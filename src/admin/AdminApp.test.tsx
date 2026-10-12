import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AdminApp, configDeAdministracion } from './AdminApp'

const admin = { id: 'u1', email: 'admin@wasichai.local', displayName: 'Administración de prueba', organizationId: 'o1', roles: ['ADMIN'] }

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.documentElement.lang = 'es-PE'
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
  // spec F6 elección 9: /admin arma el mismo mapa base que el portal después del login, para GeometryField y el componente MAP
  it('después del login pide el mapa base de la organización', async () => {
    await signIn()
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/sgspe/map/settings')).toBe(true))
  })

  it('inicia sesión con el admin sembrado y guarda la sesión bajo sgspe.*', async () => {
    await signIn()
    expect(screen.getAllByText('SGSPE').length).toBeGreaterThan(0)
    expect(localStorage.getItem('sgspe.token')).toBe('t')
  })

  // los starters de F1 (views, forms y pages), los de F2 (gis y workflow) y los de F3 (documents y automation); ningún módulo
  // que el backend no corre, ni el asistente
  it('agrega las pantallas de los starters de F1 a F3 y solo esas', async () => {
    await signIn()
    for (const label of ['Vistas', 'Formularios', 'Páginas', 'Workflows', 'Mapas', 'Capas', 'Documentos', 'Reglas', 'Ejecuciones']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    for (const label of ['Asistente']) {
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

  // core no toca <html lang>: /admin lo sigue con el idioma de la interfaz (WCAG 3.1.1), con es-PE para el español
  it('<html lang> es es-PE en español y sigue al idioma guardado', async () => {
    document.documentElement.lang = ''
    fetch = mockFetch([])
    const { unmount } = render(<AdminApp />)
    expect(await screen.findByLabelText('Correo')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es-PE')
    unmount()

    localStorage.setItem('sgspe.lang', 'en')
    render(<AdminApp />)
    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
  })

  // los formularios de registro de /admin (DynamicForm) leen y escriben los DATETIME en la hora de Lima, no en la del navegador
  it('fija el huso de Lima para los DATETIME', () => {
    expect(configDeAdministracion.timeZone).toBe('America/Lima')
  })
})
