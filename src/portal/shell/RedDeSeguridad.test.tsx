import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, ADMIN_PERMISOS, ADMINISTRACION, rutasDeSesion } from '../../test/portal'
import { ErrorDeSgspe } from '../datos/http'
import { PortalApp } from '../PortalApp'

// D1 de la revisión de UX: un error de render en una pantalla o en el panel del asistente no tumba el portal. la pantalla
// que falla lo dice dentro del shell, con el código para soporte si el error lo trae y «Volver al inicio»
const registradas = vi.hoisted(() => ({}) as Record<string, ComponentType>)
vi.mock('../pantallas', () => ({ PANTALLAS: registradas, RUTAS_ADICIONALES: [] }))

const falla = (error: Error) =>
  function Rompe(): never {
    throw error
  }

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  for (const clave of Object.keys(registradas)) delete registradas[clave]
  // React y React Router escriben el error en la consola: aquí es lo esperado
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  fetch?.restore()
  fetch = null
  vi.restoreAllMocks()
})

function abrir(ruta: string, ia?: unknown) {
  abrirSesion(ADMINISTRACION)
  window.history.pushState({}, '', ruta)
  fetch = mockFetch([...rutasDeSesion(ADMINISTRACION, ADMIN_PERMISOS), ...(ia ? [{ path: '/sgspe/ai/status', body: ia }] : [])])
  render(<PortalApp />)
}

describe('red de seguridad del portal', () => {
  it('una pantalla que falla lo dice dentro del shell y ofrece volver al inicio', async () => {
    registradas.projects = falla(new Error('x is undefined'))
    abrir('/projects')
    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByText('Esta pantalla no se pudo mostrar')).toBeInTheDocument()
    expect(screen.queryByText('x is undefined')).not.toBeInTheDocument()
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument()
    // el shell sigue: la barra lateral y la superior
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument()
    await userEvent.click(within(alerta).getByRole('link', { name: 'Volver al inicio' }))
    expect(window.location.pathname).toBe('/')
    expect(screen.queryByText('Esta pantalla no se pudo mostrar')).not.toBeInTheDocument()
  })

  it('si el error viene de la API, muestra su código para soporte', async () => {
    registradas.projects = falla(new ErrorDeSgspe(500, 'Internal', [], 'corr-123'))
    abrir('/projects')
    expect(await screen.findByText('Código para soporte: corr-123')).toBeInTheDocument()
  })

  it('un estado de la IA fuera de contrato (sin useCases) no rompe el asistente ni el portal', async () => {
    abrir('/', { enabled: true, providerAvailable: true })
    const preguntar = await within(await screen.findByRole('banner')).findByRole('button', { name: 'Preguntar' })
    await userEvent.click(preguntar)
    expect(await screen.findByRole('dialog', { name: 'Asistente de IA' })).toBeInTheDocument()
    expect(screen.queryByText('El asistente no se pudo mostrar', { exact: false })).not.toBeInTheDocument()
    // el diálogo modal oculta lo demás a la accesibilidad, pero sigue montado
    expect(screen.getByRole('navigation', { name: 'Secciones', hidden: true })).toBeInTheDocument()
  })
})
