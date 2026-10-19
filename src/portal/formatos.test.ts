import { describe, expect, it } from 'vitest'
import { mesPe, periodoPe } from './i18n'

// los meses y los periodos de las series se leen como fechas es-PE, no como «2026-10»
describe('formatos de mes y periodo', () => {
  it('un mes AAAA-MM se dice con su nombre', () => {
    expect(mesPe('2026-10')).toBe('octubre de 2026')
    expect(mesPe('2026-01')).toBe('enero de 2026')
  })

  it('el periodo de una serie se dice corto: el mes con su año o el día', () => {
    expect(periodoPe('2025-11')).toBe('nov. 2025')
    expect(periodoPe('2026-09-07')).toBe('7 set. 2026')
  })

  it('lo que no es un mes ni un día sale tal cual', () => {
    expect(mesPe('pronto')).toBe('pronto')
    expect(periodoPe('2026-T3')).toBe('2026-T3')
  })
})
