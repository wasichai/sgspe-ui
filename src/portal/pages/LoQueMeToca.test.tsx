import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { LoQueMeToca } from './LoQueMeToca'

// P-01 «Lo que me toca hoy» (rediseño de UX, U-05 y U-13): lo que la persona tiene a su cargo, lo vencido primero y cada entrada
// con su motivo y su fecha, sin muros de enlaces; y las tareas para tomar de cada proyecto con asignación vigente, sin elegir un
// proyecto en el selector
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
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
    expect(entradas(/^A su cargo/)).toEqual([
      'C-001 · Mejora del canalCompromiso · Vencido · venció el 10/10/2026',
      'Visitar Tunas PampaTarea · Vencido · venció el 17/10/2026',
      'Preparar el tallerTarea · Por vencer · vence el 23/10/2026',
      'Redactar el actaTarea · Al día · vence el 30/10/2026',
      'Llamar a la juntaTarea · Al día · vence el 04/11/2026'
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

  it('las tareas para tomar de cada proyecto con asignación vigente, sin elegir proyecto, con «Ver los N» hacia su lista', async () => {
    fetch = mockFetch([
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
    montar(<LoQueMeToca />, { usuario: RELACIONISTA, permisos: permisos({ task: ['READ'], project: ['READ'], project_assignment: ['READ'] }) })
    const cola = await screen.findByRole('region', { name: /^Para tomar en PRJ-01 · Proyecto Ejemplo A/ })
    expect(within(cola).getByRole('heading')).toHaveTextContent('4')
    expect(
      within(cola)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual([
      'Registrar la asistenciaSin asignar · Vencido · venció el 19/10/2026',
      'Georreferenciar la captaciónSin asignar · Al día · vence el 28/10/2026',
      'Fotografiar el tramoSin asignar'
    ])
    expect(within(cola).getByRole('link', { name: 'Registrar la asistencia' })).toHaveAttribute('href', '/projects/p1/tasks?task=q1')
    expect(within(cola).getByRole('link', { name: 'Ver los 4' })).toHaveAttribute('href', '/projects/p1/tasks')
    // un proyecto sin cola no se dibuja, y la asignación vencida no se consulta
    expect(screen.queryByRole('region', { name: /PRJ-02/ })).not.toBeInTheDocument()
    const colas = fetch.calls.filter((c) => c.path.startsWith('/objects/task/records') && c.path.includes('empty=assignee_user_id'))
    expect(colas.map((c) => new URLSearchParams(c.path.split('?')[1]).get('project')).sort()).toEqual(['p1', 'p2'])
    expect(colas.every((c) => new URLSearchParams(c.path.split('?')[1]).get('state') === 'open,in_progress,blocked')).toBe(true)
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

  it('sin lectura de lo que se tiene a cargo, el bloque no se dibuja', async () => {
    fetch = mockFetch(sinAsignaciones)
    const { container } = montar(<LoQueMeToca />, { usuario: RELACIONISTA, permisos: permisos({}) })
    await waitFor(() => expect(fetch?.calls.some((c) => c.path.startsWith('/objects/project_assignment'))).toBe(true))
    expect(container).toBeEmptyDOMElement()
  })
})
