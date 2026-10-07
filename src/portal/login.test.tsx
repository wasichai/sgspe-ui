import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirSesion, RELACIONISTA, rutasDeSesion, SIN_PERMISOS } from '../test/portal'
import { irA } from './auth/navegacion'
import { PortalApp } from './PortalApp'

// la navegación completa del navegador (window.location.assign) no existe en jsdom: se observa por este módulo
vi.mock('./auth/navegacion', () => ({ irA: vi.fn() }))

// el login del portal: la sesión de core (POST /api/auth/login, guardada bajo sgspe.*) y RequireSession delante del marco

let fetch: FetchMock | null = null
beforeEach(() => {
  vi.mocked(irA).mockClear()
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

  // design-system.md §7: landmarks; el formulario está en <main>
  it('el formulario está en el landmark principal', async () => {
    start('/login', [])
    const principal = await screen.findByRole('main')
    expect(within(principal).getByLabelText('Correo')).toBeInTheDocument()
    expect(within(principal).getByRole('heading', { level: 1, name: 'SGSPE' })).toBeInTheDocument()
  })

  // quien aún no tiene sesión también puede elegir el idioma (sin sesión no hay preferencias que guardar en el servidor)
  it('se puede cambiar el idioma antes de iniciar sesión', async () => {
    start('/login', [])
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Idioma' }), 'en')
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(localStorage.getItem('sgspe.lang')).toBe('en')
    expect(fetch!.calls.find((call) => call.method === 'PUT')).toBeUndefined()
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
    // el portal trata de usted en todo (Su cuenta, Le damos la bienvenida)
    expect(alerta).toHaveTextContent('Inténtelo de nuevo')
    expect(alerta).not.toHaveTextContent('Correo o contraseña incorrectos')
  })

  it.each(['//otro.example', '/\\otro.example', '/\t/otro.example'])('va al inicio en lugar de a otro sitio: %j', async (next) => {
    start(`/login?next=${encodeURIComponent(next)}`, [login(), ...rutasDeSesion(RELACIONISTA, SIN_PERMISOS)])
    await ingresar('relacionista@sgspe.test', 'secreta')
    expect(await screen.findByRole('banner')).toBeInTheDocument()
    expect(aqui()).toBe('/')
  })

  // /admin es otra app del mismo bundle: el router del portal no la conoce, así que se llega con una navegación completa
  it.each(['/admin', '/admin/admin/roles', '/admin?vista=1'])('next=%s va a la consola de administración, no a la ruta del portal', async (next) => {
    start(`/login?next=${encodeURIComponent(next)}`, [login(), ...rutasDeSesion(RELACIONISTA, SIN_PERMISOS)])
    await ingresar('relacionista@sgspe.test', 'secreta')
    await waitFor(() => expect(irA).toHaveBeenCalledWith(next))
    expect(irA).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Esta página no existe')).not.toBeInTheDocument()
  })

  it('con la sesión ya abierta, next=/admin también sale a la consola', async () => {
    abrirSesion(RELACIONISTA)
    start('/login?next=%2Fadmin%2Fadmin%2Froles', rutasDeSesion(RELACIONISTA, SIN_PERMISOS))
    await waitFor(() => expect(irA).toHaveBeenCalledWith('/admin/admin/roles'))
  })

  // solo /admin y /admin/…; /administracion es una ruta del portal (que no existe) y /adminx no es de admin
  it.each(['/administracion', '/adminx/roles'])('%s sigue por el router del portal', async (next) => {
    start(`/login?next=${encodeURIComponent(next)}`, [login(), ...rutasDeSesion(RELACIONISTA, SIN_PERMISOS)])
    await ingresar('relacionista@sgspe.test', 'secreta')
    expect(await screen.findByText('Esta página no existe')).toBeInTheDocument()
    expect(irA).not.toHaveBeenCalled()
  })
})
