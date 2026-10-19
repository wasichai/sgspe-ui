import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeF8, CIERRE, INDICADORES_DEL_CATALOGO, TABLERO_MONITOREO } from '../test/f8'
import { pagina } from '../test/montar'
import { abrirPortal, rutaActual } from '../test/pantalla'
import { GERENCIA_SOCIAL } from '../test/portal'
import { espiarRed, type Red } from '../test/red'

vi.mock('./graficos/Grafico', () => import('../test/graficoFalso'))

// las rutas de F8 en el portal entero (decisión 2 del plan): el monitoreo y el detalle de un indicador bajo Dashboard
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  fetch = null
  red = null
})

describe('rutas de F8', () => {
  it('el monitoreo vive en /dashboards/monitoring', async () => {
    fetch = abrirPortal('/dashboards/monitoring', GERENCIA_SOCIAL, CIERRE, [
      { path: '/sgspe/dashboards/monitoring', body: TABLERO_MONITOREO },
      { path: '/objects/indicator/records', body: pagina(INDICADORES_DEL_CATALOGO) },
      ...baseDeF8(GERENCIA_SOCIAL)
    ])
    expect(await screen.findByRole('heading', { level: 1, name: 'Monitoreo del plan de relaciones comunitarias' })).toBeInTheDocument()
  })

  it('el detalle de un indicador vuelve al monitoreo', async () => {
    fetch = abrirPortal('/dashboards/indicators/KPI-ENG-02?periodStart=2026-09-01', GERENCIA_SOCIAL, CIERRE, [
      { path: '/sgspe/dashboards/indicators/KPI-ENG-02', body: { code: 'KPI-ENG-02', label: 'Reuniones sostenidas al mes', available: true, value: 3 } },
      ...baseDeF8(GERENCIA_SOCIAL)
    ])
    expect(await screen.findByRole('heading', { level: 1, name: 'Reuniones sostenidas al mes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al tablero' })).toHaveAttribute('href', '/dashboards/monitoring?month=2026-09')
  })

  it('el detalle abierto desde el monitoreo calcula la cifra del mismo proyecto y vuelve al mismo mes y proyecto', async () => {
    fetch = abrirPortal('/dashboards/monitoring?month=2026-07&project=p1', GERENCIA_SOCIAL, CIERRE, [
      { path: '/sgspe/dashboards/monitoring', body: TABLERO_MONITOREO },
      { path: '/sgspe/dashboards/indicators/KPI-STK-04', body: { code: 'KPI-STK-04', label: 'Grupos contactados', available: true, value: 3 } },
      { path: '/objects/indicator/records', body: pagina(INDICADORES_DEL_CATALOGO) },
      ...baseDeF8(GERENCIA_SOCIAL)
    ])
    red = espiarRed()
    const tabla = await screen.findByRole('table', { name: 'Monitoreo del plan de relaciones comunitarias' })
    const enlace = await within(tabla).findByRole('link', { name: 'Grupos de interés contactados, por sexo, ámbito e institución' })
    expect(enlace).toHaveAttribute('href', '/dashboards/indicators/KPI-STK-04?periodStart=2026-07-01&periodEnd=2026-07-31&month=2026-07&project=p1')
    await userEvent.click(enlace)
    expect(await screen.findByRole('heading', { level: 1, name: 'Grupos contactados' })).toBeInTheDocument()
    const [detalle] = red.a('GET', '/sgspe/dashboards/indicators/KPI-STK-04')
    expect(new URLSearchParams(detalle.ruta.split('?')[1]).get('project')).toBe('p1')
    expect(detalle.ruta).toContain('periodStart=2026-07-01')
    await userEvent.click(screen.getByRole('link', { name: 'Volver al tablero' }))
    await waitFor(() => expect(rutaActual()).toBe('/dashboards/monitoring?month=2026-07&project=p1'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Monitoreo del plan de relaciones comunitarias' })).toBeInTheDocument()
  })
})
