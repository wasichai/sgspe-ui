import { describe, expect, it } from 'vitest'
import { registro } from '../../test/montar'
import { diaDe, diaEnLima, esDia, esMes, esFormal, semanaDe, semanasDelMes, sumarMeses } from './fechas'

describe('días en Lima', () => {
  it('una interacción del 2026-10-02T03:00:00Z es del 1 de octubre y a las 05:00Z ya es del 2', () => {
    expect(diaEnLima('2026-10-02T03:00:00Z')).toBe('2026-10-01')
    expect(diaEnLima('2026-10-02T04:59:59Z')).toBe('2026-10-01')
    expect(diaEnLima('2026-10-02T05:00:00Z')).toBe('2026-10-02')
  })

  it('el día de una interacción es el de su realización y, si no se realizó, el programado; sin fecha o con basura, null', () => {
    expect(diaDe(registro('a', { held_at: '2026-10-02T03:00:00Z', scheduled_at: '2026-10-09T15:00:00Z' }))).toBe('2026-10-01')
    expect(diaDe(registro('b', { held_at: null, scheduled_at: '2026-10-09T15:00:00Z' }))).toBe('2026-10-09')
    expect(diaDe(registro('c', {}))).toBeNull()
    expect(diaDe(registro('d', { held_at: 'ayer' }))).toBeNull()
  })

  it('valida el mes y el día de la URL', () => {
    expect(esMes('2026-10')).toBe(true)
    expect(['2026-13', '2026-1', 'octubre', null].map(esMes)).toEqual([false, false, false, false])
    expect(esDia('2026-10-31')).toBe(true)
    expect(['2026-02-30', '2026-10', 'hoy', null].map(esDia)).toEqual([false, false, false, false])
  })
})

describe('semanas', () => {
  it('suma meses cruzando el año', () => {
    expect(sumarMeses('2026-12', 1)).toBe('2027-01')
    expect(sumarMeses('2026-01', -1)).toBe('2025-12')
  })

  it('octubre de 2026 son cinco semanas de lunes a domingo, de 2026-09-28 a 2026-11-01', () => {
    const semanas = semanasDelMes('2026-10')
    expect(semanas).toHaveLength(5)
    expect(semanas[0][0]).toBe('2026-09-28')
    expect(semanas[4][6]).toBe('2026-11-01')
    expect(semanaDe('2026-10-15')[0]).toBe('2026-10-12')
  })

  it('RN-ENG-004: las reuniones y asambleas son formales y las llamadas no', () => {
    expect(esFormal(registro('a', { engagement_type: 'ASAMBLEA' }))).toBe(true)
    expect(esFormal(registro('b', { engagement_type: 'LLAMADA' }))).toBe(false)
  })
})
