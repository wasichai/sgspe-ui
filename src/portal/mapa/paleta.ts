import { ESTILOS_PROPIOS } from './estilos'
import paleta from './paleta.json'

// la paleta compartida con los SLD de GeoServer y los mapas de informe (spec F6 §3.3, gis.md §7.2). paleta.json es copia byte a
// byte de model/styles/palette.json de sgspe (paleta.test.ts): no se edita aquí. Sus hex son los del tema claro (los informes
// son claros) y cada uno nombra su token de la paleta cartográfica (design-system.md §3.3), con el que el portal pinta en claro
// o en oscuro. Las capas que no tienen SLD usan estilos.ts
export interface EstiloDeSld {
  layer: string
  stroke: string
  strokeWidth?: number
  strokeDasharray?: number[]
  fill?: string | null
  fillOpacity?: number
  mark?: string
  label?: string | null
  halo?: string | null
  // el token (sin --sg-) de cada color
  tokens?: Partial<Record<'stroke' | 'fill' | 'label' | 'halo', string>>
}

export const ESTILOS_SLD = (paleta as unknown as { styles: Record<string, EstiloDeSld> }).styles

export interface EstiloDeCapa {
  // el color de la línea; en un punto, el de la marca (su relleno), porque su borde es el surface del SLD; en un punto hueco, el
  // de su borde. un token --sg-* o, sin token en la paleta, el hex
  color: string
  // el color del relleno de un polígono, si no es el de la línea (LYR-07)
  colorDeRelleno?: string
  // la opacidad del relleno
  fillOpacity: number
  // línea discontinua
  trazo?: number[]
  // un punto hueco: relleno surface y el color en el borde (LYR-02, design-system.md §3.3)
  hueco?: boolean
}

// una capa que nadie nombra (no debería ocurrir: paleta.test.ts lo vigila) usa el gris de los límites
const NEUTRO: EstiloDeCapa = { color: '--sg-lyr-boundary', fillOpacity: 0.15 }

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
    // el color de la clave por su token, que sigue al tema; el hex solo si la paleta no lo nombra
    const de = (clave: 'stroke' | 'fill') => (sld.tokens?.[clave] ? `--sg-${sld.tokens[clave]}` : sld[clave]) ?? undefined
    const hueco = marca && sld.tokens?.fill === 'surface'
    const color = (marca && !hueco ? (de('fill') ?? de('stroke')) : de('stroke')) as string
    return {
      color,
      ...(!marca && sld.fill && de('fill') !== color ? { colorDeRelleno: de('fill') } : {}),
      fillOpacity: sld.fillOpacity ?? (sld.mark ? 1 : 0),
      ...(sld.strokeDasharray ? { trazo: sld.strokeDasharray } : {}),
      ...(hueco ? { hueco: true } : {})
    }
  }
  const propio = ESTILOS_PROPIOS[capa]
  if (!propio) return NEUTRO
  return { color: propio.color, fillOpacity: propio.fillOpacity, ...(propio.dash ? { trazo: propio.dash } : {}) }
}
