import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirSesion, RELACIONISTA, rutasDeSesion, SIN_PERMISOS } from '../test/portal'
import { crearI18n, fechaPe, NS, numeroPe } from './i18n'
import { PortalApp } from './PortalApp'
import { EN } from './textos/en'
import { ES } from './textos/es'

// RNF-I18N-001: español por defecto e inglés, con números y fechas es-PE en los dos; las etiquetas de la metadata de wasichai
// existen solo en español (CON-051)

let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

// las claves de un objeto de textos, aplanadas: "shell.salir"
function claves(textos: object, prefijo = ''): string[] {
  return Object.entries(textos).flatMap(([clave, valor]) =>
    typeof valor === 'string' ? [`${prefijo}${clave}`] : claves(valor as object, `${prefijo}${clave}.`)
  )
}

// las preferencias del usuario en el servidor, las mismas que lee y guarda /admin (GET y PUT /auth/me/preferences)
const preferencias = (locale: string | null): MockRoute => ({ path: '/auth/me/preferences', body: { theme: 'system', locale } })

function start(...extra: MockRoute[]) {
  abrirSesion(RELACIONISTA)
  window.history.pushState({}, '', '/')
  fetch = mockFetch([...rutasDeSesion(RELACIONISTA, SIN_PERMISOS), ...extra])
  render(<PortalApp />)
}

describe('i18n del portal', () => {
  it('en.ts tiene exactamente las claves de es.ts', () => {
    expect(claves(EN).sort()).toEqual(claves(ES).sort())
  })

  it('el español es el idioma por defecto', async () => {
    start()
    expect(await screen.findByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveValue('es')
    // WCAG 3.1.1: el idioma de la página es el del portal
    expect(document.documentElement.lang).toBe('es-PE')
  })

  it('con sgspe.lang en inglés, el login también habla inglés', async () => {
    localStorage.setItem('sgspe.lang', 'en')
    window.history.pushState({}, '', '/login')
    fetch = mockFetch([])
    render(<PortalApp />)
    expect(await screen.findByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('elegir inglés cambia los textos y lo guarda en sgspe.lang, la clave de /admin', async () => {
    start()
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Idioma' }), 'en')
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
    expect(localStorage.getItem('sgspe.lang')).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  // el idioma es una preferencia del usuario, no solo del navegador: /admin la guarda en el servidor y el portal igual
  it('elegir inglés lo guarda también en el servidor, como /admin', async () => {
    // el servidor contesta el PUT con lo guardado
    start({ method: 'PUT', path: '/auth/me/preferences', body: { theme: 'system', locale: 'en' } }, preferencias('es'))
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Idioma' }), 'en')
    await screen.findByRole('button', { name: 'Sign out' })
    await waitFor(() => {
      const put = fetch!.calls.find((call) => call.method === 'PUT' && call.path === '/auth/me/preferences')
      expect(put?.body).toEqual({ locale: 'en' })
    })
    expect(localStorage.getItem('sgspe.lang')).toBe('en')
  })

  // si el servidor rechaza el PUT, core devuelve el idioma anterior y vuelve a lanzar: el menú lo dice y no queda sin atender
  it('si el servidor rechaza guardar el idioma, vuelve al anterior y lo dice', async () => {
    start({ method: 'PUT', path: '/auth/me/preferences', status: 500, body: { title: 'Error', status: 500, detail: 'Fallo de prueba' } }, preferencias('es'))
    const selector = await screen.findByRole('combobox', { name: 'Idioma' })
    await userEvent.selectOptions(selector, 'en')
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el idioma')
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveValue('es'))
    expect(localStorage.getItem('sgspe.lang')).toBe('es')
    expect(document.documentElement.lang).toBe('es-PE')
    expect(selector).toHaveAttribute('title', expect.stringContaining('No se pudo guardar el idioma'))
  })

  it('el idioma guardado en el servidor se aplica al cargar y se recuerda en sgspe.lang', async () => {
    start(preferencias('en'))
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en')
    expect(localStorage.getItem('sgspe.lang')).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('los números y las fechas son es-PE en los dos idiomas', () => {
    const i18n = crearI18n()
    const cuando = new Date('2026-10-07T15:00:00Z')
    for (const idioma of ['es', 'en']) {
      i18n.addResource(idioma, NS, 'prueba', '{{n, number}} · {{d, datetime}}')
      expect(i18n.t('prueba', { ns: NS, lng: idioma, n: 12345.5, d: cuando })).toBe(`12,345.5 · ${fechaPe(cuando)}`)
    }
    expect(numeroPe(1234567.25)).toBe('1,234,567.25')
    // 03:00 UTC es todavía el 7 de octubre en Lima (UTC-5)
    expect(fechaPe(new Date('2026-10-08T03:00:00Z'))).toBe('7 oct. 2026')
  })
})
