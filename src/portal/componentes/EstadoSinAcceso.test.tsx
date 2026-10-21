import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { EstadoSinAcceso } from './EstadoSinAcceso'

// quien llega por la URL a lo que su cuenta no abre (hallazgo U-09, DD-12): un bloque que dice qué no puede abrir, por qué en
// lenguaje llano, a quién pedirlo y cómo volver, en lugar de una línea de advertencia sin salida
const ENFOCABLES = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
const bloque = (que: string) => screen.getByRole('region', { name: `No puede abrir «${que}»` })

describe('EstadoSinAcceso', () => {
  it('dice qué no puede abrir, por qué y a quién pedirlo, con la administración si no se sabe a quién', () => {
    montar(<EstadoSinAcceso que="Compromisos" aQuien={null} volver={{ etiqueta: 'Volver al inicio', a: '/' }} />)
    const region = bloque('Compromisos')
    expect(screen.getByRole('heading', { name: 'No puede abrir «Compromisos»' })).toBeInTheDocument()
    expect(region).toHaveTextContent('Su cuenta no tiene acceso a esta sección')
    expect(region).toHaveTextContent('pídalo a la administración de su organización')
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
  })

  it('con un nombre, dice a quién pedirlo', () => {
    montar(<EstadoSinAcceso que="Riesgos" aQuien="la jefatura del proyecto" volver={{ etiqueta: 'Volver al proyecto', a: '/projects/p-1' }} />)
    const region = bloque('Riesgos')
    expect(region).toHaveTextContent('pídalo a la jefatura del proyecto')
    expect(region).not.toHaveTextContent('la administración de su organización')
    expect(screen.getByRole('link', { name: 'Volver al proyecto' })).toHaveAttribute('href', '/projects/p-1')
  })

  // CA-1.8.1: el acceso se explica sin nombrar roles ni permisos técnicos
  it('no nombra roles ni permisos técnicos', () => {
    montar(<EstadoSinAcceso que="Compromisos" aQuien={null} volver={{ etiqueta: 'Volver al inicio', a: '/' }} />)
    const texto = bloque('Compromisos').textContent ?? ''
    expect(texto).not.toMatch(/\b[A-Z]+(?:_[A-Z]+)+\b/)
    expect(texto).not.toMatch(/\b(?:READ|CREATE|UPDATE|DELETE|ADMIN)\b/)
  })

  // CA-1.8.2: la salida es lo primero que se alcanza con el teclado dentro del bloque
  it('el enlace para volver es el primer elemento enfocable del bloque', () => {
    montar(<EstadoSinAcceso que="Compromisos" aQuien={null} volver={{ etiqueta: 'Volver al inicio', a: '/' }} />)
    const enfocables = bloque('Compromisos').querySelectorAll(ENFOCABLES)
    expect(enfocables.length).toBeGreaterThan(0)
    expect(enfocables[0]).toBe(screen.getByRole('link', { name: 'Volver al inicio' }))
  })

  it('el ícono es decorativo', () => {
    montar(<EstadoSinAcceso que="Compromisos" aQuien={null} volver={{ etiqueta: 'Volver al inicio', a: '/' }} />)
    const icono = bloque('Compromisos').querySelector('svg')
    expect(icono).not.toBeNull()
    expect(icono).toHaveAttribute('aria-hidden', 'true')
  })

  it('en inglés, con la administración como destino', () => {
    localStorage.setItem('sgspe.lang', 'en')
    try {
      montar(<EstadoSinAcceso que="Commitments" aQuien={null} volver={{ etiqueta: 'Back to home', a: '/' }} />)
      const region = screen.getByRole('region', { name: 'You cannot open “Commitments”' })
      expect(region).toHaveTextContent('ask your organization’s administration')
    } finally {
      localStorage.removeItem('sgspe.lang')
    }
  })
})
