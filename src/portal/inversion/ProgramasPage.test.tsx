import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { P1 } from '../../test/compromisos'
import { APORTE, baseDeInversion, EQUIPO_DE_INVERSION, INVERSION, PROGRAMA } from '../../test/inversion'
import { definicion, montar, pagina, registro, ubicacion } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { ProgramasPage } from './ProgramasPage'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

// S42 (screens.md §10): las cifras del tablero investment (el tope con lo comprometido y lo ejecutado, el presupuesto del año por
// moneda, los beneficiarios), los programas y los aportes del alcance con su enlace, y el alta de un aporte (con motivo) o de un
// programa dentro de un proyecto, que abre su ficha
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
              otherCurrencyCount: 2
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
              key: 'sp1:2026:USD',
              program: 'sp1',
              label: 'PS-001 · Programa Ejemplo de agua segura',
              year: 2026,
              currency: 'USD',
              allocated: '5000',
              executed: null,
              percent: null,
              state: 'executing'
            },
            {
              key: 'sp1:2027:PEN',
              program: 'sp1',
              label: 'PS-001 · Programa Ejemplo de agua segura',
              year: 2027,
              currency: 'PEN',
              allocated: '90000',
              executed: null,
              percent: null,
              state: 'executing'
            }
          ]
        }
      ]
    },
    { code: 'KPI-INV-04', label: 'Beneficiarios', available: false, unavailableReason: 'FIELD_NOT_READABLE' }
  ]
}

const CERRADO = registro('a2', { ...APORTE.attributes, code: 'AP-002', currency: 'USD', total_amount: '300' }, { state: 'closed' })

const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeInversion(),
  { path: '/sgspe/dashboards/indicators', body: [{ code: 'KPI-INV-01', label: 'Ejecución de la campaña', dashboard: 'investment', available: true }] },
  { path: '/sgspe/dashboards/investment', body: TABLERO },
  { path: '/objects/social_program/records', body: pagina([PROGRAMA]) },
  { path: '/objects/social_contribution/records', body: pagina([APORTE, CERRADO]) },
  { path: '/objects/project/records', body: pagina([P1]) }
]

const abrir = (opciones: { ruta?: string; camino?: string; usuario?: typeof INVERSION; permisos?: typeof EQUIPO_DE_INVERSION } = {}) =>
  montar(<ProgramasPage />, {
    ruta: opciones.ruta ?? '/projects/p1/programs',
    camino: opciones.camino ?? '/projects/:projectId/programs',
    usuario: opciones.usuario ?? INVERSION,
    permisos: opciones.permisos ?? EQUIPO_DE_INVERSION
  })

