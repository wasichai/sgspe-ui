import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeAtencion, CONSULTA, EQUIPO_DE_QUEJAS, GESTORA_DE_QUEJAS, SOLICITUD } from '../../test/atencion'
import { DEF_COMPROMISO, WF_COMPROMISO } from '../../test/compromisos'
import { APORTE, DEF_APORTE, EMPRESA, EQUIPO_DE_INVERSION, INVERSION } from '../../test/inversion'
import { definicion, montar, pagina, registro, ubicacion } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { FichaConsultaPage, FichaSolicitudPage } from './FichaConsultaPage'
import { abrirCamino, estadosDeLaFicha } from '../../test/fichas'

vi.mock('../documentos/exif', () => ({ leerExif: async () => ({}) }))

// S57 (screens.md §8, WF-E2 y WF-E3): la consulta con su plazo de respuesta, «Responder» que pide la respuesta en su diálogo y la
// carta firmada; la solicitud sin plazo, «Aceptar y crear el compromiso» solo en evaluación y con la transición del rol, con la respuesta,
// la hora de Lima, el compromiso que nace y el motivo; sus errores con su texto y un 412 con «Recargar»
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const transiciones = (objeto: string, id: string, lista: [string, string][]) => ({
  path: `/objects/${objeto}/records/${id}/transitions`,
  body: lista.map(([name, label]) => ({ name, label, to: 'x', toLabel: 'Siguiente', allowed: true, reason: null }))
})

const comunes = (objeto: string, id: string): MockRoute[] => [
  ...baseDeAtencion(),
  { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } },
  { path: `/objects/${objeto}/records/${id}/related/evidence_${objeto}`, body: pagina([]) },
  { path: `/objects/${objeto}/records/${id}/history`, body: [] },
  { path: '/metadata/objects/evidence', body: definicion('evidence', [['evidence_type', { type: 'ENUM', enumOptions: ['CARTA'] }]]) },
  { path: '/metadata/objects/commitment', body: DEF_COMPROMISO },
  { path: '/objects/commitment/workflow', body: WF_COMPROMISO }
]

