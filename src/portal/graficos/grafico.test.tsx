import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GraficoImpl from './GraficoImpl'

// ECharts 6 de verdad, en jsdom: el renderizador SVG dibuja sin canvas, con su descripción ARIA (dashboards.md §9.4)
describe('GraficoImpl', () => {
  it('dibuja en SVG con la descripción ARIA de ECharts', async () => {
    // jsdom no tiene canvas: ECharts mide el texto sin él
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(
      <div style={{ width: 400 }}>
        <GraficoImpl
          etiqueta="Reuniones al mes"
          opciones={{ xAxis: { type: 'category', data: ['2026-09', '2026-10'] }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: [1, 3] }] }}
        />
      </div>
    )
    await act(async () => new Promise((r) => setTimeout(r, 50)))
    const grupo = screen.getByRole('group', { name: 'Reuniones al mes' })
    expect(grupo.querySelector('svg')).not.toBeNull()
    expect(grupo.querySelector('div[aria-label]')?.getAttribute('aria-label')).toMatch(/\S/)
  })
})
