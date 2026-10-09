import { render } from '@testing-library/react'
import type { AuthUser, CallerPermissions } from '@wasichai/core'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { PortalApp } from '../portal/PortalApp'
import { abrirSesion, rutasDeSesion } from './portal'

// abre el portal entero en una ruta, con una sesión y lo que contesta la API: las pantallas se prueban con su ruta, su
// guarda de sección y su shell reales
export function abrirPortal(ruta: string, usuario: AuthUser, permisos: CallerPermissions, rutas: MockRoute[]): FetchMock {
  abrirSesion(usuario)
  window.history.pushState({}, '', ruta)
  const fetch = mockFetch([...rutas, ...rutasDeSesion(usuario, permisos)])
  render(<PortalApp />)
  return fetch
}

// la ruta de la pantalla actual del portal
export const rutaActual = () => window.location.pathname + window.location.search
