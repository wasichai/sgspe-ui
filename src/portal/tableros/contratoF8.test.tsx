import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TABLERO_EJECUTIVO } from '../../test/f8'
import { montar } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { ErrorDeSgspe } from '../datos/http'
import type { Indicador } from '../datos/indicadores'
import { mesAnterior, mesesDeTendencia, periodoDelMes, razonDeCierre, useCerrarPeriodo } from './contratoF8'

// el contrato de los tableros de F8 (api.md §4.11): la tendencia de KPI-EXE-03, el periodo de un mes en Lima y el cierre con su
// clave, su cuerpo y la razón de un 409
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

function Cerrar() {
  const cerrar = useCerrarPeriodo()
  return <button onClick={() => cerrar.mutate({ indicador: 'i-eng02', proyecto: 'p1', desde: '2026-09-01', hasta: '2026-09-30' })}>Cerrar</button>
}

describe('contrato de los tableros de F8', () => {
  it('la tendencia lee las tres medidas de cada mes de KPI-EXE-03', () => {
    const tendencia = TABLERO_EJECUTIVO.indicators.find((i) => i.code === 'KPI-EXE-03') as unknown as Indicador
    expect(mesesDeTendencia(tendencia)).toEqual([
      { period: '2026-09', engagements: 5, grievancesReceived: 2, grievancesClosed: 1, overdueCommitments: 2 },
      { period: '2026-10', engagements: 7, grievancesReceived: 1, grievancesClosed: 2, overdueCommitments: 3 }
    ])
    expect(mesesDeTendencia(undefined)).toEqual([])
  })

  it('el mes anterior y el periodo de un mes, también en febrero y en enero', () => {
    expect(mesAnterior('2026-10-16')).toBe('2026-09')
    expect(mesAnterior('2026-01-05')).toBe('2025-12')
    expect(periodoDelMes('2026-02')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
    expect(periodoDelMes('2028-02')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
  })

  it('la razón de un 409 que no se cierra sale del cuerpo; otro error no tiene razón', () => {
    const noSeCierra = new ErrorDeSgspe(409, 'x', [{ field: 'indicator', message: 'INDICATOR_NOT_CLOSABLE' }], 'c', null, { reason: 'STANCE' })
    expect(razonDeCierre(noSeCierra)).toBe('STANCE')
    expect(razonDeCierre(new ErrorDeSgspe(409, 'x', [{ field: 'attributes.period_start_date', message: 'MEASUREMENT_EXISTS' }], 'c'))).toBeNull()
    expect(razonDeCierre(new Error('red'))).toBeNull()
  })

  it('cierra con el proyecto, el periodo y una clave de idempotencia', async () => {
    fetch = mockFetch([])
    red = espiarRed([{ method: 'POST', path: '/sgspe/indicators/i-eng02/measurements', responder: () => jsonResponse({ id: 'm9' }, 201) }])
    montar(<Cerrar />)
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await screen.findByRole('button', { name: 'Cerrar' })
    await expect.poll(() => red!.a('POST', '/sgspe/indicators/i-eng02/measurements').length).toBe(1)
    const [llamada] = red.a('POST', '/sgspe/indicators/i-eng02/measurements')
    expect(llamada.cuerpo).toEqual({ project: 'p1', attributes: { period_start_date: '2026-09-01', period_end_date: '2026-09-30' } })
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })
})
