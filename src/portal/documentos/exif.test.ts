import { describe, expect, it } from 'vitest'
import { leerExif, leerExifDeJpeg } from './exif'

// un JPEG mínimo con un APP1 EXIF: IFD0 con los punteros a Exif y a GPS, DateTimeOriginal (y OffsetTimeOriginal) y la latitud y
// la longitud en grados, minutos y segundos. le elige el orden de bytes (II o MM)
function jpegConExif({
  fecha,
  huso,
  lat,
  lon,
  le = false
}: {
  fecha?: string
  huso?: string
  lat?: [number, number, number, string]
  lon?: [number, number, number, string]
  le?: boolean
}) {
  const tiff = new DataView(new ArrayBuffer(256))
  const u16 = (p: number, v: number) => tiff.setUint16(p, v, le)
  const u32 = (p: number, v: number) => tiff.setUint32(p, v, le)
  const ascii = (p: number, s: string) => [...s, '\0'].forEach((c, i) => tiff.setUint8(p + i, c.charCodeAt(0)))
  const entrada = (p: number, tag: number, tipo: number, cuenta: number, valor: number) => {
    u16(p, tag)
    u16(p + 2, tipo)
    u32(p + 4, cuenta)
    u32(p + 8, valor)
  }
  tiff.setUint16(0, le ? 0x4949 : 0x4d4d)
  u16(2, 42)
  u32(4, 8)
  // IFD0 en 8: Exif en 38 y GPS en 96
  u16(8, 2)
  entrada(10, 0x8769, 4, 1, 38)
  entrada(22, 0x8825, 4, 1, 96)
  // Exif en 38: la fecha en 68 y el huso en 88
  const exif = [fecha ? [0x9003, 68, fecha] : null, huso ? [0x9011, 88, huso] : null].filter((e) => e !== null) as [number, number, string][]
  u16(38, exif.length)
  exif.forEach(([tag, en, valor], i) => {
    entrada(40 + i * 12, tag, 2, valor.length + 1, en)
    ascii(en, valor)
  })
  // GPS en 96: referencias en línea, grados en 150 y 174
  const gps: [number, number, number, number][] = []
  if (lat && lon) {
    gps.push([1, 2, 2, 0], [2, 5, 3, 150], [3, 2, 2, 0], [4, 5, 3, 174])
  }
  u16(96, gps.length)
  gps.forEach(([tag, tipo, cuenta, valor], i) => {
    const p = 98 + i * 12
    entrada(p, tag, tipo, cuenta, valor)
    if (tag === 1) ascii(p + 8, lat![3])
    if (tag === 3) ascii(p + 8, lon![3])
  })
  const dms = (en: number, [g, m, s]: [number, number, number, string]) =>
    [g, m, s].forEach((v, i) => {
      u32(en + i * 8, Math.round(v * 100))
      u32(en + i * 8 + 4, 100)
    })
  if (lat && lon) {
    dms(150, lat)
    dms(174, lon)
  }
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0, 0]
  const largo = 2 + exifHeader.length + tiff.byteLength
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, largo >> 8, largo & 0xff, ...exifHeader, ...new Uint8Array(tiff.buffer), 0xff, 0xda]).buffer
}

describe('EXIF de una foto', () => {
  it('lee la fecha de captura con su huso y la ubicación con el signo de S y W', () => {
    const datos = leerExifDeJpeg(jpegConExif({ fecha: '2026:10:07 14:03:11', huso: '-05:00', lat: [9, 31, 30, 'S'], lon: [77, 31, 48, 'W'] }))
    expect(datos.capturadoEn).toBe('2026-10-07T19:03:11.000Z')
    expect(datos.ubicacion![0]).toBeCloseTo(-77.53, 2)
    expect(datos.ubicacion![1]).toBeCloseTo(-9.525, 3)
  })

  it('sin huso la hora es la de Lima, también en orden de bytes II', () => {
    expect(leerExifDeJpeg(jpegConExif({ fecha: '2026:10:07 23:30:00', le: true })).capturadoEn).toBe('2026-10-08T04:30:00.000Z')
  })

  it('un archivo que no es JPEG, un EXIF sin datos o una fecha mal escrita no dan nada', async () => {
    expect(leerExifDeJpeg(new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer)).toEqual({})
    expect(leerExifDeJpeg(jpegConExif({}))).toEqual({})
    expect(leerExifDeJpeg(jpegConExif({ fecha: '2026-10-07 14:03' }))).toEqual({})
    expect(await leerExif(new File(['%PDF'], 'acta.pdf', { type: 'application/pdf' }))).toEqual({})
    expect((await leerExif(new File([jpegConExif({ fecha: '2026:10:07 14:03:11' })], 'foto.jpg', { type: 'image/jpeg' }))).capturadoEn).toBe(
      '2026-10-07T19:03:11.000Z'
    )
  })
})
