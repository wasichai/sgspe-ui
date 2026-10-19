import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { ADMIN_PERMISOS, ADMINISTRACION } from '../../test/portal'

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