describe('S57 · ficha de consulta', () => {
  const abrir = () =>
    montar(<FichaConsultaPage />, {
      ruta: '/projects/p1/inquiries/i1',
      camino: '/projects/:projectId/inquiries/:inquiryId',
      usuario: GESTORA_DE_QUEJAS,
      permisos: EQUIPO_DE_QUEJAS
    })

  // tercera pasada de UX (1.2): «Responder» pide la respuesta y cuándo se comunicó en su diálogo, con un solo motivo; ya no hay
  // «Escribir la respuesta» antes, con el suyo
  it('dice el plazo de respuesta; «Responder» pide la respuesta en su diálogo; reclasificar y la carta firmada', async () => {
    fetch = mockFetch([
      {
        method: 'POST',
        path: '/sgspe/transition-checks',
        body: {
          allowed: false,
          blocking: [
            { code: 'FIELD_REQUIRED', message: 'La transición answer exige response', field: 'response' },
            { code: 'FIELD_REQUIRED', message: 'La transición answer exige responded_at', field: 'responded_at' }
          ],
          warnings: []
        }
      },
      { path: '/objects/inquiry/records/i1', body: CONSULTA },
      transiciones('inquiry', 'i1', [
        ['answer', 'Responder'],
        ['refer', 'Derivar'],
        ['close_reclassified', 'Cerrar por reclasificación']
      ]),
      ...comunes('inquiry', 'i1')
    ])
    abrir()
    // el título dice lo que se planteó (U-27 del rediseño)
    expect(await screen.findByRole('heading', { name: '¿Cuándo empieza la perforación en el sector norte?', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Respuesta hasta el 17 oct/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Escribir la respuesta' })).not.toBeInTheDocument()
    // el panel dice lo que el paso pedirá, sin presentarlo como una falta
    const siguiente = screen.getByRole('group', { name: 'Siguiente acción' })
    expect(await within(siguiente).findByText('Al darla se le pedirán «response» y «responded_at».')).toBeInTheDocument()
    // con «Editar» y «Reclasificar…» a la vista, derivar va en «Más acciones» (CabeceraDeFicha)
    expect(await screen.findByRole('button', { name: 'Reclasificar…' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
    expect(within(screen.getByRole('group', { name: 'Más acciones' })).getByRole('button', { name: 'Derivar' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Responder' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Responder' })
    expect(await within(dialogo).findByLabelText('response (obligatorio)')).toBeInTheDocument()
    expect(within(dialogo).getByText('Se guardan «response» y «responded_at» con el mismo motivo.')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('tab', { name: 'Evidencias' }))
    expect(await screen.findByRole('button', { name: 'Subir carta firmada' })).toBeInTheDocument()
  })

  // revisión de UX, etapa 4: la anatomía común (camino del flujo, panel de decisión y los tres grupos de trazabilidad)
  it('dice el camino del flujo, el panel de decisión y los tres grupos de trazabilidad', async () => {
    fetch = mockFetch([
      { path: '/objects/inquiry/records/i1', body: CONSULTA },
      transiciones('inquiry', 'i1', [['answer', 'Responder']]),
      ...comunes('inquiry', 'i1')
    ])
    abrir()
    const camino = await abrirCamino()
    expect(estadosDeLaFicha()).toHaveLength(1)
    expect(within(camino).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('region', { name: 'Situación' })).toBeInTheDocument()
    const panel = screen.getByRole('complementary', { name: 'Trazabilidad' })
    expect(
      within(panel)
        .getAllByRole('region')
        .map((r) => r.getAttribute('aria-label'))
    ).toEqual(['De dónde viene', 'Qué generó', 'Lo sustenta'])
  })

  it('una consulta que no existe o que la cuenta no lee lo dice sin delatar cuál', async () => {
    fetch = mockFetch([{ path: '/objects/inquiry/records/i1', status: 404, body: { title: 'Not Found', status: 404 } }, ...comunes('inquiry', 'i1')])
    abrir()
    expect(await screen.findByText('Esta consulta no existe, no es de sus proyectos o es confidencial y su cuenta no la lee.')).toBeInTheDocument()
  })
})

describe('S57 · ficha de solicitud', () => {
  const COMPROMISO = registro('c9', { project: 'p1', code: 'COM-010' }, { state: 'draft' })
  const abrir = () =>
    montar(<FichaSolicitudPage />, {
      ruta: '/projects/p1/requests/r1',
      camino: '/projects/:projectId/requests/:requestId',
      usuario: GESTORA_DE_QUEJAS,
      permisos: { ...EQUIPO_DE_QUEJAS, objects: { ...EQUIPO_DE_QUEJAS.objects, commitment: ['READ', 'CREATE'] } }
    })
  const rutas = (extra: MockRoute[] = []): MockRoute[] => [
    ...extra,
    { path: '/objects/stakeholder_request/records/r1', body: SOLICITUD },
    transiciones('stakeholder_request', 'r1', [
      ['accept', 'Aceptar'],
      ['decline', 'Declinar']
    ]),
    ...comunes('stakeholder_request', 'r1')
  ]

  it('sin plazo, dice qué se pide; aceptar es de comando y manda la respuesta, la hora de Lima, el compromiso y el motivo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T02:30:00Z'))
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholder-requests/r1/accept',
        responder: () => new Response(JSON.stringify({ request: { ...SOLICITUD, state: 'accepted' }, commitment: COMPROMISO }), { status: 201 })
      }
    ])
    abrir()
    expect(await screen.findByRole('heading', { name: 'La comunidad pide apoyo para el techo del local comunal', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Las solicitudes no tienen plazo de respuesta.')).toBeInTheDocument()
    expect(screen.getByText('Calaminas para el local comunal')).toBeInTheDocument()
    // accept no es un botón de transición: tiene su diálogo
    expect(await screen.findByRole('button', { name: 'Declinar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar y crear el compromiso' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la solicitud' })
    // hallazgo U-07 (DD-07): la hora de Lima propuesta se muestra como dd/mm/aaaa y HH:mm de 24 h
    expect(within(dialogo).getByLabelText('Respuesta comunicada (hora de Lima)')).toHaveValue('09/10/2026')
    expect(within(dialogo).getByLabelText('Respuesta comunicada (hora de Lima) (hora)')).toHaveValue('21:30')
    expect(within(dialogo).getByLabelText('Título del compromiso')).toHaveValue('Calaminas para el local comunal')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    expect(within(dialogo).getAllByText('Este dato es obligatorio').length).toBeGreaterThanOrEqual(3)
    expect(red.a('POST', '/sgspe/stakeholder-requests/r1/accept')).toHaveLength(0)
    await userEvent.type(within(dialogo).getByLabelText('Respuesta a la solicitud'), 'Se entregarán 40 calaminas')
    await userEvent.type(within(dialogo).getByLabelText('Código del compromiso'), 'COM-010')
    await userEvent.type(within(dialogo).getByLabelText('Monto'), '1,200.50')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Moneda'), 'USD')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'aprobada en comité')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments/c9'))
    const [aceptar] = red.a('POST', '/sgspe/stakeholder-requests/r1/accept')
    expect(aceptar.cuerpo).toEqual({
      creates: 'commitment',
      response: 'Se entregarán 40 calaminas',
      respondedAt: '2026-10-10T02:30:00.000Z',
      attributes: { code: 'COM-010', title: 'Calaminas para el local comunal', amount: '1200.50', currency: 'USD' }
    })
    expect(aceptar.cabeceras.get('If-Match')).toBe(`"${SOLICITUD.updatedAt}"`)
    expect(aceptar.cabeceras.get('X-Change-Reason')).toBe("UTF-8''aprobada%20en%20comit%C3%A9")
    expect(aceptar.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  // hallazgo U-07 (DD-07): la respuesta se escribe como 20/10/2026 y 10:15 y viaja como el instante de esa hora de Lima
  it('la hora de la respuesta escrita como 20/10/2026 y 10:15 viaja como el instante de Lima', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholder-requests/r1/accept',
        responder: () => new Response(JSON.stringify({ request: { ...SOLICITUD, state: 'accepted' }, commitment: COMPROMISO }), { status: 201 })
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar y crear el compromiso' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la solicitud' })
    const dia = within(dialogo).getByLabelText('Respuesta comunicada (hora de Lima)')
    const hora = within(dialogo).getByLabelText('Respuesta comunicada (hora de Lima) (hora)')
    await userEvent.clear(dia)
    await userEvent.type(dia, '20/10/2026')
    await userEvent.clear(hora)
    await userEvent.type(hora, '10:15')
    await userEvent.type(within(dialogo).getByLabelText('Respuesta a la solicitud'), 'Sí')
    await userEvent.type(within(dialogo).getByLabelText('Código del compromiso'), 'COM-010')
    await userEvent.type(within(dialogo).getByLabelText('Monto'), '100')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'comité')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/stakeholder-requests/r1/accept')).toHaveLength(1))
    expect(red.a('POST', '/sgspe/stakeholder-requests/r1/accept')[0].cuerpo).toMatchObject({ respondedAt: '2026-10-20T15:15:00.000Z' })
  })

  // plan 4.2a: un respondedAt mal formado es un 400 sobre respondedAt (con el texto libre de la validación): se dice junto a su
  // control, con el texto del portal, y un dato del compromiso que el servidor rechaza, junto al suyo
  it('un 400 sobre respondedAt o sobre un dato del compromiso se dice junto a su control', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholder-requests/r1/accept',
        responder: () =>
          problema(400, 'datos inválidos', [
            { field: 'respondedAt', message: 'Invalid date-time value' },
            { field: 'code', message: 'Ya existe un compromiso con ese código' }
          ])
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar y crear el compromiso' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la solicitud' })
    await userEvent.type(within(dialogo).getByLabelText('Respuesta a la solicitud'), 'Sí')
    await userEvent.type(within(dialogo).getByLabelText('Código del compromiso'), 'COM-010')
    await userEvent.type(within(dialogo).getByLabelText('Monto'), '100')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'comité')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    const fecha = within(dialogo).getByLabelText('Respuesta comunicada (hora de Lima)')
    await waitFor(() => expect(fecha).toHaveAccessibleDescription('La fecha y hora de la respuesta no es válida: corríjala.'))
    expect(within(dialogo).getByLabelText('Código del compromiso')).toHaveAccessibleDescription('Ya existe un compromiso con ese código')
    expect(within(dialogo).queryByText('Invalid date-time value')).not.toBeInTheDocument()
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('otra persona ya la decidió: STATE_MISMATCH dice su texto en el diálogo', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholder-requests/r1/accept',
        responder: () => problema(409, 'ya decidida', [{ field: 'record', message: 'STATE_MISMATCH' }])
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar y crear el compromiso' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la solicitud' })
    await userEvent.type(within(dialogo).getByLabelText('Respuesta a la solicitud'), 'Sí')
    await userEvent.type(within(dialogo).getByLabelText('Código del compromiso'), 'COM-010')
    await userEvent.type(within(dialogo).getByLabelText('Monto'), '100')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'comité')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    expect(await within(dialogo).findByText(/El registro ya no está en el estado de partida/)).toBeInTheDocument()
  })

  it('fuera de evaluación, o sin crear compromisos, no se ofrece aceptar; una aceptada enlaza su compromiso', async () => {
    fetch = mockFetch(
      rutas([
        {
          path: '/objects/stakeholder_request/records/r1',
          body: { ...SOLICITUD, state: 'accepted', attributes: { ...SOLICITUD.attributes, created_commitment: 'c9' } }
        },
        transiciones('stakeholder_request', 'r1', [['close_unfulfilled', 'Cerrar sin ejecución']]),
        { path: '/objects/commitment/records/c9', body: { ...COMPROMISO, attributes: { ...COMPROMISO.attributes, title: 'Calaminas' } } }
      ])
    )
    abrir()
    expect(await screen.findByRole('link', { name: 'COM-010 · Calaminas' })).toHaveAttribute('href', '/projects/p1/commitments/c9')
    expect(await screen.findByRole('button', { name: 'Cerrar sin ejecución' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar y crear el compromiso' })).not.toBeInTheDocument()
  })
})

// P-09 del rediseño de UX (DD-02 y DD-06; U-02, U-03, U-25, U-26 y U-27): el título dice lo que se planteó; el estado, una sola
// vez, en el panel de decisión; una sola primaria (la siguiente acción del flujo o, sin ella, la acción propia de la ficha), dos
// secundarias a la vista y lo demás en «Más acciones»; los datos del caso por tema, con los vacíos plegados
describe('S57 · cabecera y cuerpo de la ficha (P-09)', () => {
  it('consulta: «Responder» es la única primaria y «Editar» y «Derivar» la acompañan como secundarias', async () => {
    fetch = mockFetch([
      { path: '/objects/inquiry/records/i1', body: CONSULTA },
      transiciones('inquiry', 'i1', [
        ['refer', 'Derivar'],
        ['answer', 'Responder']
      ]),
      ...comunes('inquiry', 'i1')
    ])
    montar(<FichaConsultaPage />, {
      ruta: '/projects/p1/inquiries/i1',
      camino: '/projects/:projectId/inquiries/:inquiryId',
      usuario: GESTORA_DE_QUEJAS,
      permisos: EQUIPO_DE_QUEJAS
    })
    const titulo = await screen.findByRole('heading', { name: '¿Cuándo empieza la perforación en el sector norte?', level: 1 })
    expect(within(titulo.parentElement!).getByText(/^Consulta · C-001/)).not.toHaveClass('font-sg-mono')
    const acciones = await screen.findByRole('group', { name: 'Acciones del registro' })
    expect(await within(acciones).findByRole('button', { name: 'Responder' })).toHaveAttribute('data-variant', 'primary')
    expect(within(acciones).getByRole('button', { name: 'Editar' })).toHaveAttribute('data-variant', 'secondary')
    // sin «Escribir la respuesta» (tercera pasada de UX, 1.2), «Derivar» cabe a la vista
    expect(await within(acciones).findByRole('button', { name: 'Derivar' })).toHaveAttribute('data-variant', 'secondary')
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(1)
    expect(await screen.findAllByText('Recibida', { selector: '[data-estado]' })).toHaveLength(1)
    const atencion = screen.getByRole('region', { name: 'Atención y respuesta' })
    expect(within(atencion).getByRole('button', { name: /^Mostrar (el campo|los \d+ campos) sin dato$/ })).toBeInTheDocument()
  })

  it('solicitud: sin transición del camino, «Aceptar y crear el compromiso» es la primaria; qué se pide va en lo que se plantea', async () => {
    fetch = mockFetch([
      { path: '/objects/stakeholder_request/records/r1', body: SOLICITUD },
      transiciones('stakeholder_request', 'r1', [
        ['accept', 'Aceptar'],
        ['decline', 'Declinar']
      ]),
      ...comunes('stakeholder_request', 'r1')
    ])
    montar(<FichaSolicitudPage />, {
      ruta: '/projects/p1/requests/r1',
      camino: '/projects/:projectId/requests/:requestId',
      usuario: GESTORA_DE_QUEJAS,
      permisos: { ...EQUIPO_DE_QUEJAS, objects: { ...EQUIPO_DE_QUEJAS.objects, commitment: ['READ', 'CREATE'] } }
    })
    expect(await screen.findByRole('heading', { name: 'La comunidad pide apoyo para el techo del local comunal', level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Aceptar y crear el compromiso' })).toHaveAttribute('data-variant', 'primary')
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(1)
    expect(within(screen.getByRole('region', { name: 'Qué se plantea' })).getByText('Calaminas para el local comunal')).toBeInTheDocument()
    expect(await screen.findAllByText('En evaluación', { selector: '[data-estado]' })).toHaveLength(1)
  })
})

// F5 (spec §3.7 y §2.2): aceptar una solicitud crea el compromiso o el aporte que la cuenta puede crear; con los dos, se elige. el
// aporte nace en requested con lo mínimo de su alta y sus ítems se cargan en S44
describe('S57 · aceptar como aporte', () => {
  const ACEPTADA_COMO_APORTE = registro('r1', { ...SOLICITUD.attributes, created_contribution: 'a1' }, { state: 'accepted' })
  const conAportes: CallerPermissions = {
    ...EQUIPO_DE_QUEJAS,
    objects: { ...EQUIPO_DE_QUEJAS.objects, commitment: ['READ', 'CREATE'], social_contribution: ['READ', 'CREATE'], organization: ['READ'] }
  }
  const abrir = (permisos = conAportes, usuario = GESTORA_DE_QUEJAS) =>
    montar(<FichaSolicitudPage />, { ruta: '/projects/p1/requests/r1', camino: '/projects/:projectId/requests/:requestId', usuario, permisos })
  const rutas = (extra: MockRoute[] = []): MockRoute[] => [
    ...extra,
    { path: '/objects/stakeholder_request/records/r1', body: SOLICITUD },
    transiciones('stakeholder_request', 'r1', [
      ['accept', 'Aceptar'],
      ['decline', 'Declinar']
    ]),
    { path: '/metadata/objects/social_contribution', body: DEF_APORTE },
    { path: /^\/objects\/organization\/records\?/, body: pagina([EMPRESA]) },
    ...comunes('stakeholder_request', 'r1')
  ]

  // revisión de UX, decisión 6: el código propuesto de lo que nace sigue a «¿Qué se crea?»
  it('aceptar propone el código del compromiso o del aporte, según lo que se crea', async () => {
    fetch = mockFetch(
      rutas([
        { path: /^\/sgspe\/codes\/next\?object=commitment&project=p1$/, body: { code: 'COM-2026-012' } },
        { path: /^\/sgspe\/codes\/next\?object=social_contribution&project=p1$/, body: { code: 'APO-2026-003' } }
      ])
    )
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar…' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la solicitud' })
    await waitFor(() => expect(within(dialogo).getByLabelText('Código del compromiso')).toHaveValue('COM-2026-012'))
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Un aporte social' }))
    await waitFor(() => expect(within(dialogo).getByLabelText('Código del aporte')).toHaveValue('APO-2026-003'))
  })

  it('con los dos, «Aceptar…» pregunta qué se crea; el aporte manda su propósito, condiciones, quién paga y moneda, y abre su ficha', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T02:30:00Z'))
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholder-requests/r1/accept',
        responder: () =>
          new Response(
            JSON.stringify({
              request: { ...SOLICITUD, state: 'accepted' },
              contribution: registro('a9', { project: 'p1', code: 'AP-010' }, { state: 'requested' })
            }),
            {
              status: 201
            }
          )
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar…' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la solicitud' })
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Un aporte social' }))
    expect(within(dialogo).getByLabelText('Propósito declarado')).toHaveValue('Calaminas para el local comunal')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    expect(within(dialogo).getAllByText('Este dato es obligatorio').length).toBeGreaterThanOrEqual(3)
    expect(red.a('POST', '/sgspe/stakeholder-requests/r1/accept')).toHaveLength(0)
    await userEvent.type(within(dialogo).getByLabelText('Respuesta a la solicitud'), 'Se apoyará con las calaminas')
    await userEvent.type(within(dialogo).getByLabelText('Código del aporte'), 'AP-010')
    await userEvent.type(within(dialogo).getByLabelText('Condiciones'), 'Entrega con acta firmada')
    await userEvent.type(within(dialogo).getByLabelText('Quién paga'), 'Empr')
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'Empresa Ejemplo S.A.' }))
    await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo de aporte (opcional)'), 'APOYO EN ESPECIE')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'aprobada en comité')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/contributions/a9'))
    const [aceptar] = red.a('POST', '/sgspe/stakeholder-requests/r1/accept')
    expect(aceptar.cuerpo).toEqual({
      creates: 'social_contribution',
      response: 'Se apoyará con las calaminas',
      respondedAt: '2026-10-10T02:30:00.000Z',
      attributes: {
        code: 'AP-010',
        declared_purpose: 'Calaminas para el local comunal',
        conditions: 'Entrega con acta firmada',
        currency: 'PEN',
        payer_organization: 'o3',
        contribution_type: 'APOYO EN ESPECIE'
      }
    })
    expect(aceptar.cabeceras.get('If-Match')).toBe(`"${SOLICITUD.updatedAt}"`)
    expect(aceptar.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('sin CREATE sobre los aportes solo ofrece el compromiso; quien solo crea aportes, el aporte; un tenant sin aportes no lo ofrece', async () => {
    fetch = mockFetch(rutas())
    const { unmount } = abrir({ ...EQUIPO_DE_QUEJAS, objects: { ...EQUIPO_DE_QUEJAS.objects, commitment: ['READ', 'CREATE'] } })
    expect(await screen.findByRole('button', { name: 'Aceptar y crear el compromiso' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar…' })).not.toBeInTheDocument()
    unmount()
    const soloAportes = abrir(EQUIPO_DE_INVERSION, INVERSION)
    expect(await screen.findByRole('button', { name: 'Aceptar y crear el aporte' })).toBeInTheDocument()
    soloAportes.unmount()
    fetch.restore()
    // ADMIN puede todo, pero un tenant de F4 no tiene social_contribution (404 en su definición): solo el compromiso
    fetch = mockFetch(rutas([{ path: '/metadata/objects/social_contribution', status: 404, body: { title: 'Not Found', status: 404 } }]))
    abrir({ admin: true, objects: {} })
    expect(await screen.findByRole('button', { name: 'Aceptar y crear el compromiso' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar…' })).not.toBeInTheDocument()
  })

  it('una aceptada como aporte enlaza su aporte; uno que la cuenta no lee es «Registro reservado»', async () => {
    fetch = mockFetch(
      rutas([
        { path: '/objects/stakeholder_request/records/r1', body: ACEPTADA_COMO_APORTE },
        { path: '/objects/social_contribution/records/a1', body: APORTE }
      ])
    )
    const { unmount } = abrir()
    expect(await screen.findByRole('link', { name: 'AP-001' })).toHaveAttribute('href', '/projects/p1/contributions/a1')
    unmount()
    fetch.restore()
    fetch = mockFetch(
      rutas([
        { path: '/objects/stakeholder_request/records/r1', body: ACEPTADA_COMO_APORTE },
        { path: '/objects/social_contribution/records/a1', status: 404, body: { title: 'Not Found', status: 404 } }
      ])
    )
    abrir()
    expect(await screen.findByText('Registro reservado')).toBeInTheDocument()
  })

  it('mientras no se sabe si hay aportes no ofrece aceptar; un error que no es 404 se dice y se reintenta, no quita el aporte en silencio', async () => {
    fetch = mockFetch(rutas())
    let soltar: () => void = () => {}
    red = espiarRed([
      {
        path: '/metadata/objects/social_contribution',
        responder: () => new Promise<Response>((r) => (soltar = () => r(new Response(JSON.stringify(DEF_APORTE), { status: 200 }))))
      }
    ])
    const { unmount } = abrir()
    expect(await screen.findByRole('button', { name: 'Declinar' })).toBeInTheDocument()
    await waitFor(() => expect(red?.a('GET', '/metadata/objects/social_contribution')).toHaveLength(1))
    expect(screen.queryByRole('button', { name: 'Aceptar y crear el compromiso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar…' })).not.toBeInTheDocument()
    soltar()
    expect(await screen.findByRole('button', { name: 'Aceptar…' })).toBeInTheDocument()
    unmount()
    red.restaurar()
    let veces = 0
    red = espiarRed([
      {
        path: '/metadata/objects/social_contribution',
        responder: () =>
          ++veces === 1
            ? new Response(JSON.stringify({ title: 'Internal Server Error', status: 500 }), { status: 500 })
            : new Response(JSON.stringify(DEF_APORTE), { status: 200 })
      }
    ])
    abrir()
    const aviso = await screen.findByText('No se pudo saber si su cuenta puede crear el aporte: por ahora solo se ofrece el compromiso.')
    expect(screen.getByRole('button', { name: 'Aceptar y crear el compromiso' })).toBeInTheDocument()
    await userEvent.click(within(aviso.closest('[role="status"]') as HTMLElement).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: 'Aceptar…' })).toBeInTheDocument()
    expect(screen.queryByText('No se pudo saber si su cuenta puede crear el aporte: por ahora solo se ofrece el compromiso.')).not.toBeInTheDocument()
  })

  it('el error de quién paga se asocia a su buscador', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar…' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la solicitud' })
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Un aporte social' }))
    const buscador = within(dialogo).getByRole('searchbox', { name: 'Quién paga' })
    expect(buscador).not.toHaveAttribute('aria-invalid')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    expect(buscador).toHaveAttribute('aria-invalid', 'true')
    expect(buscador).toHaveAccessibleDescription('Este dato es obligatorio')
  })

  it('con los dos, volver a «Un compromiso» manda creates commitment y solo los datos del compromiso', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T02:30:00Z'))
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholder-requests/r1/accept',
        responder: () =>
          new Response(JSON.stringify({ request: { ...SOLICITUD, state: 'accepted' }, commitment: registro('c9', { project: 'p1', code: 'COM-011' }) }), {
            status: 201
          })
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar…' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la solicitud' })
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Un aporte social' }))
    await userEvent.type(within(dialogo).getByLabelText('Código del aporte'), 'AP-011')
    await userEvent.type(within(dialogo).getByLabelText('Condiciones'), 'Entrega con acta firmada')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo de aporte (opcional)'), 'DONACION')
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Un compromiso' }))
    expect(within(dialogo).queryByLabelText('Condiciones')).not.toBeInTheDocument()
    await userEvent.type(within(dialogo).getByLabelText('Respuesta a la solicitud'), 'Se atenderá como compromiso')
    await userEvent.clear(within(dialogo).getByLabelText('Código del compromiso'))
    await userEvent.type(within(dialogo).getByLabelText('Código del compromiso'), 'COM-011')
    await userEvent.type(within(dialogo).getByLabelText('Monto'), '300')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'aprobada en comité')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments/c9'))
    const [aceptar] = red.a('POST', '/sgspe/stakeholder-requests/r1/accept')
    expect(aceptar.cuerpo).toEqual({
      creates: 'commitment',
      response: 'Se atenderá como compromiso',
      respondedAt: '2026-10-10T02:30:00.000Z',
      attributes: { code: 'COM-011', title: 'Calaminas para el local comunal', amount: '300', currency: 'PEN' }
    })
  })

  it('cambiar lo que se crea es otra acción: el envío siguiente lleva otra Idempotency-Key', async () => {
    fetch = mockFetch(rutas())
    let intentos = 0
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/stakeholder-requests/r1/accept',
        responder: () =>
          ++intentos === 1
            ? problema(503, 'caído')
            : new Response(JSON.stringify({ request: { ...SOLICITUD, state: 'accepted' }, commitment: registro('c9', { project: 'p1', code: 'COM-012' }) }), {
                status: 201
              })
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar…' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la solicitud' })
    await userEvent.type(within(dialogo).getByLabelText('Respuesta a la solicitud'), 'Se atenderá')
    await userEvent.type(within(dialogo).getByLabelText('Código del compromiso'), 'COM-012')
    await userEvent.type(within(dialogo).getByLabelText('Monto'), '300')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'aprobada en comité')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/stakeholder-requests/r1/accept')).toHaveLength(1))
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Un aporte social' }))
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Un compromiso' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar y crear' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/stakeholder-requests/r1/accept')).toHaveLength(2))
    const [primero, segundo] = red.a('POST', '/sgspe/stakeholder-requests/r1/accept').map((l) => l.cabeceras.get('Idempotency-Key'))
    expect(primero).toBeTruthy()
    expect(segundo).toBeTruthy()
    expect(segundo).not.toBe(primero)
  })
})
