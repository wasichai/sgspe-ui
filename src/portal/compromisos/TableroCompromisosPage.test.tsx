import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeCompromisos, C1, EQUIPO_DE_COMPROMISOS, GESTORA } from '../../test/compromisos'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { TableroCompromisosPage } from './TableroCompromisosPage'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

// S27 (dashboards.md §5.6): una llamada con los filtros de campaña y responsable, los once KPI-COM en sus zonas, los filtros que
// un indicador no aplica dichos, «no disponible» en lugar de cero y los pendientes con su ficha
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const ind = (code: string, label: string, extra: Record<string, unknown> = {}) => ({ code, label, available: true, value: 0, ...extra })
const TABLERO = {
  dashboard: 'commitments',
  computedAt: '2026-10-09T15:00:00Z',
  filters: {},
  indicators: [
    ind('KPI-COM-01', 'Compromisos registrados', {
      value: 12,
      ignoredFilters: ['owner'],
      breakdowns: [
        {
          by: 'workflow_state',
          rows: [
            { key: 'in_progress', value: 7 },
            { key: 'closed', value: 5 }
          ]
        }
      ]
    }),
    ind('KPI-COM-02', 'Compromisos abiertos', { value: 7 }),
    ind('KPI-COM-03', 'Compromisos vencidos', {
      value: 3,
      breakdowns: [
        {
          by: 'daysOverdue',
          rows: [
            { key: '1-7', value: 1 },
            { key: '8-15', value: 0 },
            { key: 'más de 15', value: 2 }
          ]
        }
      ]
    }),
    ind('KPI-COM-04', 'Compromisos por vencer', { value: 2 }),
    ind('KPI-COM-05', 'Cumplidos en el periodo', { value: 4 }),
    { code: 'KPI-COM-06', label: 'Compromisos bloqueados', available: false, unavailableReason: 'OBJECT_NOT_READABLE' },
    ind('KPI-COM-07', 'Desgloses', {
      value: 7,
      breakdowns: [
        { by: 'owner', rows: [{ key: 'cmm@sgspe.test', label: 'cmm@sgspe.test', value: 5, overdue: 2 }] },
        { by: 'topic', rows: [{ key: 't1', label: 'Agua', value: 3, overdue: 1 }] }
      ]
    }),
    ind('KPI-COM-08', 'Formales por tema', {
      value: 6,
      breakdowns: [
        {
          by: 'commitment_theme',
          rows: [
            { key: 'SOCIAL', value: 4 },
            { key: 'AMBIENTAL', value: 2 }
          ]
        }
      ]
    }),
    ind('KPI-COM-09', 'Cumplidos a tiempo', {
      value: 66.7,
      unit: '%',
      numerator: 2,
      denominator: 3,
      breakdowns: [
        {
          by: 'against',
          rows: [
            { key: 'current', value: 66.7, numerator: 2, denominator: 3 },
            { key: 'original', value: 33.3, numerator: 1, denominator: 3 }
          ]
        }
      ]
    }),
    ind('KPI-COM-10', 'Monto comprometido frente a ejecutado', {
      value: 25000,
      breakdowns: [{ by: 'currency', rows: [{ key: 'PEN', value: 25000, committed: 25000, executed: 10000 }] }]
    }),
    ind('KPI-COM-11', 'Vencidos al cierre de cada mes', {
      value: 3,
      series: [
        { period: '2026-09', value: 2 },
        { period: '2026-10', value: 3 }
      ]
    })
  ]
}
const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  { path: '/sgspe/dashboards/commitments', body: TABLERO },
  { path: '/objects/exploration_campaign/records', body: pagina([registro('camp1', { project: 'p1', name: 'Campaña 2026' })]) },
  { path: /^\/objects\/commitment\/records\?.*VENCIDO/, body: pagina([{ ...C1, attributes: { ...C1.attributes, deadline_status: 'VENCIDO' } }]) },
  { path: /^\/objects\/commitment\/records\?.*POR\+VENCER/, body: pagina([]) }
]
const abrir = () =>
  montar(<TableroCompromisosPage />, {
    ruta: '/projects/p1/commitments/dashboard',
    camino: '/projects/:projectId/commitments/dashboard',
    usuario: GESTORA,
    permisos: EQUIPO_DE_COMPROMISOS
  })

describe('S27 · tablero de compromisos', () => {
  it('dibuja las zonas con sus cifras, dice lo que no está disponible y lo que no aplica el filtro', async () => {
    fetch = mockFetch(rutas())
    abrir()
    expect(await screen.findByRole('region', { name: 'Compromisos registrados' })).toHaveTextContent('12')
    expect(screen.getByRole('region', { name: 'Compromisos bloqueados' })).toHaveTextContent('No disponible')
    expect(screen.getByRole('table', { name: 'Días de atraso' })).toHaveTextContent('más de 15')
    const atiempo = screen.getByRole('region', { name: 'Cumplimiento a tiempo' })
    expect(within(atiempo).getByText('Frente al plazo original')).toBeInTheDocument()
    expect(within(atiempo).getByText(/33\.3 % · 1 de 3/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Comprometido frente a ejecutado' })).toHaveTextContent('S/ 10,000.00')
    const desgloses = screen.getByRole('region', { name: 'Dónde y en manos de quién' })
    expect(within(desgloses).getByRole('table', { name: 'Responsable: abiertos y vencidos' })).toHaveTextContent('cmm@sgspe.test')
    await userEvent.click(within(desgloses).getByRole('tab', { name: 'Tema' }))
    expect(within(desgloses).getByRole('table', { name: 'Tema: abiertos y vencidos' })).toHaveTextContent('Agua')
    const pendientes = screen.getByRole('region', { name: 'Pendientes: vencidos y por vencer' })
    expect(await within(pendientes).findByRole('link', { name: 'Reservorio de agua para Tunas Pampa' })).toHaveAttribute('href', '/projects/p1/commitments/c1')
  })

  it('los filtros de campaña y de responsable viajan en la llamada; la zona que no aplica el responsable lo dice', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir()
    await screen.findByRole('option', { name: 'Campaña 2026' })
    await userEvent.selectOptions(screen.getByLabelText('Campaña'), 'camp1')
    await userEvent.click(screen.getByLabelText('Solo los míos (responsable)'))
    await waitFor(() => {
      const ultima = red!.a('GET', '/sgspe/dashboards/commitments').at(-1)!.ruta
      expect(ultima).toContain('explorationCampaign=camp1')
      expect(ultima).toContain('owner=u-cmm')
    })
    expect(await screen.findByText('Esta cifra no aplica el filtro de responsable')).toBeInTheDocument()
  })

  it('400 TOO_MANY_RECORDS es «Acote los filtros», no un error de carga ni ceros', async () => {
    fetch = mockFetch(rutas().filter((r) => r.path !== '/sgspe/dashboards/commitments'))
    red = espiarRed([{ path: '/sgspe/dashboards/commitments', responder: () => problema(400, 'x', [{ field: 'project', message: 'TOO_MANY_RECORDS' }]) }])
    abrir()
    expect(await screen.findByText('Acote los filtros')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Compromisos registrados' })).not.toBeInTheDocument()
  })
})
