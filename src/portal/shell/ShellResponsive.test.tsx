import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { pagina, registro } from '../../test/montar'
import { ADMIN_PERMISOS, ADMINISTRACION, permisos, RELACIONISTA } from '../../test/portal'

const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' }, { state: 'active' })
const P2 = registro('p2', { code: 'PRJ-02', name: 'Proyecto Ejemplo B' }, { state: 'active' })

// el shell en tableta y teléfono (ux-architecture.md §7.1, design-system.md §5.2 y §8): por debajo de lg la navegación principal
// se oculta y el botón de menú de la cabecera abre un panel con la cuenta, el selector de proyecto, las secciones, el idioma, el
// tema y la salida; por debajo de sm, una barra inferior de cinco destinos (Inicio, Proyectos, Registrar, Mapa y Tareas). jsdom
// no evalúa las media queries: se prueba la estructura y sus clases
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const BANDEJA = {
  path: '/auth/me/notifications/summary',
  body: {
    kinds: { ACTION: { active: 4, unread: 3, overdue: 0 }, WARNING: { active: 0, unread: 0, overdue: 0 }, INFO: { active: 1, unread: 1, overdue: 0 } },
    latest: null
  }
}

// la cabecera institucional es el primer banner (una pantalla puede tener el suyo)
const cabecera = () => screen.getAllByRole('banner')[0]

