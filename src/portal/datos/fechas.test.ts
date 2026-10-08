import { describe, expect, it } from 'vitest'
import { diasEntre, hoyEnLima } from './fechas'

describe('hoyEnLima', () => {
  it('a las 03:00Z todavía es el día anterior en Lima', () => {
    expect(hoyEnLima(new Date('2026-10-02T03:00:00Z'))).toBe('2026-10-01')
  })
  it('a las 05:00Z ya es el día siguiente en Lima', () => {
    expect(hoyEnLima(new Date('2026-10-02T05:00:00Z'))).toBe('2026-10-02')
  })
})

describe('diasEntre', () => {
  it('cuenta días de calendario, también con una marca de tiempo, y es null si no hay fecha', () => {
    expect(diasEntre('2026-07-09', '2026-10-07')).toBe(90)
    expect(diasEntre('2026-07-09T23:00:00Z', '2026-10-07')).toBe(90)
    expect(diasEntre('2026-10-08', '2026-10-07')).toBe(-1)
    expect(diasEntre(null, '2026-10-07')).toBeNull()
    expect(diasEntre('ayer', '2026-10-07')).toBeNull()
  })
})
