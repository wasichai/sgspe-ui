import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeF8, EJECUTIVA, SOLO_LECTURA_F8, TABLERO_EJECUTIVO } from '../../test/f8'
import { montar } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { espiarRed, problema, type Red } from '../../test/red'
import { RevisionEjecutivaPage } from './RevisionEjecutivaPage'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))

// S51 (screens.md, dashboards.md §5.1): el tablero executive en una sola llamada, la atención por regla fija, las tiles, la
// inversión por moneda, la tendencia en tres gráficos y la tabla por proyecto con su tope
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
})

const abrir = (tablero: unknown = TABLERO_EJECUTIVO, ruta = '/') => {
  fetch = mockFetch([{ path: '/sgspe/dashboards/executive', body: tablero }, ...baseDeF8(EJECUTIVA)])
  red = espiarRed()
  montar(<RevisionEjecutivaPage />, { ruta, usuario: EJECUTIVA, permisos: SOLO_LECTURA_F8 })
}

describe('S51 · revisión ejecutiva', () => {
  it('dice lo que necesita atención por regla fija, las tiles y que la postura no se muestra', async () => {
    abrir()
    const atencion = await screen.findByRole('region', { name: 'Lo que necesita atención hoy' })
    const items = within(atencion).getAllByRole('link')
    expect(items.map((a) => a.textContent)).toEqual([
      'Proyecto Ejemplo A: 2 alertas activas',
      'Proyecto Ejemplo A: 1 riesgos altos o críticos',
      'Proyecto Ejemplo A: 3 compromisos vencidos',
      'Proyecto Ejemplo B: 3 quejas abiertas',
      'Proyecto Ejemplo A: 1 quejas abiertas'
    ])
    expect(items[0]).toHaveAttribute('href', '/projects/p1/risks/warnings')
    const tiles = screen.getByRole('region', { name: 'Indicadores de la cartera' })
    expect(within(within(tiles).getByRole('region', { name: 'Proyectos activos' })).getByText('2')).toBeInTheDocument()
    expect(within(within(tiles).getByRole('region', { name: 'Alertas activas' })).getByText('2')).toBeInTheDocument()
    const postura = within(tiles).getByRole('region', { name: 'Postura de los grupos de interés' })
    expect(within(postura).getByText('No disponible')).toBeInTheDocument()
    expect(red!.a('GET', '/sgspe/dashboards/executive')).toHaveLength(1)
  })

  it('la inversión se dice por moneda, sin sumar monedas, y la tendencia en tres gráficos', async () => {
    abrir()
    const inversion = await screen.findByRole('region', { name: 'Inversión ejecutada frente a presupuesto y topes' })
    const pen = within(inversion).getByRole('group', { name: 'PEN' })
    expect(within(pen).getByText('Ejecutado: S/ 15,000.00')).toBeInTheDocument()
    expect(within(pen).getByText('Presupuesto: S/ 40,000.00')).toBeInTheDocument()
    expect(within(pen).getByText('Topes de campaña: S/ 50,000.00')).toBeInTheDocument()
    expect(within(pen).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '37.5')
    const usd = within(inversion).getByRole('group', { name: 'USD' })
    expect(within(usd).getByText(/500\.00/)).toBeInTheDocument()
    expect(within(usd).getByText('Presupuesto: —')).toBeInTheDocument()
    const tendencia = screen.getByRole('region', { name: 'Tendencia de 12 meses' })
    expect(within(tendencia).getByRole('table', { name: 'Interacciones realizadas' })).toHaveTextContent('oct. 2026')
    expect(within(tendencia).getByRole('table', { name: 'Quejas recibidas y cerradas' })).toHaveTextContent('Cerradas')
    expect(within(tendencia).getByRole('table', { name: 'Compromisos vencidos al cierre del mes' })).toHaveTextContent('3')
  })

  it('la tabla por proyecto enlaza cada proyecto y dice no disponible donde la cuenta no lee; omitida, lo explica', async () => {
    abrir()
    const tabla = await screen.findByRole('table', { name: 'Por proyecto' })
    expect(within(tabla).getByRole('link', { name: 'PRJ-01 · Proyecto Ejemplo A' })).toHaveAttribute('href', '/projects/p1/overview')
    expect(within(tabla).getAllByText('No disponible')).toHaveLength(2)
    fetch!.restore()
    red!.restaurar()
    document.body.innerHTML = ''
    abrir({ ...TABLERO_EJECUTIVO, byProject: undefined, byProjectOmitted: true })
    expect(await screen.findByText('Tiene más de 25 proyectos: elija hasta 25 para ver la tabla por proyecto.')).toBeInTheDocument()
  })

  it('elegir proyectos pide el tablero con ellos; pasarse del tope pide acotar los filtros', async () => {
    abrir()
    await screen.findByRole('table', { name: 'Por proyecto' })
    await userEvent.click(screen.getByText('Proyectos de la tabla (0 elegidos)'))
    await userEvent.click(screen.getByRole('checkbox', { name: 'PRJ-02 · Proyecto Ejemplo B' }))
    await waitFor(() => expect(red!.a('GET', '/sgspe/dashboards/executive').some((l) => l.ruta.includes('project=p2'))).toBe(true))
    fetch!.restore()
    red!.restaurar()
    document.body.innerHTML = ''
    fetch = mockFetch(baseDeF8(EJECUTIVA))
    red = espiarRed([{ path: '/sgspe/dashboards/executive', responder: () => problema(400, 'x', [{ field: 'project', message: 'TOO_MANY_RECORDS' }]) }])
    montar(<RevisionEjecutivaPage />, { usuario: EJECUTIVA, permisos: SOLO_LECTURA_F8 })
    expect(await screen.findByText('Acote los filtros')).toBeInTheDocument()
  })

  it('sin proyectos asignados dice que no tiene y lleva a Proyectos', async () => {
    abrir({ ...TABLERO_EJECUTIVO, filters: { project: [] }, byProject: [] })
    expect(await screen.findByText('No tiene proyectos asignados.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a Proyectos' })).toHaveAttribute('href', '/projects')
  })

  it('/ dibuja la revisión ejecutiva si el catálogo la ofrece', async () => {
    fetch = abrirPortal('/', EJECUTIVA, SOLO_LECTURA_F8, [{ path: '/sgspe/dashboards/executive', body: TABLERO_EJECUTIVO }, ...baseDeF8(EJECUTIVA)])
    expect(await screen.findByRole('heading', { level: 1, name: 'Revisión ejecutiva' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Monitoreo de la Tabla 9.5' })).toHaveAttribute('href', '/dashboards/monitoring')
  })
})
