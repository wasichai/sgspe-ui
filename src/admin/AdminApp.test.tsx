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

  // la marca del portal (la montaña de la cabecera) también en la barra y en la cabecera angosta de /admin (core 1.7.0 y 1.8.0,
  // appLogo): las dos caras de SGSPE se reconocen como el mismo producto
  it('muestra la marca del portal en la barra lateral y en la cabecera angosta', async () => {
    await signIn()
    const marcas = document.querySelectorAll('[data-slot="app-logo"]')
    expect(marcas).toHaveLength(2)
    for (const marca of marcas) {
      expect(marca).toHaveAttribute('aria-hidden')
      expect(marca.querySelector('[data-marca="sgspe"] svg')).not.toBeNull()
    }
  })

  // a 390 px la barra lateral es un cajón (core 1.3.1): se abre con «Abrir el menú» como un diálogo con nombre y, abierto,
  // Tab no sale de él (core 1.8.2, wasichai/wasichai-ui#179); Escape lo cierra y el foco vuelve al botón
  it('el menú angosto abre un cajón que atrapa el foco y se cierra con Escape', async () => {
    await signIn()
    const boton = screen.getByRole('button', { name: 'Abrir el menú' })
    await userEvent.click(boton)
    const cajon = screen.getByRole('dialog', { name: 'Menú' })
    expect(cajon).toHaveAttribute('aria-modal', 'true')
    for (let i = 0; i < 40; i++) {
      await userEvent.tab()
      expect(cajon).toContainElement(document.activeElement as HTMLElement)
    }
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Menú' })).not.toBeInTheDocument()
    expect(boton).toHaveFocus()
  })

  // los formularios de registro de /admin (DynamicForm) leen y escriben los DATETIME en la hora de Lima, no en la del navegador
  it('fija el huso de Lima para los DATETIME', () => {
    expect(configDeAdministracion.timeZone).toBe('America/Lima')
  })

  // el modelo, los workflows y los roles viven en model/ de sgspe (GAP-030): /admin avisa que un cambio hecho allí se pierde
  // en la próxima subida de fase (W-05, @wasichai/core 1.1.0)
  it('declara que el modelo vive en el repositorio', () => {
    expect(configDeAdministracion.modelInRepository).toBe(true)
  })
})
