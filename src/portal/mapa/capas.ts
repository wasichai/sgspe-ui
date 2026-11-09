// las dieciséis capas básicas del mapa de F2 (gis.md §2.2 y §10: LYR-01 a LYR-16), cada una servida como GeoJSON
// autenticado por GET /api/sgspe/territory/layers/{layer} (api.md §4.2). el grupo es el del control de capas de S09
// (Referencia, Proyecto, Tenencia) y el color, el de la paleta compartida. las de gestión (LYR-17 a LYR-24, F6) van aparte, en
// CAPAS_DE_GESTION: solo S12 las ofrece (decisión 10 del plan 6.3)
import type { Coleccion } from './api'
import type { ColorPorAtributo, Rotulo } from './Mapa'
import { estiloDeCapa } from './paleta'
import type { Simbolo } from './simbolos'

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

// el color de los puntos de dos capas de gestión (design-system.md §3.3): LYR-21 con el relleno del nivel del riesgo y LYR-17
// con un anillo del color de la postura que más pesa en la localidad (__postura, que pone paraElMapa). con su símbolo
// (SIMBOLOS), el círculo queda para la selección; el color por atributo sigue para quien dibuja la capa sin símbolo
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

// el id de la imagen del anillo de LYR-17 lleva sus conteos (simbolos.ts lo dibuja cuando MapLibre lo pide)
export const PREFIJO_DEL_ANILLO = 'sg-anillo-'

// las posturas de LYR-17 en el orden del anillo (de A FAVOR a EN CONTRA, la escala divergente); SIN DATO no entra
const POSTURAS = ['A FAVOR', 'NEUTRAL', 'EN CONTRA PERO ABIERTO A ESCUCHAR', 'EN CONTRA'] as const

// los símbolos de §3.3: el anillo de 14 px de radio por postura con el total al centro (LYR-17), el cuadrado de 18 px con su
// conteo (LYR-19) y el rombo con el relleno del nivel y el borde de su tinta, con «!» en on-critical en CRITICO (LYR-21)
export const SIMBOLOS: Readonly<Record<string, Simbolo>> = {
  'LYR-17': { forma: 'anillo', conteo: 'total', colores: POSTURAS.map((p) => COLORES_POR_ATRIBUTO['LYR-17'].colores[p]) },
  'LYR-19': { forma: 'cuadrado', conteo: '__conteo' },
  'LYR-21': {
    forma: 'rombo',
    campo: 'risk_level',
    niveles: {
      BAJO: { relleno: '--sg-risk-low', borde: '--sg-success' },
      MEDIO: { relleno: '--sg-risk-medium', borde: '--sg-level-medium-border' },
      ALTO: { relleno: '--sg-risk-high', borde: '--sg-level-high-border' },
      CRITICO: { relleno: '--sg-risk-critical', borde: '--sg-critical', marca: '--sg-on-critical' }
    }
  }
}

// los rótulos de §3.3, con halo map-ground de 4 px: los centros poblados y las ciudades a la derecha de su punto, el territorio
// comunal en versalitas de 12 px (MapLibre no tiene versalitas: mayúsculas espaciadas), los ríos en cursiva de 12 px a lo largo
// del cauce, los límites a lo largo de su línea y las áreas de influencia por su tipo, en primary-text
export const ROTULOS: Readonly<Record<string, Rotulo>> = {
  'LYR-01': { campo: 'name', tamano: 11, peso: 'semibold', color: '--sg-lyr-boundary', colocacion: 'linea' },
  'LYR-02': { campo: 'name', tamano: 12, peso: 'semibold', color: '--sg-lyr-place', colocacion: 'punto' },
  'LYR-03': { campo: 'name', tamano: 13, peso: 'bold', color: '--sg-lyr-place', colocacion: 'punto' },
  'LYR-05': { campo: 'name', tamano: 12, peso: 'bold', color: '--sg-lyr-community-label', colocacion: 'punto', mayusculas: true },
  'LYR-08': { campo: 'name', tamano: 12, peso: 'semibold', color: '--sg-lyr-water-label', colocacion: 'linea', cursiva: true },
  'LYR-13': { campo: 'area_type', tamano: 12, peso: 'bold', color: '--sg-primary-text', colocacion: 'punto' }
}

