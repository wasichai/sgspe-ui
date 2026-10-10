import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeAtencion, DEF_QUEJA, EQUIPO_DE_QUEJAS, GESTORA_DE_QUEJAS, QUEJA, sinPersona } from '../../test/atencion'
import { WF_COMPROMISO } from '../../test/compromisos'
import { definicion, montar, pagina, registro, workflow } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import type { Registro } from '../datos/registros'
import { FichaQuejaPage } from './FichaQuejaPage'

vi.mock('../documentos/exif', () => ({ leerExif: async () => ({}) }))

// S36 (screens.md §8, WF-E1): el encabezado con el estado, la severidad y el plazo que corre; «Resolver» de una queja grave sale
// bloqueada con su razón y la nota dice que la resuelve quien aprueba; la confidencial dice quién la lee; la persona solo para quien
// la lee; la reclasificación, el compromiso desde la queja y el cargo firmado; de dónde viene, con «Registro reservado» para una
// QCS que la cuenta no lee; y la edición con motivo e If-Match
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const transiciones = (lista: [string, string][]) => ({
  path: '/objects/grievance/records/g1/transitions',
  body: lista.map(([name, label]) => ({ name, label, to: 'resolved', toLabel: 'Resuelta', allowed: true, reason: null }))
})

const rutas = (queja: Registro = QUEJA, extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeAtencion(),
  { path: '/objects/grievance/records/g1', body: queja },
  transiciones([
    ['resolve', 'Resolver'],
    ['withdraw_in_action', 'Registrar desistimiento']
  ]),
  {
    method: 'POST',
    path: '/sgspe/transition-checks',
    body: {
      allowed: false,
      blocking: [{ code: 'SENIOR_APPROVAL_REQUIRED', message: 'Una queja ALTA la resuelve quien aprueba', field: 'record' }],
      warnings: []
    }
  },
  { path: '/objects/stakeholder/records/s1', body: registro('s1', { project: 'p1', organization: 'o1' }) },
  { path: '/objects/organization/records/o1', body: registro('o1', { name: 'Junta de regantes' }) },
  { path: '/objects/commitment/records', body: pagina([]) },
  { path: '/objects/commitment/workflow', body: WF_COMPROMISO },
  { path: '/objects/grievance/records/g1/related/evidence_grievance', body: pagina([]) },
  { path: '/objects/grievance/records/g1/history', body: [] },
  { path: '/metadata/objects/evidence', body: definicion('evidence', [['evidence_type', { type: 'ENUM', enumOptions: ['FORMULARIO', 'CARTA'] }]]) }
]

const abrir = (permisosDeCuenta = EQUIPO_DE_QUEJAS) =>
  montar(<FichaQuejaPage />, {
    ruta: '/projects/p1/grievances/g1',
    camino: '/projects/:projectId/grievances/:grievanceId',
    usuario: GESTORA_DE_QUEJAS,
    permisos: permisosDeCuenta
  })

