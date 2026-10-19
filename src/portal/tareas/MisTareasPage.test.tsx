import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeCompromisos, EQUIPO_DE_COMPROMISOS, GESTORA } from '../../test/compromisos'
import { definicion, montar, pagina, registro, workflow } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { MisTareasPage } from './MisTareasPage'

// S47 (WF-N): las tareas de quien mira con sus conteos, el tablero por estado, el calendario por vencimiento y «Para tomar» en
// el proyecto, donde tomar una tarea es un cambio con If-Match
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const T1 = registro(
  't1',
  {
    project: 'p1',
    title: 'Ejecutar compromiso C-001',
    commitment: 'c1',
    assignee_user_id: 'u-cmm',
    due_date: '2026-10-05',
    deadline_status: 'VENCIDO',
    priority: 'ALTA'
  },
  { state: 'open' }
)
const T2 = registro(
  't2',
  { project: 'p1', title: 'Reprogramar el taller', engagement: 'e1', assignee_user_id: 'u-cmm', due_date: '2026-10-15', deadline_status: 'POR VENCER' },
  { state: 'in_progress' }
)
const T3 = registro('t3', { project: 'p1', title: 'Revisar el acta', engagement: 'e2', assignee_user_id: 'u-cmm' }, { state: 'done' })
// el GET trae como clave cada campo legible, también los vacíos: la escritura sale de esa forma
const ESCALAMIENTO = registro(
  't4',
  {
    project: 'p1',
    title: 'Escalamiento C-002 nivel 1',
    commitment: 'c2',
    assignee_user_id: null,
    assignee_user_email: null,
    generator_key: 'escalation:commitment:c2:1'
  },
  { state: 'open', updatedAt: '2026-10-08T05:00:00Z' }
)
const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  {
    path: '/objects/task/workflow',
    body: workflow('task', [
      ['open', 'Abierta'],
      ['in_progress', 'En curso'],
      ['done', 'Hecha']
    ])
  },
  { path: '/objects/task/records', body: pagina([T1, T2, T3, ESCALAMIENTO]) },
  {
    path: '/metadata/objects/task',
    body: definicion('task', [
      'title',
      'description',
      'assignee_user_id',
      'assignee_user_email',
      ['due_date', { type: 'DATE' }],
      'priority',
      'project',
      'commitment',
      'generator_key'
    ])
  },
  {
    path: /^\/objects\/task\/records\/t\d\/transitions/,
    body: [{ name: 'start', label: 'Iniciar', to: 'in_progress', toLabel: 'En curso', allowed: true, reason: null }]
  }
]

