import { describe, expect, it } from 'vitest'
import { registro } from '../../test/montar'
import { EN_COMUN, ES_COMUN } from '../textos/comun'
import { esDeComando, esDerivado } from './derivados'
import { rutaDeFicha } from './fichas'
import { anioEnLima, porcentaje, sumaPorMoneda, TERMINOS_APROBADOS, totalDeItems } from './inversion'

// BC-10 en las piezas comunes (spec F5 §2.1, §2.3 y §3.3): las sumas por moneda nunca mezclan monedas ni pasan por coma flotante
// (ASM-063), los derivados y el campo de comando de F5, la ficha de un programa y de un aporte, y los códigos nuevos con texto
const presupuesto = (id: string, monto: unknown, moneda?: string) => registro(id, { allocated_amount: monto, ...(moneda ? { currency: moneda } : {}) })

describe('sumas de dinero de F5', () => {
  it('suma exacta por moneda, sin mezclar monedas ni perder dígitos pasados 2^53', () => {
    const { sumas, invalidos } = sumaPorMoneda(
      [presupuesto('b1', '9007199254740993.0002'), presupuesto('b2', '0.0003'), presupuesto('b3', 10000.1, 'USD'), presupuesto('b4', '20000.20', 'USD')],
      'allocated_amount'
    )
    expect(sumas).toEqual([
      { moneda: 'PEN', total: '9007199254740993.0005' },
      { moneda: 'USD', total: '30000.3000' }
    ])
    expect(invalidos).toBe(0)
  })

  it('un monto inválido se omite y se cuenta; uno vacío no suma ni se cuenta', () => {
    const { sumas, invalidos } = sumaPorMoneda([presupuesto('b1', '1e3'), presupuesto('b2', null), presupuesto('b3', '100')], 'allocated_amount')
    expect(sumas).toEqual([{ moneda: 'PEN', total: '100.0000' }])
    expect(invalidos).toBe(1)
  })

  it('el total de los ítems es la suma de line_amount en la moneda del aporte; sin ítems, null', () => {
    const items = [registro('it1', { line_amount: '1500' }), registro('it2', { line_amount: '250.50', currency: 'USD' })]
    expect(totalDeItems(items, 'PEN')).toEqual({ total: '1750.5000', invalidos: 0 })
    expect(totalDeItems([], 'PEN')).toEqual({ total: null, invalidos: 0 })
  })

  it('el avance es la parte sobre la base con dos decimales; sin base positiva o con un monto inválido, null', () => {
    expect(porcentaje('20000', '80000')).toBe(25)
    expect(porcentaje('1', '3')).toBe(33.33)
    expect(porcentaje('5', '0')).toBeNull()
    expect(porcentaje('x', '10')).toBeNull()
    expect(porcentaje(null, '10')).toBeNull()
  })

  it('el año en curso es el de Lima: el 31 de diciembre a las 20:00 de Lima ya es enero en UTC', () => {
    expect(anioEnLima(new Date('2027-01-01T01:00:00Z'))).toBe(2026)
  })
})

describe('BC-10 en las piezas comunes', () => {
  it('total_amount y total_budget son derivados; created_contribution es de comando; la moneda es un término aprobado', () => {
    expect(esDerivado('social_contribution', 'total_amount')).toBe(true)
    expect(esDerivado('social_program', 'total_budget')).toBe(true)
    expect(esDeComando('stakeholder_request', 'created_contribution')).toBe(true)
    expect(esDeComando('stakeholder_request', 'created_commitment')).toBe(true)
    expect(TERMINOS_APROBADOS).toEqual(
      expect.arrayContaining(['currency', 'contribution_type', 'topic', 'exploration_campaign', 'has_institutional_synergy', 'agreement'])
    )
    expect(TERMINOS_APROBADOS).not.toContain('declared_purpose')
  })

  it('la ficha de un programa y la de un aporte viven bajo su proyecto, con el id codificado', () => {
    expect(rutaDeFicha('social_program', registro('sp/1', { project: 'p1' }))).toBe('/projects/p1/programs/sp%2F1')
    expect(rutaDeFicha('social_contribution', registro('a1', { project: 'p1' }))).toBe('/projects/p1/contributions/a1')
    expect(rutaDeFicha('social_contribution', registro('a1', {}))).toBeNull()
    expect(rutaDeFicha('program_budget', registro('b1', { social_program: 'sp1' }))).toBeNull()
  })

  it('los once códigos de F5 tienen texto en los dos idiomas', () => {
    const codigos = [
      'ITEMS_REQUIRED',
      'ITEMS_FROZEN',
      'CONTRIBUTION_FROZEN',
      'DELIVERY_EXISTS',
      'FIELD_NOT_ALLOWED',
      'PROGRAM_MISMATCH',
      'PAID_LABOR',
      'MONETARY_DONATION',
      'PRIORITY_NOT_MET',
      'PRIORITIES_NOT_CONFIGURED',
      'SYNERGY_AGREEMENT_REQUIRED'
    ]
    for (const codigo of codigos) {
      expect(ES_COMUN.codigos, codigo).toHaveProperty(codigo)
      expect(EN_COMUN.codigos, codigo).toHaveProperty(codigo)
    }
  })
})
