import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
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

function start() {
  abrirSesion(RELACIONISTA)
  window.history.pushState({}, '', '/')
  fetch = mockFetch(rutasDeSesion(RELACIONISTA, SIN_PERMISOS))
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
    expect(document.documentElement.lang).toBe('es')
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
