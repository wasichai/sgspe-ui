import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createApiClient } from '@wasichai/core'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina } from '../../test/montar'
import { rutaActual } from '../../test/pantalla'
import { abrirSesion, permisos, RELACIONISTA, rutasDeSesion } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { PortalApp } from '../PortalApp'
import { conSesionRenovable } from '../api'

// design-system.md §6.5: con la sesión vencida (401) se vuelve a ingresar sin perder lo escrito: la pantalla no se desmonta
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

describe('el cliente con sesión renovable', () => {
  it('un 401 va a quien pide renovar la sesión; si nadie la renueva, al cierre de sesión de core', async () => {
    const base = createApiClient({ baseUrl: '/api', storagePrefix: 'prueba' })
    const { cliente, alVencerLaSesion } = conSesionRenovable(base)
    const cierreDeCore = vi.fn()
    cliente.setOnUnauthorized(cierreDeCore)
    const original = globalThis.fetch
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 401 })) as typeof globalThis.fetch
    try {
      const renovar = vi.fn(() => true)
      const quitar = alVencerLaSesion(renovar)
      await expect(cliente.request('/x')).rejects.toThrow()
      expect(renovar).toHaveBeenCalledTimes(1)
      expect(cierreDeCore).not.toHaveBeenCalled()
      quitar()
      await expect(cliente.request('/x')).rejects.toThrow()
      expect(cierreDeCore).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = original
    }
  })
})

describe('sesión vencida en el portal', () => {
  it('un 401 abre «Su sesión venció» sin ir al login; con la contraseña se renueva el token y la pantalla sigue', async () => {
    let vencida = true
    abrirSesion(RELACIONISTA)
    window.history.pushState({}, '', '/projects')
    fetch = mockFetch(rutasDeSesion(RELACIONISTA, permisos({ project: ['READ'] })))
    red = espiarRed([
      {
        path: /^\/objects\/project\/records/,
        responder: () => (vencida ? new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), { status: 401 }) : jsonResponse(pagina([])))
      },
      {
        method: 'POST',
        path: '/auth/login',
        responder: () => {
          vencida = false
          return jsonResponse({ token: 't-nuevo', expiresAt: '2026-10-20T00:00:00Z', user: { ...RELACIONISTA } })
        }
      }
    ])
    render(<PortalApp />)
    const dialogo = await screen.findByRole('dialog', { name: 'Su sesión venció' })
    expect(rutaActual()).toBe('/projects')
    expect(within(dialogo).getByText(RELACIONISTA.email)).toBeInTheDocument()
    await userEvent.type(within(dialogo).getByLabelText('Contraseña'), 'clave')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Ingresar' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Su sesión venció' })).not.toBeInTheDocument())
    expect(localStorage.getItem('sgspe.token')).toBe('t-nuevo')
    expect(rutaActual()).toBe('/projects')
  })
})
