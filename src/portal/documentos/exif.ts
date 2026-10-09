import { instanteDeLima } from '../datos/fechas'

// los datos EXIF de una foto que el portal manda con la evidencia (api.md §4.9, decisión 1 del plan 3.2: el servidor no lee
// EXIF): el momento de captura (captured_at) y la ubicación (geometries.location). solo JPEG, que es lo que guarda un
// teléfono; un archivo que no es JPEG, o un EXIF incompleto o mal formado, no da nada y no es un error: la persona puede
// escribir la fecha. DateTimeOriginal no trae huso: con OffsetTimeOriginal se usa ese; sin él, la hora es la de Lima, la
// del trabajo de campo
export interface DatosDeCaptura {
  // instante UTC con Z
  capturadoEn?: string
  // [longitud, latitud] en grados decimales (EPSG:4326)
  ubicacion?: [number, number]
}

const TAG_EXIF = 0x8769
const TAG_GPS = 0x8825
const TAG_FECHA_ORIGINAL = 0x9003
const TAG_HUSO_ORIGINAL = 0x9011
const GPS_LAT_REF = 0x0001
const GPS_LAT = 0x0002
const GPS_LON_REF = 0x0003
const GPS_LON = 0x0004

interface Entrada {
  tipo: number
  cuenta: number
  // el desplazamiento del valor dentro del TIFF (o el del propio campo, si cabe en 4 bytes)
  valor: number
}

function leerIfd(vista: DataView, tiff: number, desplazamiento: number, le: boolean): Map<number, Entrada> {
  const entradas = new Map<number, Entrada>()
  const inicio = tiff + desplazamiento
  if (inicio + 2 > vista.byteLength) return entradas
  const n = vista.getUint16(inicio, le)
  for (let i = 0; i < n; i++) {
    const p = inicio + 2 + i * 12
    if (p + 12 > vista.byteLength) break
    const tipo = vista.getUint16(p + 2, le)
    const cuenta = vista.getUint32(p + 4, le)
    const tamano = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 } as Record<number, number>)[tipo] ?? 1
    const valor = tamano * cuenta > 4 ? tiff + vista.getUint32(p + 8, le) : p + 8
    entradas.set(vista.getUint16(p, le), { tipo, cuenta, valor })
  }
  return entradas
}

const texto = (vista: DataView, e: Entrada | undefined): string | undefined => {
  if (!e || e.tipo !== 2 || e.valor + e.cuenta > vista.byteLength) return undefined
  let s = ''
  for (let i = 0; i < e.cuenta; i++) {
    const c = vista.getUint8(e.valor + i)
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  return s
}

const racional = (vista: DataView, posicion: number, le: boolean): number => {
  const denominador = vista.getUint32(posicion + 4, le)
  return denominador === 0 ? Number.NaN : vista.getUint32(posicion, le) / denominador
}

// grados, minutos y segundos (tres RATIONAL) a grados decimales, con el signo de su referencia (S y W son negativos)
function grados(vista: DataView, e: Entrada | undefined, referencia: string | undefined, le: boolean): number | undefined {
  if (!e || e.tipo !== 5 || e.cuenta !== 3 || e.valor + 24 > vista.byteLength) return undefined
  const [g, m, s] = [0, 1, 2].map((i) => racional(vista, e.valor + i * 8, le))
  const valor = g + m / 60 + s / 3600
  if (!Number.isFinite(valor)) return undefined
  return referencia === 'S' || referencia === 'W' ? -valor : valor
}

// "2026:10:07 14:03:11" y el huso "-05:00" opcional → instante UTC
function instante(fecha: string | undefined, huso: string | undefined): string | undefined {
  const partes = fecha ? /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(fecha) : null
  if (!partes) return undefined
  const [, a, m, d, h, min, s] = partes
  const local = `${a}-${m}-${d}T${h}:${min}:${s}`
  if (huso && /^[+-]\d{2}:\d{2}$/.test(huso)) {
    const conHuso = new Date(`${local}${huso}`)
    return Number.isNaN(conHuso.getTime()) ? undefined : conHuso.toISOString()
  }
  return instanteDeLima(local) || undefined
}

export function leerExifDeJpeg(bytes: ArrayBuffer): DatosDeCaptura {
  const vista = new DataView(bytes)
  if (vista.byteLength < 4 || vista.getUint16(0) !== 0xffd8) return {}
  let p = 2
  while (p + 4 <= vista.byteLength) {
    const marcador = vista.getUint16(p)
    const largo = vista.getUint16(p + 2)
    if ((marcador & 0xff00) !== 0xff00 || marcador === 0xffda) return {}
    // APP1 con "Exif\0\0"
    if (marcador === 0xffe1 && p + 10 <= vista.byteLength && vista.getUint32(p + 4) === 0x45786966 && vista.getUint16(p + 8) === 0) {
      const tiff = p + 10
      if (tiff + 8 > vista.byteLength) return {}
      const orden = vista.getUint16(tiff)
      if (orden !== 0x4949 && orden !== 0x4d4d) return {}
      const le = orden === 0x4949
      const ifd0 = leerIfd(vista, tiff, vista.getUint32(tiff + 4, le), le)
      const datos: DatosDeCaptura = {}
      const exif = ifd0.get(TAG_EXIF)
      if (exif) {
        const sub = leerIfd(vista, tiff, vista.getUint32(exif.valor, le), le)
        const capturado = instante(texto(vista, sub.get(TAG_FECHA_ORIGINAL)), texto(vista, sub.get(TAG_HUSO_ORIGINAL)))
        if (capturado) datos.capturadoEn = capturado
      }
      const gps = ifd0.get(TAG_GPS)
      if (gps) {
        const sub = leerIfd(vista, tiff, vista.getUint32(gps.valor, le), le)
        const lat = grados(vista, sub.get(GPS_LAT), texto(vista, sub.get(GPS_LAT_REF)), le)
        const lon = grados(vista, sub.get(GPS_LON), texto(vista, sub.get(GPS_LON_REF)), le)
        if (lat !== undefined && lon !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) datos.ubicacion = [lon, lat]
      }
      return datos
    }
    p += 2 + largo
  }
  return {}
}

export async function leerExif(archivo: File): Promise<DatosDeCaptura> {
  if (archivo.type !== 'image/jpeg' && !/\.jpe?g$/i.test(archivo.name)) return {}
  try {
    // los primeros 256 kB bastan: el APP1 va al principio del archivo
    return leerExifDeJpeg(await archivo.slice(0, 262_144).arrayBuffer())
  } catch {
    return {}
  }
}
