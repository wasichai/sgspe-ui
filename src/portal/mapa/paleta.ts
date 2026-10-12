import { ESTILOS_PROPIOS } from './estilos'
import paleta from './paleta.json'

// la paleta compartida con los SLD de GeoServer y los mapas de informe (spec F6 §3.3, gis.md §7.2). paleta.json es copia byte a
// byte de model/styles/palette.json de sgspe (paleta.test.ts): no se edita aquí. Las capas que no tienen SLD usan estilos.ts
export interface EstiloDeSld {
  layer: string
  stroke: string
  strokeWidth?: number
  strokeDasharray?: number[]
  fill?: string | null
  fillOpacity?: number
  mark?: string
}

export const ESTILOS_SLD = (paleta as unknown as { styles: Record<string, EstiloDeSld> }).styles

export interface EstiloDeCapa {
  // el color de la línea; en un punto, el de la marca (su relleno), porque su borde es el blanco del SLD
  color: string
  // el color del relleno de un polígono, si no es el de la línea (LYR-07)
  colorDeRelleno?: string
  // la opacidad del relleno
  fillOpacity: number
  // línea discontinua
  trazo?: number[]
}

// una capa que nadie nombra (no debería ocurrir: paleta.test.ts lo vigila) usa el gris neutro de los datos
const NEUTRO: EstiloDeCapa = { color: '#838b85', fillOpacity: 0.15 }

const PUNTOS = new Set(['Point', 'MultiPoint'])

// el estilo de una capa: LYR-02 se elige por la geometría (punto o límite) y LYR-16 por la institución (escuela o salud)
export function estiloDeCapa(capa: string, geometria?: string, institucion: 'school' | 'health' = 'school'): EstiloDeCapa {
  const numero = capa.toLowerCase()
  const nombre =
    capa === 'LYR-02'
      ? `sgspe-${numero}-${geometria && PUNTOS.has(geometria) ? 'location' : 'boundary'}`
      : capa === 'LYR-16'
        ? `sgspe-${numero}-${institucion}`
        : `sgspe-${numero}`
  const sld = ESTILOS_SLD[nombre]
  if (sld) {
    const marca = Boolean(sld.mark)
    return {
      color: marca ? (sld.fill ?? sld.stroke) : sld.stroke,
      ...(!marca && sld.fill && sld.fill !== sld.stroke ? { colorDeRelleno: sld.fill } : {}),
      fillOpacity: sld.fillOpacity ?? (sld.mark ? 1 : 0),
      ...(sld.strokeDasharray ? { trazo: sld.strokeDasharray } : {})
    }
  }
  const propio = ESTILOS_PROPIOS[capa]
  if (!propio) return NEUTRO
  return { color: propio.color, fillOpacity: propio.fillOpacity, ...(propio.dash ? { trazo: propio.dash } : {}) }
}
