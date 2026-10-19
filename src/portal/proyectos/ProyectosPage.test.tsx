import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { definicion, montar, pagina, registro, workflow } from '../../test/montar'
import { ROL_DE_JEFATURA } from '../config'
import { useMisAsignaciones } from '../contexto/proyectos'
import { useTodos } from '../datos/registros'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { ProyectosPage } from './ProyectosPage'
import { ADMINISTRACION_DE_PROYECTO, AUDITORA, permisos, RELACIONISTA } from '../../test/portal'

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

const rutas = (usuario = RELACIONISTA, fases: string[] = []) => [
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
      ['exploration_phase', { type: 'ENUM', enumOptions: fases }]
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
    expect(screen.getByText('2 proyectos')).toBeInTheDocument()
    const [p1, p3] = filas()
    expect(await within(p1).findByText('jefa@sgspe.test')).toBeInTheDocument()
    expect(await within(p1).findByText('Perforación 2026')).toBeInTheDocument()
    expect(await within(p1).findByText('Activo')).toBeInTheDocument()
    expect(await within(p3).findByText('Sin jefatura asignada')).toBeInTheDocument()
  })

  it('quien lee todos los proyectos abre en «Todos», no en una lista vacía de asignaciones', async () => {
    const lectorDeTodo = permisos({ project: ['READ', 'READ_ALL_PROJECTS'], project_assignment: ['READ'], exploration_campaign: ['READ'] })
    fetch = abrirPortal('/projects', AUDITORA, lectorDeTodo, rutas(AUDITORA))
    await waitFor(() => expect(filas()).toHaveLength(3))
    expect(screen.getByRole('tab', { name: 'Todos' })).toHaveAttribute('aria-selected', 'true')
    // «Mis proyectos» sigue a un clic
    await userEvent.click(screen.getByRole('tab', { name: 'Mis proyectos' }))
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(rutaActual()).toBe('/projects?view=mine')
  })

  it('las vistas y los filtros viven en la URL', async () => {
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, rutas())
    await userEvent.click(await screen.findByRole('tab', { name: 'Todos' }))
    await waitFor(() => expect(filas()).toHaveLength(3))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Etapa' }), 'FACTIBILIDAD')
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(rutaActual()).toBe('/projects?view=all&stage=FACTIBILIDAD')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Etapa: Factibilidad' }))
    await waitFor(() => expect(filas()).toHaveLength(3))
  })

  it('la vista "En revisión" filtra por el estado del workflow', async () => {
    fetch = abrirPortal('/projects?view=in_review', RELACIONISTA, LECTOR, rutas())
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(within(filas()[0]).getByText('Qorihuasi')).toBeInTheDocument()
    // un solo proyecto, en singular
    expect(screen.getByText('1 proyecto')).toBeInTheDocument()
  })

  it('"Nuevo proyecto" solo para quien puede crear proyectos', async () => {
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, rutas())
    await screen.findByRole('table', { name: 'Proyectos' })
    expect(screen.queryByRole('link', { name: 'Nuevo proyecto' })).not.toBeInTheDocument()
    fetch.restore()
    cleanup()
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

  it('el filtro de fase toma sus opciones de la metadata y no se dibuja si no las tiene', async () => {
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, rutas())
    await screen.findByRole('table', { name: 'Proyectos' })
    expect(screen.getByRole('combobox', { name: 'Etapa' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Fase de exploración' })).not.toBeInTheDocument()
    fetch.restore()
    cleanup()
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, rutas(RELACIONISTA, ['PRE_EXPLORACION', 'EXPLORACION_AVANZADA']))
    const fase = await screen.findByRole('combobox', { name: 'Fase de exploración' })
    expect(
      within(fase)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Seleccionar…', 'PRE_EXPLORACION', 'EXPLORACION_AVANZADA'])
  })

  it('la jefatura repetida se muestra una vez y un líder sin correo no deja un nombre vacío', async () => {
    const jefe = (id: string, proyecto: string, correo: string) =>
      registro(id, { project: proyecto, member_user_email: correo, role_name: 'PROJECT_MANAGER', active: true })
    fetch = abrirPortal('/projects?view=all', RELACIONISTA, LECTOR, [
      {
        path: /^\/objects\/project_assignment\/records\?.*role_name=PROJECT_MANAGER/,
        body: pagina([jefe('a3', 'p1', 'jefa@sgspe.test'), jefe('a4', 'p1', 'jefa@sgspe.test'), jefe('a5', 'p1', ''), jefe('a6', 'p2', '')])
      },
      ...rutas()
    ])
    await waitFor(() => expect(filas()).toHaveLength(3))
    const [p1, p2] = filas()
    await waitFor(() => expect(within(p1).getByText('jefa@sgspe.test')).toBeInTheDocument())
    expect(within(p1).getAllByRole('cell')[5]).toHaveTextContent(/^jefa@sgspe\.test$/)
    expect(within(p2).getByText('Sin jefatura asignada')).toBeInTheDocument()
  })

  it('si no puede leer las asignaciones de jefatura dice "No disponible" y no "Sin jefatura asignada"', async () => {
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, [
      {
        path: /^\/objects\/project_assignment\/records\?.*role_name=PROJECT_MANAGER/,
        status: 403,
        body: { title: 'Forbidden', status: 403, detail: 'x', errors: [] }
      },
      ...rutas()
    ])
    await waitFor(() => expect(filas()).toHaveLength(2))
    const [p1, p3] = filas()
    await waitFor(() => expect(within(p1).getAllByRole('cell')[5]).toHaveTextContent('No disponible'))
    expect(within(p3).getAllByRole('cell')[5]).toHaveTextContent('No disponible')
    expect(screen.queryByText('Sin jefatura asignada')).not.toBeInTheDocument()
  })

  it('si no puede leer las campañas dice "No disponible" y no "—"', async () => {
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, [
      { path: '/objects/exploration_campaign/records', status: 403, body: { title: 'Forbidden', status: 403, detail: 'x', errors: [] } },
      ...rutas()
    ])
    await waitFor(() => expect(filas()).toHaveLength(2))
    const [p1, p3] = filas()
    await waitFor(() => expect(within(p1).getAllByRole('cell')[6]).toHaveTextContent('No disponible'))
    expect(within(p3).getAllByRole('cell')[6]).toHaveTextContent('No disponible')
  })

  it('"Mis proyectos" con las asignaciones fallidas dice el error, no que no hay proyectos', async () => {
    fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, status: 500, body: { title: 'Error', status: 500, detail: 'x', errors: [] } },
      ...rutas()
    ])
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Proyectos' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Aún no hay|Sin resultados|no hay proyectos/i)).not.toBeInTheDocument()
    expect(screen.queryByText('0 proyectos')).not.toBeInTheDocument()
    // «Todos» no necesita las asignaciones propias
    await userEvent.click(screen.getByRole('tab', { name: 'Todos' }))
    await waitFor(() => expect(filas()).toHaveLength(3))
  })

  // con el alcance por proyecto, una cuenta sin asignaciones vigentes no lee ningún proyecto (spec 4.4 §3.12)
  const SIN_PROYECTOS = [
    { path: '/objects/project/records', body: pagina([]) },
    { path: '/objects/project_assignment/records', body: pagina([]) },
    { path: '/objects/exploration_campaign/records', body: pagina([]) },
    { path: '/metadata/objects/project', body: definicion('project', []) }
  ]

  it('sin proyectos que leer ni la acción de leer todos, dice que no tiene proyectos asignados', async () => {
    fetch = mockFetch(SIN_PROYECTOS)
    montar(<ProyectosPage />, { ruta: '/projects', permisos: LECTOR })
    expect(await screen.findByText('No tiene proyectos asignados. Pida una asignación al administrador de proyectos.')).toBeInTheDocument()
    expect(screen.queryByText(/Un proyecto nace con/)).not.toBeInTheDocument()
    expect(screen.queryByText('0 proyectos')).not.toBeInTheDocument()
  })

  it('con la acción de leer todos y ningún proyecto en la organización, no dice que le falte una asignación', async () => {
    fetch = mockFetch(SIN_PROYECTOS)
    montar(<ProyectosPage />, {
      ruta: '/projects',
      permisos: permisos({ project: ['READ', 'READ_ALL_PROJECTS'], project_assignment: ['READ'], exploration_campaign: ['READ'] })
    })
    // abre en «Todos» (sin filtros que limpiar) y no le sugiere «Nuevo proyecto» a quien no puede crearlo
    expect(await screen.findByText('Aún no hay registros')).toBeInTheDocument()
    expect(screen.queryByText(/Un proyecto nace con/)).not.toBeInTheDocument()
    expect(screen.queryByText(/No tiene proyectos asignados/)).not.toBeInTheDocument()
  })

  describe('mientras las consultas auxiliares cargan', () => {
    // retiene las respuestas de las URL que contienen el patrón hasta soltarlas
    const retener = (patron: string) => {
      const original = globalThis.fetch
      let soltar = () => {}
      const espera = new Promise<void>((r) => (soltar = r))
      globalThis.fetch = ((entrada: RequestInfo | URL, init?: RequestInit) => {
        const url = entrada instanceof Request ? entrada.url : String(entrada)
        return url.includes(patron) ? espera.then(() => original(entrada, init)) : original(entrada, init)
      }) as typeof globalThis.fetch
      return soltar
    }

    it('"Mis proyectos" dice Cargando, sin conteo ni lista vacía, hasta que llegan las asignaciones', async () => {
      fetch = abrirPortal('/projects', RELACIONISTA, LECTOR, rutas())
      // las consultas de la página salen cuando llegan los permisos: se retienen solo las asignaciones propias
      const soltar = retener('member_user_id')
      expect(await screen.findByRole('status')).toHaveTextContent('Cargando…')
      expect(screen.queryByText(/\d+ proyectos?$/)).not.toBeInTheDocument()
      expect(screen.queryByRole('table', { name: 'Proyectos' })).not.toBeInTheDocument()
      soltar()
      await waitFor(() => expect(filas()).toHaveLength(2))
    })

    it('la jefatura y la campaña no afirman nada mientras cargan', async () => {
      fetch = abrirPortal('/projects?view=all', RELACIONISTA, LECTOR, rutas())
      const soltar = retener('exploration_campaign')
      const sueltaJefatura = retener('role_name=PROJECT_MANAGER')
      await waitFor(() => expect(filas()).toHaveLength(3))
      expect(screen.queryByText('Sin jefatura asignada')).not.toBeInTheDocument()
      expect(within(filas()[0]).getAllByRole('cell')[6]).not.toHaveTextContent('—')
      soltar()
      sueltaJefatura()
      expect(await screen.findAllByText('Sin jefatura asignada')).not.toHaveLength(0)
    })
  })
})

