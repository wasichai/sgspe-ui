import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeCompromisos, C1, EQUIPO_DE_COMPROMISOS, GESTORA, P1 } from '../../test/compromisos'
import { montar, pagina, registro, ubicacion, workflow } from '../../test/montar'
import { permisos } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { CompromisosPage, enVista } from './CompromisosPage'

// S28 (screens.md §7, flujo 7): las vistas de lo vencido, por vencer y bloqueado, el alta solo con asignación, y los candidatos
// decididos por una persona con IK, IM y CR; un código de error se dice con su texto
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const C2 = registro(
  'c2',
  { ...C1.attributes, code: 'C-002', title: 'Taller de costura', deadline_status: 'VENCIDO', owner_user_id: 'u-otro' },
  { state: 'blocked' }
)
const C3 = registro('c3', { ...C1.attributes, code: 'C-003', title: 'Becas escolares', deadline_status: 'POR VENCER' }, { state: 'approved' })
const C4 = registro('c4', { ...C1.attributes, code: 'C-004', title: 'Botiquín comunal', deadline_status: null }, { state: 'closed' })
const PROPUESTO = registro(
  'k1',
  { project: 'p1', proposed_text: 'Mejorar el camino al anexo Huallpa', ai_generated: false, suggested_due_date: '2026-12-15', engagement: 'e1' },
  { state: 'proposed', updatedAt: '2026-10-06T15:00:00Z' }
)
const RECHAZADO = registro(
  'k2',
  { project: 'p1', proposed_text: 'Pintar la escuela', ai_generated: true, confidence: 0.82, evidence_quote: '«…pintar la escuela…»' },
  { state: 'rejected' }
)

const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  { path: '/objects/commitment/records', body: pagina([C1, C2, C3, C4]) },
  { path: '/objects/commitment_candidate/records', body: pagina([PROPUESTO, RECHAZADO]) },
  {
    path: '/objects/commitment_candidate/workflow',
    body: workflow('commitment_candidate', [
      ['proposed', 'Propuesto'],
      ['rejected', 'Rechazado']
    ])
  },
  {
    path: '/objects/commitment_candidate/records/k1/transitions',
    body: [{ name: 'reject', label: 'Rechazar', to: 'rejected', toLabel: 'Rechazado', allowed: true, reason: null }]
  },
  { path: '/objects/project/records', body: pagina([P1]) },
  { path: '/sgspe/dashboards/indicators', body: [] }
]
const enProyecto = (p = EQUIPO_DE_COMPROMISOS, ruta = '/projects/p1/commitments') =>
  montar(<CompromisosPage />, { ruta, camino: '/projects/:projectId/commitments', usuario: GESTORA, permisos: p })