describe('S36 · ficha de queja', () => {
  it('dice el estado, la severidad y el plazo de resolución; «Resolver» de una grave sale bloqueada con su razón', async () => {
    fetch = mockFetch(rutas())
    abrir()
    expect(await screen.findByRole('heading', { name: 'Queja Q-001', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Severidad ALTA')).toBeInTheDocument()
    expect(screen.getByLabelText('Situación de plazo: AL DIA')).toBeInTheDocument()
    expect(screen.getByText(/Resolución hasta el 31 oct/)).toBeInTheDocument()
    const resolver = await screen.findByRole('button', { name: 'Resolver' })
    await waitFor(() => expect(resolver).toBeDisabled())
    expect(resolver).toHaveAccessibleDescription('Una queja ALTA la resuelve quien aprueba')
    expect(await screen.findByText(/Es una queja ALTA: la resuelve quien aprueba/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar desistimiento' })).toBeEnabled()
  })

  it('una confidencial dice quién la lee; la persona restringida es «Restringido» y el grupo de interés se nombra', async () => {
    fetch = mockFetch(
      rutas({ ...QUEJA, attributes: { ...QUEJA.attributes, confidential: true } }, [{ path: '/metadata/objects/grievance', body: sinPersona(DEF_QUEJA) }])
    )
    abrir()
    expect(await screen.findByText('Confidencial')).toBeInTheDocument()
    expect(screen.getByText(/Solo la leen la gestión de quejas, su responsable, quien la recibió/)).toBeInTheDocument()
    expect(screen.getByText('Restringido')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Junta de regantes' })).toHaveAttribute('href', '/projects/p1/stakeholders/s1')
  })

  it('una queja que no existe o que la cuenta no lee lo dice sin delatar cuál, sin reintento', async () => {
    fetch = mockFetch(rutas(QUEJA, [{ path: '/objects/grievance/records/g1', status: 404, body: { title: 'Not Found', status: 404 } }]))
    abrir()
    expect(await screen.findByText('Esta queja no existe o es confidencial y su cuenta no la lee.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('ofrece reclasificar cuando el estado lo permite, el compromiso desde la queja y el cargo firmado', async () => {
    const recibida = { ...QUEJA, state: 'received' }
    fetch = mockFetch(
      rutas(recibida, [
        transiciones([
          ['acknowledge', 'Acusar recibo'],
          ['close_reclassified_received', 'Cerrar por reclasificación']
        ])
      ])
    )
    abrir({ ...EQUIPO_DE_QUEJAS, objects: { ...EQUIPO_DE_QUEJAS.objects, commitment: ['READ', 'CREATE'] } })
    expect(await screen.findByRole('button', { name: 'Reclasificar…' })).toBeInTheDocument()
    // la reclasificación es de comando: nunca un botón de transición
    expect(screen.queryByRole('button', { name: 'Cerrar por reclasificación' })).not.toBeInTheDocument()
    expect(screen.getByText(/Acuse hasta el 8 oct/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crear compromiso desde esta queja' })).toHaveAttribute('href', '/projects/p1/commitments/new?origin_grievance=g1')
    await userEvent.click(screen.getByRole('button', { name: 'Reclasificar…' }))
    expect(await screen.findByRole('dialog', { name: 'Reclasificar' })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Evidencias' }))
    expect(await screen.findByRole('button', { name: 'Subir cargo firmado' })).toBeInTheDocument()
    expect(screen.getByText(/El cargo de queja no se emite en el sistema/)).toBeInTheDocument()
  })

  it('de dónde viene: la interacción de origen y «Registro reservado» para la consulta confidencial de la que se reclasificó', async () => {
    const reclasificada = { ...QUEJA, attributes: { ...QUEJA.attributes, origin_engagement: 'e1', reclassified_from_inquiry: 'i9' } }
    fetch = mockFetch(
      rutas(reclasificada, [
        { path: '/objects/engagement/records/e1', body: registro('e1', { project: 'p1', title: 'Asamblea de agosto' }) },
        { path: '/objects/inquiry/records/i9', status: 404, body: { title: 'Not Found', status: 404 } },
        {
          path: '/objects/commitment/records',
          body: pagina([registro('c7', { project: 'p1', code: 'COM-7', title: 'Limpieza del canal' }, { state: 'draft' })])
        }
      ])
    )
    // un vínculo que carga o falla dibuja bloques: ningún <p> puede envolverlo (aviso de React «cannot be a descendant of <p>»)
    const avisos = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    abrir()
    const deDonde = await screen.findByRole('region', { name: 'De dónde viene' })
    expect(await within(deDonde).findByRole('link', { name: 'Asamblea de agosto' })).toHaveAttribute('href', '/projects/p1/engagements/e1')
    expect(await within(deDonde).findByText('Registro reservado')).toBeInTheDocument()
    const genero = screen.getByRole('region', { name: 'Qué alimenta y qué generó' })
    expect(await within(genero).findByRole('link', { name: 'COM-7 · Limpieza del canal' })).toHaveAttribute('href', '/projects/p1/commitments/c7')
    const anidados = avisos.mock.calls.filter((llamada) => /cannot be a descendant of <p>|cannot contain a nested/.test(llamada.join(' ')))
    avisos.mockRestore()
    expect(anidados).toEqual([])
  })

  it('editar manda el cambio con el motivo y la versión leída', async () => {
    // una definición mínima: la prueba es del motivo y la versión, no de los controles de wasichai. el GET trae la resolución vacía:
    // una clave que el GET no trae es un campo restringido y no viaja
    const queja = { ...QUEJA, attributes: { ...QUEJA.attributes, resolution: null } }
    fetch = mockFetch(
      rutas(queja, [
        { path: '/metadata/objects/grievance', body: definicion('grievance', [['resolution', { type: 'LONG_TEXT' }], 'response']) },
        { method: 'PUT', path: '/objects/grievance/records/g1', body: queja }
      ])
    )
    red = espiarRed()
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const drawer = await screen.findByRole('dialog', { name: 'Editar el caso' })
    await userEvent.type(within(drawer).getByLabelText('Motivo del cambio (obligatorio)'), 'severidad revisada')
    await userEvent.type(await within(drawer).findByLabelText(/^resolution/), 'Se limpió el canal')
    await userEvent.click(await within(drawer).findByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('PUT', '/objects/grievance/records/g1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/grievance/records/g1')
    expect(cambio.cabeceras.get('If-Match')).toBe(`"${QUEJA.updatedAt}"`)
    expect(cambio.cabeceras.get('X-Change-Reason')).toBe("UTF-8''severidad%20revisada")
    expect(cambio.cuerpo).toMatchObject({ attributes: { resolution: 'Se limpió el canal' } })
  })

  // plan 4.2a: reclassified_from_* lo escribe solo la reclasificación (403 COMMAND_ONLY al fijarlo, cambiarlo o vaciarlo, también con
  // un PUT que lo omite): la edición genérica lo devuelve tal como se leyó, con el vacío como vacío
  const RECLASIFICADA_DE = '7d3c6a52-1b2e-4f00-9a00-000000000001'
  const reclasificada = {
    ...QUEJA,
    attributes: { ...QUEJA.attributes, resolution: null, reclassified_from_inquiry: RECLASIFICADA_DE, reclassified_from_request: null }
  }
  const definicionReclasificada = definicion('grievance', [
    ['resolution', { type: 'LONG_TEXT' }],
    'response',
    ['reclassified_from_inquiry', { type: 'RELATION', relationTarget: 'inquiry' }],
    ['reclassified_from_request', { type: 'RELATION', relationTarget: 'stakeholder_request' }]
  ])
  const editarReclasificada = async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const drawer = await screen.findByRole('dialog', { name: 'Editar el caso' })
    await userEvent.type(within(drawer).getByLabelText('Motivo del cambio (obligatorio)'), 'resolución escrita')
    await userEvent.type(await within(drawer).findByLabelText(/^resolution/), 'Se limpió el canal')
    await userEvent.click(await within(drawer).findByRole('button', { name: /guardar|save/i }))
    return drawer
  }

  it('editar una queja reclasificada devuelve su vínculo de reclasificación tal como se leyó', async () => {
    fetch = mockFetch(
      rutas(reclasificada, [
        { path: '/metadata/objects/grievance', body: definicionReclasificada },
        { method: 'PUT', path: '/objects/grievance/records/g1', body: reclasificada }
      ])
    )
    red = espiarRed()
    await editarReclasificada()
    await waitFor(() => expect(red!.a('PUT', '/objects/grievance/records/g1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/grievance/records/g1')
    expect(cambio.cuerpo).toEqual({
      attributes: { resolution: 'Se limpió el canal', reclassified_from_inquiry: RECLASIFICADA_DE, reclassified_from_request: null }
    })
  })

  it('un 403 COMMAND_ONLY sobre el vínculo de reclasificación se dice con su texto, nunca con el código', async () => {
    fetch = mockFetch(rutas(reclasificada, [{ path: '/metadata/objects/grievance', body: definicionReclasificada }]))
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/grievance/records/g1',
        responder: () => problema(403, 'solo comando', [{ field: 'reclassified_from_inquiry', message: 'COMMAND_ONLY' }])
      }
    ])
    const drawer = await editarReclasificada()
    expect(
      await within(drawer).findByText(
        'El vínculo con la QCS reclasificada o con el compromiso creado lo escriben solo la reclasificación y la aceptación: recargue y vuelva a guardar sin cambiarlo.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('COMMAND_ONLY')).not.toBeInTheDocument()
  })

  it('quien solo lee no edita ni reclasifica', async () => {
    fetch = mockFetch(rutas(QUEJA, [{ path: '/objects/grievance/workflow', body: workflow('grievance', [['in_action', 'En atención']]) }]))
    abrir(permisos({ project: ['READ'], project_assignment: ['READ'], grievance: ['READ'], stakeholder: ['READ'], commitment: ['READ'] }))
    expect(await screen.findByRole('heading', { name: 'Queja Q-001', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Crear compromiso desde esta queja' })).not.toBeInTheDocument()
  })
})

// marcar confidencial una queja ya registrada (decisión del usuario del 2026-10-10, D-3; security.md §9.6): solo su receptor,
// su responsable guardados o quien lee todas las confidenciales; la marca se confirma con lo que implica y el 403 se dice con texto
describe('S36 · marcar confidencial al editar', () => {
  const COLEGA: AuthUser = { id: 'u-otro', email: 'otro@sgspe.test', displayName: 'Colega de prueba', organizationId: 'o1', roles: ['GRIEVANCE_MANAGER'] }
  const sinLeerConfidenciales = permisos({
    project: ['READ'],
    project_assignment: ['READ'],
    grievance: ['READ', 'CREATE', 'UPDATE'],
    stakeholder: ['READ'],
    commitment: ['READ']
  })
  const abrirComo = (usuario: AuthUser, permisosDeCuenta = sinLeerConfidenciales) =>
    montar(<FichaQuejaPage />, {
      ruta: '/projects/p1/grievances/g1',
      camino: '/projects/:projectId/grievances/:grievanceId',
      usuario,
      permisos: permisosDeCuenta
    })
  const editar = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    return screen.findByRole('dialog', { name: 'Editar el caso' })
  }

  it('quien la recibió la marca tras confirmar lo que implica, con motivo e If-Match y los datos leídos', async () => {
    fetch = mockFetch([
      ...rutas(QUEJA, baseDeAtencion(RELACIONISTA)),
      { method: 'PUT', path: '/objects/grievance/records/g1', body: { ...QUEJA, attributes: { ...QUEJA.attributes, confidential: true } } }
    ])
    red = espiarRed()
    abrirComo(RELACIONISTA)
    const drawer = await editar()
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Marcar como confidencial…' }))
    const confirmacion = await screen.findByRole('dialog', { name: '¿Marcar la queja como confidencial?' })
    expect(within(confirmacion).getByText(/Sus colegas sin acceso dejarán de verla/)).toBeInTheDocument()
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Marcar como confidencial' }))
    expect(within(confirmacion).getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('PUT', '/objects/grievance/records/g1')).toHaveLength(0)
    await userEvent.type(within(confirmacion).getByLabelText('Motivo del cambio (obligatorio)'), 'datos sensibles del reclamante')
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Marcar como confidencial' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/grievance/records/g1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/grievance/records/g1')
    expect(cambio.cabeceras.get('If-Match')).toBe(`"${QUEJA.updatedAt}"`)
    expect(cambio.cabeceras.get('X-Change-Reason')).toBe("UTF-8''datos%20sensibles%20del%20reclamante")
    expect(cambio.cuerpo).toMatchObject({ attributes: { confidential: true, category: 'AGUA Y MEDIO AMBIENTE' } })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '¿Marcar la queja como confidencial?' })).not.toBeInTheDocument())
  })

  it('su responsable y quien lee todas las confidenciales también la marcan; un colega sin esa relación ni ese permiso, no', async () => {
    fetch = mockFetch(rutas(QUEJA, baseDeAtencion(COLEGA)))
    const vista = abrirComo(COLEGA)
    const drawer = await editar()
    expect(await within(drawer).findByLabelText(/^description/)).toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Marcar como confidencial…' })).not.toBeInTheDocument()
    vista.unmount()
    fetch.restore()
    fetch = mockFetch(rutas(QUEJA, baseDeAtencion(COLEGA)))
    const conPermiso = abrirComo(COLEGA, EQUIPO_DE_QUEJAS)
    expect(await within(await editar()).findByRole('button', { name: 'Marcar como confidencial…' })).toBeInTheDocument()
    conPermiso.unmount()
    fetch.restore()
    fetch = mockFetch(rutas(QUEJA))
    abrirComo(GESTORA_DE_QUEJAS)
    expect(await within(await editar()).findByRole('button', { name: 'Marcar como confidencial…' })).toBeInTheDocument()
  })

  it('una queja ya confidencial no ofrece marcarla', async () => {
    fetch = mockFetch(rutas({ ...QUEJA, attributes: { ...QUEJA.attributes, confidential: true } }, baseDeAtencion(RELACIONISTA)))
    abrirComo(RELACIONISTA)
    const drawer = await editar()
    expect(await within(drawer).findByLabelText(/^description/)).toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Marcar como confidencial…' })).not.toBeInTheDocument()
  })

  it('el 403 de quien no puede marcarla se dice con su texto, nunca con el código', async () => {
    fetch = mockFetch(rutas(QUEJA, baseDeAtencion(RELACIONISTA)))
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/grievance/records/g1',
        responder: () => problema(403, 'marca', [{ field: 'confidential', message: 'CONFIDENTIAL_MARK_FORBIDDEN' }])
      }
    ])
    abrirComo(RELACIONISTA)
    const drawer = await editar()
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Marcar como confidencial…' }))
    const confirmacion = await screen.findByRole('dialog', { name: '¿Marcar la queja como confidencial?' })
    await userEvent.type(within(confirmacion).getByLabelText('Motivo del cambio (obligatorio)'), 'datos sensibles')
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Marcar como confidencial' }))
    expect(
      await within(confirmacion).findByText(
        'Solo quien la recibió, su responsable o la gestión de quejas pueden marcarla como confidencial: pídaselo a una de esas personas.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('CONFIDENTIAL_MARK_FORBIDDEN')).not.toBeInTheDocument()
  })
})
