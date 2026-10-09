import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeCompromisos, C1, EQUIPO_DE_COMPROMISOS, GESTORA } from '../../test/compromisos'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, problema, type Llamada, type Red, type RutaEspecial } from '../../test/red'
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
            { key: 'OVERDUE_FIRST', label: '1-7', value: 1 },
            { key: 'OVERDUE_SECOND', label: '8-15', value: 0 },
            { key: 'OVERDUE_OVER', label: 'más de 15', value: 2 }
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
type TableroDePrueba = typeof TABLERO

// los filtros que cada KPI-COM acepta y no aplica (Kpis.kt de sgspe, dashboards.md §4.4): el doble del servidor los devuelve en
// ignoredFilters solo si se pidieron, como el backend, para probar qué cifra dice cuál
const IGNORA: Record<string, string[]> = {
  'KPI-COM-01': ['owner'],
  'KPI-COM-02': ['owner'],
  'KPI-COM-05': ['owner'],
  'KPI-COM-06': ['explorationCampaign'],
  'KPI-COM-07': ['explorationCampaign', 'owner'],
  'KPI-COM-08': ['explorationCampaign', 'owner'],
  'KPI-COM-09': ['explorationCampaign'],
  'KPI-COM-10': ['owner']
}
const servidor =
  (tablero: { indicators: Record<string, unknown>[] } & Omit<TableroDePrueba, 'indicators'> = TABLERO) =>
  (llamada: Llamada) => {
    const pedidos = new URLSearchParams(llamada.ruta.split('?')[1] ?? '')
    return jsonResponse({
      ...tablero,
      indicators: tablero.indicators.map((i) => {
        const ignorados = (IGNORA[String(i.code)] ?? []).filter((f) => pedidos.has(f))
        return i.available && ignorados.length > 0 ? { ...i, ignoredFilters: ignorados } : i
      })
    })
  }
const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  { path: '/objects/exploration_campaign/records', body: pagina([registro('camp1', { project: 'p1', name: 'Campaña 2026' })]) },
  { path: /^\/objects\/commitment\/records\?.*VENCIDO/, body: pagina([{ ...C1, attributes: { ...C1.attributes, deadline_status: 'VENCIDO' } }]) },
  { path: /^\/objects\/commitment\/records\?.*POR\+VENCER/, body: pagina([]) }
]
// el tablero lo contesta el doble del servidor; especiales va antes, para reemplazar una respuesta
const iniciar = (tablero?: Parameters<typeof servidor>[0], especiales: RutaEspecial[] = []) => {
  fetch = mockFetch(rutas())
  red = espiarRed([...especiales, { path: '/sgspe/dashboards/commitments', responder: servidor(tablero) }])
}
const conIndicadores = (cambios: Record<string, Record<string, unknown> | null>) => ({
  ...TABLERO,
  indicators: TABLERO.indicators.filter((i) => cambios[i.code] !== null).map((i) => (cambios[i.code] ? { ...i, ...cambios[i.code] } : i)) as Record<
    string,
    unknown
  >[]
})
const abrir = (busqueda = '') =>
  montar(<TableroCompromisosPage />, {
    ruta: `/projects/p1/commitments/dashboard${busqueda}`,
    camino: '/projects/:projectId/commitments/dashboard',
    usuario: GESTORA,
    permisos: EQUIPO_DE_COMPROMISOS
  })

