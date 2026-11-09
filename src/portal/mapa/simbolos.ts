// los símbolos de las capas de gestión (design-system.md §3.3): el cuadrado de los compromisos (LYR-19), el rombo de los riesgos
// con «!» en CRITICO (LYR-21) y el anillo de posturas de los grupos por localidad (LYR-17). no hay archivo de sprite: cada
// ícono se dibuja aquí, píxel a píxel y sin lienzo, con los colores del tema activo, y MapaImpl lo entrega a MapLibre con
// addImage (y updateImage al cambiar de tema). así viene del propio origen sin pedir nada (CSP) y sigue al tema
import { PREFIJO_DEL_ANILLO } from './capas'
import { colorDe } from './colores'

// un ícono como lo recibe addImage: RGBA sin premultiplicar, con el doble de píxeles que su tamaño CSS
export interface Imagen {
  width: number
  height: number
  data: Uint8Array
}
export const DENSIDAD = 2

type Rgba = [number, number, number, number]

// un color de colorDe (hex o rgb()) como RGBA de 0 a 255; lo que no se entiende, gris
export function rgbaDe(color: string): Rgba {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(color.trim())?.[1]
  if (hex && (hex.length === 3 || hex.length === 4)) {
    const [r, g, b, a = 'f'] = hex.split('').map((c) => c + c)
    return [r, g, b, a + a].map((c) => parseInt(c.slice(0, 2), 16)) as Rgba
  }
  if (hex && (hex.length === 6 || hex.length === 8)) {
    const partes = hex.match(/../g)!.map((c) => parseInt(c, 16))
    return [partes[0], partes[1], partes[2], partes[3] ?? 255]
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(color.trim())?.[1]
  if (rgb) {
    const [r, g, b, a] = rgb.split(/[\s,/]+/).filter(Boolean)
    const alfa = a === undefined ? 1 : a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a)
    return [Number(r), Number(g), Number(b), Math.round(alfa * 255)]
  }
  return [128, 128, 128, 255]
}

// el color de un punto del ícono (en px CSS, desde la esquina superior izquierda) o null si ahí no hay nada
type Muestra = (x: number, y: number) => Rgba | null

// pinta un ícono de lado × lado px CSS con 4 × 4 muestras por píxel: los bordes salen suavizados
function pintar(lado: number, muestra: Muestra): Imagen {
  const n = lado * DENSIDAD
  const data = new Uint8Array(n * n * 4)
  const sub = 4
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const c = muestra((px + (sx + 0.5) / sub) / DENSIDAD, (py + (sy + 0.5) / sub) / DENSIDAD)
          if (!c) continue
          const alfa = c[3] / 255
          r += c[0] * alfa
          g += c[1] * alfa
          b += c[2] * alfa
          a += alfa
        }
      }
      const i = (py * n + px) * 4
      if (a > 0) {
        data[i] = Math.round(r / a)
        data[i + 1] = Math.round(g / a)
        data[i + 2] = Math.round(b / a)
        data[i + 3] = Math.round((a / (sub * sub)) * 255)
      }
    }
  }
  return { width: n, height: n, data }
}

// LYR-19: cuadrado de 18 px del color de la capa con borde surface de 1,5 px; el conteo va encima, como texto con halo
export const LADO_DEL_CUADRADO = 18
export function cuadrado(relleno: string, borde: string): Imagen {
  const [fondo, linea] = [rgbaDe(relleno), rgbaDe(borde)]
  const l = LADO_DEL_CUADRADO
  return pintar(l, (x, y) => (Math.min(x, y, l - x, l - y) < 1.5 ? linea : fondo))
}

// LYR-21: rombo de 20 px con el relleno del nivel y borde de 1,5 px de su tinta; con marca, el «!» al centro
export const LADO_DEL_ROMBO = 20
export function rombo(relleno: string, borde: string, marca?: string): Imagen {
  const [fondo, linea] = [rgbaDe(relleno), rgbaDe(borde)]
  const exclamacion = marca ? rgbaDe(marca) : null
  const c = LADO_DEL_ROMBO / 2
  // la distancia al borde del rombo (|x| + |y| = c) medida en perpendicular
  const raiz2 = Math.SQRT2
  return pintar(LADO_DEL_ROMBO, (x, y) => {
    const d = (c - (Math.abs(x - c) + Math.abs(y - c))) / raiz2
    if (d < 0) return null
    if (d < 1.5) return linea
    if (exclamacion) {
      const dx = Math.abs(x - c)
      // el trazo del «!» (de 5 a 11,5 px, 2 px de ancho) y su punto (círculo de 1,2 px de radio en 13,6)
      if (dx <= 1 && y >= 5 && y <= 11.5) return exclamacion
      if (Math.hypot(x - c, y - 13.6) <= 1.2) return exclamacion
    }
    return fondo
  })
}

