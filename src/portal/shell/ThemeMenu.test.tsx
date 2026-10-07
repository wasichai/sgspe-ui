import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirSesion, RELACIONISTA, rutasDeSesion, SIN_PERMISOS } from '../../test/portal'
import { PortalApp } from '../PortalApp'

// el menú de tema del marco: sistema, claro y oscuro. lo elegido se aplica, se guarda en sgspe.theme (lo que lee el script
// de arranque) y en las preferencias del usuario, como hace /admin

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  delete document.documentElement.dataset.theme
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

function start(routes: MockRoute[] = []) {
  abrirSesion(RELACIONISTA)
  window.history.pushState({}, '', '/')
  fetch = mockFetch([...routes, { path: '/auth/me/preferences', body: { theme: 'system', locale: null } }, ...rutasDeSesion(RELACIONISTA, SIN_PERMISOS)])
  render(<PortalApp />)
}

describe('menú de tema', () => {
  it('cambia el tema desde un menú, lo guarda en sgspe.theme y en las preferencias', async () => {
    start([{ method: 'PUT', path: '/auth/me/preferences', body: { theme: 'dark', locale: null } }])
    const button = await screen.findByRole('button', { name: /^Tema: Sistema/ })
    await userEvent.click(button)
    const menu = screen.getByRole('menu', { name: 'Tema' })
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent)
    ).toEqual(['Sistema', 'Claro', 'Oscuro'])

    await userEvent.click(within(menu).getByRole('menuitemradio', { name: 'Oscuro' }))
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('sgspe.theme')).toBe('dark')
    await waitFor(() => expect(fetch!.calls.find((c) => c.method === 'PUT' && c.path === '/auth/me/preferences')?.body).toEqual({ theme: 'dark' }))
  })
})
