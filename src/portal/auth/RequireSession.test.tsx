import { render, screen } from '@testing-library/react'
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
    ['projects', '/']
  ])('%j lleva a %j', (next, esperado) => {
    expect(safeNext(next)).toBe(esperado)
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
  it('un 401 a mitad de sesión vuelve al login y después regresa a la misma ruta', async () => {
    abrirSesion(RELACIONISTA)
    window.history.pushState({}, '', '/?vista=modulos')
    fetch = mockFetch([{ path: '/auth/me/permissions', status: 401, body: { title: 'Unauthorized', status: 401 } }])
    render(<PortalApp />)
    expect(await screen.findByLabelText('Contraseña')).toBeInTheDocument()
    expect(localStorage.getItem('sgspe.token')).toBeNull()
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
