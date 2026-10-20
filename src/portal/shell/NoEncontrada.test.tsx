import { screen } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { CompromisosRutas } from '../compromisos/CompromisosRutas'
import { NoEncontrada } from './NoEncontrada'

// rediseño de UX (2026-10-20): una ruta que no existe dentro de una sección (/commitments/<id>, un enlace incompleto) dejaba la
// página en blanco, sin decir nada ni ofrecer cómo seguir. ahora dice que no existe y lleva a la lista de su sección y al inicio
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('NoEncontrada', () => {
  it('dentro de una sección, lleva a su lista y al inicio', () => {
    montar(<NoEncontrada />, { ruta: '/commitments/abc/def' })
    expect(screen.getByText('Esta página no existe')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Compromisos' })).toHaveAttribute('href', '/commitments')
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  })

  it('fuera de toda sección, solo al inicio', () => {
    montar(<NoEncontrada />, { ruta: '/nada/por/aqui' })
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Ir a / })).not.toBeInTheDocument()
  })

  it('una sección con una ruta que no declara ya no queda en blanco', () => {
    fetch = mockFetch([])
    montar(<CompromisosRutas />, { ruta: '/commitments/b858205c', camino: '/commitments/*' })
    expect(screen.getByText('Esta página no existe')).toBeInTheDocument()
  })
})