describe('S42 · programas e inversión', () => {
  it('dice el tope de la campaña con lo comprometido y lo ejecutado, el presupuesto del año por moneda y «No disponible» sin cifra', async () => {
    fetch = mockFetch(rutas())
    abrir()
    expect(await screen.findByRole('heading', { name: 'Programas e inversión', level: 1 })).toBeInTheDocument()
    const campanas = await screen.findByRole('region', { name: 'Tope de las campañas' })
    expect(within(campanas).getByText('Campaña Ejemplo 2026')).toBeInTheDocument()
    expect(within(campanas).getByText('Tope: S/ 50,000.00')).toBeInTheDocument()
    expect(within(campanas).getByText('Comprometido: S/ 30,000.00 (60 %)')).toBeInTheDocument()
    expect(within(campanas).getByText('Ejecutado: S/ 12,000.00')).toBeInTheDocument()
    expect(within(campanas).getByText('Montos en otra moneda que no se suman al tope: 2.')).toBeInTheDocument()
    const presupuesto = screen.getByRole('table', { name: 'Presupuesto de programas 2026' })
    const pen = within(presupuesto).getByText('PEN').closest('tr') as HTMLElement
    expect(within(pen).getByText('S/ 80,000.00')).toBeInTheDocument()
    expect(within(pen).getByText('S/ 20,000.00')).toBeInTheDocument()
    expect(within(pen).getByText('25 %')).toBeInTheDocument()
    // lo ejecutado en USD no vino: «—», nunca cero; el año siguiente no se suma al de hoy
    const usd = within(presupuesto).getByText('USD').closest('tr') as HTMLElement
    expect(within(usd).getAllByText('—').length).toBeGreaterThanOrEqual(1)
    expect(within(presupuesto).queryByText(/90,000/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Beneficiarios' })).getByText(/No disponible/)).toBeInTheDocument()
  })

  it('lista los programas y los aportes con su enlace, su socio y su monto en su moneda; filtra los terminados', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const programas = await screen.findByRole('table', { name: 'Programas del alcance' })
    expect(await within(programas).findByRole('link', { name: 'PS-001 · Programa Ejemplo de agua segura' })).toHaveAttribute(
      'href',
      '/projects/p1/programs/sp1'
    )
    expect(await within(programas).findByRole('link', { name: 'Asociación Ejemplo' })).toBeInTheDocument()
    expect(within(programas).getByText(/S\/ 80,000\.00 · .*5,000\.00/)).toBeInTheDocument()
    const aportes = await screen.findByRole('table', { name: 'Aportes del alcance' })
    expect(within(aportes).getByRole('link', { name: 'AP-001' })).toHaveAttribute('href', '/projects/p1/contributions/a1')
    expect(within(aportes).getByText('S/ 1,750.50')).toBeInTheDocument()
    // «En curso» por defecto: el cerrado no sale; «Terminados» lo muestra
    expect(within(aportes).queryByText('AP-002')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Terminados' }))
    expect(await screen.findByRole('link', { name: 'AP-002' })).toBeInTheDocument()
  })

  it('«Nuevo aporte» pide el motivo, propone PEN, manda el proyecto y abre la ficha del aporte creado', async () => {
    const definicionCorta = definicion('social_contribution', [
      ['code', { required: true }],
      ['declared_purpose', { type: 'LONG_TEXT', required: true }],
      ['conditions', { type: 'LONG_TEXT', required: true }],
      ['currency', { type: 'ENUM', enumOptions: ['PEN', 'USD'], required: true }],
      'project'
    ])
    fetch = mockFetch(
      rutas([
        { path: '/metadata/objects/social_contribution', body: definicionCorta },
        {
          method: 'POST',
          path: '/objects/social_contribution/records',
          status: 201,
          body: registro('a9', { project: 'p1', code: 'AP-009' }, { state: 'requested' })
        }
      ])
    )
    red = espiarRed()
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo aporte' }))
    const drawer = await screen.findByRole('dialog', { name: 'Nuevo aporte' })
    expect(within(drawer).getByText('Los ítems se cargan después, en la ficha del aporte, antes de enviarlo a aprobar.')).toBeInTheDocument()
    // la moneda es un ENUM: un Select de Radix (combobox) que dice la opción propuesta
    expect(await within(drawer).findByLabelText(/^currency/)).toHaveTextContent('PEN')
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'pedido de la asociación')
    await userEvent.type(within(drawer).getByLabelText(/^code/), 'AP-009')
    await userEvent.type(within(drawer).getByLabelText(/^declared_purpose/), 'Útiles escolares')
    await userEvent.type(within(drawer).getByLabelText(/^conditions/), 'Entrega con acta')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/contributions/a9'))
    const [alta] = red.a('POST', '/objects/social_contribution/records')
    expect(alta.cuerpo).toMatchObject({ attributes: { code: 'AP-009', currency: 'PEN', project: 'p1' } })
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''pedido%20de%20la%20asociaci%C3%B3n")
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('en el alcance global muestra la columna Proyecto y no ofrece «Nuevo»: pide elegir un proyecto', async () => {
    fetch = mockFetch(rutas())
    abrir({ ruta: '/programs', camino: '/programs' })
    const programas = await screen.findByRole('table', { name: 'Programas del alcance' })
    expect(within(programas).getByRole('columnheader', { name: 'Proyecto' })).toBeInTheDocument()
    expect(await within(programas).findByTitle('Pukaqaqa')).toHaveTextContent('PRJ-01 · Pukaqaqa')
    expect(screen.getByText('Para registrar un aporte o un programa, elija un proyecto.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo aporte' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tablero de inversión' })).toHaveAttribute('href', '/programs/dashboard')
  })

  it('sin crear aportes ni programas no ofrece «Nuevo»; quien lee solo los aportes no ve la tabla de programas', async () => {
    fetch = mockFetch(rutas())
    abrir({
      usuario: RELACIONISTA,
      permisos: permisos({ project: ['READ'], project_assignment: ['READ'], social_contribution: ['READ'], organization: ['READ'] })
    })
    expect(await screen.findByRole('table', { name: 'Aportes del alcance' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Programas del alcance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo aporte' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo programa' })).not.toBeInTheDocument()
  })
  it('un presupuesto sin moneda se dice aparte y sin prefijo de moneda: nunca «— 1,234.00» ni sumado a otra moneda', async () => {
    const sinMoneda = {
      ...TABLERO,
      indicators: TABLERO.indicators.map((i) =>
        i.code === 'KPI-INV-02'
          ? {
              ...i,
              breakdowns: [
                {
                  by: 'program',
                  rows: [
                    ...(i.breakdowns?.[0].rows ?? []),
                    {
                      key: 'sp4:2026:',
                      program: 'sp4',
                      label: 'PS-004',
                      year: 2026,
                      currency: null,
                      allocated: '1234',
                      executed: null,
                      percent: null,
                      state: 'executing'
                    }
                  ]
                }
              ]
            }
          : i
      )
    }
    fetch = mockFetch(rutas([{ path: '/sgspe/dashboards/investment', body: sinMoneda }]))
    abrir()
    const presupuesto = await screen.findByRole('table', { name: 'Presupuesto de programas 2026' })
    const fila = within(presupuesto).getByText('Sin moneda').closest('tr') as HTMLElement
    expect(within(fila).getByText('1,234.00')).toBeInTheDocument()
    const pen = within(presupuesto).getByText('PEN').closest('tr') as HTMLElement
    expect(within(pen).getByText('S/ 80,000.00')).toBeInTheDocument()
    expect(within(presupuesto).queryByText(/^— \d/)).not.toBeInTheDocument()
  })

  it('un programa por aprobar no muestra ejecución ni avance, y un monto ilegible no se suma: se dice', async () => {
    const porAprobar = {
      ...TABLERO,
      indicators: TABLERO.indicators.map((i) =>
        i.code === 'KPI-INV-02'
          ? {
              ...i,
              breakdowns: [
                {
                  by: 'program',
                  rows: [
                    {
                      key: 'sp1:2026:PEN',
                      program: 'sp1',
                      label: 'PS-001',
                      year: 2026,
                      currency: 'PEN',
                      allocated: '80000',
                      executed: '0',
                      percent: 0,
                      state: 'pending_approval'
                    },
                    {
                      key: 'sp1:2026:USD',
                      program: 'sp1',
                      label: 'PS-001',
                      year: 2026,
                      currency: 'USD',
                      allocated: 'abc',
                      executed: null,
                      percent: null,
                      state: 'pending_approval'
                    }
                  ]
                }
              ]
            }
          : i
      )
    }
    fetch = mockFetch(rutas([{ path: '/sgspe/dashboards/investment', body: porAprobar }]))
    abrir()
    const presupuesto = await screen.findByRole('table', { name: 'Presupuesto de programas 2026' })
    const pen = within(presupuesto).getByText('PEN').closest('tr') as HTMLElement
    expect(within(pen).getByText('S/ 80,000.00')).toBeInTheDocument()
    expect(within(pen).queryByText('S/ 0.00')).not.toBeInTheDocument()
    expect(within(pen).queryByText('0 %')).not.toBeInTheDocument()
    // el monto ilegible en USD se omite (no hay fila de USD en cero) y se dice
    expect(within(presupuesto).queryByText('USD')).not.toBeInTheDocument()
    const zona = screen.getByRole('region', { name: 'Presupuesto de programas 2026' })
    expect(within(zona).getByText('Montos que no se pueden leer y no se suman: 1.')).toBeInTheDocument()
    expect(within(zona).getByText('Los programas por aprobar no cuentan en lo ejecutado ni en el avance.')).toBeInTheDocument()
    const programas = await screen.findByRole('table', { name: 'Programas del alcance' })
    const fila = (await within(programas).findByRole('link', { name: 'PS-001 · Programa Ejemplo de agua segura' })).closest('tr') as HTMLElement
    expect(within(fila).getByText('S/ 80,000.00 · monto ilegible')).toBeInTheDocument()
    expect(within(fila).getByText('Por aprobar')).toBeInTheDocument()
    expect(within(fila).queryByText('S/ 0.00')).not.toBeInTheDocument()
  })
})
