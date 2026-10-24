import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { echarts } from './echarts'
import { Grafico } from './Grafico'
import GraficoImpl, { opcionesConTema } from './GraficoImpl'

const OPCIONES = { xAxis: { type: 'category', data: ['2026-09', '2026-10'] }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: [1, 3] }] }

// jsdom no tiene canvas: ECharts mide el texto sin él
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

// ECharts 6 de verdad, en jsdom: el renderizador SVG dibuja sin canvas, con su descripción ARIA (dashboards.md §9.4)
describe('GraficoImpl', () => {
  it('dibuja en SVG con la descripción ARIA de ECharts', async () => {
    render(
      <div style={{ width: 400 }}>
        <GraficoImpl etiqueta="Reuniones al mes" opciones={OPCIONES} />
      </div>
    )
    const grupo = screen.getByRole('group', { name: 'Reuniones al mes' })
    await waitFor(() => expect(grupo.querySelector('svg')).not.toBeNull())
    expect(grupo.querySelector('div[aria-label]')?.getAttribute('aria-label')).toMatch(/\S/)
  })

  it('con la descripción de la pantalla, el texto accesible es ese, sin el NaN que ECharts diría de una barra null', async () => {
    const opciones = {
      ...OPCIONES,
      aria: { label: { description: 'Reuniones al mes. 2026-09: 1; 2026-10: sin dato.' } },
      series: [{ type: 'bar', data: [1, null] }]
    }
    render(
      <div style={{ width: 400 }}>
        <GraficoImpl etiqueta="Reuniones al mes" opciones={opciones} />
      </div>
    )
    const grupo = screen.getByRole('group', { name: 'Reuniones al mes' })
    await waitFor(() => expect(grupo.querySelector('svg')).not.toBeNull())
    expect(grupo.querySelector('div[aria-label]')?.getAttribute('aria-label')).toBe('Reuniones al mes. 2026-09: 1; 2026-10: sin dato.')
  })

  it('al desmontar libera la instancia de ECharts y deja de observar el tamaño', async () => {
    const observadores: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
        constructor() {
          observadores.push(this)
        }
      }
    )
    const { unmount } = render(
      <div style={{ width: 400 }}>
        <GraficoImpl etiqueta="Reuniones al mes" opciones={OPCIONES} />
      </div>
    )
    const caja = screen.getByRole('group', { name: 'Reuniones al mes' }).firstElementChild as HTMLElement
    const instancia = echarts.getInstanceByDom(caja)
    expect(instancia).toBeDefined()
    expect(instancia?.isDisposed()).toBeFalsy()
    expect(observadores).toHaveLength(1)
    expect(observadores[0].observe).toHaveBeenCalledWith(caja)

    unmount()
    expect(instancia?.isDisposed()).toBe(true)
    expect(observadores[0].disconnect).toHaveBeenCalledTimes(1)
  })
})

