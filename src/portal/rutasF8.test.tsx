import { screen } from '@testing-library/react'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeF8, CIERRE, INDICADORES_DEL_CATALOGO, TABLERO_MONITOREO } from '../test/f8'
import { pagina } from '../test/montar'
import { abrirPortal } from '../test/pantalla'
import { GERENCIA_SOCIAL } from '../test/portal'

vi.mock('./graficos/Grafico', () => import('../test/graficoFalso'))

// las rutas de F8 en el portal entero (decisión 2 del plan): el monitoreo y el detalle de un indicador bajo Dashboard
let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('rutas de F8', () => {
  it('el monitoreo vive en /dashboards/monitoring', async () => {
    fetch = abrirPortal('/dashboards/monitoring', GERENCIA_SOCIAL, CIERRE, [
      { path: '/sgspe/dashboards/monitoring', body: TABLERO_MONITOREO },
      { path: '/objects/indicator/records', body: pagina(INDICADORES_DEL_CATALOGO) },
      ...baseDeF8(GERENCIA_SOCIAL)
    ])
    expect(await screen.findByRole('heading', { level: 1, name: 'Monitoreo de la Tabla 9.5' })).toBeInTheDocument()
  })

  it('el detalle de un indicador vuelve al monitoreo', async () => {
    fetch = abrirPortal('/dashboards/indicators/KPI-ENG-02?periodStart=2026-09-01', GERENCIA_SOCIAL, CIERRE, [
      { path: '/sgspe/dashboards/indicators/KPI-ENG-02', body: { code: 'KPI-ENG-02', label: 'Reuniones sostenidas al mes', available: true, value: 3 } },
      ...baseDeF8(GERENCIA_SOCIAL)
    ])
    expect(await screen.findByRole('heading', { level: 1, name: 'Reuniones sostenidas al mes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al tablero' })).toHaveAttribute('href', '/dashboards/monitoring?periodStart=2026-09-01')
  })
})
