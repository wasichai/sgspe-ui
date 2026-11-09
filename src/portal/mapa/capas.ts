// las dieciséis capas básicas del mapa de F2 (gis.md §2.2 y §10: LYR-01 a LYR-16), cada una servida como GeoJSON
// autenticado por GET /api/sgspe/territory/layers/{layer} (api.md §4.2). el grupo es el del control de capas de S09
// (Referencia, Proyecto, Tenencia) y el color, el de la paleta compartida. las de gestión (LYR-17 a LYR-24, F6) van aparte, en
// CAPAS_DE_GESTION: solo S12 las ofrece (decisión 10 del plan 6.3)
import type { Coleccion } from './api'
import type { ColorPorAtributo } from './Mapa'
import { estiloDeCapa } from './paleta'

export type GrupoDeCapa = 'referencia' | 'proyecto' | 'tenencia' | 'gestion'

export interface Capa {
  id: string
  grupo: GrupoDeCapa
  // el objeto del modelo que la capa dibuja: a él lleva la selección
  objeto: string
  // el color de la paleta compartida (paleta.json, spec F6 §3.3)
  color: string
  // confidencial o con datos personales (gis.md §2.1): se marca con candado aunque la cuenta pueda verla
  sensible: boolean
  // encendida al abrir el mapa del proyecto
  inicial: boolean
  // además de sus registros trae los miembros de las áreas aprobadas (LYR-13, api.md §4.2), con su propio dibujo
  miembros?: boolean
}

export const CAPAS: readonly Capa[] = [
  { id: 'LYR-01', grupo: 'referencia', objeto: 'administrative_unit', color: estiloDeCapa('LYR-01').color, sensible: false, inicial: false },
  { id: 'LYR-02', grupo: 'referencia', objeto: 'locality', color: estiloDeCapa('LYR-02').color, sensible: false, inicial: true },
  { id: 'LYR-03', grupo: 'referencia', objeto: 'locality', color: estiloDeCapa('LYR-03').color, sensible: false, inicial: false },
  { id: 'LYR-04', grupo: 'referencia', objeto: 'road_access', color: estiloDeCapa('LYR-04').color, sensible: false, inicial: false },
  { id: 'LYR-05', grupo: 'tenencia', objeto: 'community', color: estiloDeCapa('LYR-05').color, sensible: false, inicial: true },
  { id: 'LYR-06', grupo: 'tenencia', objeto: 'community_sector', color: estiloDeCapa('LYR-06').color, sensible: false, inicial: false },
  { id: 'LYR-07', grupo: 'proyecto', objeto: 'mining_concession', color: estiloDeCapa('LYR-07').color, sensible: false, inicial: false },
  { id: 'LYR-08', grupo: 'referencia', objeto: 'environmental_feature', color: estiloDeCapa('LYR-08').color, sensible: false, inicial: false },
  { id: 'LYR-09', grupo: 'proyecto', objeto: 'project', color: estiloDeCapa('LYR-09').color, sensible: false, inicial: true },
  { id: 'LYR-10', grupo: 'proyecto', objeto: 'project_component', color: estiloDeCapa('LYR-10').color, sensible: true, inicial: true },
  { id: 'LYR-11', grupo: 'proyecto', objeto: 'project_component', color: estiloDeCapa('LYR-11').color, sensible: true, inicial: false },
  { id: 'LYR-12', grupo: 'proyecto', objeto: 'project_component', color: estiloDeCapa('LYR-12').color, sensible: false, inicial: false },
  { id: 'LYR-13', grupo: 'proyecto', objeto: 'area_of_influence', color: estiloDeCapa('LYR-13').color, sensible: false, inicial: true, miembros: true },
  { id: 'LYR-14', grupo: 'tenencia', objeto: 'land_parcel', color: estiloDeCapa('LYR-14').color, sensible: true, inicial: false },
  { id: 'LYR-15', grupo: 'tenencia', objeto: 'land_parcel', color: estiloDeCapa('LYR-15').color, sensible: true, inicial: false },
  { id: 'LYR-16', grupo: 'referencia', objeto: 'school', color: estiloDeCapa('LYR-16').color, sensible: false, inicial: false }
]

// las capas de gestión de S12 (gis.md §2.2, LYR-17 a LYR-24; H1 bis del plan 6.3): registros con su ubicación o la de su
// localidad, comunidad o área, y dos agregados por localidad (LYR-17, los grupos de interés por postura, y los aportes de LYR-23),
// que son un lugar con sus conteos y nunca una persona. llegan con el plan 6.2c: antes, layers/{layer} responde 404 y la capa no
// se ofrece. el objeto es el principal de la capa; elegir un elemento lleva al suyo (__object)
const gestion = (id: string, objeto: string, sensible: boolean): Capa => ({
  id,
  grupo: 'gestion',
  objeto,
  color: estiloDeCapa(id).color,
  sensible,
  inicial: false
})
export const CAPAS_DE_GESTION: readonly Capa[] = [
  gestion('LYR-17', 'stakeholder', true),
  gestion('LYR-18', 'engagement', false),
  gestion('LYR-19', 'commitment', false),
  gestion('LYR-20', 'grievance', true),
  gestion('LYR-21', 'social_risk', false),
  gestion('LYR-22', 'incident', false),
  gestion('LYR-23', 'social_initiative', true),
  gestion('LYR-24', 'evidence', false)
]