describe('S28 · lista de compromisos', () => {
  it('abiertos por defecto; vencidos, por vencer y bloqueados en su vista; el alta con la asignación vigente', async () => {
    fetch = mockFetch(rutas())
    enProyecto()
    const tabla = await screen.findByRole('table', { name: 'Compromisos' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(4)
    expect(within(tabla).queryByText('Botiquín comunal')).not.toBeInTheDocument()
    expect(within(tabla).getByRole('link', { name: 'Reservorio de agua para Tunas Pampa' })).toHaveAttribute('href', '/projects/p1/commitments/c1')
    // el ojo abre su vista previa sin dejar la lista (revisión de UX, etapa 6)
    expect(within(tabla).getByRole('link', { name: /^Vista previa de C-\d+ Reservorio de agua para Tunas Pampa$/ })).toHaveAttribute(
      'href',
      '/projects/p1/commitments?peek=commitment%3Ac1'
    )
    expect(within(tabla).getAllByText('S/ 25,000.00')).toHaveLength(3)
    await userEvent.click(screen.getByRole('tab', { name: 'Vencidos' }))
    expect(await within(await screen.findByRole('table', { name: 'Compromisos' })).findByText('Taller de costura')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
    await userEvent.click(screen.getByRole('tab', { name: 'Bloqueados' }))
    expect(screen.getByText('Taller de costura')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Por vencer' }))
    expect(screen.getByText('Becas escolares')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nuevo compromiso' })).toHaveAttribute('href', '/projects/p1/commitments/new')
  })

  it('«Míos» lista los abiertos de quien mira; «Cerrados y cancelados», los cerrados', () => {
    expect([C1, C2, C3, C4].filter((c) => enVista('mios', c, 'u-cmm')).map((c) => c.id)).toEqual(['c1', 'c3'])
    expect([C1, C2, C3, C4].filter((c) => enVista('cerrados', c, 'u-cmm')).map((c) => c.id)).toEqual(['c4'])
    expect(enVista('cerrados', { ...C1, state: 'cancelled' }, 'u-cmm')).toBe(true)
    expect(enVista('mios', { ...C1, state: 'cancelled' }, 'u-cmm')).toBe(false)
  })

  it('sin asignación vigente no se ofrece el alta; mientras carga no dice que no hay compromisos', async () => {
    fetch = mockFetch([...rutas().filter((r) => !(r.path instanceof RegExp)), { path: /^\/objects\/project_assignment\/records/, body: pagina([]) }])
    red = espiarRed([{ path: '/objects/commitment/records', responder: () => problema(500, 'caído') }])
    enProyecto()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('No hay compromisos en esta vista.')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Nuevo compromiso' })).not.toBeInTheDocument()
  })

  // revisión de UX, etapa 3: crear no depende del selector de proyecto
  it('en el alcance global dice el proyecto de cada compromiso y ofrece crear eligiendo el proyecto', async () => {
    fetch = mockFetch(rutas())
    montar(<CompromisosPage />, { ruta: '/commitments', camino: '/commitments', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByRole('columnheader', { name: 'Proyecto' })).toBeInTheDocument()
    expect((await screen.findAllByRole('link', { name: 'PRJ-01 · Pukaqaqa' }))[0]).toHaveAttribute('href', '/projects/p1/overview')
    expect(screen.getByRole('button', { name: 'Nuevo compromiso' })).toBeInTheDocument()
    expect(screen.queryByText(/elija su proyecto en el selector/)).not.toBeInTheDocument()
  })

  it('cada vista dice cuántos tiene, el código va junto al título y el total va en el encabezado', async () => {
    fetch = mockFetch(rutas())
    enProyecto()
    const tabla = await screen.findByRole('table', { name: 'Compromisos' })
    expect(screen.getByRole('tab', { name: 'Abiertos' })).toHaveAccessibleDescription('3 registros')
    expect(screen.getByRole('tab', { name: 'Vencidos' })).toHaveAccessibleDescription('1 registro')
    expect(screen.getByRole('tab', { name: 'Cerrados y cancelados' })).toHaveAccessibleDescription('1 registro')
    expect(screen.getByRole('tab', { name: 'Candidatos' })).not.toHaveAccessibleDescription()
    expect(screen.getByText('3 compromisos')).toBeInTheDocument()
    expect(within(tabla).getByText('C-002')).toHaveClass('font-sg-mono')
  })

  it('los filtros son chips en la URL con «Limpiar», y el vacío por filtros dice cuántos hay sin ellos', async () => {
    fetch = mockFetch(rutas())
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?q=inexistente')
    expect(await screen.findByText('Nada coincide con los filtros')).toBeInTheDocument()
    expect(screen.getByText('Sin los filtros hay 3.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar Contiene «inexistente»' })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Limpiar filtros' })[0])
    expect(ubicacion.actual).toBe('/projects/p1/commitments')
    expect(await screen.findByRole('table', { name: 'Compromisos' })).toBeInTheDocument()
  })
})

describe('S28 · candidatos', () => {
  it('lista los propuestos y los decididos; la cita que la cuenta no lee dice Restringido', async () => {
    fetch = mockFetch(rutas())
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    const region = await screen.findByRole('region', { name: 'Candidatos a compromiso' })
    expect(await within(region).findByText('Mejorar el camino al anexo Huallpa')).toBeInTheDocument()
    expect(within(region).getByText('Propuesto por la IA · confianza 82 %')).toBeInTheDocument()
    expect(within(region).getByText('Restringido')).toBeInTheDocument()
    // la cita que sí se lee se dice tal cual
    expect(within(region).getByText(/«…pintar la escuela…»/)).toBeInTheDocument()
  })

  it('una lista de candidatos que el tope cortó lo dice con su propio texto', async () => {
    const muchos = Array.from({ length: 200 }, (_, i) => registro(`k${i}`, { project: 'p1', proposed_text: `Propuesta ${i}` }, { state: 'proposed' }))
    fetch = mockFetch(rutas([{ path: /^\/objects\/commitment_candidate\/records\?/, body: pagina(muchos, { nextCursor: 'siguiente' }) }]))
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    expect(await screen.findByText('Se muestran los 1,000 candidatos más recientes: elija un proyecto para ver el resto.')).toBeInTheDocument()
    expect(screen.queryByText(/compromisos del alcance/)).not.toBeInTheDocument()
  })

  it('aceptar valida el monto, manda IK, If-Match y motivo sin el proyecto, y abre el compromiso creado', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/commitment-candidates/k1/accept',
        responder: () =>
          jsonResponse({ commitment: registro('c9', { project: 'p1' }, { state: 'draft' }), candidate: { ...PROPUESTO, state: 'accepted' } }, 201)
      }
    ])
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.type(within(panel).getByLabelText('Código del compromiso'), 'C-010')
    await userEvent.type(within(panel).getByLabelText('Monto'), '-5')
    await userEvent.click(within(panel).getByRole('button', { name: 'Aceptar y crear borrador' }))
    expect(await within(panel).findByText('Escriba un monto de hasta 15 dígitos enteros y 4 decimales')).toBeInTheDocument()
    expect(within(panel).getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/commitment-candidates/k1/accept')).toHaveLength(0)
    await userEvent.clear(within(panel).getByLabelText('Monto'))
    await userEvent.type(within(panel).getByLabelText('Monto'), '8,000.50')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Acordado en la asamblea')
    await userEvent.click(within(panel).getByRole('button', { name: 'Aceptar y crear borrador' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments/c9'))
    const [llamada] = red.a('POST', '/sgspe/commitment-candidates/k1/accept')
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-06T15:00:00Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Acordado%20en%20la%20asamblea")
    expect(llamada.cuerpo).toEqual({
      attributes: {
        code: 'C-010',
        title: 'Mejorar el camino al anexo Huallpa',
        description: 'Mejorar el camino al anexo Huallpa',
        amount: '8000.50',
        currency: 'PEN',
        due_date: '2026-12-15',
        origin_engagement: 'e1'
      }
    })
  })

  it('otra persona ya lo decidió: dice el texto propio del STATE_MISMATCH, nunca el código', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { method: 'POST', path: '/sgspe/commitment-candidates/k1/accept', responder: () => problema(409, 'x', [{ field: 'state', message: 'STATE_MISMATCH' }]) }
    ])
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.type(within(panel).getByLabelText('Código del compromiso'), 'C-010')
    await userEvent.type(within(panel).getByLabelText('Monto'), '10')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Asamblea')
    await userEvent.click(within(panel).getByRole('button', { name: 'Aceptar y crear borrador' }))
    expect(await within(panel).findByText(/Otra persona ya decidió este candidato/)).toBeInTheDocument()
    expect(within(panel).queryByText('STATE_MISMATCH')).not.toBeInTheDocument()
  })

  it('«Es duplicado de…» exige el compromiso y el motivo, y manda duplicateOf con la versión', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { method: 'POST', path: '/sgspe/commitment-candidates/k1/duplicate', responder: () => jsonResponse({ candidate: { ...PROPUESTO, state: 'duplicate' } }) }
    ])
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.click(within(panel).getByRole('radio', { name: 'Es duplicado de…' }))
    await userEvent.click(within(panel).getByRole('button', { name: 'Confirmar' }))
    expect(await within(panel).findByText('Este dato es obligatorio')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/commitment-candidates/k1/duplicate')).toHaveLength(0)
    await userEvent.type(within(panel).getByLabelText('Buscar el compromiso que ya lo cubre'), 'Re')
    await userEvent.click(await within(panel).findByRole('button', { name: 'C-001 · Reservorio de agua para Tunas Pampa' }))
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Ya está en C-001')
    await userEvent.click(within(panel).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitment-candidates/k1/duplicate')).toHaveLength(1))
    const [llamada] = red.a('POST', '/sgspe/commitment-candidates/k1/duplicate')
    expect(llamada.cuerpo).toEqual({ duplicateOf: 'c1' })
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-06T15:00:00Z"')
    expect(llamada.cabeceras.has('Idempotency-Key')).toBe(false)
  })

  it('registrar un candidato manda el proyecto y su clave; sin el texto no se envía', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { method: 'POST', path: '/sgspe/commitment-candidates', responder: () => jsonResponse(registro('k9', { project: 'p1' }, { state: 'proposed' }), 201) }
    ])
    enProyecto(EQUIPO_DE_COMPROMISOS, '/projects/p1/commitments?view=candidatos')
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar candidato' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    expect(await within(panel).findByText('Escriba lo que se propuso')).toBeInTheDocument()
    await userEvent.type(within(panel).getByLabelText('Lo que se propuso'), 'Instalar dos pozos')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitment-candidates')).toHaveLength(1))
    const [llamada] = red.a('POST', '/sgspe/commitment-candidates')
    expect(llamada.cuerpo).toEqual({ attributes: { proposed_text: 'Instalar dos pozos', project: 'p1' } })
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('quien solo lee los candidatos no ve las decisiones', async () => {
    fetch = mockFetch(rutas())
    enProyecto(permisos({ project: ['READ'], commitment: ['READ'], commitment_candidate: ['READ'] }), '/projects/p1/commitments?view=candidatos')
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    const panel = await screen.findByRole('dialog')
    expect(within(panel).queryByRole('button', { name: 'Aceptar y crear borrador' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar candidato' })).not.toBeInTheDocument()
  })
})
