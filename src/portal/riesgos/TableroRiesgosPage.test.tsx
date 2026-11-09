import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { baseDeRiesgos, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS } from '../../test/riesgos'
import { TableroRiesgosPage } from './TableroRiesgosPage'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

// S62 (dashboards.md §5.8): una llamada al tablero risks, las cifras de KPI-RSK-01 y 05 arriba (S03) y las zonas 02, 03, 04 y 05, el
// mapa de calor como tabla de verdad con su valoración vigente y residual, lo que no entra al mapa dicho, «no disponible» en lugar de cero y «acote
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
    // la misma matriz coloreada del registro (MatrizDeRiesgo): la cifra a la vista y el nivel dicho con texto, no solo con la zona
    const fila4 = within(mapa).getByRole('row', { name: /^Probabilidad 4/ })
    expect(within(fila4).getAllByRole('cell')[3]).toHaveTextContent('2')
    expect(within(within(fila4).getAllByRole('cell')[3]).getByRole('img', { name: 'Probabilidad 4, impacto 4: 2 riesgos, nivel Crítico' })).toHaveClass(
      'bg-sg-zone-4'
    )
    expect(screen.getByText('Sin evaluar: 4 riesgos todavía no tienen revisión y no entran al mapa.')).toBeInTheDocument()
    const zonas = screen
      .getAllByRole('region')
      // el nombre de una Seccion con título sale de su encabezado (aria-labelledby), el de las demás de aria-label
      .map((r) => r.getAttribute('aria-label') ?? document.getElementById(r.getAttribute('aria-labelledby') ?? '')?.textContent)
    // S03: las dos cifras (KPI-RSK-01 y KPI-RSK-05) arriba, en una rejilla; después las zonas en su orden, y la lista de las
    // medidas atrasadas en su propia zona
    expect(
      within(screen.getByRole('group', { name: 'Cifras principales' }))
        .getAllByRole('region')
        .map((r) => r.getAttribute('aria-label'))
    ).toEqual(['Riesgos activos', 'Medidas de mitigación atrasadas'])
    expect(zonas.filter((z) => z !== 'Filtros')).toEqual([
      'Riesgos activos',
      'Medidas de mitigación atrasadas',
      'Mapa de calor de riesgos',
      'Riesgos por territorio',
      'Niveles de riesgo semana a semana',
      'Detalle de las medidas atrasadas'
    ])
    expect(screen.getByRole('region', { name: 'Riesgos activos' })).toHaveTextContent('7')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    // el tablero es una página más de Riesgos, en sus pestañas
    expect(within(screen.getByRole('navigation', { name: 'Páginas de Riesgos' })).getByRole('link', { name: 'Tablero' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(screen.getByRole('navigation', { name: 'Páginas de Riesgos' })).getByRole('link', { name: 'Registro y matriz' })).toHaveAttribute(
      'href',
      '/projects/p1/risks'
    )
    expect(red.a('GET', '/sgspe/dashboards/risks')[0].ruta).toContain('project=p1')
  })

  it('la valoración residual cambia la tabla del mapa', async () => {
    fetch = mockFetch([...baseDeRiesgos(), { path: '/sgspe/dashboards/risks', body: TABLERO }])
    abrir()
    await screen.findByRole('table', { name: 'Riesgos por probabilidad e impacto (Vigente)' })
    await userEvent.click(screen.getByRole('button', { name: 'Residual' }))
    const mapa = screen.getByRole('table', { name: 'Riesgos por probabilidad e impacto (Residual)' })
    expect(within(within(mapa).getByRole('row', { name: /^Probabilidad 4/ })).getAllByRole('cell')[3]).toHaveTextContent('0')
    expect(within(within(mapa).getByRole('row', { name: /^Probabilidad 2/ })).getAllByRole('cell')[1]).toHaveTextContent('1')
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
    expect(within(territorio).queryByText('No hay riesgos activos para estos filtros.')).not.toBeInTheDocument()
    expect(within(territorio).queryByRole('table')).not.toBeInTheDocument()
    expect(within(territorio).queryByLabelText('Ver por')).not.toBeInTheDocument()
  })

  it('sin datos de territorio abre por proyecto, y el vacío de cada desglose dice qué falta (humo F4, D5)', async () => {
    const conTerritorio = (proyecto: unknown[]) => ({
      ...TABLERO,
      indicators: TABLERO.indicators.map((i) =>
        i.code === 'KPI-RSK-03'
          ? {
              ...i,
              breakdowns: [
                { by: 'locality', rows: [] },
                { by: 'community', rows: [] },
                { by: 'areaOfInfluence', rows: [] },
                { by: 'project', rows: proyecto }
              ]
            }
          : i
      )
    })
    fetch = mockFetch(baseDeRiesgos())
    red = espiarRed([
      { path: '/sgspe/dashboards/risks', responder: () => jsonResponse(conTerritorio([{ key: 'p1', label: 'Pukaqaqa', value: 3, ...nivelesEnCero, ALTO: 3 }])) }
    ])
    const vista = abrir()
    expect(await screen.findByRole('table', { name: 'Riesgos por Proyecto y nivel' })).toHaveTextContent('Pukaqaqa')
    expect(screen.getByLabelText('Ver por')).toHaveValue('project')
    const territorio = screen.getByRole('region', { name: 'Riesgos por territorio' })
    await userEvent.selectOptions(screen.getByLabelText('Ver por'), 'locality')
    expect(within(territorio).getByText('Ningún riesgo activo de estos filtros tiene localidad registrada.')).toBeInTheDocument()
    expect(within(territorio).queryByText(/No hay riesgos/)).not.toBeInTheDocument()
    vista.unmount()
    red.restaurar()
    red = espiarRed([{ path: '/sgspe/dashboards/risks', responder: () => jsonResponse(conTerritorio([])) }])
    abrir()
    const vacio = await screen.findByRole('region', { name: 'Riesgos por territorio' })
    expect(await within(vacio).findByText('No hay riesgos activos para estos filtros.')).toBeInTheDocument()
    expect(screen.getByLabelText('Ver por')).toHaveValue('locality')
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
