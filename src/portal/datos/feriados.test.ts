import { describe, expect, it } from 'vitest'
import { feriadosDe } from './feriados'

// la respuesta de GET /api/sgspe/calendar/holidays (wasichai/sgspe#159): solo los días AAAA-MM-DD del año pedido
describe('feriadosDe', () => {
  it('toma los días del año', () => {
    expect([...feriadosDe({ year: 2026, configured: true, holidays: ['2026-12-08', '2026-12-25'] }, 2026)]).toEqual(['2026-12-08', '2026-12-25'])
  })

  it('un año sin lista, una forma extraña o días de otro año no marcan nada', () => {
    expect(feriadosDe({ year: 2030, configured: false, holidays: [] }, 2030).size).toBe(0)
    expect(feriadosDe(null, 2026).size).toBe(0)
    expect(feriadosDe({ holidays: 'x' }, 2026).size).toBe(0)
    expect([...feriadosDe({ holidays: ['2027-01-01', 8, '2026-13', '2026-07-28'] }, 2026)]).toEqual(['2026-07-28'])
  })
})
