import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { leerBorrador, useBorradorLocal, type ContenidoDelBorrador } from './borrador'

// el borrador de un alta en este navegador (tercera pasada de UX, 2.4): se guarda medio segundo después del último cambio, lo que
// quedaba por guardar se guarda al salir de la pantalla, vacío no ocupa lugar y, descartado o terminada el alta, no vuelve
const CLAVE = 'sgspe.borrador.prueba.p1'
type Valores = { titulo: string; participantes: { nombre: string }[]; realizada: boolean }
const VACIO: Valores = { titulo: '', participantes: [], realizada: false }

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

const montar = (contenido: ContenidoDelBorrador<Valores>, activo = true) =>
  renderHook(({ contenido, activo }) => useBorradorLocal(CLAVE, contenido, activo), { initialProps: { contenido, activo } })

describe('useBorradorLocal', () => {
  it('guarda medio segundo después del último cambio, con los ids elegidos fuera del formulario', () => {
    const { rerender } = montar({ valores: { ...VACIO, titulo: 'Asam' } })
    rerender({ contenido: { valores: { ...VACIO, titulo: 'Asamblea' }, elegidos: { grupos: ['g1'] } }, activo: true })
    act(() => vi.advanceTimersByTime(499))
    expect(localStorage.getItem(CLAVE)).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    const guardado = leerBorrador<Valores>(CLAVE)
    expect(guardado?.valores.titulo).toBe('Asamblea')
    expect(guardado?.elegidos).toEqual({ grupos: ['g1'] })
    expect(typeof guardado?.guardado).toBe('string')
  })

  it('salir antes del medio segundo no pierde lo último', () => {
    const { unmount } = montar({ valores: { ...VACIO, titulo: 'Asamblea' } })
    unmount()
    expect(leerBorrador<Valores>(CLAVE)?.valores.titulo).toBe('Asamblea')
  })

  it('sin cambios no guarda, y lo vacío borra el borrador en vez de guardarlo', () => {
    const { rerender, unmount } = montar({ valores: { ...VACIO, titulo: 'x' } }, false)
    act(() => vi.advanceTimersByTime(1000))
    expect(localStorage.getItem(CLAVE)).toBeNull()
    localStorage.setItem(CLAVE, JSON.stringify({ valores: { titulo: 'viejo' }, guardado: '2026-10-19T15:00:00Z' }))
    rerender({ contenido: { valores: VACIO, elegidos: { grupos: [] } }, activo: true })
    act(() => vi.advanceTimersByTime(500))
    expect(localStorage.getItem(CLAVE)).toBeNull()
    unmount()
    expect(localStorage.getItem(CLAVE)).toBeNull()
  })

  it('descartado o terminada el alta, lo pendiente no vuelve a guardarse al salir', () => {
    const { result, unmount } = montar({ valores: { ...VACIO, titulo: 'Asamblea' } })
    act(() => result.current.descartar())
    expect(localStorage.getItem(CLAVE)).toBeNull()
    // el guardado que esperaba su medio segundo tampoco
    act(() => vi.advanceTimersByTime(1000))
    expect(localStorage.getItem(CLAVE)).toBeNull()
    unmount()
    expect(localStorage.getItem(CLAVE)).toBeNull()
  })

  it('«Guardar y salir» guarda ya lo que hay, sin esperar', () => {
    const { result } = montar({ valores: { ...VACIO, participantes: [{ nombre: 'Rosa' }] } })
    act(() => result.current.guardarYa())
    expect(leerBorrador<Valores>(CLAVE)?.valores.participantes).toEqual([{ nombre: 'Rosa' }])
  })

  it('un borrador ilegible no se recupera', () => {
    localStorage.setItem(CLAVE, '{no es json')
    expect(leerBorrador(CLAVE)).toBeNull()
    localStorage.setItem(CLAVE, JSON.stringify({ guardado: 'x' }))
    expect(leerBorrador(CLAVE)).toBeNull()
  })
})
