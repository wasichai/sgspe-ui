import { screen, waitFor, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro, workflow } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { MisProyectos } from './MisProyectos'

// S02 «Mi día» (revisión de UX, etapa 2; P-01 del rediseño): una fila de la tabla compacta por proyecto asignado con su estado, su jefatura y lo
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
  // S02: una tabla compacta, una fila por proyecto, y una columna por cifra que la cuenta lee
  it('sus proyectos vigentes, los de más pendientes primero, con jefatura y cifras enlazadas', async () => {
    fetch = mockFetch(rutas())
    montar(<MisProyectos />, { usuario: RELACIONISTA, permisos: LEE })
    const region = await screen.findByRole('region', { name: 'Mis proyectos' })
    await waitFor(() => expect(within(region).getByRole('link', { name: '3 compromisos vencidos' })).toBeInTheDocument())
    const tabla = within(region).getByRole('table', { name: 'Mis proyectos' })
    // no lee riesgos: su columna no se dibuja (DD-38), ni «—» ni cero
    // los encabezados abreviados de la columna de 440 px se nombran enteros para los lectores de pantalla
    expect(within(tabla).getAllByRole('columnheader')).toHaveLength(3)
    for (const nombre of ['Proyecto', 'Compromisos vencidos', 'QCS vencidas'])
      expect(within(tabla).getByRole('columnheader', { name: nombre })).toBeInTheDocument()
    expect(within(tabla).getByText('Comp. venc.')).toHaveAttribute('title', 'Compromisos vencidos')
    const filas = within(tabla).getAllByRole('row').slice(1)
    expect(filas.map((f) => within(f).getAllByRole('link')[0].textContent)).toEqual(['PRJ-02 Proyecto Ejemplo B', 'PRJ-01 Proyecto Ejemplo A'])
    const [p2, p1] = filas
    expect(within(p2).getByRole('link', { name: '3 compromisos vencidos' })).toHaveAttribute('href', '/projects/p2/commitments?view=vencidos')
    expect(within(p2).getByRole('link', { name: '3 compromisos vencidos' })).toHaveTextContent('3')
    expect(within(p2).getByRole('link', { name: '1 QCS vencida' })).toHaveAttribute('href', '/projects/p2/attention?view=atencion')
    expect(within(p2).getByRole('link', { name: 'PRJ-02 Proyecto Ejemplo B' })).toHaveAttribute('href', '/projects/p2/overview')
    expect(within(p2).getByText(/jefa/)).toBeInTheDocument()
    expect(within(p1).getByText('Jefatura: Sin jefatura asignada')).toBeInTheDocument()
    // un cero es un cero apagado, sin enlace (nada pide acción); nunca «—»
    expect(
      within(p1)
        .getAllByRole('cell')
        .slice(1)
        .map((c) => c.textContent)
    ).toEqual(['0', '0'])
    expect(within(p1).getAllByRole('link')).toHaveLength(1)
    expect(within(region).queryByText('—')).not.toBeInTheDocument()
    // las cifras y el nombre no van subrayados (U-05)
    expect(within(p2).getByRole('link', { name: '3 compromisos vencidos' })).not.toHaveClass('underline')
    expect(within(p2).getByRole('link', { name: 'PRJ-02 Proyecto Ejemplo B' })).not.toHaveClass('underline')
    expect(within(region).queryByText('Proyecto ajeno')).not.toBeInTheDocument()
  })

  it('una cifra que no llegó es «—» con su nota al pie, nunca cero', async () => {
    fetch = mockFetch([
      { path: /^\/objects\/grievance\/records/, status: 500, body: { title: 'x', status: 500 } },
      ...rutas().filter((r) => !String(r.path).includes('grievance'))
    ])
    montar(<MisProyectos />, { usuario: RELACIONISTA, permisos: LEE })
    const region = await screen.findByRole('region', { name: 'Mis proyectos' })
    await waitFor(() => expect(within(region).getAllByText('—').length).toBeGreaterThan(0))
    expect(within(region).getByText('Cada cifra lleva a su lista. — = la cifra no se pudo leer.')).toBeInTheDocument()
  })

  // fase 13a de Civic Modern: a 390 px la tabla cabe sin desplazarse: los encabezados de cifras se parten en dos líneas y las
  // celdas de cifras se angostan
  it('en el teléfono, los encabezados de cifras se parten y las cifras se angostan', async () => {
    fetch = mockFetch(rutas())
    montar(<MisProyectos />, { usuario: RELACIONISTA, permisos: LEE })
    const tabla = await screen.findByRole('table', { name: 'Mis proyectos' })
    const encabezado = within(tabla).getByRole('columnheader', { name: 'Compromisos vencidos' })
    expect(encabezado).toHaveClass('max-sm:whitespace-normal', 'max-sm:px-2', 'max-sm:leading-tight')
    const cifra = within(tabla).getAllByRole('row')[1].querySelectorAll('td')[1]
    expect(cifra).toHaveClass('max-sm:px-2')
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
    expect(within(region).getAllByRole('row')).toHaveLength(7)
  })
})
