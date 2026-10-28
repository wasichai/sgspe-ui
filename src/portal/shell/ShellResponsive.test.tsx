import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { pagina, registro } from '../../test/montar'
import { ADMIN_PERMISOS, ADMINISTRACION } from '../../test/portal'

const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' }, { state: 'active' })
const P2 = registro('p2', { code: 'PRJ-02', name: 'Proyecto Ejemplo B' }, { state: 'active' })

// el shell en tableta y teléfono (ux-architecture.md §7.1, design-system.md §8): por debajo de md la navegación lateral se
// oculta y el botón de menú abre un panel con las secciones, el idioma y el tema; en el teléfono, una barra inferior de cuatro
// destinos (Inicio, Tareas, Avisos y Más). jsdom no evalúa las media queries: se prueba la estructura y sus clases
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('shell responsive', () => {
  it('la navegación lateral se oculta por debajo de md y el menú abre un panel con las secciones, que se cierra al navegar', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [])
    const lateral = await screen.findByRole('navigation', { name: 'Secciones' })
    expect(lateral).toHaveClass('hidden', 'md:block')
    const menu = screen.getByRole('button', { name: 'Menú' })
    expect(menu).toHaveClass('md:hidden')
    await userEvent.click(menu)
    const panel = await screen.findByRole('dialog', { name: 'Menú' })
    expect(within(panel).getByRole('combobox', { name: 'Idioma' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    await userEvent.click(within(within(panel).getByRole('navigation', { name: 'Secciones del menú' })).getByRole('link', { name: 'Inicio' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menú' })).not.toBeInTheDocument())
  })

  // D2 de la revisión de UX: en el teléfono el selector de la barra superior no se ve; el panel del menú lo trae arriba y un
  // chip en la barra superior dice el proyecto actual y abre el panel
  it('en el teléfono, el chip del proyecto abre el panel con el selector, que lleva al proyecto elegido', async () => {
    fetch = abrirPortal('/projects/p1/overview', ADMINISTRACION, ADMIN_PERMISOS, [
      { path: '/objects/project/records/p1', body: P1 },
      { path: '/objects/project/records', body: pagina([P1, P2]) },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    const chip = await within(screen.getByRole('banner')).findByRole('button', { name: 'Proyecto: PRJ-01. Cambiar de proyecto' })
    expect(chip).toHaveClass('md:hidden')
    await userEvent.click(chip)
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

  // revisión de UX, etapa 1: insignias con lo que pide acción, sin cambiar el nombre de cada destino
  // tercera pasada de UX: la insignia de Avisos cuenta lo mismo que la campana, los sin leer de todo tipo
  it('Tareas y Avisos llevan insignias con sus tareas vencidas o por vencer y sus avisos sin leer', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [
      { path: '/objects/task/records', body: pagina([], { totalElements: 2 }) },
      {
        path: '/auth/me/notifications/summary',
        body: {
          kinds: { ACTION: { active: 4, unread: 3, overdue: 0 }, WARNING: { active: 0, unread: 0, overdue: 0 }, INFO: { active: 1, unread: 1, overdue: 0 } },
          latest: null
        }
      }
    ])
    const barra = await screen.findByRole('navigation', { name: 'Accesos rápidos' })
    // las dos lecturas de tareas (vencidas y por vencer) responden 2 cada una
    await waitFor(() => expect(within(barra).getByRole('link', { name: 'Tareas' })).toHaveAccessibleDescription('4 tareas suyas vencidas o por vencer'))
    expect(within(barra).getByRole('link', { name: 'Avisos' })).toHaveAccessibleDescription('4 avisos sin leer')
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Tareas' })).toHaveAccessibleDescription(
      '4 tareas suyas vencidas o por vencer'
    )
  })

  it('en el teléfono, una barra inferior con Inicio, Avisos y Más; Más abre el mismo panel', async () => {
    fetch = abrirPortal('/', ADMINISTRACION, ADMIN_PERMISOS, [])
    const barra = await screen.findByRole('navigation', { name: 'Accesos rápidos' })
    expect(barra).toHaveClass('sm:hidden')
    expect(within(barra).getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/')
    expect(within(barra).getByRole('link', { name: 'Avisos' })).toHaveAttribute('href', '/notifications')
    await userEvent.click(within(barra).getByRole('link', { name: 'Avisos' }))
    await waitFor(() => expect(rutaActual()).toBe('/notifications'))
    await userEvent.click(within(barra).getByRole('button', { name: 'Más' }))
    expect(await screen.findByRole('dialog', { name: 'Menú' })).toBeInTheDocument()
  })
})
