import { describe, expect, it } from 'vitest'
import { hoyEnLima } from './fechas'

describe('hoyEnLima', () => {
  it('a las 03:00Z todavía es el día anterior en Lima', () => {
    expect(hoyEnLima(new Date('2026-10-02T03:00:00Z'))).toBe('2026-10-01')
  })
  it('a las 05:00Z ya es el día siguiente en Lima', () => {
    expect(hoyEnLima(new Date('2026-10-02T05:00:00Z'))).toBe('2026-10-02')
  })
})
