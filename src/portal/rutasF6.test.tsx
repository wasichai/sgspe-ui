import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock, MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirPortal } from '../test/pantalla'
import { permisos } from '../test/portal'
import { ANALISTA_SIG, baseDeSig, CALIDAD_INVALIDAS, coleccion, EQUIPO_SIG, TABLERO_TERRITORIAL } from '../test/sig'

vi.mock('./mapa/Mapa', () => import('../test/mapaFalso'))

// las rutas de F6 en el portal entero (ux-architecture.md §6.2): el tablero territorial y la calidad de datos bajo la sección
// Territorio, con su guarda, y los enlaces de S12
let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const deSig = (catalogo: unknown[] = []): MockRoute[] => [
  { path: '/sgspe/dashboards/indicators', body: catalogo },
  ...baseDeSig(),
  { path: /^\/sgspe\/territory\/layers\//, body: coleccion([]) },
  { path: '/sgspe/dashboards/territory', body: TABLERO_TERRITORIAL },
  { path: '/sgspe/territory/data-quality', body: CALIDAD_INVALIDAS }
]

describe('rutas de F6', () => {
  it('/territory/dashboard es el tablero territorial y /territory/quality la calidad de datos', async () => {
    fetch = abrirPortal('/territory/dashboard?project=p1', ANALISTA_SIG, EQUIPO_SIG, deSig())
    expect(await screen.findByRole('heading', { name: 'Tablero territorial', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al mapa territorial' })).toHaveAttribute('href', '/territory?project=p1')
    cleanup()
    fetch.restore()
    fetch = abrirPortal('/territory/quality', ANALISTA_SIG, EQUIPO_SIG, deSig())
    expect(await screen.findByRole('heading', { name: 'Calidad de datos', level: 1 })).toBeInTheDocument()
  })

  it('S12 enlaza a la calidad de datos y, si el catálogo lo ofrece, al tablero territorial', async () => {
    fetch = abrirPortal(
      '/territory?project=p1',
      ANALISTA_SIG,
      EQUIPO_SIG,
      deSig([{ code: 'KPI-TER-02', label: 'Superficie', dashboard: 'territory', available: true }])
    )
    expect(await screen.findByRole('link', { name: 'Tablero territorial' })).toHaveAttribute('href', '/territory/dashboard?project=p1')
    // la calidad de datos va en «Más acciones» (DD-11); el cambio entre el mapa y el tablero queda a la vista
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    expect(screen.getByRole('link', { name: 'Calidad de datos' })).toHaveAttribute('href', '/territory/quality')
    cleanup()
    fetch.restore()
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, deSig())
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
    await screen.findByRole('link', { name: 'Calidad de datos' })
    expect(screen.queryByRole('link', { name: 'Tablero territorial' })).not.toBeInTheDocument()
  })

  it('sin leer el territorio, la sección no se ofrece ni abre sus rutas de F6', async () => {
    fetch = abrirPortal('/territory/quality', ANALISTA_SIG, permisos({ project: ['READ'] }), deSig())
    expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).queryByRole('link', { name: 'Territorio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Calidad de datos', level: 1 })).not.toBeInTheDocument()
  })
})
