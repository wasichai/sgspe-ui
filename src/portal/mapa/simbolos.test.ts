import { describe, expect, it } from 'vitest'
import { anillo, anilloDe, cuadrado, DENSIDAD, rgbaDe, rombo } from './simbolos'

// el color del píxel en (x, y) px CSS de un ícono
const en = (imagen: { width: number; data: Uint8Array }, x: number, y: number) => {
  const i = (Math.floor(y * DENSIDAD) * imagen.width + Math.floor(x * DENSIDAD)) * 4
  return [...imagen.data.slice(i, i + 4)]
}

describe('los símbolos de las capas de gestión', () => {
  it('lee los colores que da colorDe: hex corto, largo, con alfa y rgb()', () => {
    expect(rgbaDe('#fff')).toEqual([255, 255, 255, 255])
    expect(rgbaDe('#159f78')).toEqual([21, 159, 120, 255])
    expect(rgbaDe('#15 9f78')).toEqual([128, 128, 128, 255])
    expect(rgbaDe('#159f7880')).toEqual([21, 159, 120, 128])
    expect(rgbaDe('rgb(21 159 120 / 50%)')).toEqual([21, 159, 120, 128])
    expect(rgbaDe('rgba(21, 159, 120, 1)')).toEqual([21, 159, 120, 255])
  })

  it('el cuadrado de LYR-19 mide 18 px, con el relleno de la capa y el borde surface de 1,5 px', () => {
    const imagen = cuadrado('#159f78', '#ffffff')
    expect([imagen.width, imagen.height]).toEqual([36, 36])
    expect(en(imagen, 9, 9)).toEqual([21, 159, 120, 255])
    expect(en(imagen, 0.5, 9)).toEqual([255, 255, 255, 255])
  })

  it('el rombo de LYR-21 deja las esquinas vacías y, con marca, lleva el «!» al centro', () => {
    const conMarca = rombo('#a11a1a', '#7a1212', '#ffffff')
    expect(en(conMarca, 1, 1)[3]).toBe(0)
    expect(en(conMarca, 10, 8)).toEqual([255, 255, 255, 255])
    expect(en(conMarca, 10, 13.6)).toEqual([255, 255, 255, 255])
    expect(en(conMarca, 7, 10)).toEqual([161, 26, 26, 255])
    expect(en(conMarca, 10, 0.8)).toEqual([122, 18, 18, 255])
    expect(en(rombo('#a11a1a', '#7a1212'), 10, 8)).toEqual([161, 26, 26, 255])
  })

  it('el anillo de LYR-17 reparte sus tramos por los conteos desde las doce y deja el centro para el total', () => {
    const imagen = anillo([1, 1], ['#0000ff', '#ff0000'], '#ffffff', '#888888')
    // a las tres (derecha) el primer tramo, a las nueve (izquierda) el segundo; el centro, surface
    expect(en(imagen, 25.5, 14)).toEqual([0, 0, 255, 255])
    expect(en(imagen, 2.5, 14)).toEqual([255, 0, 0, 255])
    expect(en(imagen, 14, 14)).toEqual([255, 255, 255, 255])
    expect(en(imagen, 0.5, 0.5)[3]).toBe(0)
    expect(en(anillo([0, 0], ['#0000ff', '#ff0000'], '#ffffff', '#888888'), 25.5, 14)).toEqual([136, 136, 136, 255])
  })

  it('el anillo que MapLibre pide se arma con los conteos de su id', () => {
    expect(anilloDe('sg-anillo-1-2', ['#0000ff', '#ff0000'])?.width).toBe(56)
    expect(anilloDe('sg-cuadrado-LYR-19', ['#0000ff'])).toBeNull()
    expect(anilloDe('sg-anillo-x', ['#0000ff'])).toBeNull()
  })
})
