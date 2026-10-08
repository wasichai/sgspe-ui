import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { definicion, pagina, registro, workflow } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { ADMINISTRACION_DE_PROYECTO, permisos, RELACIONISTA } from '../../test/portal'

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const P1 = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa', project_type: 'MINERIA', stage: 'EXPLORACION' }, { state: 'active' })
const P2 = registro('p2', { code: 'PRJ-02', name: 'Qorihuasi', project_type: 'MINERIA', stage: 'FACTIBILIDAD' }, { state: 'in_review' })
const P3 = registro('p3', { code: 'PRJ-03', name: 'Sondor', project_type: 'ENERGIA', stage: 'EXPLORACION' }, { state: 'draft' })

const rutas = (usuario = RELACIONISTA) => [
  { path: '/objects/project/records', body: pagina([P1, P2, P3]) },
  {
    path: '/objects/project/workflow',
    body: workflow('project', [
      ['draft', 'Borrador'],
      ['in_review', 'En revisión'],
      ['active', 'Activo']
    ])
  },
  {
    path: '/metadata/objects/project',
    body: definicion('project', [
      ['stage', { type: 'ENUM', enumOptions: ['EXPLORACION', 'FACTIBILIDAD'] }],
      ['project_type', { type: 'ENUM', enumOptions: ['MINERIA', 'ENERGIA'] }],
      ['exploration_phase', { type: 'ENUM', enumOptions: [] }]
    ])
  },
  {
    path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
    body: pagina([
      registro('a1', { project: 'p1', member_user_id: usuario.id, role_name: 'COMMUNITY_RELATIONS_OFFICER', active: true }),
      registro('a2', { project: 'p3', member_user_id: usuario.id, role_name: 'COMMUNITY_RELATIONS_OFFICER', active: true })
    ])
  },
  {
    path: /^\/objects\/project_assignment\/records\?.*role_name=PROJECT_MANAGER/,
    body: pagina([registro('a3', { project: 'p1', member_user_email: 'jefa@sgspe.test', role_name: 'PROJECT_MANAGER', active: true })])
  },
  {
    path: '/objects/exploration_campaign/records',
    body: pagina([registro('c1', { project: 'p1', name: 'Perforación 2026', campaign_status: 'EN EJECUCION' })])
  }
]

const LECTOR = permisos({ project: ['READ'], project_assignment: ['READ'], exploration_campaign: ['READ'] })
const filas = () =>
  within(screen.getByRole('table', { name: 'Proyectos' }))
    .getAllByRole('row')
    .slice(1)

describe('S06 · lista de proyectos', () => {
  it('por defecto muestra los proyectos de la persona, con su jefatura y su campaña en curso', async () => {
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, rutas())
    await waitFor(() => expect(filas()).toHaveLength(2))
    const [p1, p3] = filas()
    expect(within(p1).getByText('jefa@sgspe.test')).toBeInTheDocument()
    expect(within(p1).getByText('Perforación 2026')).toBeInTheDocument()
    expect(await within(p1).findByText('Activo')).toBeInTheDocument()
    expect(within(p3).getByText('Sin jefatura asignada')).toBeInTheDocument()
  })

  it('las vistas y los filtros viven en la URL', async () => {
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, rutas())
    await userEvent.click(await screen.findByRole('tab', { name: 'Todos' }))
    await waitFor(() => expect(filas()).toHaveLength(3))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Etapa' }), 'FACTIBILIDAD')
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(rutaActual()).toBe('/projects?view=all&stage=FACTIBILIDAD')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Etapa: FACTIBILIDAD' }))
    await waitFor(() => expect(filas()).toHaveLength(3))
  })

  it('la vista "En revisión" filtra por el estado del workflow', async () => {
    fetch = abrirPortal('/projects?view=in_review', RELACIONISTA, LECTOR, rutas())
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(within(filas()[0]).getByText('Qorihuasi')).toBeInTheDocument()
  })

  it('"Nuevo proyecto" solo para quien puede crear proyectos', async () => {
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, rutas())
    await screen.findByRole('table', { name: 'Proyectos' })
    expect(screen.queryByRole('link', { name: 'Nuevo proyecto' })).not.toBeInTheDocument()
    fetch.restore()
    document.body.innerHTML = ''
    fetch = abrirPortal(
      '/projects',
      ADMINISTRACION_DE_PROYECTO,
      permisos({ project: ['READ', 'CREATE'], project_assignment: ['READ'] }),
      rutas(ADMINISTRACION_DE_PROYECTO)
    )
    expect(await screen.findByRole('link', { name: 'Nuevo proyecto' })).toHaveAttribute('href', '/projects/new')
  })

  it('una fila abre el Resumen del proyecto', async () => {
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, [...rutas(), { path: '/objects/project/records/p1', body: P1 }])
    await userEvent.click(await screen.findByRole('link', { name: 'Pukaqaqa' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/overview'))
  })
})