describe('opcionesConTema', () => {
  it('los ejes, el tooltip y la leyenda que la pantalla declara siguen los tokens, y lo suyo gana', () => {
    document.documentElement.style.setProperty('--sg-border-strong', '#111111')
    document.documentElement.style.setProperty('--sg-border-subtle', '#222222')
    document.documentElement.style.setProperty('--sg-surface', '#333333')
    document.documentElement.style.setProperty('--sg-text-secondary', '#444444')
    const r = opcionesConTema({
      xAxis: { type: 'category', axisLabel: { width: 150 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#abcdef' } } },
      tooltip: { trigger: 'axis' },
      legend: {}
    }) as Record<string, any>
    expect(r.xAxis.axisLine.lineStyle.color).toBe('#111111')
    expect(r.xAxis.axisLabel).toEqual({ width: 150, color: '#444444' })
    expect(r.yAxis.splitLine.lineStyle.color).toBe('#abcdef')
    expect(r.tooltip).toMatchObject({ trigger: 'axis', backgroundColor: '#333333' })
    expect(r.legend.textStyle.color).toBe('#444444')
  })

  it('la descripción accesible que la pantalla da se suma al aria del tema sin apagarlo', () => {
    const r = opcionesConTema({ aria: { label: { description: 'Programas: uno por aprobar' } }, series: [] }) as Record<string, any>
    expect(r.aria).toEqual({ enabled: true, label: { description: 'Programas: uno por aprobar' } })
  })

  // DD-15 del rediseño de UX (P-07 (i)): barras y áreas de color sólido, sin el relleno con trama (decal) que activaba el tema
  it('el tema no pone trama en las barras ni en las áreas', () => {
    const r = opcionesConTema({ series: [{ type: 'bar', data: [1, 2] }] }) as Record<string, any>
    expect(r.aria.enabled).toBe(true)
    expect(JSON.stringify(r)).not.toMatch(/decal/)
  })

  it('un eje de valores con series de enteros (conteos) no tiene ticks decimales; con decimales, sí', () => {
    const conteos = opcionesConTema({ xAxis: { type: 'value' }, yAxis: { type: 'category' }, series: [{ type: 'bar', data: [0, 1] }] }) as Record<string, any>
    expect(conteos.xAxis.minInterval).toBe(1)
    expect(conteos.yAxis.minInterval).toBeUndefined()
    const promedios = opcionesConTema({ yAxis: { type: 'value' }, series: [{ type: 'line', data: [2.7, null, 3.1] }] }) as Record<string, any>
    expect(promedios.yAxis.minInterval).toBeUndefined()
    const propio = opcionesConTema({ yAxis: { type: 'value', minInterval: 5 }, series: [{ type: 'bar', data: [10] }] }) as Record<string, any>
    expect(propio.yAxis.minInterval).toBe(5)
  })

  it('una leyenda abajo (también la que no dice top: ECharts 6 la pone abajo) deja espacio a las etiquetas del eje', () => {
    const abajo = opcionesConTema({ grid: { bottom: 24 }, legend: { bottom: 0 }, series: [] }) as Record<string, any>
    expect(abajo.grid.bottom).toBeGreaterThanOrEqual(56)
    const porDefecto = opcionesConTema({ grid: { bottom: 32 }, legend: {}, series: [] }) as Record<string, any>
    expect(porDefecto.grid.bottom).toBeGreaterThanOrEqual(56)
    const arriba = opcionesConTema({ grid: { bottom: 24 }, legend: { top: 0 }, series: [] }) as Record<string, any>
    expect(arriba.grid.bottom).toBe(24)
  })

  it('no agrega un tooltip ni una leyenda que la pantalla no pidió', () => {
    const r = opcionesConTema({ series: [] }) as Record<string, unknown>
    expect(r.tooltip).toBeUndefined()
    expect(r.legend).toBeUndefined()
    expect(r.xAxis).toBeUndefined()
  })
})

describe('Grafico', () => {
  const datos = {
    columnas: ['Mes', 'Reuniones'],
    filas: [
      ['2026-09', '1'],
      ['2026-10', '3']
    ]
  }

  it('dibuja el gráfico y, bajo "Ver datos", su tabla con título, encabezados y filas', async () => {
    montar(<Grafico etiqueta="Reuniones al mes" opciones={OPCIONES} datos={datos} />)
    await waitFor(() => expect(screen.getByRole('group', { name: 'Reuniones al mes' }).querySelector('svg')).not.toBeNull())
    const resumen = screen.getByText('Ver datos')
    expect(resumen.tagName).toBe('SUMMARY')
    expect(resumen.closest('details')).not.toHaveAttribute('open')
    const tabla = screen.getByRole('table', { name: 'Reuniones al mes' })
    expect(tabla.querySelector('caption')).toHaveTextContent('Reuniones al mes')
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Mes', 'Reuniones'])
    expect(screen.getAllByRole('row').map((f) => f.textContent)).toEqual(['MesReuniones', '2026-091', '2026-103'])
  })

  it('sin filas o con todo en cero dice que no hay datos en el periodo, sin ejes vacíos', () => {
    const { rerender } = montar(<Grafico etiqueta="Reuniones al mes" opciones={OPCIONES} datos={{ columnas: ['Mes', 'Reuniones'], filas: [] }} />)
    expect(screen.getByText('Sin datos en el periodo')).toBeInTheDocument()
    expect(screen.queryByText('Ver datos')).not.toBeInTheDocument()
    rerender(
      <Grafico
        etiqueta="Reuniones al mes"
        opciones={OPCIONES}
        datos={{
          columnas: ['Mes', 'Reuniones'],
          filas: [
            ['2026-09', '0'],
            ['2026-10', '—']
          ]
        }}
      />
    )
    expect(screen.getByText('Sin datos en el periodo')).toBeInTheDocument()
  })
})
