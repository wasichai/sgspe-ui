import { screen, within } from '@testing-library/react'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { GERENCIA_SOCIAL } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { P1, EQUIPO, base } from '../../test/relacionamiento'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))
vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
  vi.unstubAllGlobals()
})

describe('tablero de relacionamiento', () => {
  it('dibuja la actividad por tipo, las reuniones frente a la meta y la tabla de reuniones informativas', async () => {
    fetch = abrirPortal('/engagements/dashboard', GERENCIA_SOCIAL, EQUIPO, [
      ...base(GERENCIA_SOCIAL),
      { path: '/objects/project/records', body: pagina([P1]) },
      {
        path: '/sgspe/dashboards/engagement',
        body: {
          dashboard: 'engagement',
          computedAt: '2026-10-07T15:04:05Z',
          filters: {},
          indicators: [
            {
              code: 'KPI-ENG-01',
              label: 'Interacciones realizadas',
              available: true,
              value: 9,
              breakdowns: [
                {
                  by: 'engagement_type',
                  rows: [
                    { key: 'ASAMBLEA', value: 3 },
                    { key: 'REUNION', value: 6 }
                  ]
                }
              ]
            },
            // un indicador disponible trae siempre value, aunque su zona dibuje la serie o el desglose (api.md §4.11)
            { code: 'KPI-ENG-02', label: 'Reuniones', available: true, value: 3, series: [{ period: '2026-10', value: 3, target: 2 }] },
            {
              code: 'KPI-ENG-03',
              label: 'Asistentes',
              available: true,
              value: 35,
              breakdowns: [{ by: 'engagement', rows: [{ key: 'e1', label: 'Taller de agua', value: 35, femalePercent: 40, directArea: 30, indirectArea: 5 }] }]
            },
            {
              code: 'KPI-ENG-04',
              label: 'Temas',
              available: true,
              value: 78,
              breakdowns: [{ by: 'topic', rows: Array.from({ length: 12 }, (_, i) => ({ key: `t${i}`, label: `Tema ${i}`, value: 12 - i })) }]
            },
            { code: 'KPI-ENG-05', label: 'Inquietudes resueltas', available: true, value: 75, numerator: 3, denominator: 4, unit: '%' }
          ]
        }
      }
    ])
    const informativas = await screen.findByRole('table', { name: 'Reuniones informativas' })
    expect(within(informativas).getByText('Taller de agua')).toBeInTheDocument()
    expect(within(informativas).getByText('40 %')).toBeInTheDocument()
    // directArea e indirectArea son conteos de asistentes, no porcentajes
    expect(within(informativas).getByRole('columnheader', { name: 'Del AIDS' })).toBeInTheDocument()
    expect(within(informativas).getByRole('cell', { name: '30' })).toBeInTheDocument()
    expect(within(informativas).getByRole('cell', { name: '5' })).toBeInTheDocument()
    const temas = screen.getByRole('table', { name: 'Temas consultados' })
    expect(within(temas).getAllByRole('row')).toHaveLength(12)
    expect(within(temas).getByRole('cell', { name: 'Otros' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('table', { name: 'Reuniones al mes frente a la meta' }))
        .getAllByRole('cell')
        .map((c) => c.textContent)
    ).toEqual(['2026-10', '3', '2'])
    expect(screen.getByText('3 / 4 · %')).toBeInTheDocument()
  })

  it('400 TOO_MANY_RECORDS deja el tablero en «acote los filtros» con los filtros a la vista', async () => {
    fetch = abrirPortal('/engagements/dashboard', GERENCIA_SOCIAL, EQUIPO, [...base(GERENCIA_SOCIAL), { path: '/objects/project/records', body: pagina([P1]) }])
    red = espiarRed([
      {
        path: '/sgspe/dashboards/engagement',
        responder: () => problema(400, 'Demasiados registros', [{ field: 'project', message: 'TOO_MANY_RECORDS' }])
      }
    ])
    expect(await screen.findByText('Acote los filtros')).toBeInTheDocument()
    expect(screen.getByText(/Hay demasiados registros para calcular estas cifras/)).toBeInTheDocument()
    expect(screen.queryByText(/No se pudo cargar/)).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Filtros del tablero' })).toBeInTheDocument()
  })

  it('una cifra sin dato dice «—», nunca 0, y una zona dice los filtros que no aplica', async () => {
    fetch = abrirPortal('/projects/p1/engagements/dashboard', GERENCIA_SOCIAL, EQUIPO, [
      ...base(GERENCIA_SOCIAL),
      {
        path: '/sgspe/dashboards/engagement',
        body: {
          dashboard: 'engagement',
          computedAt: '2026-10-07T15:04:05Z',
          filters: {},
          indicators: [
            {
              code: 'KPI-ENG-03',
              label: 'Asistentes',
              available: true,
              value: null,
              ignoredFilters: ['community'],
              breakdowns: [
                { by: 'engagement', rows: [{ key: 'e1', label: 'Taller de agua', value: null, femalePercent: null, directArea: null, indirectArea: null }] }
              ]
            }
          ]
        }
      }
    ])
    const informativas = await screen.findByRole('table', { name: 'Reuniones informativas' })
    expect(within(informativas).getAllByRole('cell', { name: '—' })).toHaveLength(4)
    expect(within(informativas).queryByRole('cell', { name: '0' })).not.toBeInTheDocument()
    expect(screen.getByText(/Esta cifra no aplica el filtro de/)).toBeInTheDocument()
  })

  it('un 403 del tablero dice «No disponible» con su motivo y deja los filtros fuera', async () => {
    fetch = abrirPortal('/engagements/dashboard', GERENCIA_SOCIAL, EQUIPO, [...base(GERENCIA_SOCIAL), { path: '/objects/project/records', body: pagina([P1]) }])
    red = espiarRed([
      {
        path: '/sgspe/dashboards/engagement',
        responder: () => problema(403, 'Sin asignación', [{ field: 'project', message: 'NOT_ASSIGNED' }])
      }
    ])
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByText('NOT_ASSIGNED')).not.toBeInTheDocument()
  })
})
