import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeCompromisos, EQUIPO_DE_COMPROMISOS, GESTORA } from '../../test/compromisos'
import { definicion, montar, registro, ubicacion, workflow } from '../../test/montar'
import { fichaDelServidor, listaDelServidor } from '../../test/listaDelServidor'
import { espiarRed, problema, type Red, type RutaEspecial } from '../../test/red'
import type { Registro } from '../datos/registros'
import { MisTareasPage } from './MisTareasPage'

// S47 (WF-N): las tareas de quien mira con sus conteos, el tablero por estado, el calendario por vencimiento y «Para tomar»,
// donde tomar una tarea es un cambio con If-Match
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

// las tareas las contesta el servidor emulado: cada grupo, columna y mes es una consulta (D10 de la revisión de UX)
const servidor = (tareas: Registro[] | (() => Registro[]) = [T1, T2, T3, ESCALAMIENTO], especiales: RutaEspecial[] = []) =>
  espiarRed([...especiales, listaDelServidor('task', tareas), fichaDelServidor('task', tareas)])

describe('S47 · mis tareas', () => {
  it('lee las asignadas a quien mira, cuenta las vencidas y abre una con su origen y sus transiciones', async () => {
    fetch = mockFetch(rutas([{ path: '/objects/commitment/records/c1', body: registro('c1', { project: 'p1', code: 'C-001', title: 'Reservorio' }) }]))
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const tabla = await screen.findByRole('table', { name: 'Mis tareas' })
    expect(red.a('GET', '/objects/task/records')[0].ruta).toContain('assignee_user_id=u-cmm')
    const contadores = screen.getByRole('group', { name: 'Mis tareas' })
    expect(within(contadores).getByRole('button', { name: 'Vencidas 1' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(contadores).getByRole('button', { name: 'Abiertas 2' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(tabla).queryByText('Revisar el acta')).not.toBeInTheDocument()
    // el origen con su tipo y su nombre, leído como quien mira (revisión de UX, etapa 6)
    expect(await within(tabla).findByRole('link', { name: /^C-001 · / })).toHaveAttribute('href', '/projects/p1/commitments/c1')
    expect(within(tabla).getByText(/^Compromiso ·/)).toBeInTheDocument()
    await userEvent.click(within(tabla).getByRole('button', { name: 'Abrir Ejecutar compromiso C-001' }))
    const drawer = await screen.findByRole('dialog')
    expect(await within(drawer).findByRole('button', { name: 'Iniciar' })).toBeInTheDocument()
    expect(within(drawer).getByLabelText('Situación de plazo: Vencido')).toBeInTheDocument()
  })

  // revisión de UX, etapa 3: las cifras de arriba son filtros; en lo global, la columna Proyecto
  it('pulsar «Vencidas» filtra la lista, queda como chip y «Abiertas» lo quita; en lo global se dice el proyecto', async () => {
    fetch = mockFetch(rutas())
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const tabla = await screen.findByRole('table', { name: 'Mis tareas' })
    expect(within(tabla).getByRole('columnheader', { name: 'Proyecto' })).toBeInTheDocument()
    expect(within(tabla).getAllByRole('row')).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Vencidas 1' }))
    expect(ubicacion.actual).toBe('/tasks?situacion=VENCIDO')
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Mis tareas' })).getAllByRole('row')).toHaveLength(2))
    expect(screen.getByRole('button', { name: 'Quitar Vencidas' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abiertas 2' }))
    expect(ubicacion.actual).toBe('/tasks')
  })

  it('el tablero agrupa por estado y el calendario ubica cada tarea en su día de vencimiento', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-09T15:00:00Z'))
    fetch = mockFetch(rutas())
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/tasks?view=tablero', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await waitFor(() => expect(screen.getByRole('region', { name: 'Hechas' })).toHaveTextContent('Revisar el acta'))
    await waitFor(() => expect(screen.getByRole('region', { name: 'En curso' })).toHaveTextContent('Reprogramar el taller'))
    // cada columna es una consulta por estado
    expect(red.a('GET', '/objects/task/records').map((l) => l.ruta)).toContainEqual(expect.stringContaining('state=done'))
    await userEvent.click(screen.getByRole('tab', { name: 'Calendario' }))
    const mes = await screen.findByRole('region', { name: /octubre/ })
    expect((await within(mes).findByRole('button', { name: 'Ejecutar compromiso C-001' })).closest('div')).toHaveTextContent(/^5/)
    expect(await within(mes).findByText('Sin fecha de vencimiento: 1')).toBeInTheDocument()
    // el mes se pide por su rango de vencimiento
    expect(red.a('GET', '/objects/task/records').map((l) => l.ruta)).toContainEqual(
      expect.stringContaining('range_field=due_date&range_from=2026-10-01&range_to=2026-11-01')
    )
    await userEvent.click(within(mes).getByRole('button', { name: 'Mes siguiente' }))
    expect(await screen.findByRole('region', { name: /noviembre/ })).toBeInTheDocument()
  })

  it('en el proyecto, «Para tomar» lista las sin asignar y tomar una manda quien mira con la versión leída', async () => {
    fetch = mockFetch(rutas())
    red = servidor(undefined, [{ method: 'PUT', path: '/objects/task/records/t4', responder: () => problema(412, 'otra persona la tomó') }])
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
    red = servidor(
      () => [T1, T2, T3, tomada ? ASIGNADA : ESCALAMIENTO],
      [
        {
          method: 'PUT',
          path: '/objects/task/records/t4',
          responder: () => {
            tomada = true
            return jsonResponse(ASIGNADA)
          }
        }
      ]
    )
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

  // tercera pasada de UX, 3.3: «Tomar» en la fila y varias a la vez, cada una con su If-Match; la que otra persona tomó antes no
  // detiene a las demás
  it('en «Para tomar» se toma desde la fila o se eligen varias y se toman juntas', async () => {
    const OTRA = registro(
      't5',
      { project: 'p1', title: 'Escalamiento C-003 nivel 1', commitment: 'c3', assignee_user_id: null, assignee_user_email: null },
      { state: 'open' }
    )
    fetch = mockFetch(rutas())
    red = servidor(
      [T1, T2, T3, ESCALAMIENTO, OTRA],
      [
        { method: 'PUT', path: '/objects/task/records/t4', responder: () => jsonResponse(ESCALAMIENTO) },
        { method: 'PUT', path: '/objects/task/records/t5', responder: () => problema(412, 'otra persona la tomó') }
      ]
    )
    montar(<MisTareasPage />, { ruta: '/projects/p1/tasks', camino: '/projects/:projectId/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const paraTomar = await screen.findByRole('region', { name: 'Para tomar' })
    expect(await within(paraTomar).findByRole('button', { name: 'Tomar «Escalamiento C-002 nivel 1»' })).toBeInTheDocument()
    await userEvent.click(within(paraTomar).getByRole('checkbox', { name: 'Elegir todas las que se pueden tomar' }))
    expect(within(paraTomar).getByRole('checkbox', { name: 'Elegir «Escalamiento C-003 nivel 1»' })).toBeChecked()
    await userEvent.click(within(paraTomar).getByRole('button', { name: 'Tomar las 2 elegidas' }))
    expect(await within(paraTomar).findByRole('status')).toHaveTextContent('Tomó 1; 1 no se pudo tomar')
    expect(red.a('PUT', '/objects/task/records/t4')[0].cuerpo).toMatchObject({ attributes: { assignee_user_id: 'u-cmm' } })
    expect(red.a('PUT', '/objects/task/records/t5')).toHaveLength(1)
  })

  it('una tarea de una QCS, un riesgo o una alerta (F4) lleva a la ficha de su origen, con su tipo y su nombre', async () => {
    const acuse = registro('t5', { project: 'p1', title: 'Acusar recibo de la queja Q-001', grievance: 'g1', assignee_user_id: 'u-cmm' }, { state: 'open' })
    const revision = registro('t6', { project: 'p1', title: 'Revisar el riesgo R-001', social_risk: 'k1', assignee_user_id: 'u-cmm' }, { state: 'open' })
    const conOtroProyecto = registro('t7', { project: 'p1', title: 'Revisar la alerta', early_warning: 'w9', assignee_user_id: 'u-cmm' }, { state: 'open' })
    fetch = mockFetch(
      rutas([
        { path: '/objects/grievance/records/g1', body: registro('g1', { project: 'p1', code: 'Q-001' }) },
        { path: '/objects/social_risk/records/k1', body: registro('k1', { project: 'p1', code: 'R-001', title: 'Polvo en la vía' }) },
        { path: '/objects/early_warning/records/w9', status: 404, body: { title: 'Not Found', status: 404 } }
      ])
    )
    red = servidor([acuse, revision, conOtroProyecto])
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const tabla = await screen.findByRole('table', { name: 'Mis tareas' })
    expect(await within(tabla).findByRole('link', { name: 'Q-001' })).toHaveAttribute('href', '/projects/p1/grievances/g1')
    expect(await within(tabla).findByRole('link', { name: 'R-001 · Polvo en la vía' })).toHaveAttribute('href', '/projects/p1/risks/k1')
    // un origen que no se lee es «Registro reservado», sin enlace
    expect(await within(tabla).findByText('Registro reservado')).toBeInTheDocument()
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
    fetch = mockFetch(rutas())
    red = servidor([NIVEL_2], [{ method: 'PUT', path: '/objects/task/records/t7', responder: () => jsonResponse(NIVEL_2) }])
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
    fetch = mockFetch(rutas())
    red = espiarRed([{ path: '/objects/task/records', responder: () => respuesta.then((r) => r.clone()) }])
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    // la lectura sigue pendiente: «Cargando» en cada grupo, sin conteos ni lista vacía
    const estados = await screen.findAllByRole('status')
    expect(estados.map((e) => e.textContent)).toEqual(['Cargando…', 'Cargando…'])
    expect(screen.queryByText('No tiene tareas abiertas.')).not.toBeInTheDocument()
    expect(screen.queryByText('No hay tareas sin asignar en sus proyectos.')).not.toBeInTheDocument()
    expect(screen.queryByText('Vencidas')).not.toBeInTheDocument()
    fallar()
    expect(await within(screen.getByRole('region', { name: 'Mis tareas' })).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(await within(screen.getByRole('region', { name: 'Para tomar' })).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('No tiene tareas abiertas.')).not.toBeInTheDocument()
    expect(screen.queryByText('Vencidas')).not.toBeInTheDocument()
  })

  // tercera pasada de UX: el tablero no ignora la situación elegida, que sigue marcada en su cifra
  it('el tablero aplica la situación elegida y su cifra queda marcada', async () => {
    fetch = mockFetch(rutas())
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/tasks?view=tablero&situacion=VENCIDO', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await waitFor(() => expect(red!.a('GET', '/objects/task/records').some((l) => /[?&]state=done(&|$)/.test(l.ruta))).toBe(true))
    const columnas = red.a('GET', '/objects/task/records').filter((l) => /[?&]state=(open|in_progress|blocked|done)(&|$)/.test(l.ruta))
    expect(columnas.length).toBeGreaterThanOrEqual(4)
    expect(columnas.every((l) => l.ruta.includes('deadline_status=VENCIDO'))).toBe(true)
    // las cifras llegan con su propia lectura
    const cifras = await screen.findByRole('group', { name: 'Mis tareas' })
    expect(await within(cifras).findByRole('button', { name: 'Vencidas 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('una columna con más de las que muestra lleva a la lista, y el calendario dice cuando no le caben todas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-09T15:00:00Z'))
    const muchas = Array.from({ length: 52 }, (_, i) =>
      registro(`x${i}`, { project: 'p1', title: `Tarea ${i}`, assignee_user_id: 'u-cmm', due_date: '2026-10-20' }, { state: 'open' })
    )
    // el mes se lee por cursor de 200 en 200: un servidor que siempre tiene más corta la lectura en el tope
    const pagina = Array.from({ length: 200 }, (_, i) => registro(`m${i}`, { project: 'p1', title: `Del mes ${i}`, due_date: '2026-10-20' }, { state: 'open' }))
    const delMes: RutaEspecial = {
      path: /\/objects\/task\/records\?.*range_field=due_date/,
      responder: () => jsonResponse({ content: pagina, page: 0, size: 200, nextCursor: 'mas' })
    }
    fetch = mockFetch(rutas())
    red = servidor(muchas, [delMes])
    montar(<MisTareasPage />, { ruta: '/tasks?view=tablero', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const abiertas = await screen.findByRole('region', { name: 'Abiertas' })
    await userEvent.click(await within(abiertas).findByRole('button', { name: 'Ver las 2 restantes en la lista' }))
    expect(ubicacion.actual).toBe('/tasks')
    await userEvent.click(screen.getByRole('tab', { name: 'Calendario' }))
    expect(await screen.findByText('Este mes tiene más tareas de las que el calendario puede mostrar: véalas todas en la lista.')).toBeInTheDocument()
  })

  it('dentro de un proyecto, el título dice que son las tareas de quien mira', async () => {
    fetch = mockFetch(rutas())
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/projects/p1/tasks', camino: '/projects/:projectId/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis tareas en este proyecto' })).toBeInTheDocument()
  })

  it('en el proyecto, la lista agrupa «Mis tareas» y «Para tomar», cada grupo con su consulta y su total', async () => {
    fetch = mockFetch(rutas())
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/projects/p1/tasks', camino: '/projects/:projectId/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const mias = await screen.findByRole('region', { name: 'Mis tareas' })
    await waitFor(() => expect(within(mias).getByRole('heading')).toHaveTextContent('Mis tareas (2)'))
    const paraTomar = screen.getByRole('region', { name: 'Para tomar' })
    await waitFor(() => expect(within(paraTomar).getByRole('heading')).toHaveTextContent('Para tomar (1)'))
    expect(within(paraTomar).getByRole('button', { name: 'Abrir Escalamiento C-002 nivel 1' })).toBeInTheDocument()
    const consultas = red.a('GET', '/objects/task/records').map((l) => Object.fromEntries(new URLSearchParams(l.ruta.split('?')[1])))
    expect(consultas).toContainEqual(
      expect.objectContaining({ project: 'p1', assignee_user_id: 'u-cmm', state: 'open,in_progress,blocked', page: '0', size: '25' })
    )
    expect(consultas).toContainEqual(expect.objectContaining({ project: 'p1', empty: 'assignee_user_id', state: 'open,in_progress,blocked', page: '0' }))
    expect(screen.queryByText(/Se muestran las primeras/)).not.toBeInTheDocument()
  })

  it('fuera de un proyecto, ?view=paraTomar muestra la lista: «Para tomar» es un grupo de la lista, no una vista', async () => {
    fetch = mockFetch(rutas())
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/tasks?view=paraTomar', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByRole('button', { name: 'Abrir Ejecutar compromiso C-001' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Para tomar' })).not.toBeInTheDocument()
  })

  // B-04: el servidor acota la lectura de task a los proyectos de la cuenta (ADR-0029), así que «Para tomar» no exige un proyecto
  it('sin proyecto elegido, «Para tomar» es una sola lectura sin project y dice el proyecto de cada tarea', async () => {
    fetch = mockFetch(rutas())
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const paraTomar = await screen.findByRole('region', { name: 'Para tomar' })
    await waitFor(() => expect(within(paraTomar).getByRole('heading')).toHaveTextContent('Para tomar (1)'))
    const tabla = within(paraTomar).getByRole('table', { name: 'Para tomar' })
    expect(within(tabla).getByRole('columnheader', { name: 'Proyecto' })).toBeInTheDocument()
    expect(within(tabla).getByRole('button', { name: 'Abrir Escalamiento C-002 nivel 1' })).toBeInTheDocument()
    const colas = red
      .a('GET', '/objects/task/records')
      .map((l) => Object.fromEntries(new URLSearchParams(l.ruta.split('?')[1])))
      .filter((c) => c.empty === 'assignee_user_id')
    expect(colas).toHaveLength(1)
    expect(colas[0]).not.toHaveProperty('project')
    expect(colas[0]).toMatchObject({ state: 'open,in_progress,blocked', page: '0', size: '25' })
    expect(screen.queryByText(/elija uno en el selector/)).not.toBeInTheDocument()
  })

  it('sin proyecto elegido y sin tareas sin asignar, «Para tomar» lo dice de sus proyectos', async () => {
    fetch = mockFetch(rutas())
    red = servidor([T1, T2, T3])
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const paraTomar = await screen.findByRole('region', { name: 'Para tomar' })
    expect(await within(paraTomar).findByText('No hay tareas sin asignar en sus proyectos.')).toBeInTheDocument()
  })

  // B-04, decisión (a) de wasichai/sgspe#162: quien lee todos los proyectos ve la cola de sus proyectos asignados, no la de todo
  // el tenant, en una sola lectura con assigned=true
  const lectorDeTodo = { ...EQUIPO_DE_COMPROMISOS, objects: { ...EQUIPO_DE_COMPROMISOS.objects, project: ['READ', 'READ_ALL_PROJECTS'] } }

  it('con alcance de tenant, sin proyecto elegido «Para tomar» es una sola lectura con assigned=true', async () => {
    fetch = mockFetch(rutas())
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: lectorDeTodo })
    const paraTomar = await screen.findByRole('region', { name: 'Para tomar' })
    await waitFor(() => expect(within(paraTomar).getByRole('heading')).toHaveTextContent('Para tomar (1)'))
    expect(within(paraTomar).getByRole('button', { name: 'Abrir Escalamiento C-002 nivel 1' })).toBeInTheDocument()
    const colas = red
      .a('GET', '/objects/task/records')
      .map((l) => Object.fromEntries(new URLSearchParams(l.ruta.split('?')[1])))
      .filter((c) => c.empty === 'assignee_user_id')
    expect(colas).toHaveLength(1)
    expect(colas[0]).not.toHaveProperty('project')
    expect(colas[0]).toMatchObject({ assigned: 'true', state: 'open,in_progress,blocked', page: '0', size: '25' })
    expect(screen.queryByText(/elija uno en el selector/)).not.toBeInTheDocument()
  })

  it('con alcance de tenant y un servidor sin assigned (422), sin proyecto elegido pide elegir un proyecto', async () => {
    fetch = mockFetch(rutas())
    red = servidor(undefined, [
      {
        path: /^\/objects\/task\/records\?(?=.*assigned=true)/,
        responder: () => problema(422, 'Parámetro desconocido', [{ field: 'assigned', message: 'desconocido' }])
      }
    ])
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: lectorDeTodo })
    expect(await screen.findByRole('table', { name: 'Mis tareas' })).toBeInTheDocument()
    expect(
      await screen.findByText('Como ve todos los proyectos, las tareas para tomar se ven dentro de cada uno: elija uno en el selector.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Para tomar' })).not.toBeInTheDocument()
  })

  it('sin alcance de tenant, «Para tomar» no pide assigned', async () => {
    fetch = mockFetch(rutas())
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/tasks', camino: '/tasks', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await screen.findByRole('region', { name: 'Para tomar' })
    await waitFor(() => expect(red!.a('GET', '/objects/task/records').some((l) => l.ruta.includes('empty=assignee_user_id'))).toBe(true))
    expect(red.a('GET', '/objects/task/records').some((l) => l.ruta.includes('assigned='))).toBe(false)
  })

  it('con alcance de tenant, en un proyecto «Para tomar» se lee con su project y sin assigned', async () => {
    fetch = mockFetch(rutas())
    red = servidor()
    montar(<MisTareasPage />, { ruta: '/projects/p1/tasks', camino: '/projects/:projectId/tasks', usuario: GESTORA, permisos: lectorDeTodo })
    const paraTomar = await screen.findByRole('region', { name: 'Para tomar' })
    await waitFor(() => expect(within(paraTomar).getByRole('heading')).toHaveTextContent('Para tomar (1)'))
    const colas = red.a('GET', '/objects/task/records').filter((l) => l.ruta.includes('empty=assignee_user_id'))
    expect(colas.length).toBeGreaterThan(0)
    expect(colas.every((l) => new URLSearchParams(l.ruta.split('?')[1]).get('project') === 'p1')).toBe(true)
    expect(colas.some((l) => l.ruta.includes('assigned='))).toBe(false)
  })
})
