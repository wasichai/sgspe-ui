import { screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EQUIPO_DE_RELACIONES } from '../../test/atencion'
import { montar } from '../../test/montar'
import { RELACIONISTA } from '../../test/portal'
import { problema } from '../../test/red'
import { TableroAtencionPage } from './TableroAtencionPage'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

// S34 (dashboards.md §5.7): el flujo por tipo, las absueltas, los tiempos, los desgloses y la tendencia en una llamada; la nota de
// confidenciales excluidas sin cuántas; lo que no se lee dice «No disponible» y un tipo sin cifra «—», nunca 0
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const porTipo = (q: number, c: number) => [
  {
    by: 'type',
    rows: [
      { key: 'grievance', value: q },
      { key: 'inquiry', value: c }
    ]
  }
]
const TABLERO = {
  dashboard: 'attention',
  computedAt: '2026-10-09T15:00:00Z',
  filters: {},
  confidentialHidden: true,
  indicators: [
    { code: 'KPI-GRV-01', label: 'QCS recibidas', available: true, value: 7, breakdowns: porTipo(4, 3) },
    { code: 'KPI-GRV-02', label: 'QCS abiertas', available: true, value: 5, breakdowns: porTipo(3, 2) },
    { code: 'KPI-GRV-03', label: 'Quejas resueltas', available: true, value: 1, breakdowns: [{ by: 'severity', rows: [{ key: 'ALTA', value: 1 }] }] },
    { code: 'KPI-GRV-04', label: 'QCS cerradas', available: false, unavailableReason: 'OBJECT_NOT_READABLE' },
    { code: 'KPI-GRV-05', label: 'Quejas rechazadas', available: true, value: 0, breakdowns: [] },
    { code: 'KPI-GRV-06', label: 'QCS fuera de plazo', available: true, value: 2, breakdowns: porTipo(2, 0) },
    { code: 'KPI-GRV-07', label: 'QCS absueltas', available: true, value: 60, numerator: 3, denominator: 5, unit: '%' },
    {
      code: 'KPI-GRV-08',
      label: 'Desgloses de QCS',
      available: true,
      value: 7,
      breakdowns: [
        { by: 'category', rows: [{ key: 'EMPLEO', label: 'EMPLEO', value: 4, open: 2 }] },
        { by: 'stakeholder', rows: [{ key: 'ANONIMAS', label: 'Anónimas', value: 2, open: 1 }] }
      ]
    },
    {
      code: 'KPI-GRV-09',
      label: 'Recibidas frente a cerradas',
      available: true,
      value: 3,
      series: [{ period: '2026-10', value: 3, received: 3, closed: 1 }]
    },
    {
      code: 'KPI-GRV-10',
      label: 'Tiempo de atención',
      available: true,
      value: 6,
      numerator: 4,
      denominator: 5,
      breakdowns: [
        {
          by: 'type',
          rows: [
            { key: 'grievance', value: 8, attended: 3, onTime: 66.7, numerator: 2, denominator: 3 },
            { key: 'stakeholder_request', value: 4, attended: 1 }
          ]
        }
      ]
    }
  ]
}

const abrir = () =>
  montar(<TableroAtencionPage />, {
    ruta: '/projects/p1/attention/dashboard',
    camino: '/projects/:projectId/attention/dashboard',
    usuario: RELACIONISTA,
    permisos: EQUIPO_DE_RELACIONES
  })

describe('S34 · tablero de QCS', () => {
  it('dibuja el flujo por tipo, con «No disponible» en lo que no se lee y «—» en un tipo sin cifra', async () => {
    fetch = mockFetch([{ path: '/sgspe/dashboards/attention', body: TABLERO }])
    abrir()
    const flujo = await screen.findByRole('table', { name: 'Flujo de quejas, consultas y solicitudes por tipo' })
    const recibidas = within(flujo).getByRole('row', { name: /QCS recibidas/ })
    expect(
      within(recibidas)
        .getAllByRole('cell')
        .map((c) => c.textContent)
    ).toEqual(['4', '3', '—', '7'])
    expect(within(within(flujo).getByRole('row', { name: /QCS cerradas/ })).getByText('No disponible')).toBeInTheDocument()
    // «Lista · Tablero» (revisión de UX, etapa 7)
    expect(within(screen.getByRole('navigation', { name: 'Vistas del módulo' })).getByRole('link', { name: 'Lista' })).toHaveAttribute(
      'href',
      '/projects/p1/attention'
    )
    expect(within(screen.getByRole('navigation', { name: 'Vistas del módulo' })).getByRole('link', { name: 'Tablero' })).toHaveAttribute('aria-current', 'page')
  })

  it('dice que excluye confidenciales sin decir cuántas, y que cada planteamiento cuenta una vez', async () => {
    fetch = mockFetch([{ path: '/sgspe/dashboards/attention', body: TABLERO }])
    abrir()
    const nota = (await screen.findAllByRole('note')).find((n) => n.textContent?.includes('confidenciales'))
    expect(nota).toHaveTextContent('no incluye las QCS confidenciales que su cuenta no puede leer')
    expect(nota?.textContent).not.toMatch(/\d/)
    expect(screen.getByText(/Cada planteamiento cuenta una vez/)).toBeInTheDocument()
  })

  it('los tiempos por tipo, sin plazo en las solicitudes; los desgloses y la tendencia con su tabla', async () => {
    fetch = mockFetch([{ path: '/sgspe/dashboards/attention', body: TABLERO }])
    abrir()
    const tiempos = await screen.findByRole('table', { name: 'Tiempo de atención por tipo' })
    expect(
      within(tiempos)
        .getAllByRole('row')
        .map((r) => r.textContent)
    ).toEqual(['TipoMediana de díasAtendidasDentro de plazo', 'Quejas8366.7 %', 'Solicitudes41Sin plazo'])
    expect(within(screen.getByRole('table', { name: 'Por grupo de interés' })).getByText('Anónimas')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Por severidad' })).not.toBeInTheDocument()
    const tendencia = screen.getByRole('table', { name: 'Recibidas frente a cerradas por mes' })
    expect(
      within(tendencia)
        .getAllByRole('cell')
        .map((c) => c.textContent)
    ).toEqual(['oct. 2026', '3', '1'])
  })

  it('400 TOO_MANY_RECORDS es «acote los filtros», no un error ni ceros', async () => {
    fetch = mockFetch([])
    const { espiarRed } = await import('../../test/red')
    const red = espiarRed([
      { path: '/sgspe/dashboards/attention', responder: () => problema(400, 'demasiados', [{ field: 'project', message: 'TOO_MANY_RECORDS' }]) }
    ])
    abrir()
    expect(await screen.findByText(/Acote/i)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    red.restaurar()
  })
})
