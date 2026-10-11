import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeInversion, CAMPANA, EQUIPO_DE_INVERSION, INVERSION, PROGRAMA } from '../../test/inversion'
import { montar, pagina } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { TableroInversionPage } from './TableroInversionPage'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

// el tablero de inversión social (dashboards.md §5.10, spec F5 §3.9): una llamada al tablero investment con sus filtros, los cuatro
// KPI-INV en su orden, montos siempre en su moneda y sin sumar monedas (ASM-063), «no disponible» en lugar de cero y «acote los
// filtros» ante el tope
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-10T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const TABLERO = {
  dashboard: 'investment',
  computedAt: '2026-10-10T15:00:00Z',
  filters: {},
  indicators: [
    {
      code: 'KPI-INV-01',
      label: 'Ejecución de la campaña frente a su tope',
      available: true,
      value: 24,
      breakdowns: [
        {
          by: 'campaign',
          rows: [
            {
              key: 'camp1',
              label: 'Campaña Ejemplo 2026',
              currency: 'PEN',
              cap: '50000',
              committed: '30000',
              executed: '12000',
              committedPercent: 60,
              executedPercent: 24,
              committedOtherCurrencyCount: 0,
              otherCurrencyCount: 1
            }
          ]
        }
      ]
    },
    {
      code: 'KPI-INV-02',
      label: 'Ejecución de programas frente a presupuesto',
      available: true,
      value: null,
      ignoredFilters: ['explorationCampaign'],
      breakdowns: [
        {
          by: 'program',
          rows: [
            {
              key: 'sp1:2026:PEN',
              program: 'sp1',
              label: 'PS-001 · Programa Ejemplo de agua segura',
              year: 2026,
              currency: 'PEN',
              allocated: '80000',
              executed: '20000',
              percent: 25,
              state: 'executing'
            },
            {
              key: 'sp2:2026:USD',
              program: 'sp2',
              label: 'PS-002 · Programa Ejemplo de becas',
              year: 2026,
              currency: 'USD',
              allocated: '5000',
              executed: '1000',
              percent: 20,
              state: 'executing'
            },
            {
              key: 'sp3:2026:PEN',
              program: 'sp3',
              label: 'PS-003 · Programa Ejemplo por aprobar',
              year: 2026,
              currency: 'PEN',
              allocated: '10000',
              executed: '0',
              percent: 0,
              state: 'pending_approval'
            }
          ]
        }
      ]
    },
    {
      code: 'KPI-INV-03',
      label: 'Inversión social ejecutada',
      available: true,
      value: 32000,
      warnings: ['1 montos ejecutados en una moneda distinta de PEN no se suman a la cifra (ASM-063)'],
      breakdowns: [
        {
          by: 'source',
          rows: [
            { key: 'COMPROMISOS:PEN', source: 'COMPROMISOS', currency: 'PEN', value: '10000' },
            { key: 'APORTES:PEN', source: 'APORTES', currency: 'PEN', value: '2000' },
            { key: 'PROGRAMAS:PEN', source: 'PROGRAMAS', currency: 'PEN', value: '20000' },
            { key: 'PROGRAMAS:USD', source: 'PROGRAMAS', currency: 'USD', value: '1000' }
          ]
        },
        {
          by: 'project',
          rows: [
            {
              key: 'p1:PEN',
              project: 'p1',
              label: 'PRY-1',
              currency: 'PEN',
              executed: '32000',
              commitments: '10000',
              contributions: '2000',
              programs: '20000',
              budget: '90000',
              cap: '50000'
            },
            {
              key: 'p1:USD',
              project: 'p1',
              label: 'PRY-1',
              currency: 'USD',
              executed: '1000',
              commitments: '0',
              contributions: '0',
              programs: '1000',
              budget: '5000',
              cap: '0'
            }
          ]
        }
      ]
    },
    { code: 'KPI-INV-04', label: 'Beneficiarios', available: false, unavailableReason: 'FIELD_NOT_READABLE' }
  ]
}

const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeInversion(),
  { path: '/sgspe/dashboards/investment', body: TABLERO },
  { path: '/objects/exploration_campaign/records', body: pagina([CAMPANA]) },
  { path: '/objects/social_program/records', body: pagina([PROGRAMA]) },
  { path: '/metadata/objects/stakeholder', body: { id: 'o-stakeholder', name: 'stakeholder', fields: [] } }
]
const abrir = (ruta = '/programs/dashboard', camino = '/programs/dashboard') =>
  montar(<TableroInversionPage />, { ruta, camino, usuario: INVERSION, permisos: EQUIPO_DE_INVERSION })

