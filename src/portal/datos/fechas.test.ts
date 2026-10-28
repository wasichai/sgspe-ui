import { afterEach, describe, expect, it } from 'vitest'
import { diaPe, fechaPe, fechaYHoraPe } from '../i18n'
import { ahoraEnLima, cuandoRelativo, diaDeTexto, diasEntre, horaDeTexto, hoyEnLima, instanteDeLima, textoDeDia } from './fechas'

describe('ahoraEnLima', () => {
  it('la hora por defecto es la de Lima, no la del navegador', () => {
    expect(ahoraEnLima(new Date('2026-10-09T03:30:00Z'))).toBe('2026-10-08T22:30')
  })
})

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

// hallazgo U-07: CampoFecha muestra y lee el día como dd/mm/aaaa y la hora en 24 h, sea cual sea el idioma del navegador
describe('diaDeTexto, textoDeDia y horaDeTexto', () => {
  it('lee el día escrito como dd/mm/aaaa, ddmmaaaa o dd-mm-aaaa', () => {
    expect(diaDeTexto('20/10/2026')).toBe('2026-10-20')
    expect(diaDeTexto('20102026')).toBe('2026-10-20')
    expect(diaDeTexto('20-10-2026')).toBe('2026-10-20')
    expect(diaDeTexto(' 1/9/2026 ')).toBe('2026-09-01')
  })

  it('un día que no existe o no es un día es null', () => {
    expect(diaDeTexto('31/02/2026')).toBeNull()
    expect(diaDeTexto('29/02/2026')).toBeNull()
    expect(diaDeTexto('29/02/2028')).toBe('2028-02-29')
    expect(diaDeTexto('10/20/2026')).toBeNull()
    expect(diaDeTexto('2026-10-20')).toBeNull()
    expect(diaDeTexto('mañana')).toBeNull()
    expect(diaDeTexto('')).toBeNull()
  })

  it('dice un día AAAA-MM-DD como dd/mm/aaaa, y lo demás vacío', () => {
    expect(textoDeDia('2026-10-20')).toBe('20/10/2026')
    expect(textoDeDia('2026-10-20T10:15')).toBe('20/10/2026')
    expect(textoDeDia('')).toBe('')
    expect(textoDeDia('mañana')).toBe('')
  })

  it('lee la hora de 24 h como HH:mm, también sin los dos puntos', () => {
    expect(horaDeTexto('10:15')).toBe('10:15')
    expect(horaDeTexto('1015')).toBe('10:15')
    expect(horaDeTexto('9:05')).toBe('09:05')
    expect(horaDeTexto('905')).toBe('09:05')
    expect(horaDeTexto('23:59')).toBe('23:59')
    expect(horaDeTexto('24:00')).toBeNull()
    expect(horaDeTexto('10:60')).toBeNull()
    expect(horaDeTexto('10:15 pm')).toBeNull()
    expect(horaDeTexto('')).toBeNull()
  })
})

// tercera pasada de UX (1.7, DD-35): un plazo dicho desde hoy, en días de calendario o, con feriados, hábiles
describe('cuandoRelativo', () => {
  // el miércoles 28 de octubre de 2026
  const HOY = '2026-10-28'
  it('hoy, mañana y ayer, y los días que faltan o que pasaron, de calendario', () => {
    expect(cuandoRelativo('2026-10-28', HOY)).toEqual({ sentido: 'hoy', dias: 0, habiles: false })
    expect(cuandoRelativo('2026-10-29', HOY)).toEqual({ sentido: 'manana', dias: 1, habiles: false })
    expect(cuandoRelativo('2026-10-27', HOY)).toEqual({ sentido: 'ayer', dias: 1, habiles: false })
    expect(cuandoRelativo('2026-11-02', HOY)).toEqual({ sentido: 'futuro', dias: 5, habiles: false })
    expect(cuandoRelativo('2026-10-23T15:00:00Z', HOY)).toEqual({ sentido: 'pasado', dias: 5, habiles: false })
  })

  it('con feriados cuenta de lunes a viernes y salta los feriados', () => {
    // del miércoles 28 al lunes 2 de noviembre: jueves 29, viernes 30 y lunes 2; el domingo 1 no cuenta
    expect(cuandoRelativo('2026-11-02', HOY, new Set())).toEqual({ sentido: 'futuro', dias: 3, habiles: true })
    // con el viernes 30 feriado, dos
    expect(cuandoRelativo('2026-11-02', HOY, new Set(['2026-10-30']))).toEqual({ sentido: 'futuro', dias: 2, habiles: true })
    // venció el viernes 23: lunes 26, martes 27 y miércoles 28
    expect(cuandoRelativo('2026-10-23', HOY, new Set())).toEqual({ sentido: 'pasado', dias: 3, habiles: true })
  })

  it('lo que no es una fecha no se dice', () => {
    expect(cuandoRelativo(null, HOY)).toBeNull()
    expect(cuandoRelativo('pronto', HOY)).toBeNull()
  })
})