// el relleno y el trazo de la capa en el mapa, de la paleta, su color por atributo, si sus puntos son huecos, su rótulo y su
// símbolo
export const dibujoDe = (
  id: string
): { relleno: number; colorDeRelleno?: string; trazo?: number[]; colorPor?: ColorPorAtributo; hueco?: boolean; rotulo?: Rotulo; simbolo?: Simbolo } => {
  const estilo = estiloDeCapa(id)
  return {
    // los puntos de la capa, huecos si la paleta los quiere así (los centros poblados de LYR-02)
    ...(estiloDeCapa(id, 'Point').hueco ? { hueco: true } : {}),
    relleno: estilo.fillOpacity,
    ...(estilo.colorDeRelleno ? { colorDeRelleno: estilo.colorDeRelleno } : {}),
    ...(estilo.trazo ? { trazo: estilo.trazo } : {}),
    ...(COLORES_POR_ATRIBUTO[id] ? { colorPor: COLORES_POR_ATRIBUTO[id] } : {}),
    ...(ROTULOS[id] ? { rotulo: ROTULOS[id] } : {}),
    ...(SIMBOLOS[id] ? { simbolo: SIMBOLOS[id] } : {})
  }
}

// lo que MapLibre no sabe calcular en sus expresiones, puesto en cada elemento: LYR-17 trae los conteos por postura en un objeto
// (byStance), y cada localidad lleva la postura que más pesa (__postura; sin postura conocida o empatadas, ninguna) y el id de
// su anillo con los conteos en el orden de POSTURAS (__anillo); en LYR-19, cada compromiso lleva cuántos comparten su lugar
// (__conteo), que su cuadrado dice. la misma colección devuelve la misma copia, para que el mapa no vuelva a poner sus datos en
// cada dibujo
const preparadas = new WeakMap<Coleccion, Coleccion>()
export function paraElMapa(id: string, datos: Coleccion): Coleccion {
  if (id !== 'LYR-17' && id !== 'LYR-19') return datos
  const guardada = preparadas.get(datos)
  if (guardada) return guardada
  const copia: Coleccion = { ...datos, features: id === 'LYR-17' ? datos.features.map(conPosturas) : conConteos(datos.features) }
  preparadas.set(datos, copia)
  return copia
}

type Elemento = Coleccion['features'][number]

function conPosturas(f: Elemento): Elemento {
  const porPostura = (f.properties.byStance as Record<string, number> | null | undefined) ?? {}
  const conteos = Object.entries(porPostura).filter(([postura]) => postura !== 'SIN DATO')
  const mayor = Math.max(0, ...conteos.map(([, n]) => n))
  const primeras = conteos.filter(([, n]) => n === mayor && n > 0)
  const anillo = `${PREFIJO_DEL_ANILLO}${POSTURAS.map((p) => Math.max(0, Math.round(Number(porPostura[p] ?? 0)) || 0)).join('-')}`
  return { ...f, properties: { ...f.properties, __anillo: anillo, ...(primeras.length === 1 ? { __postura: primeras[0][0] } : {}) } }
}

// el lugar de un punto, redondeado a 1e-6 grados (unos 10 cm): dos compromisos de la misma localidad caen en el mismo
const lugarDe = (f: Elemento): string | null => {
  const g = f.geometry as { type?: string; coordinates?: unknown } | null
  if (g?.type !== 'Point' || !Array.isArray(g.coordinates)) return null
  return (g.coordinates as number[]).map((c) => Math.round(c * 1e6)).join(',')
}

function conConteos(elementos: Elemento[]): Elemento[] {
  const porLugar = new globalThis.Map<string, number>()
  for (const f of elementos) {
    const lugar = lugarDe(f)
    if (lugar) porLugar.set(lugar, (porLugar.get(lugar) ?? 0) + 1)
  }
  return elementos.map((f) => {
    const lugar = lugarDe(f)
    return lugar ? { ...f, properties: { ...f.properties, __conteo: porLugar.get(lugar) } } : f
  })
}
