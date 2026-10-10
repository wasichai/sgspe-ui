import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { baseDeRiesgos, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS } from '../../test/riesgos'
import { TableroRiesgosPage } from './TableroRiesgosPage'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

// S62 (dashboards.md §5.8): una llamada al tablero risks, los cinco KPI-RSK en el orden 02, 01, 03, 04 y 05, el mapa de calor como
// tabla de verdad con su valoración vigente y residual, lo que no entra al mapa dicho, «no disponible» en lugar de cero y «acote
// los filtros» ante el tope. sin nota de confidenciales: los riesgos no tienen alcance por registro
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const celdas = (valores: Record<string, number>, conNivel = false) =>
  [1, 2, 3, 4, 5].flatMap((p) =>
    [1, 2, 3, 4, 5].map((i) => ({
      key: `${p}-${i}`,
      probability: p,
      impact: i,
      value: valores[`${p}-${i}`] ?? 0,
      ...(conNivel ? { level: p * i >= 15 ? 'CRITICO' : p * i >= 10 ? 'ALTO' : p * i >= 5 ? 'MEDIO' : 'BAJO' } : {})
    }))
  )
const nivelesEnCero = { BAJO: 0, MEDIO: 0, ALTO: 0, CRITICO: 0, 'SIN NIVEL': 0 }
const TABLERO = {
  dashboard: 'risks',
  computedAt: '2026-10-09T15:00:00Z',
  filters: {},
  indicators: [
    {
      code: 'KPI-RSK-02',
      label: 'Mapa de calor de riesgos',
      available: true,
      value: 3,
      breakdowns: [
        { by: 'matrix', rows: celdas({ '4-4': 2, '2-3': 1 }, true) },
        { by: 'residual', rows: celdas({ '2-2': 1 }, true) },
        { by: 'assessment', rows: [{ key: 'SIN EVALUAR', value: 4 }] }
      ]
    },
    { code: 'KPI-RSK-01', label: 'Riesgos activos', available: true, value: 7 },
    {
      code: 'KPI-RSK-03',
      label: 'Riesgos por territorio',
      available: true,
      value: 7,
      breakdowns: [
        { by: 'locality', rows: [{ key: 'l1', label: 'Tunas Pampa', value: 3, ...nivelesEnCero, ALTO: 1, CRITICO: 2 }] },
        { by: 'community', rows: [{ key: 'c1', label: 'CC Tunas Pampa', value: 2, ...nivelesEnCero, MEDIO: 2 }] }
      ]
    },
    {
      code: 'KPI-RSK-04',
      label: 'Niveles de riesgo semana a semana',
      available: true,
      value: 7,
      series: [
        { period: '2026-09-28', value: 6, BAJO: 2, MEDIO: 2, ALTO: 1, CRITICO: 1, AUMENTA: 1, 'SE MANTIENE': 4, DISMINUYE: 1 },
        { period: '2026-10-05', value: 7, BAJO: 2, MEDIO: 2, ALTO: 1, CRITICO: 2, AUMENTA: 2, 'SE MANTIENE': 5, DISMINUYE: 0 }
      ]
    },
    {
      code: 'KPI-RSK-05',
      label: 'Medidas de mitigación atrasadas',
      available: true,
      value: 2,
      breakdowns: [
        { by: 'risk', rows: [{ key: 'k1', label: 'R-001 · Bloqueo de la vía', value: 2 }] },
        { by: 'owner', rows: [{ key: 'u-srm', label: 'srm@sgspe.test', value: 2 }] }
      ]
    }
  ]
}

const abrir = (ruta = '/projects/p1/risks/dashboard') =>
  montar(<TableroRiesgosPage />, { ruta, camino: '/projects/:projectId/risks/dashboard', usuario: GESTOR_DE_RIESGOS, permisos: EQUIPO_DE_RIESGOS })

