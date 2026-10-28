import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro, ubicacion } from '../../test/montar'
import { ADMIN_PERMISOS, ADMINISTRACION, permisos, RELACIONISTA } from '../../test/portal'
import { BotonCrear } from './BotonCrear'

// la revisión de UX, etapa 0: crear no depende de un selector que no se ve. dentro de un proyecto, el botón lleva al alta
// del proyecto; con el alcance global, pide el proyecto entre los que la cuenta puede escribir (useEscribeEnProyecto: ADMIN
// en todos, los demás con una asignación vigente), con los suyos primero
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' })
const P2 = registro('p2', { code: 'PRJ-02', name: 'Proyecto Ejemplo B' })
const P3 = registro('p3', { code: 'PRJ-03', name: 'Proyecto Ejemplo C' })
const asignacion = (id: string, proyecto: string, extra: Record<string, unknown> = {}) =>
  registro(id, { project: proyecto, member_user_id: RELACIONISTA.id, active: true, start_date: '2026-01-01', ...extra })
const CREA = permisos({ commitment: ['READ', 'CREATE'], project: ['READ'], project_assignment: ['READ'] })

const boton = () => <BotonCrear objeto="commitment" etiqueta="Nuevo compromiso" resto="commitments/new" />
const rutas = (asignaciones: unknown[], proyectos = [P1, P2, P3]) => [
  { path: '/objects/project_assignment/records', body: pagina(asignaciones) },
  { path: '/objects/project/records', body: pagina(proyectos) }
]

describe('BotonCrear', () => {
  it('dentro de un proyecto donde escribe, lleva a su alta', async () => {
    fetch = mockFetch(rutas([asignacion('a1', 'p1')]))
    montar(boton(), { ruta: '/projects/p1/commitments', camino: '/projects/:projectId/commitments', usuario: RELACIONISTA, permisos: CREA })
    const enlace = await screen.findByRole('link', { name: 'Nuevo compromiso' })
    expect(enlace).toHaveAttribute('href', '/projects/p1/commitments/new')
  })

  it('dentro de un proyecto donde no escribe, o sin permiso de crear, no se ofrece', async () => {
    fetch = mockFetch(rutas([asignacion('a1', 'p1', { end_date: '2026-02-01' })]))
    const { unmount } = montar(boton(), { ruta: '/projects/p1/commitments', camino: '/projects/:projectId/commitments', usuario: RELACIONISTA, permisos: CREA })
    // la asignación vencida ya llegó y el botón sigue sin ofrecerse
    await waitFor(() => expect(fetch?.calls.some((c) => c.url.includes('project_assignment'))).toBe(true))
    expect(screen.queryByRole('link', { name: 'Nuevo compromiso' })).not.toBeInTheDocument()
    unmount()
    montar(boton(), { ruta: '/commitments', usuario: RELACIONISTA, permisos: permisos({ commitment: ['READ'] }) })
    expect(screen.queryByRole('button', { name: 'Nuevo compromiso' })).not.toBeInTheDocument()
  })

  it('con el alcance global pide el proyecto entre los suyos vigentes y lleva a su alta', async () => {
    fetch = mockFetch(rutas([asignacion('a1', 'p1'), asignacion('a2', 'p2'), asignacion('a3', 'p3', { active: false })]))
    montar(boton(), { ruta: '/commitments', usuario: RELACIONISTA, permisos: CREA })
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo compromiso' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿En qué proyecto?' })
    const proyecto = within(dialogo).getByRole('combobox', { name: 'Proyecto' })
    expect(
      within(proyecto)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Elija un proyecto', 'PRJ-01 · Proyecto Ejemplo A', 'PRJ-02 · Proyecto Ejemplo B'])
    expect(within(dialogo).getByRole('button', { name: 'Continuar' })).toBeDisabled()
    await userEvent.selectOptions(proyecto, 'p2')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }))
    expect(ubicacion.actual).toBe('/projects/p2/commitments/new')
  })

  // tercera pasada de UX, 2.6: el diálogo propone el último proyecto elegido, si la cuenta sigue escribiendo en él
  it('propone el último proyecto elegido para crear', async () => {
    fetch = mockFetch(rutas([asignacion('a1', 'p1'), asignacion('a2', 'p2')]))
    const { unmount } = montar(boton(), { ruta: '/commitments', usuario: RELACIONISTA, permisos: CREA })
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo compromiso' }))
    let dialogo = await screen.findByRole('dialog', { name: '¿En qué proyecto?' })
    await userEvent.selectOptions(within(dialogo).getByRole('combobox', { name: 'Proyecto' }), 'p2')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }))
    unmount()
    montar(boton(), { ruta: '/commitments', usuario: RELACIONISTA, permisos: CREA })
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo compromiso' }))
    dialogo = await screen.findByRole('dialog', { name: '¿En qué proyecto?' })
    expect(within(dialogo).getByRole('combobox', { name: 'Proyecto' })).toHaveValue('p2')
    expect(within(dialogo).getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })

  it('con un solo proyecto donde escribe, va directo a su alta', async () => {
    fetch = mockFetch(rutas([asignacion('a1', 'p2')]))
    montar(boton(), { ruta: '/commitments', usuario: RELACIONISTA, permisos: CREA })
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo compromiso' }))
    expect(ubicacion.actual).toBe('/projects/p2/commitments/new')
  })

  it('a quien administra le ofrece todos los proyectos, los suyos primero', async () => {
    fetch = mockFetch(rutas([registro('a9', { project: 'p3', member_user_id: ADMINISTRACION.id, active: true, start_date: '2026-01-01' })]))
    montar(boton(), { ruta: '/commitments', usuario: ADMINISTRACION, permisos: ADMIN_PERMISOS })
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo compromiso' }))
    const proyecto = within(await screen.findByRole('dialog')).getByRole('combobox', { name: 'Proyecto' })
    expect(
      within(proyecto)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Elija un proyecto', 'PRJ-03 · Proyecto Ejemplo C', 'PRJ-01 · Proyecto Ejemplo A', 'PRJ-02 · Proyecto Ejemplo B'])
  })

  it('si no pudo leer los proyectos, lo dice en lugar de afirmar que no hay', async () => {
    fetch = mockFetch([
      { path: '/objects/project_assignment/records', body: pagina([asignacion('a1', 'p1'), asignacion('a2', 'p2')]) },
      { path: '/objects/project/records', status: 503, body: { title: 'Unavailable', status: 503 } }
    ])
    montar(boton(), { ruta: '/commitments', usuario: RELACIONISTA, permisos: CREA })
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo compromiso' }))
    const dialogo = await screen.findByRole('dialog')
    expect(await within(dialogo).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(within(dialogo).queryByText('Su cuenta no tiene un proyecto vigente donde registrar.')).not.toBeInTheDocument()
  })

  it('sin un proyecto donde escribir, lo dice', async () => {
    fetch = mockFetch(rutas([]))
    montar(boton(), { ruta: '/commitments', usuario: RELACIONISTA, permisos: CREA })
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo compromiso' }))
    expect(within(await screen.findByRole('dialog')).getByText('Su cuenta no tiene un proyecto vigente donde registrar.')).toBeInTheDocument()
  })
})
