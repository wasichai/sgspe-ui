import { afterEach, describe, expect, it } from 'vitest'
import { diaPe, fechaPe, fechaYHoraPe } from '../i18n'
import { diasEntre, hoyEnLima, instanteDeLima } from './fechas'

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

// revisión final, M12: un datetime-local es la hora de Lima, no la del navegador (una laptop con otro huso registraba mal)
describe('instanteDeLima', () => {
  const huso = process.env.TZ
  afterEach(() => {
    process.env.TZ = huso
  })

  it.each(['America/Lima', 'Europe/Berlin', 'Asia/Tokyo'])('con el navegador en %s, 23:30 de Lima es 04:30Z del día siguiente', (zona) => {
    process.env.TZ = zona
    expect(instanteDeLima('2026-10-06T23:30')).toBe('2026-10-07T04:30:00.000Z')
    expect(instanteDeLima('2026-10-06T23:30:15')).toBe('2026-10-07T04:30:15.000Z')
  })

  it('lo que no es una fecha no viaja', () => {
    expect(instanteDeLima('')).toBe('')
    expect(instanteDeLima('mañana')).toBe('')
    expect(instanteDeLima('2026-13-45T99:99')).toBe('')
  })
})

describe('diaPe y fechaYHoraPe', () => {
  it('un día AAAA-MM-DD se dice en es-PE sin correrse de día, y un instante con su hora de Lima', () => {
    expect(diaPe('2026-09-01')).toBe(fechaPe(new Date('2026-09-01T12:00:00-05:00')))
    expect(diaPe('2026-09-01')).toBe('1 set. 2026')
    expect(diaPe('no es fecha')).toBe('no es fecha')
    expect(fechaYHoraPe(new Date('2026-10-07T04:30:00Z'))).toMatch(/^6 oct\. 2026.*11:30/)
  })
})