describe('S27 · tablero de compromisos', () => {
  it('dibuja las zonas con sus cifras, dice lo que no está disponible y lo que no aplica el filtro', async () => {
    iniciar()
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

  it('los filtros de campaña y de responsable viajan en la llamada; cada cifra que no los aplica lo dice, y solo esa', async () => {
    iniciar()
    abrir()
    await screen.findByRole('option', { name: 'Campaña 2026' })
    await userEvent.selectOptions(screen.getByLabelText('Campaña'), 'camp1')
    await userEvent.click(screen.getByLabelText('Solo los míos (responsable)'))
    await waitFor(() => {
      const ultima = red!.a('GET', '/sgspe/dashboards/commitments').at(-1)!.ruta
      expect(ultima).toContain('explorationCampaign=camp1')
      expect(ultima).toContain('owner=u-cmm')
    })
    const responsable = 'Esta cifra no aplica el filtro de responsable'
    await within(await screen.findByRole('region', { name: 'Compromisos abiertos' })).findByText(responsable)
    // las tarjetas de estado: la 01, la 02 y la 05 no filtran por responsable, la 03 y la 04 sí
    for (const tarjeta of ['Compromisos registrados', 'Compromisos abiertos', 'Cumplidos en el periodo'])
      expect(within(screen.getByRole('region', { name: tarjeta })).getByRole('note')).toHaveTextContent(responsable)
    for (const tarjeta of ['Compromisos vencidos', 'Compromisos por vencer'])
      expect(within(screen.getByRole('region', { name: tarjeta })).queryByRole('note')).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Cumplimiento a tiempo' })).getAllByRole('note')[0]).toHaveTextContent(
      'Esta cifra no aplica el filtro de campaña de exploración'
    )
    // la tabla de pendientes aplica los dos filtros, como los KPI de plazo
    await waitFor(() => {
      for (const situacion of ['VENCIDO', 'POR+VENCER']) {
        const ruta = red!
          .a('GET', '/objects/commitment/records')
          .filter((l) => l.ruta.includes(situacion))
          .at(-1)!.ruta
        expect(ruta).toContain('owner_user_id=u-cmm')
        expect(ruta).toContain('exploration_campaign=camp1')
      }
    })
  })

  it('los avisos de una cifra se dicen como texto en su zona', async () => {
    iniciar(
      conIndicadores({
        'KPI-COM-10': { warnings: ['2 compromisos en otra moneda que la de la campaña no se suman'] },
        'KPI-COM-11': { warnings: ['1 reprogramaciones con datos incompletos se excluyeron: el resultado está incompleto'] }
      })
    )
    abrir()
    const montos = await screen.findByRole('region', { name: 'Comprometido frente a ejecutado' })
    expect(within(montos).getByRole('list', { name: 'Avisos sobre esta cifra' })).toHaveTextContent(
      '2 compromisos en otra moneda que la de la campaña no se suman'
    )
    expect(
      within(screen.getByRole('region', { name: 'Vencidos al cierre de cada mes' })).getByRole('list', { name: 'Avisos sobre esta cifra' })
    ).toHaveTextContent('el resultado está incompleto')
  })

  it('sin base no hay ceros: un tramo sin etiqueta, montos sin moneda principal, un a tiempo sin base y un indicador ausente', async () => {
    iniciar(
      conIndicadores({
        'KPI-COM-02': null,
        'KPI-COM-03': { breakdowns: [{ by: 'daysOverdue', rows: [{ key: 'OVERDUE_OVER', value: 2 }] }] },
        'KPI-COM-09': {
          value: null,
          numerator: null,
          denominator: null,
          breakdowns: [{ by: 'against', rows: [{ key: 'current', value: null }] }]
        },
        'KPI-COM-10': { value: null, breakdowns: [{ by: 'currency', rows: [{ key: 'USD', value: 500, committed: 500 }] }] }
      })
    )
    abrir()
    const dias = await screen.findByRole('table', { name: 'Días de atraso' })
    expect(dias).toHaveTextContent('Más allá del segundo umbral')
    expect(dias).not.toHaveTextContent('OVERDUE')
    const montos = screen.getByRole('region', { name: 'Comprometido frente a ejecutado' })
    expect(within(montos).getByText(/Sin base de comparación/)).toBeInTheDocument()
    // el ejecutado que no vino no se dibuja como cero
    expect(within(montos).getByRole('table')).toHaveTextContent('USD 500.00—')
    const atiempo = screen.getByRole('region', { name: 'Cumplimiento a tiempo' })
    expect(atiempo).not.toHaveTextContent('0 de 0')
    expect(within(atiempo).getByText('Frente al plazo vigente').nextSibling).toHaveTextContent('—')
    expect(screen.getByRole('region', { name: 'Compromisos abiertos' })).toHaveTextContent('No disponible')
    expect(document.body).not.toHaveTextContent(/KPI-COM/)
  })

  it('montos sin compromisos con monto lo dicen en lugar de un gráfico vacío', async () => {
    iniciar(conIndicadores({ 'KPI-COM-10': { value: null, breakdowns: [{ by: 'currency', rows: [] }] } }))
    abrir()
    const montos = await screen.findByRole('region', { name: 'Comprometido frente a ejecutado' })
    expect(within(montos).getByText('No hay compromisos con monto para estos filtros.')).toBeInTheDocument()
    expect(within(montos).queryByRole('table')).toBeNull()
  })

  it('la tabla de pendientes dice los filtros del tablero que no aplica', async () => {
    iniciar()
    abrir('?periodStart=2026-01-01&scope=AIDS')
    const pendientes = screen.getByRole('region', { name: 'Pendientes: vencidos y por vencer' })
    expect(await within(pendientes).findByRole('note')).toHaveTextContent('Esta tabla no aplica el filtro de inicio del periodo, ámbito')
  })

  it('si una lectura de pendientes falla, lo dice aunque la otra siga cargando', async () => {
    iniciar(undefined, [
      { path: /^\/objects\/commitment\/records\?.*VENCIDO/, responder: () => problema(500, 'x') },
      { path: /^\/objects\/commitment\/records\?.*POR\+VENCER/, responder: () => new Promise<Response>(() => {}) }
    ])
    abrir()
    const pendientes = screen.getByRole('region', { name: 'Pendientes: vencidos y por vencer' })
    expect(await within(pendientes).findByText('No se pudo cargar esta información. Los filtros se conservan.')).toBeInTheDocument()
  })

  it('400 TOO_MANY_RECORDS es «Acote los filtros», no un error de carga ni ceros', async () => {
    fetch = mockFetch(rutas().filter((r) => r.path !== '/sgspe/dashboards/commitments'))
    red = espiarRed([{ path: '/sgspe/dashboards/commitments', responder: () => problema(400, 'x', [{ field: 'project', message: 'TOO_MANY_RECORDS' }]) }])
    abrir()
    expect(await screen.findByText('Acote los filtros')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Compromisos registrados' })).not.toBeInTheDocument()
  })
})
