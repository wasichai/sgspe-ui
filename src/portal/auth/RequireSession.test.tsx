import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirSesion, RELACIONISTA, rutasDeSesion, SIN_PERMISOS } from '../../test/portal'
import { PortalApp } from '../PortalApp'
import { safeNext } from './RequireSession'

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const aqui = () => window.location.pathname + window.location.search

// Review Focus 1: solo rutas internas después del login; lo que el navegador leería como otro host lleva al inicio
describe('safeNext', () => {
  it.each([
    ['/projects?x=1', '/projects?x=1'],
    ['/', '/'],
    [null, '/'],
    ['', '/'],
    ['//otro.example', '/'],
    ['/\\otro.example', '/'],
    ['/\t/otro.example', '/'],
    ['/\n/otro.example', '/'],
    ['https://otro.example', '/'],
    ['javascript:alert(1)', '/'],
    ['projects', '/'],
    ['\\x', '/'],
    ['/\r/x', '/'],
    ['/ /x', '/'],
    ['/\u00a0/x', '/'],
    ['/\u2028/x', '/'],
    ['/\u007f/x', '/'],
    ['/\u0000/x', '/'],
    // los porcentajes no se decodifican al navegar: son rutas internas del mismo origen, no otro host
    ['/%2F%2Fx', '/%2F%2Fx'],
    ['/%5Cx', '/%5Cx'],
    // volver al login después del login no lleva a ningún lado
    ['/login', '/'],
    ['/login?next=/projects', '/'],
    ['/login/x', '/'],
    ['/loginx', '/loginx']
  ])('%j lleva a %j', (next, esperado) => {
    expect(safeNext(next)).toBe(esperado)
  })
})

describe('safeNext, rutas largas', () => {
  it('acepta una ruta válida de 10 000 caracteres sin demora', () => {
    const larga = `/${'a'.repeat(9_999)}`
    const inicio = performance.now()
    expect(safeNext(larga)).toBe(larga)
    expect(performance.now() - inicio).toBeLessThan(100)
  })
})

describe('RequireSession', () => {
  it('lleva al login a quien no tiene sesión, guardando adónde iba', async () => {
    window.history.pushState({}, '', '/?vista=modulos')
    fetch = mockFetch([])
    render(<PortalApp />)
    expect(await screen.findByLabelText('Contraseña')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/?vista=modulos')
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  // Review Focus 4: un 401 a mitad de sesión borra el token, vuelve al login y, al entrar, regresa a donde estaba
  it('un 401 a mitad de sesión pide la contraseña en el lugar; quien prefiere salir va al login y vuelve a la misma ruta', async () => {
    abrirSesion(RELACIONISTA)
    window.history.pushState({}, '', '/?vista=modulos')
    fetch = mockFetch([{ path: '/auth/me/permissions', status: 401, body: { title: 'Unauthorized', status: 401 } }])
    render(<PortalApp />)
    const dialogo = await screen.findByRole('dialog', { name: 'Su sesión venció' })
    expect(localStorage.getItem('sgspe.token')).toBeNull()
    expect(aqui()).toBe('/?vista=modulos')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByLabelText('Correo')).toBeInTheDocument()
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/?vista=modulos')

    fetch.restore()
    fetch = mockFetch([
      { method: 'POST', path: '/auth/login', body: { token: 't2', expiresAt: '2026-12-31T00:00:00Z', user: RELACIONISTA } },
      ...rutasDeSesion(RELACIONISTA, SIN_PERMISOS)
    ])
    await userEvent.type(screen.getByLabelText('Correo'), RELACIONISTA.email)
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreta')
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('banner')).toBeInTheDocument()
    expect(aqui()).toBe('/?vista=modulos')
    expect(localStorage.getItem('sgspe.token')).toBe('t2')
  })
})
