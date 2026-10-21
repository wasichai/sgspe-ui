import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ANALISTA, baseDeIa, EQUIPO_IA, GERENCIA_IA, SOLO_ASISTENTE, SUG_DUPLICADO, TRANSICIONES_DE_SUGERENCIA } from '../test/ia'
import { pagina } from '../test/montar'
import { abrirPortal } from '../test/pantalla'

// las rutas de F7 en el portal entero (ux-architecture.md §6.2): la bandeja bajo el proyecto, con su pestaña, para quien lee las
// sugerencias o los candidatos
let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('rutas de F7', () => {
  it('la bandeja vive bajo el proyecto, con su pestaña', async () => {
    fetch = abrirPortal('/projects/p1/ai-review', GERENCIA_IA, EQUIPO_IA, [
      { path: '/objects/ai_suggestion/records', body: pagina([]) },
      { path: '/objects/commitment_candidate/records', body: pagina([]) },
      ...baseDeIa()
    ])
    expect(await screen.findByRole('heading', { name: 'Bandeja de revisión de IA' })).toBeInTheDocument()
    // la pestaña vive en «Más» (revisión de UX, decisión 2): abierta, el botón la nombra y la marca
    const mas = screen.getByRole('button', { name: 'Más secciones del proyecto: Bandeja de IA' })
    expect(mas).toHaveAttribute('aria-current', 'page')
    await userEvent.click(mas)
    expect(within(screen.getByRole('group', { name: 'Más secciones del proyecto' })).getByRole('link', { name: 'Bandeja de IA' })).toHaveAttribute(
      'href',
      '/projects/p1/ai-review'
    )
  })

  it('el posible duplicado vive bajo la bandeja', async () => {
    fetch = abrirPortal('/projects/p1/ai-review/s3', GERENCIA_IA, EQUIPO_IA, [
      { path: '/objects/ai_suggestion/records/s3', body: SUG_DUPLICADO },
      { path: '/objects/ai_suggestion/records/s3/transitions', body: TRANSICIONES_DE_SUGERENCIA },
      ...baseDeIa()
    ])
    expect(await screen.findByRole('heading', { name: 'Posible duplicado' })).toBeInTheDocument()
  })

  it('quien no lee propuestas no ve la pestaña y la ruta dice que no puede abrirla', async () => {
    fetch = abrirPortal('/projects/p1/ai-review', ANALISTA, SOLO_ASISTENTE, baseDeIa())
    expect(await screen.findByRole('heading', { name: 'No puede abrir «Proyectos»' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bandeja de IA' })).not.toBeInTheDocument()
  })
})
