import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RELACIONISTA, rutasDeSesion, SIN_PERMISOS } from '../test/portal'
import { PortalApp } from './PortalApp'

// el login del portal: la sesión de core (POST /api/auth/login, guardada bajo sgspe.*) y RequireSession delante del marco

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const login = (status = 200): MockRoute =>
  status === 200
    ? { method: 'POST', path: '/auth/login', body: { token: 't', expiresAt: '2026-12-31T00:00:00Z', user: RELACIONISTA } }
    : { method: 'POST', path: '/auth/login', status, body: { title: 'Error', status, detail: 'Fallo de prueba' } }

function start(path: string, routes: MockRoute[]) {
  window.history.pushState({}, '', path)
  fetch = mockFetch(routes)
  render(<PortalApp />)
}

async function ingresar(email: string, password: string) {
  const correo = await screen.findByLabelText('Correo')
  await userEvent.clear(correo)
  await userEvent.type(correo, email)
  await userEvent.type(screen.getByLabelText('Contraseña'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
}

const aqui = () => window.location.pathname + window.location.search

describe('login', () => {
  it('entra con las credenciales correctas, guarda la sesión bajo sgspe.* y sigue a next', async () => {
    start('/?vista=modulos', [login(), ...rutasDeSesion(RELACIONISTA, SIN_PERMISOS)])
    await ingresar('relacionista@sgspe.test', 'secreta')

    expect(await screen.findByRole('banner')).toBeInTheDocument()
    expect(aqui()).toBe('/?vista=modulos')
    const post = fetch!.calls.find((call) => call.method === 'POST' && call.path === '/auth/login')
    expect(post?.body).toEqual({ email: 'relacionista@sgspe.test', password: 'secreta' })
    expect(localStorage.getItem('sgspe.token')).toBe('t')
    expect(JSON.parse(localStorage.getItem('sgspe.user') ?? 'null')).toEqual(RELACIONISTA)
  })

  // el administrador sembrado es el login de desarrollo de /admin; el portal empieza vacío
  it('no propone ningún correo', async () => {
    start('/login', [])
    expect(await screen.findByLabelText('Correo')).toHaveValue('')
  })

  it('dice si las credenciales son incorrectas y no guarda sesión', async () => {
    start('/login', [login(401)])
    await ingresar('relacionista@sgspe.test', 'equivocada')
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos')
    expect(window.location.pathname).toBe('/login')
    expect(localStorage.getItem('sgspe.token')).toBeNull()
  })

  it('distingue cualquier otro fallo de las credenciales incorrectas', async () => {
    start('/login', [login(503)])
    await ingresar('relacionista@sgspe.test', 'secreta')
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('No se pudo iniciar sesión')
    expect(alerta).not.toHaveTextContent('Correo o contraseña incorrectos')
  })

  it('va al inicio en lugar de a otro sitio', async () => {
    start('/login?next=//otro.example', [login(), ...rutasDeSesion(RELACIONISTA, SIN_PERMISOS)])
    await ingresar('relacionista@sgspe.test', 'secreta')
    expect(await screen.findByRole('banner')).toBeInTheDocument()
    expect(aqui()).toBe('/')
  })
})
