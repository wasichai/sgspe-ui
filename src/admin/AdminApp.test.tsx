import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AdminApp } from './AdminApp'

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Administración de prueba', organizationId: 'o1', roles: ['ADMIN'] }

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  window.history.pushState({}, '', '/admin')
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

// monta la app de verdad y entra por su formulario; lo demás recibe el 404 del mock
async function signIn() {
  fetch = mockFetch([
    { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: admin } },
    { path: '/auth/me/permissions', body: { admin: true, objects: {} } },
    { path: '/objects', body: [] }
  ])
  render(<AdminApp />)
  const email = await screen.findByLabelText('Correo')
  // en desarrollo, el login de /admin propone el administrador sembrado
  expect(email).toHaveValue('admin@wasichai.local')
  await userEvent.type(screen.getByLabelText('Contraseña'), 'admin')
  await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
}

describe('admin', () => {
  it('inicia sesión con el admin sembrado y guarda la sesión bajo sgspe.*', async () => {
    await signIn()
    expect(screen.getAllByText('SGSPE').length).toBeGreaterThan(0)
    expect(localStorage.getItem('sgspe.token')).toBe('t')
  })

  // los starters de F1: views, forms y pages; ningún módulo que el backend no corre, ni el asistente
  it('agrega las pantallas de los starters de F1 y solo esas', async () => {
    await signIn()
    for (const label of ['Vistas', 'Formularios', 'Páginas']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    for (const label of ['Workflows', 'Documentos', 'Mapas', 'Capas', 'Reglas', 'Asistente']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
    }
  })

  // el tema del portal es el de /admin: el que se elige en un lado se ve en el otro
  it('abre con el tema que guardó el portal y guarda el que se elige', async () => {
    localStorage.setItem('sgspe.theme', 'dark')
    await signIn()
    expect(document.documentElement.dataset.theme).toBe('dark')
    const theme = screen.getByRole('combobox', { name: 'Tema' })
    expect(theme).toHaveValue('dark')
    await userEvent.selectOptions(theme, 'light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('sgspe.theme')).toBe('light')
  })
})
