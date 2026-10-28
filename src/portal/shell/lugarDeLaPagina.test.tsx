import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { GERENCIA_SOCIAL } from '../../test/portal'
import { base, LEE } from '../../test/grupos'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

// tercera pasada de UX, 3.6: el primer tabulador salta al contenido, y avanzar a otra página lleva el foco a su título, así que un
// lector de pantalla oye dónde llegó y el teclado sigue desde ahí
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('el lugar de la página', () => {
  it('«Saltar al contenido» es el primer tabulador y lleva el foco al contenido', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    await screen.findByRole('table', { name: 'Grupos de interés' })
    await userEvent.tab()
    const saltar = screen.getByRole('link', { name: 'Saltar al contenido' })
    expect(saltar).toHaveFocus()
    await userEvent.click(saltar)
    expect(screen.getByRole('main')).toHaveFocus()
    expect(rutaActual()).toBe('/projects/p1/stakeholders')
  })

  it('al abrir una ficha desde la lista, el foco va a su título', async () => {
    fetch = abrirPortal('/projects/p1/stakeholders', GERENCIA_SOCIAL, LEE, base(GERENCIA_SOCIAL, true))
    const tabla = await screen.findByRole('table', { name: 'Grupos de interés' })
    await userEvent.click(await within(tabla).findByRole('link', { name: 'Ronda campesina Tunas' }))
    const titulo = await screen.findByRole('heading', { level: 1, name: 'Ronda campesina Tunas' })
    await waitFor(() => expect(titulo).toHaveFocus())
  })
})
