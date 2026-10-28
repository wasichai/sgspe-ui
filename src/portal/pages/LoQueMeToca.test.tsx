import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar, pagina, registro, workflow } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { LoQueMeToca } from './LoQueMeToca'

// P-01 «Lo que me toca hoy» (rediseño de UX, U-05 y U-13): lo que la persona tiene a su cargo, lo vencido primero y cada entrada
// con su motivo y su fecha, sin muros de enlaces; y las tareas para tomar de sus proyectos, sin elegir un proyecto en el selector
let fetch: FetchMock | null = null
let red: Red | null = null
afterEach(() => {
  vi.restoreAllMocks()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' }, { state: 'active' })
const P2 = registro('p2', { code: 'PRJ-02', name: 'Proyecto Ejemplo B' }, { state: 'active' })
const P3 = registro('p3', { code: 'PRJ-03', name: 'Proyecto vencido' }, { state: 'active' })
const asignacion = (id: string, proyecto: string, extra: Record<string, unknown> = {}) =>
  registro(id, { project: proyecto, member_user_id: RELACIONISTA.id, active: true, start_date: '2026-01-01', ...extra })

const sinAsignaciones: MockRoute[] = [
  { path: /^\/objects\/project_assignment\/records/, body: pagina([]) },
  { path: /^\/objects\/project\/records/, body: pagina([]) }
]
const region = () => screen.getByRole('region', { name: 'Lo que me toca hoy' })
const grupo = (nombre: RegExp) => within(region()).getByRole('region', { name: nombre })
const entradas = (nombre: RegExp) =>
  within(grupo(nombre))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

describe('Lo que me toca hoy', () => {
  // tercera pasada de UX, 4.8: la sección dice cuánto hace que se leyó, se relee al volver a la pestaña tras un minuto y ofrece
  // «Actualizar»
  it('dice cuándo se actualizó, se relee al volver a la pestaña y ofrece «Actualizar»', async () => {
    fetch = mockFetch([
      {
        path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/,
        body: pagina([registro('t1', { title: 'Redactar el acta', project: 'p1', due_date: '2026-10-30', deadline_status: 'AL DIA' }, { state: 'open' })])
      },
      ...sinAsignaciones
    ])
    red = espiarRed()
    montar(<LoQueMeToca />, { usuario: RELACIONISTA, permisos: permisos({ task: ['READ'] }) })
    expect(await within(await screen.findByRole('region', { name: 'Lo que me toca hoy' })).findByText('Actualizado hace un momento')).toBeInTheDocument()
    const deSuCargo = () => red!.a('GET', /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/).length
    const antes = deSuCargo()
    // al volver a la pestaña antes de un minuto no se relee
    document.dispatchEvent(new Event('visibilitychange'))
    expect(deSuCargo()).toBe(antes)
    const real = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(real + 2 * 60_000)
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(deSuCargo()).toBe(antes + 1))
    await userEvent.click(within(region()).getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(deSuCargo()).toBe(antes + 2))
  })

  it('lo vencido primero, luego lo por vencer y lo demás, cada uno con su motivo y su fecha, cinco a la vista', async () => {
    fetch = mockFetch([
      {
        path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/,
        body: pagina([
          registro('t1', { title: 'Redactar el acta', project: 'p1', due_date: '2026-10-30', deadline_status: 'AL DIA' }, { state: 'open' }),
          registro('t2', { title: 'Visitar Tunas Pampa', project: 'p1', due_date: '2026-10-17', deadline_status: 'VENCIDO' }, { state: 'in_progress' }),
          registro('t3', { title: 'Preparar el taller', project: 'p1', due_date: '2026-10-23', deadline_status: 'POR VENCER' }, { state: 'open' }),
          registro('t4', { title: 'Tarea hecha', project: 'p1', deadline_status: 'VENCIDO' }, { state: 'done' }),
          registro('t5', { title: 'Sin fecha', project: 'p1' }, { state: 'open' }),
          registro('t6', { title: 'Llamar a la junta', project: 'p1', due_date: '2026-11-04', deadline_status: 'AL DIA' }, { state: 'open' })
        ])
      },
      {
        path: /^\/objects\/commitment\/records\?.*owner_user_id=u-relacionista/,
        body: pagina([
          registro(
            'c1',
            { code: 'C-001', title: 'Mejora del canal', project: 'p1', due_date: '2026-10-10', deadline_status: 'VENCIDO' },
            { state: 'in_progress' }
          )
        ])
      },
      ...sinAsignaciones
    ])
    montar(<LoQueMeToca />, { usuario: RELACIONISTA, permisos: permisos({ task: ['READ'], commitment: ['READ'] }) })
    await screen.findByRole('region', { name: 'Lo que me toca hoy' })
    await waitFor(() => expect(grupo(/^A su cargo/)).toBeInTheDocument())
    // el total del grupo es lo abierto que la API devolvió a quien mira; lo hecho no cuenta
    expect(within(grupo(/^A su cargo/)).getByRole('heading')).toHaveTextContent('6')
    // las fechas se leen como en el resto del portal, no en el formato de escritura del campo (tercera pasada de UX)
    expect(entradas(/^A su cargo/)).toEqual([
      'C-001 · Mejora del canalCompromiso · Vencido · venció el 10 oct. 2026',
      'Visitar Tunas PampaTarea · Vencido · venció el 17 oct. 2026',
      'Preparar el tallerTarea · Por vencer · vence el 23 oct. 2026',
      'Redactar el actaTarea · Al día · vence el 30 oct. 2026',
      'Llamar a la juntaTarea · Al día · vence el 4 nov. 2026'
    ])
    expect(within(grupo(/^A su cargo/)).getByRole('link', { name: 'Visitar Tunas Pampa' })).toHaveAttribute('href', '/projects/p1/tasks?task=t2')
    // ninguna entrada queda sin forma de verse: el resto se despliega en el lugar
    await userEvent.click(within(grupo(/^A su cargo/)).getByRole('button', { name: 'Mostrar 1 más' }))
    expect(entradas(/^A su cargo/)).toHaveLength(6)
    expect(entradas(/^A su cargo/)[5]).toBe('Sin fechaTarea')
    // el título no se subraya (U-05) y «Ver mis tareas» lleva a la lista completa
    expect(within(grupo(/^A su cargo/)).getByRole('link', { name: 'Visitar Tunas Pampa' })).toHaveClass('no-underline')
    expect(within(region()).getByRole('link', { name: 'Ver mis tareas' })).toHaveAttribute('href', '/tasks')
  })

  // tercera pasada de UX, 3.2: cada entrada dice su proyecto y su estado, una QCS lo que plantea, y una tarea para tomar se toma
  // en la línea
  it('cada entrada dice su proyecto y su estado, una QCS lo que plantea, y «Tomar» toma la tarea sin abrirla', async () => {
    // el GET trae como clave cada campo legible, también los vacíos: la escritura sale de esa forma
    const PARA_TOMAR = registro(
      'q1',
      { title: 'Registrar la asistencia', project: 'p1', due_date: '2026-10-19', assignee_user_id: null, assignee_user_email: null },
      { state: 'open', updatedAt: '2026-10-01T10:00:00Z' }
    )
    fetch = mockFetch([
      { path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/, body: pagina([]) },
      {
        path: /^\/objects\/grievance\/records\?.*owner_user_id=u-relacionista/,
        body: pagina([registro('g5', { code: 'Q-005', project: 'p1', description: 'Polvo en la vía de acceso' }, { state: 'in_attention' })])
      },
      { path: '/objects/grievance/workflow', body: workflow('grievance', [['in_attention', 'En atención']]) },
      { path: /^\/objects\/project_assignment\/records/, body: pagina([asignacion('a1', 'p1')]) },
      { path: /^\/objects\/project\/records/, body: pagina([P1]) },
      { path: /^\/objects\/task\/records\?.*empty=assignee_user_id/, body: pagina([PARA_TOMAR]) },
      {
        path: '/metadata/objects/task',
        body: definicion('task', ['title', 'project', 'due_date', ['assignee_user_id', { type: 'UUID' }], 'assignee_user_email'])
      },
      { method: 'PUT', path: '/objects/task/records/q1', body: { ...PARA_TOMAR, attributes: { ...PARA_TOMAR.attributes, assignee_user_id: RELACIONISTA.id } } }
    ])
    red = espiarRed()
    montar(<LoQueMeToca />, {
      usuario: RELACIONISTA,
      permisos: permisos({ task: ['READ', 'UPDATE'], grievance: ['READ'], project: ['READ'], project_assignment: ['READ'] })
    })
    await waitFor(() => expect(entradas(/^A su cargo/)).toEqual(['Q-005 · Polvo en la vía de accesoQueja · PRJ-01 · Proyecto Ejemplo A · En atención']))
    const cola = await screen.findByRole('region', { name: /^Para tomar en sus proyectos/ })
    await userEvent.click(await within(cola).findByRole('button', { name: 'Tomar «Registrar la asistencia»' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/task/records/q1')).toHaveLength(1))
    expect(red.a('PUT', '/objects/task/records/q1')[0].cabeceras.get('If-Match')).toBe('"2026-10-01T10:00:00Z"')
    expect(red.a('PUT', '/objects/task/records/q1')[0].cuerpo).toMatchObject({ attributes: { assignee_user_id: RELACIONISTA.id } })
    expect(await within(region()).findByRole('status')).toHaveTextContent('Tomó «Registrar la asistencia»: ahora está a su cargo.')
  })

  // B-04: el servidor acota la lectura de task a los proyectos de la cuenta (ADR-0029): la cola es una sola lectura, sin project
  it('las tareas para tomar de sus proyectos en una sola lectura, sin elegir proyecto, cada una con su proyecto', async () => {
    fetch = mockFetch([
      { path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/, body: pagina([]) },
      {
        path: /^\/objects\/project_assignment\/records/,
        body: pagina([asignacion('a1', 'p1'), asignacion('a2', 'p2'), asignacion('a3', 'p3', { end_date: '2026-01-31' })])
      },
      { path: /^\/objects\/project\/records/, body: pagina([P1, P2, P3]) },
      {
        path: /^\/objects\/task\/records\?.*empty=assignee_user_id/,
        body: pagina([
          registro('q1', { title: 'Registrar la asistencia', project: 'p1', due_date: '2026-10-19', deadline_status: 'VENCIDO' }, { state: 'open' }),
          registro('q2', { title: 'Georreferenciar la captación', project: 'p2', due_date: '2026-10-28', deadline_status: 'AL DIA' }, { state: 'open' }),
          registro('q3', { title: 'Fotografiar el tramo', project: 'p1' }, { state: 'open' })
        ])
      }
    ])
    montar(<LoQueMeToca />, { usuario: RELACIONISTA, permisos: permisos({ task: ['READ'], project: ['READ'], project_assignment: ['READ'] }) })
    const cola = await screen.findByRole('region', { name: /^Para tomar en sus proyectos/ })
    expect(within(cola).getByRole('heading')).toHaveTextContent('3')
    await waitFor(() =>
      expect(
        within(cola)
          .getAllByRole('listitem')
          .map((li) => li.textContent)
      ).toEqual([
        'Registrar la asistenciaSin asignar · PRJ-01 · Proyecto Ejemplo A · Vencido · venció el 19 oct. 2026',
        'Georreferenciar la captaciónSin asignar · PRJ-02 · Proyecto Ejemplo B · Al día · vence el 28 oct. 2026',
        'Fotografiar el tramoSin asignar · PRJ-01 · Proyecto Ejemplo A'
      ])
    )
    expect(within(cola).getByRole('link', { name: 'Georreferenciar la captación' })).toHaveAttribute('href', '/projects/p2/tasks?task=q2')
    // todas a la vista: no hay «Ver los N»
    expect(within(cola).queryByRole('link', { name: /^Ver / })).not.toBeInTheDocument()
    const colas = fetch.calls.filter((c) => c.path.startsWith('/objects/task/records') && c.path.includes('empty=assignee_user_id'))
    expect(colas).toHaveLength(1)
    const busqueda = new URLSearchParams(colas[0].path.split('?')[1])
    expect(busqueda.has('project')).toBe(false)
    // a una cuenta que no lee todos los proyectos el servidor ya la acota a los suyos: no pide assigned
    expect(busqueda.has('assigned')).toBe(false)
    expect(busqueda.get('state')).toBe('open,in_progress,blocked')
    expect(busqueda.get('size')).toBe('5')
    expect(screen.queryByText(/Lo que puede tomar en sus otros/)).not.toBeInTheDocument()
  })

  it('la cola de sus proyectos lee hasta cinco tareas y «Ver los N» lleva a Mis tareas', async () => {
    const cinco = ['a', 'b', 'c', 'd', 'e'].map((x) => registro(`q${x}`, { title: `Tarea ${x}`, project: 'p1' }, { state: 'open' }))
    fetch = mockFetch([
      { path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/, body: pagina([]) },
      ...sinAsignaciones,
      { path: /^\/objects\/task\/records\?.*empty=assignee_user_id/, body: pagina(cinco, { totalElements: 12 }) }
    ])
    montar(<LoQueMeToca />, { usuario: RELACIONISTA, permisos: permisos({ task: ['READ'], project: ['READ'], project_assignment: ['READ'] }) })
    const cola = await screen.findByRole('region', { name: /^Para tomar en sus proyectos/ })
    expect(within(cola).getByRole('heading')).toHaveTextContent('12')
    expect(within(cola).getAllByRole('listitem')).toHaveLength(5)
    expect(within(cola).getByRole('link', { name: 'Ver los 12' })).toHaveAttribute('href', '/tasks')
  })

  // B-04, decisión (a) de wasichai/sgspe#162: quien lee todos los proyectos ve la cola de sus proyectos asignados, no la de todo
  // el tenant, en una sola lectura con assigned=true
  it('con alcance de tenant, las tareas para tomar de sus proyectos asignados en una sola lectura con assigned=true', async () => {
    fetch = mockFetch([
      { path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/, body: pagina([]) },
      { path: /^\/objects\/project_assignment\/records/, body: pagina([asignacion('a1', 'p1'), asignacion('a2', 'p2')]) },
      { path: /^\/objects\/project\/records/, body: pagina([P1, P2]) },
      {
        path: /^\/objects\/task\/records\?(?=.*assigned=true)(?=.*empty=assignee_user_id)/,
        body: pagina(
          [
            registro('q1', { title: 'Registrar la asistencia', project: 'p1', due_date: '2026-10-19', deadline_status: 'VENCIDO' }, { state: 'open' }),
            registro('q2', { title: 'Georreferenciar la captación', project: 'p2' }, { state: 'open' })
          ],
          { totalElements: 7 }
        )
      }
    ])
    montar(<LoQueMeToca />, {
      usuario: RELACIONISTA,
      permisos: permisos({ task: ['READ'], project: ['READ', 'READ_ALL_PROJECTS'], project_assignment: ['READ'] })
    })
    const cola = await screen.findByRole('region', { name: /^Para tomar en sus proyectos/ })
    expect(within(cola).getByRole('heading')).toHaveTextContent('7')
    await waitFor(() =>
      expect(
        within(cola)
          .getAllByRole('listitem')
          .map((li) => li.textContent)
      ).toEqual([
        'Registrar la asistenciaSin asignar · PRJ-01 · Proyecto Ejemplo A · Vencido · venció el 19 oct. 2026',
        'Georreferenciar la captaciónSin asignar · PRJ-02 · Proyecto Ejemplo B'
      ])
    )
    expect(within(cola).getByRole('link', { name: 'Ver los 7' })).toHaveAttribute('href', '/tasks')
    const colas = fetch.calls.filter((c) => c.path.startsWith('/objects/task/records') && c.path.includes('empty=assignee_user_id'))
    expect(colas).toHaveLength(1)
    const busqueda = new URLSearchParams(colas[0].path.split('?')[1])
    expect(busqueda.get('assigned')).toBe('true')
    expect(busqueda.has('project')).toBe(false)
    expect(busqueda.get('state')).toBe('open,in_progress,blocked')
    expect(busqueda.get('size')).toBe('5')
    expect(screen.queryByRole('region', { name: /^Para tomar en PRJ-/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Lo que puede tomar en sus otros/)).not.toBeInTheDocument()
  })

  // un servidor anterior no conoce assigned y responde 422 (ASM-054): se lee la cola de cada proyecto con asignación vigente
  const sinFiltro: MockRoute = {
    path: /^\/objects\/task\/records\?(?=.*assigned=true)/,
    status: 422,
    body: { status: 422, title: 'Unprocessable Entity', detail: 'Parámetro desconocido', errors: [{ field: 'assigned', message: 'desconocido' }] }
  }

  it('con alcance de tenant y un servidor sin assigned, las tareas para tomar de cada proyecto con asignación vigente', async () => {
    fetch = mockFetch([
      sinFiltro,
      { path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/, body: pagina([]) },
      {
        path: /^\/objects\/project_assignment\/records/,
        body: pagina([asignacion('a1', 'p1'), asignacion('a2', 'p2'), asignacion('a3', 'p3', { end_date: '2026-01-31' })])
      },
      { path: /^\/objects\/project\/records/, body: pagina([P1, P2, P3]) },
      {
        path: /^\/objects\/task\/records\?(?=.*project=p1)(?=.*empty=assignee_user_id)/,
        body: pagina(
          [
            registro('q1', { title: 'Registrar la asistencia', project: 'p1', due_date: '2026-10-19', deadline_status: 'VENCIDO' }, { state: 'open' }),
            registro('q2', { title: 'Georreferenciar la captación', project: 'p1', due_date: '2026-10-28', deadline_status: 'AL DIA' }, { state: 'open' }),
            registro('q3', { title: 'Fotografiar el tramo', project: 'p1' }, { state: 'open' })
          ],
          { totalElements: 4 }
        )
      },
      { path: /^\/objects\/task\/records\?(?=.*project=p2)(?=.*empty=assignee_user_id)/, body: pagina([]) }
    ])
    montar(<LoQueMeToca />, {
      usuario: RELACIONISTA,
      permisos: permisos({ task: ['READ'], project: ['READ', 'READ_ALL_PROJECTS'], project_assignment: ['READ'] })
    })
    const cola = await screen.findByRole('region', { name: /^Para tomar en PRJ-01 · Proyecto Ejemplo A/ })
    expect(within(cola).getByRole('heading')).toHaveTextContent('4')
    expect(
      within(cola)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual([
      'Registrar la asistenciaSin asignar · Vencido · venció el 19 oct. 2026',
      'Georreferenciar la captaciónSin asignar · Al día · vence el 28 oct. 2026',
      'Fotografiar el tramoSin asignar'
    ])
    expect(within(cola).getByRole('link', { name: 'Registrar la asistencia' })).toHaveAttribute('href', '/projects/p1/tasks?task=q1')
    expect(within(cola).getByRole('link', { name: 'Ver los 4' })).toHaveAttribute('href', '/projects/p1/tasks')
    // un proyecto sin cola no se dibuja, la asignación vencida no se consulta y nunca se lee la cola de todo el tenant
    expect(screen.queryByRole('region', { name: /PRJ-02/ })).not.toBeInTheDocument()
    const colas = fetch.calls
      .filter((c) => c.path.startsWith('/objects/task/records') && c.path.includes('empty=assignee_user_id'))
      .map((c) => new URLSearchParams(c.path.split('?')[1]))
      .filter((b) => !b.has('assigned'))
    expect(colas.map((b) => b.get('project')).sort()).toEqual(['p1', 'p2'])
    expect(colas.every((b) => b.get('state') === 'open,in_progress,blocked')).toBe(true)
    expect(screen.queryByRole('region', { name: /^Para tomar en sus proyectos/ })).not.toBeInTheDocument()
  })

  it('con alcance de tenant y un servidor sin assigned, lee la cola de seis proyectos como mucho y dice dónde ver la de los demás', async () => {
    const ocho = Array.from({ length: 8 }, (_, i) => asignacion(`a${i}`, `p${i}`))
    fetch = mockFetch([
      sinFiltro,
      { path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/, body: pagina([]) },
      { path: /^\/objects\/project_assignment\/records/, body: pagina(ocho) },
      { path: /^\/objects\/project\/records/, body: pagina([]) },
      {
        path: /^\/objects\/task\/records\?.*empty=assignee_user_id/,
        body: pagina([registro('q1', { title: 'Registrar la asistencia', project: 'p0' }, { state: 'open' })])
      }
    ])
    montar(<LoQueMeToca />, {
      usuario: RELACIONISTA,
      permisos: permisos({ task: ['READ'], project: ['READ', 'READ_ALL_PROJECTS'], project_assignment: ['READ'] })
    })
    expect(await screen.findByText('Lo que puede tomar en sus otros 2 proyectos está en la lista de tareas de cada uno')).toBeInTheDocument()
    await waitFor(() => expect(fetch!.calls.filter((c) => c.path.includes('empty=assignee_user_id') && !c.path.includes('assigned='))).toHaveLength(6))
  })

  it('sin lectura de tareas no pide la cola para tomar', async () => {
    fetch = mockFetch([
      { path: /^\/objects\/commitment\/records/, body: pagina([]) },
      { path: /^\/objects\/project_assignment\/records/, body: pagina([asignacion('a1', 'p1')]) },
      { path: /^\/objects\/project\/records/, body: pagina([P1]) }
    ])
    montar(<LoQueMeToca />, { usuario: RELACIONISTA, permisos: permisos({ commitment: ['READ'] }) })
    expect(await screen.findByText('Nada pendiente a su cargo.')).toBeInTheDocument()
    expect(fetch.calls.some((c) => c.path.startsWith('/objects/task/'))).toBe(false)
  })

  // tercera pasada de UX: una lectura que falla no es «nada pendiente»; decirlo es contestar lo contrario de lo que pasa
  it('una lectura que falla no se lee como «Nada pendiente»: dice qué no se pudo leer y ofrece reintentar', async () => {
    fetch = mockFetch([
      { path: /^\/objects\/task\/records\?.*empty=assignee_user_id/, body: pagina([]) },
      { path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/, status: 400, body: { title: 'Falló' } },
      { path: /^\/objects\/commitment\/records\?.*owner_user_id=u-relacionista/, body: pagina([]) },
      ...sinAsignaciones
    ])
    montar(<LoQueMeToca />, { usuario: RELACIONISTA, permisos: permisos({ task: ['READ'], commitment: ['READ'] }) })
    expect(await screen.findByText('No se pudieron leer sus tareas: lo que está a su cargo puede estar incompleto.')).toBeInTheDocument()
    expect(within(region()).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('Nada pendiente a su cargo.')).not.toBeInTheDocument()
  })

  it('sin lectura de lo que se tiene a cargo, el bloque no se dibuja', async () => {
    fetch = mockFetch(sinAsignaciones)
    const { container } = montar(<LoQueMeToca />, { usuario: RELACIONISTA, permisos: permisos({}) })
    await waitFor(() => expect(fetch?.calls.some((c) => c.path.startsWith('/objects/project_assignment'))).toBe(true))
    expect(container).toBeEmptyDOMElement()
  })
})
