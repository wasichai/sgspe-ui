import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    document.documentElement.style.setProperty('--sg-grid', '#222222')
    document.documentElement.style.setProperty('--sg-text', '#333333')
    document.documentElement.style.setProperty('--sg-text-secondary', '#444444')
    const r = opcionesConTema({
      xAxis: { type: 'category', axisLabel: { width: 150 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#abcdef' } } },
      tooltip: { trigger: 'axis' },
      legend: {},
      series: [{ type: 'line' }, { type: 'line' }, { type: 'line' }]
    }) as Record<string, any>
    expect(r.xAxis.axisLine.lineStyle.color).toBe('#111111')
    expect(r.xAxis.axisLabel).toEqual({ width: 150, color: '#444444', fontSize: 12.5 })
    expect(r.yAxis.splitLine.lineStyle.color).toBe('#abcdef')
    expect(r.tooltip).toMatchObject({ trigger: 'axis', backgroundColor: '#333333' })
    expect(r.legend.textStyle.color).toBe('#444444')
  })

  // design-system.md §6 (gráficos): el texto en la familia del portal (Public Sans), leída de la variable del tema y no escrita
  // aquí; la rejilla es el token grid
  it('el texto del gráfico usa la familia del tema y la rejilla su token', () => {
    document.documentElement.style.setProperty('--font-sans', "'Public Sans', 'Segoe UI', system-ui, sans-serif")
    document.documentElement.style.setProperty('--sg-grid', '#e3e7ed')
    const r = opcionesConTema({ yAxis: { type: 'value' } }) as Record<string, any>
    expect(r.textStyle.fontFamily).toBe("'Public Sans', 'Segoe UI', system-ui, sans-serif")
    expect(r.yAxis.splitLine.lineStyle.color).toBe('#e3e7ed')
    document.documentElement.style.removeProperty('--font-sans')
    // sin hoja (o sin la variable), la familia del sistema
    expect((opcionesConTema({}) as Record<string, any>).textStyle.fontFamily).toBe('system-ui, sans-serif')
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

  // design-system.md §5.3 «Gráficos»: el valor de cada barra va rotulado sobre ella (a su derecha si es horizontal), en 13/700
  // text, y la barra tiene radio 2; lo que la pantalla declara gana, y una pila no se rotula tramo por tramo
  it('rotula el valor de cada barra encima, en 13/700 text, con radio 2', () => {
    document.documentElement.style.setProperty('--sg-text', '#0f1a2a')
    const r = opcionesConTema({ xAxis: { type: 'category' }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: [1200, 3] }] }) as Record<string, any>
    const serie = r.series[0]
    expect(serie.label).toMatchObject({ show: true, position: 'top', color: '#0f1a2a', fontWeight: 700, fontSize: 13 })
    expect(serie.label.formatter({ value: 1200 })).toMatch(/1\D?200/)
    expect(serie.itemStyle.borderRadius).toBe(2)
    expect(serie.labelLayout).toMatchObject({ hideOverlap: true })
    const horizontal = opcionesConTema({ xAxis: { type: 'value' }, yAxis: { type: 'category' }, series: [{ type: 'bar', data: [1] }] }) as Record<string, any>
    expect(horizontal.series[0].label.position).toBe('right')
    const propia = opcionesConTema({ series: [{ type: 'bar', data: [1], label: { show: false } }] }) as Record<string, any>
    expect(propia.series[0].label).toEqual({ show: false })
    const pila = opcionesConTema({ series: [{ type: 'bar', stack: 't', data: [1] }] }) as Record<string, any>
    expect(pila.series[0].label).toBeUndefined()
    expect(pila.series[0].itemStyle.borderRadius).toBe(2)
  })

  // anotación directa (préstamo de C): con una o dos líneas, el último valor y el nombre van al final de cada línea y la leyenda
  // sobra; con tres series o más (o barras agrupadas, que no tienen un final donde rotular), la leyenda queda
  it('con una o dos líneas anota el final de cada una y quita la leyenda; con tres o más la deja', () => {
    const una = opcionesConTema({ legend: {}, series: [{ type: 'line', name: 'Vencidos', data: [3, 7] }] }) as Record<string, any>
    expect(una.legend).toBeUndefined()
    expect(una.series[0].endLabel.show).toBe(true)
    expect(una.series[0].endLabel.formatter({ seriesName: 'Vencidos', value: 7 })).toBe('7')
    const dos = opcionesConTema({
      legend: {},
      series: [
        { type: 'line', name: 'Recibidas', data: [9, 1200] },
        { type: 'line', name: 'Cerradas', data: [6, 4] }
      ]
    }) as Record<string, any>
    expect(dos.legend).toBeUndefined()
    expect(dos.series[0].endLabel.formatter({ seriesName: 'Recibidas', value: 1200 })).toMatch(/^Recibidas 1\D?200$/)
    expect(dos.grid.right).toBeGreaterThanOrEqual(72)
    const tres = opcionesConTema({ legend: {}, series: [{ type: 'line' }, { type: 'line' }, { type: 'line' }] }) as Record<string, any>
    expect(tres.legend).toBeDefined()
    expect(tres.series[0].endLabel).toBeUndefined()
    const agrupadas = opcionesConTema({ legend: {}, series: [{ type: 'bar' }, { type: 'bar' }] }) as Record<string, any>
    expect(agrupadas.legend).toBeDefined()
  })

  // §5.3 «Tooltip»: fondo text, texto surface, radio 4, 8 × 12, 13,5/19, sombra overlay, hasta 260 px; el periodo en 700
  it('el tooltip es oscuro sobre claro, con el periodo en negrita y sin insertar nombres sin escapar', () => {
    document.documentElement.style.setProperty('--sg-text', '#0f1a2a')
    document.documentElement.style.setProperty('--sg-surface', '#ffffff')
    const r = opcionesConTema({ tooltip: { trigger: 'axis' }, series: [{ type: 'bar', data: [1] }] }) as Record<string, any>
    expect(r.tooltip).toMatchObject({
      backgroundColor: '#0f1a2a',
      borderWidth: 0,
      padding: [8, 12],
      textStyle: { color: '#ffffff', fontSize: 13.5, lineHeight: 19 }
    })
    expect(r.tooltip.extraCssText).toMatch(/border-radius: ?4px/)
    expect(r.tooltip.extraCssText).toMatch(/max-width: ?260px/)
    expect(r.tooltip.extraCssText).toMatch(/var\(--sg-shadow-overlay\)/)
    const html = r.tooltip.formatter([{ axisValueLabel: 'nov <b>', marker: '•', seriesName: 'Reuniones', value: 1200 }])
    expect(html).toContain('<strong>nov &#60;b&#62;</strong>')
    expect(html).toMatch(/Reuniones: 1\D?200/)
    const propio = opcionesConTema({ tooltip: { trigger: 'axis', formatter: 'x' } }) as Record<string, any>
    expect(propio.tooltip.formatter).toBe('x')
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
    // «Ver datos» es un botón visible en la cabecera del gráfico, cerrado: la tabla sigue en el árbol accesible, oculta a la vista
    const verDatos = screen.getByRole('button', { name: 'Ver datos' })
    expect(verDatos).toHaveAttribute('aria-expanded', 'false')
    const tabla = screen.getByRole('table', { name: 'Reuniones al mes' })
    expect(verDatos).toHaveAttribute('aria-controls', tabla.id)
    expect(tabla).toHaveClass('sr-only')
    expect(tabla.querySelector('caption')).toHaveTextContent('Reuniones al mes')
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Mes', 'Reuniones'])
    expect(screen.getAllByRole('row').map((f) => f.textContent)).toEqual(['MesReuniones', '2026-091', '2026-103'])
  })

  it('«Ver datos» abre y cierra la tabla a la vista', async () => {
    montar(<Grafico etiqueta="Reuniones al mes" opciones={OPCIONES} datos={datos} />)
    const verDatos = screen.getByRole('button', { name: 'Ver datos' })
    await userEvent.click(verDatos)
    expect(verDatos).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('table', { name: 'Reuniones al mes' })).not.toHaveClass('sr-only')
    await userEvent.click(verDatos)
    expect(verDatos).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('table', { name: 'Reuniones al mes' })).toHaveClass('sr-only')
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