describe('tablero de inversión social', () => {
  it('una llamada al tablero investment; los cuatro KPI en su orden con montos por moneda, sin sumar monedas', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir()
    expect(await screen.findByRole('heading', { name: 'Tablero de inversión social', level: 1 })).toBeInTheDocument()
    const zonas = await screen.findAllByRole('heading', { level: 2 })
    expect(zonas.map((z) => z.textContent)).toEqual([
      'Ejecución de la campaña frente a su tope',
      'Ejecución de programas frente a presupuesto',
      'Inversión social ejecutada',
      'Beneficiarios'
    ])
    expect(screen.getByText('Comprometido: S/ 30,000.00 (60 %)')).toBeInTheDocument()
    // una figura por moneda: los programas en PEN y en USD no comparten eje
    expect(screen.getByRole('figure', { name: 'Programas en PEN' })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'Programas en USD' })).toBeInTheDocument()
    // KPI-INV-03: una fila por proyecto y moneda del desglose `project` (plan 5.2b), nunca una suma entre monedas
    const consolidado = screen.getByRole('table', { name: 'Inversión ejecutada por proyecto y moneda' })
    const pen = within(consolidado).getByText('PEN').closest('tr') as HTMLElement
    expect(within(pen).getByText('S/ 32,000.00')).toBeInTheDocument()
    expect(within(pen).getByText('S/ 10,000.00')).toBeInTheDocument()
    const usd = within(consolidado).getByText('USD').closest('tr') as HTMLElement
    expect(within(usd).getAllByText(/1,000\.00/)).toHaveLength(2)
    expect(screen.getByText('1 montos ejecutados en una moneda distinta de PEN no se suman a la cifra (ASM-063)')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Beneficiarios' })).getByText(/No disponible/)).toBeInTheDocument()
    expect(red.a('GET', '/sgspe/dashboards/investment')).toHaveLength(1)
  })

  it('un programa por aprobar no muestra ejecución', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const tabla = await screen.findByRole('table', { name: 'Presupuestos de programas en PEN' })
    const fila = within(tabla).getByText('PS-003 · Programa Ejemplo por aprobar').closest('tr') as HTMLElement
    expect(within(fila).getByText('Por aprobar')).toBeInTheDocument()
    expect(within(fila).queryByText('S/ 0.00')).not.toBeInTheDocument()
  })

  it('en un proyecto, la campaña, el programa y el año viajan como filtros; un filtro que un indicador no aplica se dice', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir('/projects/p1/programs/dashboard', '/projects/:projectId/programs/dashboard')
    // las campañas y los programas del proyecto se leen aparte: se espera a que sus opciones estén antes de elegir
    await screen.findByRole('option', { name: 'Campaña Ejemplo 2026' })
    await userEvent.selectOptions(screen.getByLabelText('Campaña'), 'camp1')
    await screen.findByRole('option', { name: 'PS-001 · Programa Ejemplo de agua segura' })
    await userEvent.selectOptions(screen.getByLabelText('Programa'), 'sp1')
    await userEvent.selectOptions(screen.getByLabelText('Año'), '2026')
    await waitFor(() => {
      const pedido = red!.a('GET', /^\/sgspe\/dashboards\/investment/).at(-1)
      expect(pedido && new URLSearchParams(pedido.ruta.split('?')[1]).get('year')).toBe('2026')
    })
    const ultima = red.a('GET', /^\/sgspe\/dashboards\/investment/).at(-1)!
    const consulta = new URLSearchParams(ultima.ruta.split('?')[1])
    expect(consulta.get('project')).toBe('p1')
    expect(consulta.get('explorationCampaign')).toBe('camp1')
    expect(consulta.has('campaign')).toBe(false)
    expect(consulta.get('program')).toBe('sp1')
    expect(consulta.get('year')).toBe('2026')
    expect(await screen.findByText('Esta cifra no aplica el filtro de campaña de exploración')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a programas y aportes' })).toHaveAttribute('href', '/projects/p1/programs')
  })

  it('TOO_MANY_RECORDS es «acote los filtros», no un error ni ceros', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { path: '/sgspe/dashboards/investment', responder: () => problema(400, 'demasiados', [{ field: 'project', message: 'TOO_MANY_RECORDS' }]) }
    ])
    abrir()
    expect(await screen.findByText('Acote los filtros')).toBeInTheDocument()
    expect(screen.queryByText('S/ 0.00')).not.toBeInTheDocument()
  })

  it('sin filtros de proyecto no ofrece campaña ni programa: solo el año', async () => {
    fetch = mockFetch(rutas([{ path: '/sgspe/dashboards/investment', body: { ...TABLERO, indicators: [] } }]))
    abrir()
    expect(await screen.findByLabelText('Año')).toBeInTheDocument()
    expect(screen.queryByLabelText('Campaña')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Programa')).not.toBeInTheDocument()
  })
})
