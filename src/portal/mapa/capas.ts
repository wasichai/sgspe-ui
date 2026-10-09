// las dieciséis capas básicas del mapa de F2 (gis.md §2.2 y §10: LYR-01 a LYR-16), cada una servida como GeoJSON
// autenticado por GET /api/sgspe/territory/layers/{layer} (api.md §4.2). el grupo es el del control de capas de S09
// (Referencia, Proyecto, Tenencia; Gestión llega con las capas temáticas de F6) y el color, un token de tokens.css
export type GrupoDeCapa = 'referencia' | 'proyecto' | 'tenencia' | 'gestion'

export interface Capa {
  id: string
  grupo: GrupoDeCapa
  // el objeto del modelo que la capa dibuja: a él lleva la selección
  objeto: string
  color: string
  // confidencial o con datos personales (gis.md §2.1): se marca con candado aunque la cuenta pueda verla
  sensible: boolean
  // encendida al abrir el mapa del proyecto
  inicial: boolean
  // además de sus registros trae los miembros de las áreas aprobadas (LYR-13, api.md §4.2), con su propio dibujo
  miembros?: boolean
}

export const CAPAS: readonly Capa[] = [
  { id: 'LYR-01', grupo: 'referencia', objeto: 'administrative_unit', color: '--sg-text-muted', sensible: false, inicial: false },
  { id: 'LYR-02', grupo: 'referencia', objeto: 'locality', color: '--sg-data-1', sensible: false, inicial: true },
  { id: 'LYR-03', grupo: 'referencia', objeto: 'locality', color: '--sg-text', sensible: false, inicial: false },
  { id: 'LYR-04', grupo: 'referencia', objeto: 'road_access', color: '--sg-text-secondary', sensible: false, inicial: false },
  { id: 'LYR-05', grupo: 'tenencia', objeto: 'community', color: '--sg-territory', sensible: false, inicial: true },
  { id: 'LYR-06', grupo: 'tenencia', objeto: 'community_sector', color: '--sg-territory-border', sensible: false, inicial: false },
  { id: 'LYR-07', grupo: 'proyecto', objeto: 'mining_concession', color: '--sg-data-2', sensible: false, inicial: false },
  { id: 'LYR-08', grupo: 'referencia', objeto: 'environmental_feature', color: '--sg-data-5', sensible: false, inicial: false },
  { id: 'LYR-09', grupo: 'proyecto', objeto: 'project', color: '--sg-primary', sensible: false, inicial: true },
  { id: 'LYR-10', grupo: 'proyecto', objeto: 'project_component', color: '--sg-data-4', sensible: true, inicial: true },
  { id: 'LYR-11', grupo: 'proyecto', objeto: 'project_component', color: '--sg-data-6', sensible: true, inicial: false },
  { id: 'LYR-12', grupo: 'proyecto', objeto: 'project_component', color: '--sg-data-3', sensible: false, inicial: false },
  { id: 'LYR-13', grupo: 'proyecto', objeto: 'area_of_influence', color: '--sg-primary', sensible: false, inicial: true, miembros: true },
  { id: 'LYR-14', grupo: 'tenencia', objeto: 'land_parcel', color: '--sg-data-2', sensible: true, inicial: false },
  { id: 'LYR-15', grupo: 'tenencia', objeto: 'land_parcel', color: '--sg-data-6', sensible: true, inicial: false },
  { id: 'LYR-16', grupo: 'referencia', objeto: 'school', color: '--sg-data-5', sensible: false, inicial: false }
]

export const GRUPOS: readonly GrupoDeCapa[] = ['referencia', 'proyecto', 'tenencia', 'gestion']

// las capas del mapa territorial (S12): las públicas de lugares y su contexto
export const CAPAS_TERRITORIALES = ['LYR-01', 'LYR-02', 'LYR-03', 'LYR-04', 'LYR-05', 'LYR-06', 'LYR-08', 'LYR-16'] as const

export const capa = (id: string): Capa | undefined => CAPAS.find((c) => c.id === id)
