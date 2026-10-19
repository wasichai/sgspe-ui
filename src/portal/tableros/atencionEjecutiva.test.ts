import { describe, expect, it } from 'vitest'
import { TABLERO_EJECUTIVO } from '../../test/f8'
import { itemsDeAtencion, MAXIMO_DE_ATENCION } from './atencionEjecutiva'
import type { TableroEjecutivo } from './contratoF8'

// screens.md S51: «Lo que necesita atención hoy», por regla fija y no por IA (decisión 5 del plan)
const TABLERO = TABLERO_EJECUTIVO as unknown as TableroEjecutivo

describe('lo que necesita atención hoy', () => {
  it('ordena por alertas, riesgos altos, vencidos y quejas, y de mayor a menor dentro de cada uno', () => {
    expect(itemsDeAtencion(TABLERO).map((i) => [i.code, i.proyecto, i.valor, i.ruta])).toEqual([
      ['KPI-EXE-02', 'p1', 2, '/projects/p1/risks/warnings'],
      ['KPI-RSK-01', 'p1', 1, '/projects/p1/risks/register'],
      ['KPI-COM-03', 'p1', 3, '/projects/p1/commitments'],
      ['KPI-GRV-02', 'p2', 3, '/projects/p2/attention'],
      ['KPI-GRV-02', 'p1', 1, '/projects/p1/attention']
    ])
  })

  it('sin la tabla por proyecto, una entrada por cifra de toda la cartera que no es cero', () => {
    const sinTabla = { ...TABLERO, byProject: undefined, byProjectOmitted: true }
    expect(itemsDeAtencion(sinTabla).map((i) => [i.code, i.proyecto, i.valor, i.ruta])).toEqual([
      ['KPI-EXE-02', null, 2, '/risks/dashboard'],
      ['KPI-RSK-01', null, 1, '/risks/register'],
      ['KPI-COM-03', null, 3, '/commitments'],
      ['KPI-GRV-02', null, 4, '/attention']
    ])
  })

  it('una cifra no disponible no pide atención, y la lista se corta en diez', () => {
    const muchos = {
      ...TABLERO,
      byProject: Array.from({ length: 12 }, (_, n) => ({
        project: `p${n}`,
        code: `PRJ-${n}`,
        name: null,
        indicators: [
          { code: 'KPI-EXE-02', label: 'Alertas activas', available: true, value: n + 1 },
          { code: 'KPI-RSK-01', label: 'Riesgos', available: false, unavailableReason: 'OBJECT_NOT_READABLE' }
        ]
      }))
    }
    const items = itemsDeAtencion(muchos)
    expect(items).toHaveLength(MAXIMO_DE_ATENCION)
    expect(items.every((i) => i.code === 'KPI-EXE-02')).toBe(true)
    expect(items[0].valor).toBe(12)
  })
})
