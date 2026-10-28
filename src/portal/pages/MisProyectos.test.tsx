import { screen, waitFor, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro, workflow } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { MisProyectos } from './MisProyectos'

// S02 «Mi día» (revisión de UX, etapa 2; P-01 del rediseño): una tarjeta por proyecto asignado con su estado, su jefatura y lo
// que pide acción, enlazado a su lista; los de más pendientes primero; lo que la cuenta no lee no se dibuja (DD-38), nunca cero
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' }, { state: 'active' })
const P2 = registro('p2', { code: 'PRJ-02', name: 'Proyecto Ejemplo B' }, { state: 'active' })
const P3 = registro('p3', { code: 'PRJ-03', name: 'Proyecto ajeno' }, { state: 'active' })
const asignacion = (id: string, proyecto: string) =>
  registro(id, { project: proyecto, member_user_id: RELACIONISTA.id, active: true, start_date: '2026-01-01' })
const LEE = permisos({ project: ['READ'], project_assignment: ['READ'], commitment: ['READ'], grievance: ['READ'] })

const rutas = () => [
  {
    path: /^\/objects\/project_assignment\/records\?.*role_name=PROJECT_MANAGER/,
    body: pagina([registro('j1', { project: 'p2', member_user_email: 'jefa@sgspe.test', role_name: 'PROJECT_MANAGER', active: true })])
  },
  { path: /^\/objects\/project_assignment\/records/, body: pagina([asignacion('a1', 'p1'), asignacion('a2', 'p2')]) },
  { path: /^\/objects\/project\/records/, body: pagina([P1, P2, P3]) },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: /^\/objects\/commitment\/records\?.*project=p2/, body: pagina([], { totalElements: 3 }) },
  { path: /^\/objects\/commitment\/records/, body: pagina([], { totalElements: 0 }) },
  { path: /^\/objects\/grievance\/records\?.*project=p2/, body: pagina([], { totalElements: 1 }) },
  { path: /^\/objects\/grievance\/records/, body: pagina([], { totalElements: 0 }) },
  { path: /^\/sgspe\/people|\/users/, body: [] }
]

describe('Mis proyectos', () => {
  it('sus proyectos vigentes, los de más pendientes primero, con jefatura y cifras enlazadas', async () => {
    fetch = mockFetch(rutas())
    montar(<MisProyectos />, { usuario: RELACIONISTA, permisos: LEE })
    const region = await screen.findByRole('region', { name: 'Mis proyectos' })
    await waitFor(() => expect(within(region).getByRole('link', { name: '3 compromisos vencidos' })).toBeInTheDocument())
    const tarjetas = within(region)
      .getAllByRole('listitem')
      .filter((li) => li.parentElement?.parentElement === region)
    expect(tarjetas.map((li) => within(li).getAllByRole('link')[0].textContent)).toEqual(['PRJ-02 · Proyecto Ejemplo B', 'PRJ-01 · Proyecto Ejemplo A'])
    const p2 = tarjetas[0]
    expect(within(p2).getByRole('link', { name: '3 compromisos vencidos' })).toHaveAttribute('href', '/projects/p2/commitments?view=vencidos')
    expect(within(p2).getByRole('link', { name: '1 QCS vencida' })).toHaveAttribute('href', '/projects/p2/attention?view=atencion')
    // no lee riesgos: la línea no se dibuja (DD-38), ni «—» ni cero
    expect(within(p2).queryByText(/^Riesgos altos o críticos/)).not.toBeInTheDocument()
    expect(within(p2).getByText(/jefa/)).toBeInTheDocument()
    expect(within(tarjetas[1]).getByText('Jefatura: Sin jefatura asignada')).toBeInTheDocument()
    // lo que pide acción: una cifra en cero no se dibuja (U-11) y, sin ninguna, se dice; lo que no lee no se dibuja
    expect(within(tarjetas[1]).queryByText(/^0 /)).not.toBeInTheDocument()
    expect(within(tarjetas[1]).getByText('Nada pide acción')).toBeInTheDocument()
    expect(within(tarjetas[1]).queryByText(/^Riesgos altos o críticos/)).not.toBeInTheDocument()
    expect(within(p2).queryByText('Nada pide acción')).not.toBeInTheDocument()
    // las cifras y el nombre no van subrayados (U-05)
    expect(within(p2).getByRole('link', { name: '3 compromisos vencidos' })).not.toHaveClass('underline')
    expect(within(p2).getByRole('link', { name: 'PRJ-02 · Proyecto Ejemplo B' })).not.toHaveClass('underline')
    expect(within(region).queryByText('PRJ-03 · Proyecto ajeno')).not.toBeInTheDocument()
  })

  it('sin proyectos asignados, no se dibuja', async () => {
    fetch = mockFetch([
      { path: /^\/objects\/project_assignment\/records/, body: pagina([]) },
      { path: /^\/objects\/project\/records/, body: pagina([P1]) }
    ])
    const { container } = montar(<MisProyectos />, { usuario: RELACIONISTA, permisos: LEE })
    await waitFor(() => expect(fetch?.calls.some((c) => c.path.startsWith('/objects/project_assignment'))).toBe(true))
    expect(container).toBeEmptyDOMElement()
  })

  it('con más de seis, los seis con más pendientes y «Ver todos»', async () => {
    const muchos = Array.from({ length: 8 }, (_, i) => registro(`q${i}`, { code: `PRJ-1${i}`, name: `Proyecto ${i}` }, { state: 'active' }))
    fetch = mockFetch([
      { path: /^\/objects\/project_assignment\/records\?.*role_name/, body: pagina([]) },
      { path: /^\/objects\/project_assignment\/records/, body: pagina(muchos.map((p, i) => asignacion(`b${i}`, p.id))) },
      { path: /^\/objects\/project\/records/, body: pagina(muchos) },
      { path: /^\/objects\/(commitment|grievance)\/records/, body: pagina([], { totalElements: 0 }) }
    ])
    montar(<MisProyectos />, { usuario: RELACIONISTA, permisos: LEE })
    const region = await screen.findByRole('region', { name: 'Mis proyectos' })
    expect(within(region).getByRole('link', { name: 'Ver todos sus proyectos (8)' })).toHaveAttribute('href', '/projects')
    expect(within(region).getAllByRole('link', { name: /^PRJ-1/ })).toHaveLength(6)
  })
})