describe('S62 · tablero de riesgos', () => {
  it('dibuja el mapa de calor como tabla, lo que no entra en él y las cifras en su orden', async () => {
    fetch = mockFetch([...baseDeRiesgos(), { path: '/sgspe/dashboards/risks', body: TABLERO }])
    red = espiarRed()
    abrir()
    const mapa = await screen.findByRole('table', { name: 'Riesgos por probabilidad e impacto (Vigente)' })
    const fila4 = within(mapa).getByRole('row', { name: /^4/ })
    expect(within(fila4).getAllByRole('cell')[3]).toHaveTextContent('2')
    expect(within(fila4).getAllByRole('cell')[3]).toHaveTextContent('Crítico')
    expect(screen.getByText('Sin evaluar: 4 riesgos todavía no tienen revisión y no entran al mapa.')).toBeInTheDocument()
    const zonas = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))
    expect(zonas.filter((z) => z !== 'Filtros')).toEqual([
      'Mapa de calor de riesgos',
      'Riesgos activos',
      'Riesgos por territorio',
      'Niveles de riesgo semana a semana',
      'Medidas de mitigación atrasadas'
    ])
    expect(screen.getByRole('region', { name: 'Riesgos activos' })).toHaveTextContent('7')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al registro de riesgos' })).toHaveAttribute('href', '/projects/p1/risks/register')
    expect(red.a('GET', '/sgspe/dashboards/risks')[0].ruta).toContain('project=p1')
  })

  it('la valoración residual cambia la tabla del mapa', async () => {
    fetch = mockFetch([...baseDeRiesgos(), { path: '/sgspe/dashboards/risks', body: TABLERO }])
    abrir()
    await screen.findByRole('table', { name: 'Riesgos por probabilidad e impacto (Vigente)' })
    await userEvent.click(screen.getByRole('button', { name: 'Residual' }))
    const mapa = screen.getByRole('table', { name: 'Riesgos por probabilidad e impacto (Residual)' })
    expect(within(within(mapa).getByRole('row', { name: /^4/ })).getAllByRole('cell')[3]).toHaveTextContent('0')
    expect(within(within(mapa).getByRole('row', { name: /^2/ })).getAllByRole('cell')[1]).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Residual' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('por territorio elige el desglose; las semanas y las medidas atrasadas se leen en tablas', async () => {
    fetch = mockFetch([...baseDeRiesgos(), { path: '/sgspe/dashboards/risks', body: TABLERO }])
    abrir()
    expect(await screen.findByRole('table', { name: 'Riesgos por Localidad y nivel' })).toHaveTextContent('Tunas Pampa')
    await userEvent.selectOptions(screen.getByLabelText('Ver por'), 'community')
    expect(screen.getByRole('table', { name: 'Riesgos por Comunidad y nivel' })).toHaveTextContent('CC Tunas Pampa')
    const semanas = screen.getByRole('table', { name: 'Niveles de riesgo semana a semana' })
    expect(within(semanas).getAllByRole('row')).toHaveLength(3)
    expect(semanas).toHaveTextContent('Crítico')
    expect(screen.getByRole('table', { name: 'Medidas atrasadas por Riesgo' })).toHaveTextContent('R-001 · Bloqueo de la vía')
  })

  it('si la dimensión elegida deja de venir usa la primera que llegó; sin desgloses no afirma que no hay riesgos', async () => {
    const cambiado = (codigo: string, breakdowns: unknown[] | undefined) => ({
      ...TABLERO,
      indicators: TABLERO.indicators.map((i) => (i.code === codigo ? { ...i, breakdowns } : i))
    })
    const despues = {
      ...TABLERO,
      indicators: TABLERO.indicators.map((i) =>
        i.code === 'KPI-RSK-03'
          ? { ...i, breakdowns: i.breakdowns!.filter((b) => b.by === 'locality') }
          : i.code === 'KPI-RSK-05'
            ? { ...i, breakdowns: i.breakdowns!.filter((b) => b.by === 'owner') }
            : i
      )
    }
    let veces = 0
    fetch = mockFetch(baseDeRiesgos())
    red = espiarRed([{ path: '/sgspe/dashboards/risks', responder: () => jsonResponse(++veces === 1 ? TABLERO : despues) }])
    const vista = abrir()
    await screen.findByRole('table', { name: 'Riesgos por Localidad y nivel' })
    await userEvent.selectOptions(screen.getByLabelText('Ver por'), 'community')
    await userEvent.selectOptions(screen.getByLabelText('Medidas atrasadas por'), 'risk')
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByRole('table', { name: 'Riesgos por Localidad y nivel' })).toHaveTextContent('Tunas Pampa')
    expect(screen.getByLabelText('Ver por')).toHaveValue('locality')
    expect(screen.getByRole('table', { name: 'Medidas atrasadas por Responsable' })).toHaveTextContent('srm@sgspe.test')
    vista.unmount()
    red.restaurar()
    red = espiarRed([{ path: '/sgspe/dashboards/risks', responder: () => jsonResponse(cambiado('KPI-RSK-03', undefined)) }])
    abrir()
    const territorio = await screen.findByRole('region', { name: 'Riesgos por territorio' })
    expect(await within(territorio).findByText('El desglose por territorio no está disponible.')).toBeInTheDocument()
    expect(within(territorio).queryByText('No hay riesgos para estos filtros.')).not.toBeInTheDocument()
    expect(within(territorio).queryByRole('table')).not.toBeInTheDocument()
    expect(within(territorio).queryByLabelText('Ver por')).not.toBeInTheDocument()
  })

  it('un indicador que la cuenta no lee dice «No disponible», nunca cero', async () => {
    const sinActivos = {
      ...TABLERO,
      indicators: TABLERO.indicators.map((i) =>
        i.code === 'KPI-RSK-01' ? { code: 'KPI-RSK-01', label: 'Riesgos activos', available: false, unavailableReason: 'OBJECT_NOT_READABLE' } : i
      )
    }
    fetch = mockFetch([...baseDeRiesgos(), { path: '/sgspe/dashboards/risks', body: sinActivos }])
    abrir()
    const activos = await screen.findByRole('region', { name: 'Riesgos activos' })
    expect(activos).toHaveTextContent('No disponible')
    expect(activos).not.toHaveTextContent('0')
  })

  it('mientras carga no dibuja cifras; el tope es «acote los filtros», no un error ni ceros', async () => {
    fetch = mockFetch(baseDeRiesgos())
    red = espiarRed([{ path: '/sgspe/dashboards/risks', responder: () => problema(400, 'x', [{ field: 'project', message: 'TOO_MANY_RECORDS' }]) }])
    abrir()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(await screen.findByText(/Hay demasiados registros para calcular/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument())
  })
})