export const GRUPOS: readonly GrupoDeCapa[] = ['referencia', 'proyecto', 'tenencia', 'gestion']

// las capas del mapa territorial (S12): las públicas de lugares y su contexto, con las concesiones mineras (públicas, LYR-07)
export const CAPAS_TERRITORIALES = ['LYR-01', 'LYR-02', 'LYR-03', 'LYR-04', 'LYR-05', 'LYR-06', 'LYR-07', 'LYR-08', 'LYR-16'] as const

export const capa = (id: string): Capa | undefined => CAPAS.find((c) => c.id === id) ?? CAPAS_DE_GESTION.find((c) => c.id === id)

// un elemento agregado por localidad (LYR-17 y los aportes de LYR-23): un punto con sus conteos, que lleva a la ficha del lugar
export const esAgregado = (propiedades: Record<string, unknown> | null | undefined): boolean => typeof propiedades?.__aggregate === 'string'

// las formas finas de las capas de gestión que MapLibre dibuja con un círculo (design-system.md §3.3): LYR-21 con el relleno del
// nivel del riesgo y LYR-17 con un anillo del color de la postura que más pesa en la localidad (__postura, que pone conPostura).
// el rombo de los riesgos, el cuadrado con su conteo de los compromisos y los rótulos con halo piden íconos y tipografías de
// teselas que el portal no carga: el color sigue a la entidad igual
export const COLORES_POR_ATRIBUTO: Readonly<Record<string, ColorPorAtributo>> = {
  'LYR-21': {
    campo: 'risk_level',
    colores: { BAJO: '--sg-risk-low', MEDIO: '--sg-risk-medium', ALTO: '--sg-risk-high', CRITICO: '--sg-risk-critical' }
  },
  'LYR-17': {
    campo: '__postura',
    colores: {
      'A FAVOR': '--sg-stance-favor',
      NEUTRAL: '--sg-stance-neutral',
      'EN CONTRA PERO ABIERTO A ESCUCHAR': '--sg-stance-open',
      'EN CONTRA': '--sg-stance-against'
    },
    anillo: true
  }
}

// el relleno y el trazo de la capa en el mapa, de la paleta, su color por atributo y si sus puntos son huecos
export const dibujoDe = (id: string): { relleno: number; colorDeRelleno?: string; trazo?: number[]; colorPor?: ColorPorAtributo; hueco?: boolean } => {
  const estilo = estiloDeCapa(id)
  return {
    // los puntos de la capa, huecos si la paleta los quiere así (los centros poblados de LYR-02)
    ...(estiloDeCapa(id, 'Point').hueco ? { hueco: true } : {}),
    relleno: estilo.fillOpacity,
    ...(estilo.colorDeRelleno ? { colorDeRelleno: estilo.colorDeRelleno } : {}),
    ...(estilo.trazo ? { trazo: estilo.trazo } : {}),
    ...(COLORES_POR_ATRIBUTO[id] ? { colorPor: COLORES_POR_ATRIBUTO[id] } : {})
  }
}

// LYR-17 trae los conteos por postura en un objeto (byStance), que MapLibre no lee en sus expresiones: cada localidad lleva además
// la postura que más pesa (__postura; sin postura conocida o empatadas, ninguna). la misma colección devuelve la misma copia, para
// que el mapa no vuelva a poner sus datos en cada dibujo
const conPosturas = new WeakMap<Coleccion, Coleccion>()
export function conPostura(id: string, datos: Coleccion): Coleccion {
  if (id !== 'LYR-17') return datos
  const guardada = conPosturas.get(datos)
  if (guardada) return guardada
  const copia: Coleccion = {
    ...datos,
    features: datos.features.map((f) => {
      const conteos = Object.entries((f.properties.byStance as Record<string, number> | null | undefined) ?? {}).filter(([postura]) => postura !== 'SIN DATO')
      const mayor = Math.max(0, ...conteos.map(([, n]) => n))
      const primeras = conteos.filter(([, n]) => n === mayor && n > 0)
      return primeras.length === 1 ? { ...f, properties: { ...f.properties, __postura: primeras[0][0] } } : f
    })
  }
  conPosturas.set(datos, copia)
  return copia
}
