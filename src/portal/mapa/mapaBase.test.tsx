import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { Mapa } from './Mapa'
import { mapaBaseDe, ProveedorDelMapaBase } from './mapaBase'

// el proveedor de gisModule y el MapaImpl se reemplazan por dobles que muestran lo que reciben: la prueba mira qué fondo llega
// a GeometryField y al componente MAP (el contexto de gis) y qué fondo llega al mapa propio del portal (la prop basemap)
vi.mock('@wasichai/gis', async (original) => ({
  ...(await original<typeof import('@wasichai/gis')>()),
  gisModule: vi.fn((opciones: { basemap?: unknown }) => ({
    id: 'gis',
    providers: [
      ({ children }: { children: React.ReactNode }) => (
        <div data-testid="gis" data-basemap={JSON.stringify(opciones.basemap)}>
          {children}
        </div>
      )
    ]
  }))
}))
vi.mock('./MapaImpl', () => ({
  default: ({ basemap }: { basemap: unknown }) => <div data-testid="impl" data-basemap={JSON.stringify(basemap)} />
}))

let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const ESTILO = { type: 'style', url: 'https://mapas.example/estilo.json' }
const conProveedor = () =>
  montar(
    <ProveedorDelMapaBase>
      <Mapa etiqueta="Mapa de prueba" capas={[]} />
    </ProveedorDelMapaBase>
  )

describe('mapa base de la organización', () => {
  it('con /map/settings, gis y el mapa del portal reciben el estilo de la organización; «Sin fondo» lo apaga', async () => {
    fetch = mockFetch([{ path: '/sgspe/map/settings', body: { basemap: ESTILO, attribution: '© Mapas Ejemplo' } }])
    conProveedor()
    await waitFor(() => expect(screen.getByTestId('gis')).toHaveAttribute('data-basemap', JSON.stringify(ESTILO)))
    expect(await screen.findByTestId('impl')).toHaveAttribute('data-basemap', JSON.stringify(ESTILO))
    expect(screen.queryByText('Sin mapa base')).not.toBeInTheDocument()
    expect(screen.getByText('© Mapas Ejemplo')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sin fondo' }))
    expect(screen.getByTestId('impl')).toHaveAttribute('data-basemap', JSON.stringify({ type: 'none' }))
    expect(screen.getByText('Sin mapa base')).toBeInTheDocument()
  })

  it('sin /map/settings (backend sin F6) el fondo es «Sin mapa base», nunca OpenStreetMap', async () => {
    fetch = mockFetch([])
    conProveedor()
    expect(await screen.findByText('Sin mapa base')).toBeInTheDocument()
    expect(screen.getByTestId('gis')).toHaveAttribute('data-basemap', JSON.stringify({ type: 'none' }))
    expect(screen.queryByRole('button', { name: 'Sin fondo' })).not.toBeInTheDocument()
  })

  // U-32 y P-06: sin mapa base, quien administra lee dónde se configura; quien no, solo que no lo hay
  it('sin mapa base, el aviso nombra dónde se configura para quien administra', async () => {
    fetch = mockFetch([])
    conProveedor()
    expect(await screen.findByText('Sin mapa base')).toBeInTheDocument()
    expect(screen.getByText(/Lo configura quien opera SGSPE, en los ajustes del mapa base de la organización/)).toBeInTheDocument()
  })

  it('sin mapa base, quien no administra solo lee que no lo hay', async () => {
    fetch = mockFetch([])
    montar(
      <ProveedorDelMapaBase>
        <Mapa etiqueta="Mapa de prueba" capas={[]} />
      </ProveedorDelMapaBase>,
      { permisos: { admin: false, objects: {} } }
    )
    expect(await screen.findByText('Sin mapa base')).toBeInTheDocument()
    expect(screen.queryByText(/Lo configura/)).not.toBeInTheDocument()
  })

  it('«Sin fondo» elegido a mano no dice dónde se configura: el mapa base existe', async () => {
    fetch = mockFetch([{ path: '/sgspe/map/settings', body: { basemap: ESTILO } }])
    conProveedor()
    await userEvent.click(await screen.findByRole('button', { name: 'Sin fondo' }))
    expect(screen.getByText('Sin mapa base')).toBeInTheDocument()
    expect(screen.queryByText(/Lo configura/)).not.toBeInTheDocument()
  })

  it('una respuesta que no es un BasemapSpec válido vale «Sin mapa base»', () => {
    expect(mapaBaseDe({ basemap: null })).toEqual({ type: 'none' })
    expect(mapaBaseDe({ basemap: { type: 'raster', tiles: [] } })).toEqual({ type: 'none' })
    expect(mapaBaseDe({ basemap: { type: 'style', url: '' } })).toEqual({ type: 'none' })
    expect(mapaBaseDe({ basemap: { type: 'raster', tiles: ['https://t.example/{z}/{x}/{y}.png'], attribution: '© Ejemplo', maxzoom: 18 } })).toEqual({
      type: 'raster',
      tiles: ['https://t.example/{z}/{x}/{y}.png'],
      attribution: '© Ejemplo',
      maxzoom: 18
    })
    expect(mapaBaseDe('basura')).toEqual({ type: 'none' })
  })
})
