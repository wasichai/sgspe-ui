import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeAtencion, CONSULTA, EQUIPO_DE_QUEJAS, GESTORA_DE_QUEJAS, SOLICITUD } from '../../test/atencion'
import { DEF_COMPROMISO, WF_COMPROMISO } from '../../test/compromisos'
import { definicion, montar, pagina, registro, ubicacion } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { FichaConsultaPage, FichaSolicitudPage } from './FichaConsultaPage'

vi.mock('../documentos/exif', () => ({ leerExif: async () => ({}) }))

// S57 (screens.md §8, WF-E2 y WF-E3): la consulta con su plazo de respuesta, «Escribir la respuesta» antes de «Responder» y la carta
// firmada; la solicitud sin plazo, «Aceptar y crear el compromiso» solo en evaluación y con la transición del rol, con la respuesta,
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

  it('dice el plazo de respuesta, ofrece escribir la respuesta, «Responder», reclasificar y la carta firmada', async () => {
    fetch = mockFetch([
      { path: '/objects/inquiry/records/i1', body: CONSULTA },
      transiciones('inquiry', 'i1', [
        ['answer', 'Responder'],
        ['refer', 'Derivar'],
        ['close_reclassified', 'Cerrar por reclasificación']
      ]),
      ...comunes('inquiry', 'i1')
    ])
    abrir()
    expect(await screen.findByRole('heading', { name: 'Consulta C-001', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Respuesta hasta el 17 oct/)).toBeInTheDocument()
    expect(screen.getByText(/Responder pide la respuesta y cuándo se comunicó/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Responder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Derivar' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Reclasificar…' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Escribir la respuesta' }))
    expect(await screen.findByRole('dialog', { name: 'Responder la consulta' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('tab', { name: 'Evidencias' }))
    expect(await screen.findByRole('button', { name: 'Subir carta firmada' })).toBeInTheDocument()
  })

  it('una consulta que no existe o que la cuenta no lee lo dice sin delatar cuál', async () => {
    fetch = mockFetch([{ path: '/objects/inquiry/records/i1', status: 404, body: { title: 'Not Found', status: 404 } }, ...comunes('inquiry', 'i1')])
    abrir()
    expect(await screen.findByText('Esta consulta no existe o es confidencial y su cuenta no la lee.')).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: 'Solicitud S-001', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Las solicitudes no tienen plazo de respuesta.')).toBeInTheDocument()
    expect(screen.getByText('Calaminas para el local comunal')).toBeInTheDocument()
    // accept no es un botón de transición: tiene su diálogo
    expect(await screen.findByRole('button', { name: 'Declinar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar y crear el compromiso' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la solicitud' })
    expect(within(dialogo).getByLabelText('Respuesta comunicada (hora de Lima)')).toHaveValue('2026-10-09T21:30')
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
