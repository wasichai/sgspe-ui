import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { P1 } from '../../test/compromisos'
import { APORTE, baseDeInversion, EQUIPO_DE_INVERSION, INVERSION, PROGRAMA } from '../../test/inversion'
import { definicion, montar, pagina, registro, ubicacion } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { listaDelServidor } from '../../test/listaDelServidor'
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
  // U-35: cada vista lleva solo sus cifras; los programas, el presupuesto del año y los beneficiarios; los aportes, el tope
  it('en Programas dice el presupuesto del año por moneda y «No disponible» sin cifra; en los aportes, el tope de la campaña', async () => {
    fetch = mockFetch(rutas())
    abrir()
    expect(await screen.findByRole('heading', { name: 'Programas sociales', level: 1 })).toBeInTheDocument()
    const presupuesto = await screen.findByRole('table', { name: 'Presupuesto de programas 2026' })
    const pen = within(presupuesto).getByText('PEN').closest('tr') as HTMLElement
    expect(within(pen).getByText('S/ 80,000.00')).toBeInTheDocument()
    expect(within(pen).getByText('S/ 20,000.00')).toBeInTheDocument()
    expect(within(pen).getByText('25 %')).toBeInTheDocument()
    // lo ejecutado en USD no vino: «—», nunca cero; el año siguiente no se suma al de hoy
    const usd = within(presupuesto).getByText('USD').closest('tr') as HTMLElement
    expect(within(usd).getAllByText('—').length).toBeGreaterThanOrEqual(1)
    expect(within(presupuesto).queryByText(/90,000/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Beneficiarios' })).getByText(/No disponible/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tope de las campañas' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^Aportes en curso\b/ }))
    const campanas = await screen.findByRole('region', { name: 'Tope de las campañas' })
    expect(within(campanas).getByText('Campaña Ejemplo 2026')).toBeInTheDocument()
    expect(within(campanas).getByText('Tope: S/ 50,000.00')).toBeInTheDocument()
    expect(within(campanas).getByText('Comprometido: S/ 30,000.00 (60 %)')).toBeInTheDocument()
    expect(within(campanas).getByText('Ejecutado: S/ 12,000.00')).toBeInTheDocument()
    expect(within(campanas).getByText('Montos en otra moneda que no se suman al tope: 2.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Presupuesto de programas 2026' })).not.toBeInTheDocument()
  })

  // U-35: sin barras vacías ni «S/ 0.00» antes de la lista; una cifra sin datos no se dibuja
  it('una campaña sin ejecución no dibuja la barra ni «S/ 0.00», y una zona sin datos no se dibuja', async () => {
    const vacio = {
      ...TABLERO,
      indicators: [
        {
          code: 'KPI-INV-01',
          label: 'Tope',
          available: true,
          value: 0,
          breakdowns: [
            {
              by: 'campaign',
              rows: [
                {
                  key: 'camp1',
                  label: 'Campaña Ejemplo 2026',
                  currency: 'PEN',
                  cap: '50000',
                  committed: '0',
                  executed: '0',
                  committedPercent: 0,
                  executedPercent: 0
                }
              ]
            }
          ]
        },
        { code: 'KPI-INV-02', label: 'Presupuesto', available: true, value: null, breakdowns: [{ by: 'program', rows: [] }] },
        { code: 'KPI-INV-04', label: 'Beneficiarios', available: true, value: null, breakdowns: [{ by: 'source', rows: [] }] }
      ]
    }
    fetch = mockFetch(rutas([{ path: '/sgspe/dashboards/investment', body: vacio }]))
    abrir({ ruta: '/projects/p1/programs?view=enCurso' })
    const campanas = await screen.findByRole('region', { name: 'Tope de las campañas' })
    expect(within(campanas).getByText('Tope: S/ 50,000.00')).toBeInTheDocument()
    expect(within(campanas).queryByRole('progressbar')).not.toBeInTheDocument()
    expect(within(campanas).queryByText(/S\/ 0\.00/)).not.toBeInTheDocument()
    expect(within(campanas).getByText('Ejecutado: nada todavía')).toBeInTheDocument()
    expect(within(campanas).getByText('Comprometido: nada todavía')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^Programas\b/ }))
    await screen.findByRole('table', { name: 'Programas del alcance' })
    expect(screen.queryByRole('region', { name: 'Presupuesto de programas 2026' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Beneficiarios' })).not.toBeInTheDocument()
  })

  // U-35 y DD-03: Programas y Aportes en una sola vista con su selector, nunca dos listados completos apilados
  it('Programas y Aportes van en un solo selector de la barra de filtros, con su conteo; nunca las dos tablas a la vez', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([listaDelServidor('social_contribution', [APORTE, CERRADO])])
    abrir()
    await screen.findByRole('table', { name: 'Programas del alcance' })
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    const barra = screen.getByRole('group', { name: 'Filtros' })
    expect(within(barra).getByRole('radio', { name: 'Programas, 1' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('table', { name: 'Aportes del alcance' })).not.toBeInTheDocument()
    // el estado es de los aportes: no se ofrece en Programas
    expect(within(barra).queryByLabelText('Estado')).not.toBeInTheDocument()
    await userEvent.click(within(barra).getByRole('radio', { name: 'Aportes en curso, 1' }))
    expect(ubicacion.actual).toBe('/projects/p1/programs?view=enCurso')
    expect(await screen.findByRole('table', { name: 'Aportes del alcance' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Programas del alcance' })).not.toBeInTheDocument()
  })

  it('el estado de los aportes es un chip en la URL y «Limpiar filtros» conserva la vista', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([listaDelServidor('social_contribution', [APORTE, CERRADO])])
    abrir({ ruta: '/projects/p1/programs?view=todos&state=closed' })
    const barra = screen.getByRole('group', { name: 'Filtros' })
    expect(await within(barra).findByRole('button', { name: /^Quitar el filtro Estado: / })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'AP-002' })).toBeInTheDocument()
    await userEvent.click(within(barra).getByRole('button', { name: 'Limpiar filtros' }))
    expect(ubicacion.actual).toBe('/projects/p1/programs?view=todos')
  })

  // 05-especificacion §1.6: en una fila enfocada, Espacio abre su vista previa y Enter su ficha
  it('Espacio en una fila de programas o de aportes abre su vista previa, y Enter su ficha', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([listaDelServidor('social_contribution', [APORTE, CERRADO])])
    abrir()
    const programas = await screen.findByRole('table', { name: 'Programas del alcance' })
    within(programas).getAllByRole('row')[1].focus()
    await userEvent.keyboard(' ')
    expect(ubicacion.actual).toBe('/projects/p1/programs?peek=social_program%3Asp1')
    within(screen.getByRole('table', { name: 'Programas del alcance', hidden: true }))
      .getAllByRole('row', { hidden: true })[1]
      .focus()
    await userEvent.keyboard('{Enter}')
    expect(ubicacion.actual).toBe('/projects/p1/programs/sp1')
  })

  it('Espacio en una fila de aportes abre su vista previa', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([listaDelServidor('social_contribution', [APORTE, CERRADO])])
    abrir({ ruta: '/projects/p1/programs?view=enCurso' })
    const aportes = await screen.findByRole('table', { name: 'Aportes del alcance' })
    within(aportes).getAllByRole('row')[1].focus()
    await userEvent.keyboard(' ')
    expect(ubicacion.actual).toBe('/projects/p1/programs?view=enCurso&peek=social_contribution%3Aa1')
  })

  it('lista los programas y los aportes con su enlace, su socio y su monto en su moneda; filtra los terminados', async () => {
    fetch = mockFetch(rutas())
    // las vistas de los aportes son consultas del servidor, con su página y su conteo (D10 de la revisión de UX)
    red = espiarRed([listaDelServidor('social_contribution', [APORTE, CERRADO])])
    abrir()
    const programas = await screen.findByRole('table', { name: 'Programas del alcance' })
    expect(await within(programas).findByRole('link', { name: 'Programa Ejemplo de agua segura' })).toHaveAttribute('href', '/projects/p1/programs/sp1')
    expect(await within(programas).findByRole('link', { name: 'Asociación Ejemplo' })).toBeInTheDocument()
    expect(within(programas).getByText(/S\/ 80,000\.00 · .*5,000\.00/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^Aportes en curso\b/ }))
    const aportes = await screen.findByRole('table', { name: 'Aportes del alcance' })
    expect(within(aportes).getByRole('link', { name: 'AP-001' })).toHaveAttribute('href', '/projects/p1/contributions/a1')
    expect(within(aportes).getByText('S/ 1,750.50')).toBeInTheDocument()
    // «En curso» por defecto: el cerrado no sale; «Terminados» lo muestra
    expect(within(aportes).queryByText('AP-002')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^Aportes terminados\b/ }))
    expect(await screen.findByRole('link', { name: 'AP-002' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Todos los aportes, 2' })).toBeInTheDocument()
    const consultas = red.a('GET', '/objects/social_contribution/records').map((l) => Object.fromEntries(new URLSearchParams(l.ruta.split('?')[1])))
    expect(consultas).toContainEqual(expect.objectContaining({ state: expect.stringContaining('closed'), page: '0', size: '25' }))
    expect(consultas).toContainEqual(expect.objectContaining({ state_not: expect.stringContaining('closed'), size: '1' }))
  })

  // 05-especificacion §1.6: el código y el nombre de un programa se ordenan en el servidor; el orden dura la visita
  it('los programas se ordenan por código y por nombre en el servidor, con aria-sort, y otro orden vuelve a la primera página', async () => {
    // 26 programas: la segunda página tiene uno, el primero (PS-001) va en la primera
    const otros = Array.from({ length: 25 }, (_, i) =>
      registro(`sp${i + 2}`, { ...PROGRAMA.attributes, code: `PS-${String(i + 2).padStart(3, '0')}`, name: `Programa ${i + 2}` }, { state: 'executing' })
    )
    fetch = mockFetch(rutas())
    red = espiarRed([listaDelServidor('social_program', [PROGRAMA, ...otros])])
    abrir({ ruta: '/projects/p1/programs?pp=1' })
    const tabla = () => screen.getByRole('table', { name: 'Programas del alcance' })
    await screen.findByRole('table', { name: 'Programas del alcance' })
    expect(within(tabla()).getAllByRole('row')).toHaveLength(2)
    const consultas = () => red!.a('GET', '/objects/social_program/records').map((l) => Object.fromEntries(new URLSearchParams(l.ruta.split('?')[1])))
    expect(consultas()).toContainEqual(expect.objectContaining({ sort: 'code', dir: 'asc', page: '1' }))
    expect(within(tabla()).getByRole('columnheader', { name: 'Código' })).toHaveAttribute('aria-sort', 'ascending')
    // el código va en su columna y la vista previa lo sigue nombrando
    expect(within(tabla()).getByRole('cell', { name: 'PS-026' })).toBeInTheDocument()
    expect(within(tabla()).getByRole('link', { name: 'Vista previa de PS-026 Programa 26' })).toBeInTheDocument()
    // el estado y las cifras del tablero no se ordenan
    expect(within(tabla()).queryByRole('button', { name: 'Estado' })).not.toBeInTheDocument()
    expect(within(tabla()).queryByRole('button', { name: /^Presupuesto/ })).not.toBeInTheDocument()
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Programa' }))
    await waitFor(() => expect(consultas()).toContainEqual(expect.objectContaining({ sort: 'name', dir: 'asc', page: '0' })))
    expect(ubicacion.actual).toBe('/projects/p1/programs')
    await waitFor(() => expect(within(tabla()).getByRole('columnheader', { name: 'Programa' })).toHaveAttribute('aria-sort', 'ascending'))
    expect(within(tabla()).getByRole('columnheader', { name: 'Código' })).not.toHaveAttribute('aria-sort')
    await waitFor(() => expect(within(tabla()).getAllByRole('row')).toHaveLength(26))
  })

  it('los aportes se ordenan por código en el servidor, nunca por el monto, y otro orden vuelve a la primera página', async () => {
    // 26 aportes: con el código de mayor a menor, la segunda página tiene solo AP-001
    const otros = Array.from({ length: 25 }, (_, i) =>
      registro(`a${i + 2}`, { ...APORTE.attributes, code: `AP-${String(i + 2).padStart(3, '0')}` }, { state: 'requested' })
    )
    fetch = mockFetch(rutas())
    red = espiarRed([listaDelServidor('social_contribution', [APORTE, ...otros])])
    abrir({ ruta: '/projects/p1/programs?view=todos&page=1' })
    const tabla = () => screen.getByRole('table', { name: 'Aportes del alcance' })
    const consultas = () =>
      red!
        .a('GET', '/objects/social_contribution/records')
        .map((l) => Object.fromEntries(new URLSearchParams(l.ruta.split('?')[1])))
        .filter((c) => c.size === '25')
    await screen.findByRole('table', { name: 'Aportes del alcance' })
    expect(consultas()).toContainEqual(expect.objectContaining({ sort: 'code', dir: 'desc', page: '1' }))
    expect(within(tabla()).getByRole('columnheader', { name: 'Código' })).toHaveAttribute('aria-sort', 'descending')
    // el monto mezcla monedas: no se ordena (ASM-063)
    expect(within(tabla()).queryByRole('button', { name: 'Monto' })).not.toBeInTheDocument()
    expect(within(tabla()).getAllByRole('row')).toHaveLength(2)
    expect(within(tabla()).getAllByRole('row')[1]).toHaveTextContent('AP-001')
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Código' }))
    await waitFor(() => expect(consultas()).toContainEqual(expect.objectContaining({ sort: 'code', dir: 'asc', page: '0' })))
    await waitFor(() => expect(within(tabla()).getAllByRole('row')).toHaveLength(26))
    expect(within(tabla()).getAllByRole('row')[1]).toHaveTextContent('AP-001')
    expect(within(tabla()).getAllByRole('row')[2]).toHaveTextContent('AP-002')
    expect(within(tabla()).getByRole('columnheader', { name: 'Código' })).toHaveAttribute('aria-sort', 'ascending')
    expect(ubicacion.actual).toBe('/projects/p1/programs?view=todos')
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
    // tercera pasada de UX, 2.11: el alta dice qué pasará antes de guardar
    const quePasara = within(drawer).getByRole('region', { name: 'Qué pasará' })
    expect(
      within(quePasara)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual([
      'Se registra como «Solicitado» en este proyecto.',
      'Después, en su ficha, se cargan los ítems: su suma es el total que se aprobará.',
      'Antes de aprobarlo se revisan los lineamientos de la organización y el tope de la campaña.'
    ])
    // la moneda es un ENUM: un Select de Radix (combobox) que dice la opción propuesta
    expect(await within(drawer).findByLabelText(/^currency/)).toHaveTextContent('PEN')
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'pedido de la asociación')
    await userEvent.type(within(drawer).getByLabelText(/^code/), 'AP-009')
    await userEvent.type(within(drawer).getByLabelText(/^declared_purpose/), 'Útiles escolares')
    await userEvent.type(within(drawer).getByLabelText(/^conditions/), 'Entrega con acta')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/contributions/a9'))
    // la ficha dice lo que se registró y qué sigue (2.12)
    expect(ubicacion.estado).toMatchObject({ hecho: 'Se registró el aporte AP-009. Siga con sus ítems: su suma es el total que se aprobará.' })
    const [alta] = red.a('POST', '/objects/social_contribution/records')
    expect(alta.cuerpo).toMatchObject({ attributes: { code: 'AP-009', currency: 'PEN', project: 'p1' } })
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''pedido%20de%20la%20asociaci%C3%B3n")
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  // revisión de UX, etapa 3: crear desde lo global sin pasar por el selector (BotonCrear pide el proyecto)
  it('en el alcance global muestra la columna Proyecto y ofrece crear eligiendo el proyecto', async () => {
    fetch = mockFetch(rutas())
    abrir({ ruta: '/programs', camino: '/programs' })
    const programas = await screen.findByRole('table', { name: 'Programas del alcance' })
    expect(within(programas).getByRole('columnheader', { name: 'Proyecto' })).toBeInTheDocument()
    expect(await within(programas).findByRole('link', { name: 'PRJ-01 · Pukaqaqa' })).toHaveAttribute('href', '/projects/p1/overview')
    expect(screen.queryByText(/elija un proyecto/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo aporte' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo programa' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Vistas del módulo' })).getByRole('link', { name: 'Tablero' })).toHaveAttribute(
      'href',
      '/programs/dashboard'
    )
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
    const fila = (await within(programas).findByRole('link', { name: 'Programa Ejemplo de agua segura' })).closest('tr') as HTMLElement
    expect(within(fila).getByText('S/ 80,000.00 · monto ilegible')).toBeInTheDocument()
    expect(within(fila).getByText('Por aprobar')).toBeInTheDocument()
    expect(within(fila).queryByText('S/ 0.00')).not.toBeInTheDocument()
  })
})