// LYR-17: anillo de 28 px (14 px de radio) con un tramo por postura, proporcional a su conteo y desde las doce en el sentido del
// reloj, y el centro surface para el total; sin conteos, un anillo del color de respaldo
export const LADO_DEL_ANILLO = 28
export function anillo(conteos: readonly number[], colores: readonly string[], centro: string, respaldo: string): Imagen {
  const total = conteos.reduce((s, n) => s + Math.max(0, n), 0)
  const tramos: { hasta: number; color: Rgba }[] = []
  let acumulado = 0
  conteos.forEach((n, i) => {
    if (n <= 0) return
    acumulado += n / total
    tramos.push({ hasta: acumulado, color: rgbaDe(colores[i] ?? respaldo) })
  })
  const fondo = rgbaDe(centro)
  const sinDatos = rgbaDe(respaldo)
  const r = LADO_DEL_ANILLO / 2
  return pintar(LADO_DEL_ANILLO, (x, y) => {
    const d = Math.hypot(x - r, y - r)
    if (d > r) return null
    // borde exterior surface de 1 px, el anillo de 5 px y el centro
    if (d > r - 1 || d <= r - 6) return fondo
    if (tramos.length === 0) return sinDatos
    const angulo = (Math.atan2(x - r, r - y) / (2 * Math.PI) + 1) % 1
    return (tramos.find((t) => angulo < t.hasta) ?? tramos[tramos.length - 1]).color
  })
}

// la configuración de un símbolo (capas.ts): la forma, el atributo del conteo y, para los rombos y los anillos, sus colores
export type Simbolo =
  | { forma: 'cuadrado'; conteo: string }
  | { forma: 'rombo'; campo: string; niveles: Readonly<Record<string, { relleno: string; borde: string; marca?: string }>> }
  | { forma: 'anillo'; conteo: string; colores: readonly string[] }

// el radio del símbolo: el anillo de la selección (3 px en focus) va 3 px por fuera
export const radioDe = (simbolo: Simbolo): number =>
  (simbolo.forma === 'cuadrado' ? LADO_DEL_CUADRADO : simbolo.forma === 'rombo' ? LADO_DEL_ROMBO : LADO_DEL_ANILLO) / 2

// el id de la imagen de cada elemento: un cuadrado por capa, un rombo por nivel y un anillo por reparto de conteos (lo pone
// paraElMapa en __anillo, p. ej. «sg-anillo-3-4-3-2»)
export const idDelCuadrado = (capa: string) => `sg-cuadrado-${capa}`
export const idDelRombo = (capa: string, nivel: string) => `sg-rombo-${capa}-${nivel}`
export const SIN_NIVEL = 'SIN'

// las imágenes fijas de un símbolo con el tema activo: el cuadrado de la capa o un rombo por nivel (y uno sin nivel, del
// color de la capa)
export function imagenesFijas(capa: string, color: string, simbolo: Simbolo): Record<string, Imagen> {
  if (simbolo.forma === 'cuadrado') return { [idDelCuadrado(capa)]: cuadrado(colorDe(color), colorDe('--sg-surface')) }
  if (simbolo.forma === 'rombo') {
    const imagenes: Record<string, Imagen> = {
      [idDelRombo(capa, SIN_NIVEL)]: rombo(colorDe(color), colorDe('--sg-text-secondary'))
    }
    for (const [nivel, n] of Object.entries(simbolo.niveles)) {
      imagenes[idDelRombo(capa, nivel)] = rombo(colorDe(n.relleno), colorDe(n.borde), n.marca ? colorDe(n.marca) : undefined)
    }
    return imagenes
  }
  return {}
}

// el anillo que MapLibre pide por su id (setMissingStyleImageResolver): los conteos van en el id, en el orden de los colores
export function anilloDe(id: string, colores: readonly string[]): Imagen | null {
  if (!id.startsWith(PREFIJO_DEL_ANILLO)) return null
  const conteos = id.slice(PREFIJO_DEL_ANILLO.length).split('-').map(Number)
  if (conteos.some((n) => !Number.isFinite(n))) return null
  return anillo(
    conteos,
    colores.map((c) => colorDe(c)),
    colorDe('--sg-surface'),
    colorDe('--sg-text-muted')
  )
}
