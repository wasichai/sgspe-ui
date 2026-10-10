import { cleanup, screen, within } from '@testing-library/react'
import type { FetchMock, MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeAtencion, EQUIPO_DE_QUEJAS, GESTORA_DE_QUEJAS, QUEJA } from '../test/atencion'
import { P1 } from '../test/compromisos'
import { pagina } from '../test/montar'
import { abrirPortal } from '../test/pantalla'
import { permisos } from '../test/portal'
import { baseDeRiesgos, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS, RIESGO } from '../test/riesgos'
import { rutaEquivalente } from './contexto/rutas'

vi.mock('./graficos/Grafico', () => import('../test/graficoFalso'))

// las rutas de F4 en el portal entero (ux-architecture.md §6.2): las secciones Quejas, consultas y solicitudes y Riesgos con su
// guarda, las pestañas del proyecto, las fichas de una queja y de un riesgo (las rutas fijas de risks/ ganan a la ficha), el
// tablero de riesgos como entrada de /risks (S62) y Reportes con los permisos de exportar de F4
let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const comunes: MockRoute[] = [
  { path: '/objects/project/records', body: pagina([P1]) },
  { path: '/sgspe/dashboards/indicators', body: [] },
  { path: '/auth/me/notifications/summary', status: 404, body: { title: 'Not Found', status: 404 } }
]

const deQuejas = (): MockRoute[] => [
  ...comunes,
  ...baseDeAtencion(),
  { path: '/objects/grievance/records/g1', body: QUEJA },
  { path: /^\/objects\/(grievance|inquiry|stakeholder_request)\/records\?/, body: pagina([]) }
]

const deRiesgos = (): MockRoute[] => [
  ...comunes,
  ...baseDeRiesgos(),
  { path: '/objects/social_risk/records/k1', body: RIESGO },
  { path: /^\/objects\/social_risk\/records\?/, body: pagina([RIESGO]) }
]

describe('rutas de F4', () => {
  it('la sección de QCS del proyecto abre la lista unificada, con las pestañas de F4 en Project 360', async () => {
    fetch = abrirPortal('/projects/p1/attention', GESTORA_DE_QUEJAS, EQUIPO_DE_QUEJAS, deQuejas())
    expect(await screen.findByRole('heading', { name: 'Quejas, consultas y solicitudes', level: 1 })).toBeInTheDocument()
    const pestanas = screen.getByRole('navigation', { name: 'Secciones del proyecto' })
    expect(within(pestanas).getByRole('link', { name: 'Quejas y consultas' })).toHaveAttribute('href', '/projects/p1/attention')
    // la gestión de quejas lee los riesgos (security.md §7.6): la pestaña Riesgos lleva al registro del proyecto
    expect(within(pestanas).getByRole('link', { name: 'Riesgos' })).toHaveAttribute('href', '/projects/p1/risks')
    const secciones = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(secciones).getByRole('link', { name: 'Quejas, consultas y solicitudes' })).toBeInTheDocument()
  })

  it('la ficha de una queja vive bajo su proyecto', async () => {
    fetch = abrirPortal('/projects/p1/grievances/g1', GESTORA_DE_QUEJAS, EQUIPO_DE_QUEJAS, deQuejas())
    expect(await screen.findByRole('heading', { name: 'Queja Q-001', level: 1 })).toBeInTheDocument()
  })

  it('/risks es el tablero de riesgos (S62); risks/register del proyecto es el registro y risks/k1 la ficha', async () => {
    fetch = abrirPortal('/risks', GESTOR_DE_RIESGOS, EQUIPO_DE_RIESGOS, deRiesgos())
    expect(await screen.findByRole('heading', { name: 'Tablero de riesgos', level: 1 })).toBeInTheDocument()
  })

  it('el registro y la ficha de un riesgo viven bajo el proyecto', async () => {
    fetch = abrirPortal('/projects/p1/risks/register', GESTOR_DE_RIESGOS, EQUIPO_DE_RIESGOS, deRiesgos())
    expect(await screen.findByRole('heading', { name: 'Riesgos', level: 1 })).toBeInTheDocument()
    cleanup()
    fetch.restore()
    fetch = abrirPortal('/projects/p1/risks/k1', GESTOR_DE_RIESGOS, EQUIPO_DE_RIESGOS, deRiesgos())
    expect(await screen.findByRole('heading', { name: 'Bloqueo de la vía de acceso por la comunidad', level: 1 })).toBeInTheDocument()
  })

  it('sin READ sobre las QCS, la ruta lo dice y la sección no se ofrece', async () => {
    fetch = abrirPortal('/attention', GESTOR_DE_RIESGOS, permisos({ project: ['READ'], social_risk: ['READ'] }), deRiesgos())
    expect(await screen.findByText('Su cuenta no puede abrir «Quejas, consultas y solicitudes».')).toBeInTheDocument()
    const secciones = screen.getByRole('navigation', { name: 'Secciones' })
    expect(within(secciones).queryByRole('link', { name: 'Quejas, consultas y solicitudes' })).not.toBeInTheDocument()
    expect(within(secciones).getByRole('link', { name: 'Riesgos' })).toBeInTheDocument()
  })

  it('Reportes se ofrece con EXPORT sobre los riesgos o sobre las tres QCS', async () => {
    fetch = abrirPortal('/projects/p1/attention', GESTORA_DE_QUEJAS, EQUIPO_DE_QUEJAS, deQuejas())
    expect(await screen.findByRole('heading', { name: 'Quejas, consultas y solicitudes', level: 1 })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Reportes' })).toBeInTheDocument()
    cleanup()
    fetch!.restore()
    fetch = abrirPortal('/risks', GESTOR_DE_RIESGOS, permisos({ project: ['READ'], social_risk: ['READ', 'EXPORT'] }), deRiesgos())
    expect(await screen.findByRole('heading', { name: 'Tablero de riesgos', level: 1 })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Reportes' })).toBeInTheDocument()
  })

  it.each([
    ['/attention', 'p1', '/projects/p1/attention'],
    ['/attention/dashboard', 'p1', '/projects/p1/attention/dashboard'],
    ['/risks', 'p1', '/projects/p1/risks/dashboard'],
    ['/risks/rules', 'p1', '/projects/p1/risks/rules'],
    ['/projects/p1/grievances/g1', 'p2', '/projects/p2/attention'],
    ['/projects/p1/risks/warnings/w1', 'p2', '/projects/p2/risks/warnings'],
    ['/projects/p1/risks/k1', 'p2', '/projects/p2/risks'],
    ['/projects/p1/incidents/n1', 'p2', '/projects/p2/incidents'],
    ['/projects/p1/inquiries/i1', null, '/attention'],
    ['/projects/p1/risks/dashboard', null, '/risks'],
    ['/projects/p1/risks/k1', null, '/risks/register']
  ])('el selector de proyecto lleva de %s (proyecto %s) a %s', (desde, proyecto, hacia) => {
    expect(rutaEquivalente(desde, proyecto)).toBe(hacia)
  })
})
