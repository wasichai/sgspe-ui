import { cleanup, screen, within } from '@testing-library/react'
import type { FetchMock, MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { P1 } from '../test/compromisos'
import { APORTE, baseDeInversion, EQUIPO_DE_INVERSION, INVERSION, PROGRAMA } from '../test/inversion'
import { pagina } from '../test/montar'
import { abrirPortal } from '../test/pantalla'
import { permisos } from '../test/portal'
import { rutaEquivalente } from './contexto/rutas'

vi.mock('./graficos/Grafico', () => import('../test/graficoFalso'))
vi.mock('./documentos/exif', () => ({ leerExif: async () => ({}) }))

// las rutas de F5 en el portal entero (ux-architecture.md §6.2): la sección Programas sociales con su guarda, la pestaña del
// proyecto, S42 global y de un proyecto, el tablero de inversión y las fichas de un programa y de un aporte bajo su proyecto
let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const deInversion = (): MockRoute[] => [
  { path: '/objects/project/records', body: pagina([P1]) },
  { path: '/sgspe/dashboards/indicators', body: [] },
  { path: '/auth/me/notifications/summary', status: 404, body: { title: 'Not Found', status: 404 } },
  ...baseDeInversion(),
  { path: '/sgspe/dashboards/investment', body: { dashboard: 'investment', computedAt: '2026-10-10T15:00:00Z', filters: {}, indicators: [] } },
  { path: '/objects/social_program/records/sp1', body: PROGRAMA },
  { path: '/objects/social_contribution/records/a1', body: APORTE },
  { path: /^\/objects\/(social_program|social_contribution)\/records\/(sp1|a1)\/(transitions|history)/, body: [] },
  { path: /^\/objects\/[a-z_]+\/records\?/, body: pagina([]) },
  { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } }
]

describe('rutas de F5', () => {
  it('la sección Programas sociales se ofrece y /programs abre S42 de todos los proyectos', async () => {
    fetch = abrirPortal('/programs', INVERSION, EQUIPO_DE_INVERSION, deInversion())
    expect(await screen.findByRole('heading', { name: 'Programas sociales', level: 1 })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Programas sociales' })).toHaveAttribute('href', '/programs')
  })

  it('la pestaña del proyecto lleva a S42; programs/dashboard es el tablero y programs/sp1 la ficha del programa', async () => {
    fetch = abrirPortal('/projects/p1/programs', INVERSION, EQUIPO_DE_INVERSION, deInversion())
    expect(await screen.findByRole('heading', { name: 'Programas sociales', level: 1 })).toBeInTheDocument()
    const pestanas = screen.getByRole('navigation', { name: 'Secciones del proyecto' })
    expect(within(pestanas).getByRole('link', { name: 'Programas sociales' })).toHaveAttribute('href', '/projects/p1/programs')
    cleanup()
    fetch.restore()
    fetch = abrirPortal('/projects/p1/programs/dashboard', INVERSION, EQUIPO_DE_INVERSION, deInversion())
    expect(await screen.findByRole('heading', { name: 'Tablero de inversión social', level: 1 })).toBeInTheDocument()
    cleanup()
    fetch.restore()
    fetch = abrirPortal('/projects/p1/programs/sp1', INVERSION, EQUIPO_DE_INVERSION, deInversion())
    expect(await screen.findByRole('heading', { name: 'Programa Ejemplo de agua segura', level: 1 })).toBeInTheDocument()
  })

  it('contributions/a1 es la ficha de un aporte bajo su proyecto', async () => {
    fetch = abrirPortal('/projects/p1/contributions/a1', INVERSION, EQUIPO_DE_INVERSION, deInversion())
    expect(await screen.findByRole('heading', { name: 'Aporte AP-001', level: 1 })).toBeInTheDocument()
  })

  it('sin READ sobre programas ni aportes, la ruta lo dice y la sección no se ofrece', async () => {
    fetch = abrirPortal('/programs', INVERSION, permisos({ project: ['READ'], commitment: ['READ'] }), deInversion())
    expect(await screen.findByRole('heading', { name: 'No puede abrir «Programas sociales»' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).queryByRole('link', { name: 'Programas sociales' })).not.toBeInTheDocument()
  })

  it.each([
    ['/programs', 'p1', '/projects/p1/programs'],
    ['/programs/dashboard', 'p1', '/projects/p1/programs/dashboard'],
    ['/projects/p1/programs/sp1', 'p2', '/projects/p2/programs'],
    ['/projects/p1/contributions/a1', 'p2', '/projects/p2/programs'],
    ['/projects/p1/programs/dashboard', 'p2', '/projects/p2/programs/dashboard'],
    ['/projects/p1/contributions/a1', null, '/programs'],
    ['/projects/p1/programs/dashboard', null, '/programs/dashboard']
  ])('el selector de proyecto lleva de %s (proyecto %s) a %s', (desde, proyecto, hacia) => {
    expect(rutaEquivalente(desde, proyecto)).toBe(hacia)
  })
})
