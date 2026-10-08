import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro, workflow } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'

vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const coleccion = (objeto: string, elementos: [string, Record<string, unknown>][]) => ({
  type: 'FeatureCollection',
  features: elementos.map(([id, props]) => ({
    type: 'Feature',
    id: `${id}:location`,
    geometry: { type: 'Point', coordinates: [-78.1, -8.1] },
    properties: { __id: id, __object: objeto, ...props }
  }))
})

const rutas = () => [
  { path: '/objects/project/records/p1', body: registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa', working_crs: 'EPSG 32717' }, { state: 'active' }) },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/area_of_influence/workflow', body: workflow('area_of_influence', [['approved', 'Aprobada']]) },
  { path: '/objects/project_assignment/records', body: pagina([]) },
  { path: '/sgspe/territory/layers/LYR-10', body: coleccion('project_component', [['pc1', { code: 'SDJ-001' }]]) },
  { path: '/sgspe/territory/layers/LYR-14', status: 403, body: { title: 'Forbidden', status: 403 } },
  { path: /^\/sgspe\/territory\/layers\/LYR-\d\d/, body: coleccion('x', []) },
  {
    path: '/objects/project_component/records',
    body: pagina([
      registro('pc1', { code: 'SDJ-001', component_type: 'SONDAJE', version_number: 2 }),
      registro('pc0', { code: 'SDJ-001', component_type: 'SONDAJE', version_number: 1, superseded: true })
    ])
  },
  {
    path: '/objects/area_of_influence/records',
    body: pagina([registro('a1', { area_type: 'AIDS', version_number: 1, calculated_area_ha: 1520.5 }, { state: 'approved' })])
  }
]

describe('S09 · mapa del proyecto', () => {
  it('pide las capas iniciales con el proyecto y muestra solo la versión vigente de cada componente', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], project_component: ['READ'], area_of_influence: ['READ'] }), rutas())
    red = espiarRed()
    const tabla = await screen.findByRole('table', { name: 'Componentes' })
    await waitFor(() => expect(within(tabla).getAllByRole('row')).toHaveLength(2))
    await waitFor(() => expect(red!.a('GET', '/sgspe/territory/layers/LYR-10').length).toBeGreaterThan(0))
    expect(red.a('GET', '/sgspe/territory/layers/LYR-10')[0].ruta).toContain('project=p1')
    expect(red.a('GET', '/sgspe/territory/layers/LYR-14')).toHaveLength(0)
  })

  it('una capa sin permiso queda con candado y su razón', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), rutas())
    const predios = await screen.findByRole('checkbox', { name: /Predios de propiedad/ })
    await userEvent.click(predios)
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Predios de propiedad/ })).toBeDisabled())
    expect(screen.getByLabelText('Su cuenta no puede ver esta capa')).toBeInTheDocument()
  })

  it('elegir en el mapa o en la tabla fija ?selected= en la URL', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], project_component: ['READ'] }), rutas())
    const mapa = await screen.findByRole('list', { name: 'Mapa del proyecto' })
    await userEvent.click(await within(mapa).findByRole('button', { name: 'SDJ-001' }))
    expect(rutaActual()).toBe('/projects/p1/map?selected=project_component%3Apc1')
    expect(within(screen.getByRole('table', { name: 'Componentes' })).getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'true')
  })

  // LYR-13 trae los miembros de las áreas aprobadas (api.md §4.2): elegir uno lleva al lugar que dibuja, no al miembro
  it('un miembro de un área elige su localidad y ofrece abrir su ficha', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], area_of_influence: ['READ'] }), [
      {
        path: '/sgspe/territory/layers/LYR-13',
        body: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 'm1:location',
              geometry: { type: 'Point', coordinates: [-78.1, -8.1] },
              properties: { __id: 'm1', __object: 'area_of_influence_member', __target: 'locality', __targetId: 'l1', rationale: 'Tunas' }
            }
          ]
        }
      },
      ...rutas()
    ])
    const mapa = await screen.findByRole('list', { name: 'Mapa del proyecto' })
    await userEvent.click(await within(mapa).findByRole('button', { name: 'm1' }))
    expect(rutaActual()).toBe('/projects/p1/map?selected=locality%3Al1')
    expect(await screen.findByRole('link', { name: 'Abrir la ficha' })).toHaveAttribute('href', '/territory/localities/l1?project=p1')
  })

  it('una capa recortada al tope pide acercar el mapa', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], project_component: ['READ'] }), [
      { path: '/sgspe/territory/layers/LYR-10', body: { ...coleccion('project_component', [['pc1', { code: 'SDJ-001' }]]), truncated: true } },
      ...rutas()
    ])
    expect(await screen.findByText('Hay más elementos de los que se muestran: acerque el mapa')).toBeInTheDocument()
    expect(screen.getAllByRole('status').some((s) => s.textContent?.includes('acerque el mapa'))).toBe(true)
  })

  it('las áreas de influencia llevan a su ficha', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], area_of_influence: ['READ'] }), rutas())
    await userEvent.click(await screen.findByRole('tab', { name: 'Áreas de influencia' }))
    expect(await screen.findByRole('link', { name: 'AIDS · v1' })).toHaveAttribute('href', '/projects/p1/areas/a1')
    expect(screen.getByText('1,520.5 ha')).toBeInTheDocument()
  })
})
