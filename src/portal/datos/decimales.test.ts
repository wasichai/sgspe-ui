import { describe, expect, it } from 'vitest'
import { aDiezmilesimos, deDiezmilesimos } from './decimales'

describe('aDiezmilesimos y deDiezmilesimos', () => {
  it('lee un DECIMAL de hasta 4 decimales, en texto o en número, sin pasar por la coma flotante', () => {
    expect(aDiezmilesimos('30000.30')).toBe(300003000n)
    expect(aDiezmilesimos(20000)).toBe(200000000n)
    expect(aDiezmilesimos(' 10000.1 ')).toBe(100001000n)
    expect(aDiezmilesimos('-0.0001')).toBe(-1n)
    expect(aDiezmilesimos('9007199254740993.0001')).toBe(90071992547409930001n)
  })

  it('no lee lo que no es un decimal de hasta 4 decimales', () => {
    for (const malo of ['', '1e3', '0x10', '1.23456', 'abc', null, undefined, Number.NaN, Number.POSITIVE_INFINITY, {}]) {
      expect(aDiezmilesimos(malo)).toBeNull()
    }
  })

  it('10000.10 + 20000.20 es exactamente 30000.30', () => {
    const suma = aDiezmilesimos('10000.10')! + aDiezmilesimos('20000.20')!
    expect(suma).toBe(aDiezmilesimos('30000.30'))
    expect(deDiezmilesimos(aDiezmilesimos('30000.30')! - suma)).toBe('0.0000')
  })

  it('escribe el texto decimal con su signo y cuatro decimales', () => {
    expect(deDiezmilesimos(-50000000n)).toBe('-5000.0000')
    expect(deDiezmilesimos(-1n)).toBe('-0.0001')
    expect(deDiezmilesimos(90071992547409930001n)).toBe('9007199254740993.0001')
  })
})