describe('un refetch fallido con la lista ya cargada', () => {
  const FALLA = { title: 'Error', status: 500, detail: 'x', errors: [] }
  // observa las mismas consultas que la página (misma clave, misma caché): cuando dice que fallaron, la página ya las vio
  function Sonda() {
    const consultas = {
      proyectos: useTodos('project', { sort: 'name', dir: 'asc' }),
      asignaciones: useMisAsignaciones(),
      jefaturas: useTodos('project_assignment', { role_name: ROL_DE_JEFATURA, active: true }),
      campanas: useTodos('exploration_campaign', { campaign_status: 'EN EJECUCION' })
    }
    return (
      <p>
        {Object.entries(consultas)
          .filter(([, q]) => q.isError)
          .map(([nombre]) => nombre)
          .join(' ')}{' '}
        fallaron
      </p>
    )
  }

  it('deja la lista, la jefatura y la campaña ya cargadas, sin error ni «No disponible»', async () => {
    fetch = mockFetch(rutas())
    montar(
      <>
        <ProyectosPage />
        <Sonda />
      </>,
      { ruta: '/projects', permisos: LECTOR }
    )
    await waitFor(() => expect(filas()).toHaveLength(2))
    expect(await within(filas()[0]).findByText('jefa@sgspe.test')).toBeInTheDocument()
    expect(await within(filas()[0]).findByText('Perforación 2026')).toBeInTheDocument()
    fetch.restore()
    fetch = mockFetch([
      { path: '/objects/project/records', status: 500, body: FALLA },
      { path: /^\/objects\/project_assignment\/records/, status: 500, body: FALLA },
      { path: '/objects/exploration_campaign/records', status: 500, body: FALLA }
    ])
    // volver a la pestaña refetcha lo viejo, y ahora el servidor falla
    fireEvent(window, new Event('visibilitychange'))
    await screen.findByText('proyectos asignaciones jefaturas campanas fallaron')
    expect(filas()).toHaveLength(2)
    expect(within(filas()[0]).getByText('jefa@sgspe.test')).toBeInTheDocument()
    expect(within(filas()[0]).getByText('Perforación 2026')).toBeInTheDocument()
    expect(screen.getByText('2 proyectos')).toBeInTheDocument()
    expect(screen.queryByText('No disponible')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })
})