describe('shell responsive', () => {
  it('la navegación principal se oculta por debajo de lg y el menú abre un panel con las secciones, que se cierra al navegar', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [])
    const principal = await screen.findByRole('navigation', { name: 'Secciones' })
    expect(principal).toHaveClass('hidden', 'lg:block')
    const menu = within(screen.getByRole('banner')).getByRole('button', { name: 'Menú' })
    expect(menu).toHaveClass('lg:hidden')
    await userEvent.click(menu)
    const panel = await screen.findByRole('dialog', { name: 'Menú' })
    expect(within(panel).getByRole('combobox', { name: 'Idioma' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    await userEvent.click(within(within(panel).getByRole('navigation', { name: 'Secciones del menú' })).getByRole('link', { name: 'Inicio' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menú' })).not.toBeInTheDocument())
  })

  // D2 de la revisión de UX: en el teléfono el selector de la cabecera no se ve; el panel del menú lo trae arriba (antes lo abría
  // un chip de la cabecera, que Civic Modern quitó: la banda de contexto dice el alcance en todo ancho)
  it('en el teléfono, el menú abre el panel con el selector, que lleva al proyecto elegido', async () => {
    fetch = abrirPortal('/projects/p1/overview', ADMINISTRACION, ADMIN_PERMISOS, [
      { path: '/objects/project/records/p1', body: P1 },
      { path: '/objects/project/records', body: pagina([P1, P2]) },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    const enLaCabecera = await within(cabecera()).findByRole('combobox', { name: 'Proyecto' })
    expect(enLaCabecera.parentElement).toHaveClass('hidden', 'md:block')
    expect(await within(screen.getByRole('group', { name: 'Contexto' })).findByText('Proyecto · PRJ-01')).toBeInTheDocument()
    await userEvent.click(within(cabecera()).getByRole('button', { name: 'Menú' }))
    const panel = await screen.findByRole('dialog', { name: 'Menú' })
    const selector = await within(panel).findByRole('combobox', { name: 'Proyecto' })
    expect(selector.parentElement).not.toHaveClass('hidden')
    // el Escape del combobox cierra su lista y no el panel
    await userEvent.click(selector)
    expect(within(panel).getByRole('listbox', { name: 'Proyecto' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(within(panel).queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Menú' })).toBeInTheDocument()
    await userEvent.click(selector)
    await userEvent.click(await within(panel).findByRole('option', { name: 'PRJ-02 · Proyecto Ejemplo B' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p2/overview'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menú' })).not.toBeInTheDocument())
  })

  // revisión de UX, etapa 1: insignias con lo que pide acción, sin cambiar el nombre de cada destino. los avisos van en la campana
  // de la cabecera (en todo ancho), que cuenta los sin leer de todo tipo
  it('Tareas lleva la insignia de sus tareas vencidas o por vencer y la campana, la de los avisos sin leer', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [{ path: '/objects/task/records', body: pagina([], { totalElements: 2 }) }, BANDEJA])
    const barra = await screen.findByRole('navigation', { name: 'Accesos rápidos' })
    // las dos lecturas de tareas (vencidas y por vencer) responden 2 cada una
    await waitFor(() => expect(within(barra).getByRole('link', { name: 'Tareas' })).toHaveAccessibleDescription('4 tareas suyas vencidas o por vencer'))
    expect(await within(screen.getByRole('banner')).findByRole('button', { name: 'Avisos, 4 sin leer' })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('button', { name: 'Documentos y seguimiento' }))
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Tareas' })).toHaveAccessibleDescription(
      '4 tareas suyas vencidas o por vencer'
    )
  })

  it('en el teléfono, una barra inferior de cinco destinos: Inicio, Proyectos, Registrar, Mapa y Tareas', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [])
    const barra = await screen.findByRole('navigation', { name: 'Accesos rápidos' })
    expect(barra).toHaveClass('sm:hidden', 'h-16')
    expect(within(barra).getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
    expect(await within(barra).findByRole('link', { name: 'Proyectos' })).toHaveAttribute('href', '/projects')
    expect(within(barra).getByRole('link', { name: 'Mapa' })).toHaveAttribute('href', '/territory')
    expect(within(barra).getByRole('link', { name: 'Tareas' })).toHaveAttribute('href', '/tasks')
    expect([...barra.children].map((e) => e.textContent)).toEqual(['Inicio', 'Proyectos', 'Registrar', 'Mapa', 'Tareas'])
    await userEvent.click(within(barra).getByRole('link', { name: 'Proyectos' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects'))
  })

  // un destino sin su sección no desaparece: queda deshabilitado con el motivo, para que la barra no cambie de forma
  it('un destino que la cuenta no puede abrir se dibuja deshabilitado con su motivo', async () => {
    fetch = abrirPortal('/', RELACIONISTA, permisos({ task: ['READ'] }), [])
    const barra = await screen.findByRole('navigation', { name: 'Accesos rápidos' })
    expect(await within(barra).findByRole('button', { name: 'Proyectos: su cuenta no puede abrir esta sección' })).toBeDisabled()
    expect(within(barra).getByRole('button', { name: 'Mapa: su cuenta no puede abrir esta sección' })).toBeDisabled()
    expect(within(barra).getByRole('link', { name: 'Tareas' })).toHaveAttribute('href', '/tasks')
    // sin nada que registrar, Registrar también queda deshabilitado con su motivo
    expect(within(barra).getByRole('button', { name: 'Registrar: Su cuenta no registra nada desde aquí' })).toBeDisabled()
  })

  // «Registrar» abre las altas que la cuenta puede hacer, las mismas del inicio (useAtajos y BotonCrear)
  it('Registrar abre las altas que la cuenta puede hacer, y con un solo proyecto va directo al alta', async () => {
    fetch = abrirPortal('/', RELACIONISTA, permisos({ project: ['READ'], engagement: ['CREATE'], commitment: ['CREATE'] }), [
      { path: '/objects/project/records', body: pagina([P1]) },
      { path: '/objects/project_assignment/records', body: pagina([registro('a1', { project: 'p1', member_user_id: RELACIONISTA.id, active: true })]) }
    ])
    const barra = await screen.findByRole('navigation', { name: 'Accesos rápidos' })
    await userEvent.click(await within(barra).findByRole('button', { name: 'Registrar' }))
    const panel = await screen.findByRole('dialog', { name: '¿Qué quiere registrar?' })
    expect(within(panel).queryByRole('link', { name: 'Nuevo proyecto' })).not.toBeInTheDocument()
    const interaccion = await within(panel).findByRole('button', { name: 'Registrar interacción' })
    expect(within(panel).getByRole('button', { name: 'Nuevo compromiso' })).toBeInTheDocument()
    await waitFor(() => expect(interaccion).toBeEnabled())
    await userEvent.click(interaccion)
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/new'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '¿Qué quiere registrar?' })).not.toBeInTheDocument())
  })
})