describe('S47 · mis tareas', () => {
  it('lee las asignadas a quien mira, cuenta las vencidas y abre una con su origen y sus transiciones', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const tabla = await screen.findByRole('table', { name: 'Mis tareas' })
    expect(red.a('GET', '/objects/task/records')[0].ruta).toContain('assignee_user_id=u-cmm')
    const contadores = screen.getByLabelText('Mis tareas', { selector: 'dl' })
    expect(within(contadores).getByText('Vencidas').nextElementSibling).toHaveTextContent('1')
    expect(within(contadores).getByText('Abiertas').nextElementSibling).toHaveTextContent('2')
    expect(within(tabla).queryByText('Revisar el acta')).not.toBeInTheDocument()
    expect(within(tabla).getByRole('link', { name: 'Compromiso' })).toHaveAttribute('href', '/r/commitment/c1')
    await userEvent.click(within(tabla).getByRole('button', { name: 'Abrir Ejecutar compromiso C-001' }))
    const drawer = await screen.findByRole('dialog')
    expect(await within(drawer).findByRole('button', { name: 'Iniciar' })).toBeInTheDocument()
    expect(within(drawer).getByLabelText('Situación de plazo: Vencido')).toBeInTheDocument()
  })

  it('el tablero agrupa por estado y el calendario ubica cada tarea en su día de vencimiento', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-09T15:00:00Z'))
    fetch = mockFetch(rutas())
    montar(<MisTareasPage />, { ruta: '/tasks?view=tablero', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByRole('region', { name: 'Hechas' })).toHaveTextContent('Revisar el acta')
    expect(screen.getByRole('region', { name: 'En curso' })).toHaveTextContent('Reprogramar el taller')
    await userEvent.click(screen.getByRole('tab', { name: 'Calendario' }))
    const mes = await screen.findByRole('region', { name: /octubre/ })
    expect(within(mes).getByRole('button', { name: 'Ejecutar compromiso C-001' }).closest('div')).toHaveTextContent(/^5/)
    expect(within(mes).getByText('Sin fecha de vencimiento: 1')).toBeInTheDocument()
    await userEvent.click(within(mes).getByRole('button', { name: 'Mes siguiente' }))
    expect(await screen.findByRole('region', { name: /noviembre/ })).toBeInTheDocument()
  })

  it('en el proyecto, «Para tomar» lista las sin asignar y tomar una manda quien mira con la versión leída', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([{ method: 'PUT', path: '/objects/task/records/t4', responder: () => problema(412, 'otra persona la tomó') }])
    montar(<MisTareasPage />, {
      ruta: '/projects/p1/tasks?view=paraTomar',
      camino: '/projects/:projectId/tasks',
      usuario: GESTORA,
      permisos: EQUIPO_DE_COMPROMISOS
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir Escalamiento C-002 nivel 1' }))
    const drawer = await screen.findByRole('dialog')
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Tomar la tarea' }))
    expect(await within(drawer).findByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    const [llamada] = red.a('PUT', '/objects/task/records/t4')
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-08T05:00:00Z"')
    // el PUT reemplaza: generator_key viaja como se leyó, o GeneratorKeyGuard lo tomaría por un cambio (GENERATOR_KEY_PLATFORM_ONLY)
    expect(llamada.cuerpo).toMatchObject({
      attributes: { assignee_user_id: 'u-cmm', assignee_user_email: 'cmm@sgspe.test', generator_key: 'escalation:commitment:c2:1' }
    })
  })

  it('tomar una tarea dice que es suya y, tras releer, ya no ofrece tomarla', async () => {
    let tomada = false
    const ASIGNADA = { ...ESCALAMIENTO, attributes: { ...ESCALAMIENTO.attributes, assignee_user_id: 'u-cmm', assignee_user_email: 'cmm@sgspe.test' } }
    fetch = mockFetch(rutas())
    red = espiarRed([
      { path: /^\/objects\/task\/records\?/, responder: () => jsonResponse(pagina([T1, T2, T3, tomada ? ASIGNADA : ESCALAMIENTO])) },
      {
        method: 'PUT',
        path: '/objects/task/records/t4',
        responder: () => {
          tomada = true
          return jsonResponse(ASIGNADA)
        }
      }
    ])
    montar(<MisTareasPage />, {
      ruta: '/projects/p1/tasks?view=paraTomar',
      camino: '/projects/:projectId/tasks',
      usuario: GESTORA,
      permisos: EQUIPO_DE_COMPROMISOS
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir Escalamiento C-002 nivel 1' }))
    const drawer = await screen.findByRole('dialog')
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Tomar la tarea' }))
    expect(await within(drawer).findByText('La tarea es suya.')).toBeInTheDocument()
    await waitFor(() => expect(within(drawer).queryByRole('button', { name: 'Tomar la tarea' })).not.toBeInTheDocument())
  })

  it('una tarea de una QCS, un riesgo o una alerta (F4) lleva a su origen por /r/…', async () => {
    const acuse = registro('t5', { project: 'p1', title: 'Acusar recibo de la queja Q-001', grievance: 'g1', assignee_user_id: 'u-cmm' }, { state: 'open' })
    const revision = registro('t6', { project: 'p1', title: 'Revisar el riesgo R-001', social_risk: 'k1', assignee_user_id: 'u-cmm' }, { state: 'open' })
    fetch = mockFetch(rutas([{ path: '/objects/task/records', body: pagina([acuse, revision]) }]))
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const tabla = await screen.findByRole('table', { name: 'Mis tareas' })
    expect(within(tabla).getByRole('link', { name: 'Queja' })).toHaveAttribute('href', '/r/grievance/g1')
    expect(within(tabla).getByRole('link', { name: 'Riesgo' })).toHaveAttribute('href', '/r/social_risk/k1')
  })

  // plan 4.2a: el escalamiento de nivel 2 de una QCS confidencial no lleva vínculo a la QCS, sino un título genérico: la lista dice
  // «—» en el origen, la ficha no ofrece «Ver origen» y tomarla devuelve su clave tal como se leyó
  it('el escalamiento de nivel 2 de una QCS confidencial, sin origen, se lista, se abre y se toma sin enlace roto', async () => {
    const NIVEL_2 = registro(
      't7',
      {
        project: 'p1',
        title: 'QCS confidencial vencida en Proyecto Norte',
        assignee_user_id: null,
        assignee_user_email: null,
        commitment: null,
        generator_key: 'escalation:grievance:9f2c41:2026-10-09:2'
      },
      { state: 'open', updatedAt: '2026-10-09T05:00:00Z' }
    )
    fetch = mockFetch(rutas([{ path: '/objects/task/records', body: pagina([NIVEL_2]) }]))
    red = espiarRed([{ method: 'PUT', path: '/objects/task/records/t7', responder: () => jsonResponse(NIVEL_2) }])
    montar(<MisTareasPage />, {
      ruta: '/projects/p1/tasks?view=paraTomar',
      camino: '/projects/:projectId/tasks',
      usuario: GESTORA,
      permisos: EQUIPO_DE_COMPROMISOS
    })
    const tabla = await screen.findByRole('table')
    const fila = within(tabla).getByRole('button', { name: 'Abrir QCS confidencial vencida en Proyecto Norte' }).closest('tr')!
    expect(within(fila).queryByRole('link')).not.toBeInTheDocument()
    expect(fila.querySelectorAll('td')[1]).toHaveTextContent('—')
    await userEvent.click(within(fila).getByRole('button', { name: 'Abrir QCS confidencial vencida en Proyecto Norte' }))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).queryByRole('link')).not.toBeInTheDocument()
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Tomar la tarea' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/task/records/t7')).toHaveLength(1))
    expect(red.a('PUT', '/objects/task/records/t7')[0].cuerpo).toMatchObject({
      attributes: { assignee_user_id: 'u-cmm', commitment: null, generator_key: 'escalation:grievance:9f2c41:2026-10-09:2' }
    })
  })

  it('mientras carga no dice que no hay tareas, y si falla lo dice con reintento', async () => {
    let fallar: () => void = () => {}
    const respuesta = new Promise<Response>((resolver) => {
      fallar = () => resolver(problema(500, 'caído'))
    })
    fetch = mockFetch(rutas().filter((r) => r.path !== '/objects/task/records'))
    red = espiarRed([{ path: '/objects/task/records', responder: () => respuesta }])
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    // la lectura sigue pendiente: «Cargando», sin conteos ni lista vacía
    expect(await screen.findByRole('status')).toHaveTextContent('Cargando…')
    expect(screen.queryByText('No tiene tareas abiertas.')).not.toBeInTheDocument()
    expect(screen.queryByText('Vencidas')).not.toBeInTheDocument()
    fallar()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('No tiene tareas abiertas.')).not.toBeInTheDocument()
    expect(screen.queryByText('Vencidas')).not.toBeInTheDocument()
  })

  it('una lista que el tope cortó lo dice con cuántas muestra', async () => {
    const muchas = Array.from({ length: 200 }, (_, i) =>
      registro(`x${i}`, { project: 'p1', title: `Tarea ${i}`, assignee_user_id: 'u-cmm' }, { state: 'open' })
    )
    fetch = mockFetch(rutas([{ path: /^\/objects\/task\/records\?/, body: pagina(muchas, { nextCursor: 'siguiente' }) }]))
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByText('Se muestran las primeras 1,000 tareas: acote con un proyecto para ver el resto.')).toBeInTheDocument()
  })

  it('fuera de un proyecto, ?view=paraTomar muestra la lista: «Para tomar» solo existe en el proyecto', async () => {
    fetch = mockFetch(rutas())
    montar(<MisTareasPage />, { ruta: '/tasks?view=paraTomar', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByRole('button', { name: 'Abrir Ejecutar compromiso C-001' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Para tomar' })).not.toBeInTheDocument()
  })
})
