import { useQuery } from '@tanstack/react-query'
import { useAuth, type WasichaiModule } from '@wasichai/core'
import { gisModule, type BasemapSpec, type MapInitialView } from '@wasichai/gis'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { usePedir } from '../datos/http'

// el mapa base de la organización (spec F6 §3.3 y elección 9, ASM-125): GET /api/sgspe/map/settings da { basemap, attribution? }
// (basemap un BasemapSpec de @wasichai/gis; sin estilo, { type: 'none' }) cuando hay sesión. el proveedor monta los de gisModule({ basemap }), así GeometryField, el componente MAP y
// /admin dibujan el mismo fondo, y el mapa propio del portal lo lee con useMapaBase. sin respuesta (cargando, error, un backend
// sin F6, basemap null) el fondo es none: nunca el OpenStreetMap por defecto de gis (RQ-GIS-013)
export const SIN_MAPA_BASE: BasemapSpec = { type: 'none' }

// el Perú entero antes de que lleguen las capas, como MapaImpl
export const VISTA_INICIAL: MapInitialView = { center: [-75.5, -9.5], zoom: 5 }

// solo las tres formas de BasemapSpec; cualquier otra cosa es none
export function mapaBaseDe(respuesta: unknown): BasemapSpec {
  const b = (respuesta && typeof respuesta === 'object' ? (respuesta as { basemap?: unknown }).basemap : null) as Record<string, unknown> | null | undefined
  if (!b || typeof b !== 'object') return SIN_MAPA_BASE
  if (b.type === 'style' && typeof b.url === 'string' && b.url) return { type: 'style', url: b.url }
  if (b.type === 'raster' && Array.isArray(b.tiles) && b.tiles.length > 0 && b.tiles.every((x) => typeof x === 'string' && x)) {
    return {
      type: 'raster',
      tiles: b.tiles as string[],
      ...(typeof b.tileSize === 'number' ? { tileSize: b.tileSize } : {}),
      ...(typeof b.attribution === 'string' ? { attribution: b.attribution } : {}),
      ...(typeof b.maxzoom === 'number' ? { maxzoom: b.maxzoom } : {})
    }
  }
  return SIN_MAPA_BASE
}

// la atribución que el operador configura junto al estilo (sgspe.map.attribution), o null
export const atribucionDe = (respuesta: unknown): string | null => {
  const a = respuesta && typeof respuesta === 'object' ? (respuesta as { attribution?: unknown }).attribution : null
  return typeof a === 'string' && a.trim() ? a.trim() : null
}

const ContextoDelMapaBase = createContext<BasemapSpec>(SIN_MAPA_BASE)
const ContextoDeLaAtribucion = createContext<string | null>(null)

export const useMapaBase = (): BasemapSpec => useContext(ContextoDelMapaBase)
export const useAtribucionDelMapa = (): string | null => useContext(ContextoDeLaAtribucion)

// una lectura por organización y por sesión: el operador cambia el mapa en application.yml, no en caliente
export function useAjustesDelMapa() {
  const { user } = useAuth()
  const pedir = usePedir()
  return useQuery({
    queryKey: ['map-settings', user?.organizationId ?? null],
    queryFn: async () => {
      const respuesta = await pedir<unknown>('/sgspe/map/settings')
      return { basemap: mapaBaseDe(respuesta), atribucion: atribucionDe(respuesta) }
    },
    enabled: Boolean(user),
    staleTime: Infinity,
    retry: false
  })
}

export function ProveedorDelMapaBase({ children }: { children: ReactNode }) {
  const ajustes = useAjustesDelMapa()
  const basemap = ajustes.data?.basemap ?? SIN_MAPA_BASE
  const clave = JSON.stringify(basemap)
  // los proveedores de gis llevan el fondo a MapView y GeometryField; un fondo distinto arma otros
  const proveedores = useMemo(() => gisModule({ basemap, initialView: VISTA_INICIAL }).providers ?? [], [clave])
  const contenido = (
    <ContextoDelMapaBase.Provider value={basemap}>
      <ContextoDeLaAtribucion.Provider value={ajustes.data?.atribucion ?? null}>{children}</ContextoDeLaAtribucion.Provider>
    </ContextoDelMapaBase.Provider>
  )
  return (
    <>
      {proveedores.reduceRight<ReactNode>(
        (hijos, Proveedor) => (
          <Proveedor>{hijos}</Proveedor>
        ),
        contenido
      )}
    </>
  )
}

// el módulo que lo monta: en el portal es el segundo, después de idiomaHtmlModule; en /admin va después de gisModule({ workerUrl }),
// así su proveedor queda más adentro y gana sobre el fondo por defecto de gis
export const mapaBaseModule = (): WasichaiModule => ({ id: 'sgspe-mapa-base', providers: [ProveedorDelMapaBase] })
