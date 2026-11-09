import { useEffect, useRef } from 'react'
import { numeroPe } from '../i18n'
import { alCambiarTema, colorDe } from '../mapa/colores'
import { echarts } from './echarts'
import type { GraficoProps } from './Grafico'
import { escapar } from './tema'

// ECharts sobre un div: el tema sale de los tokens (la paleta categórica, el texto, los ejes, la cuadrícula y el tooltip, que
// siguen el tema claro y oscuro) y se reaplica al cambiar de tema; aria activado (dashboards.md §9.3). desde el rediseño de UX
// (DD-15) las barras y las áreas son de color sólido, sin el relleno con trama (decal) de §9.4: cada serie se distingue por su
// color, la anotación directa de su valor, su leyenda y su tabla «Ver datos». Civic Modern (design-system.md §5.3 «Gráficos»):
// texto de 12,5 px text-secondary, guías de 1 px grid, ejes de 1 px border-strong, valores en 13/700 text, barras con radio 2
export const PALETA = ['--sg-data-1', '--sg-data-2', '--sg-data-3', '--sg-data-4', '--sg-data-5', '--sg-data-6']

// la familia del portal (Public Sans, design-system.md §3.4) es la de --font-sans del tema (theme/wasichai.css): el lienzo de
// ECharts no hereda la del documento. sin hoja, la del sistema
function familiaDelTema(): string {
  if (typeof document === 'undefined') return 'system-ui, sans-serif'
  return getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'system-ui, sans-serif'
}

export function temaDelGrafico() {
  return {
    color: PALETA.map(colorDe),
    textStyle: { color: colorDe('--sg-text-secondary'), fontFamily: familiaDelTema(), fontSize: TEXTO },
    aria: { enabled: true },
    animation: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  }
}

const TEXTO = 12.5

type Objeto = Record<string, unknown>
const esObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v)

// lo de la persona gana sobre el tema, clave por clave
function fusionar(base: Objeto, sobre: Objeto): Objeto {
  const r: Objeto = { ...base }
  for (const [k, v] of Object.entries(sobre)) r[k] = esObjeto(v) && esObjeto(r[k]) ? fusionar(r[k], v) : v
  return r
}

// los ejes, el tooltip y la leyenda que la pantalla declara reciben los colores de los tokens; los que no declara no se agregan
// (un tooltip implícito mostraría valores donde la pantalla no los quiere)
export function opcionesConTema(opciones: Objeto): Objeto {
  const eje = {
    axisLine: { lineStyle: { color: colorDe('--sg-border-strong'), width: 1 } },
    axisTick: { lineStyle: { color: colorDe('--sg-border-strong'), width: 1 } },
    axisLabel: { color: colorDe('--sg-text-secondary'), fontSize: TEXTO },
    // la rejilla de los gráficos es su token (design-system.md §3.3)
    splitLine: { lineStyle: { color: colorDe('--sg-grid'), width: 1 } }
  }
  // un conteo no tiene «0,2 personas»: si toda serie es de enteros, el eje de valores avanza de uno en uno (salvo que la
  // pantalla diga su minInterval)
  const enteros = soloEnteros(opciones.series)
  const conEntero = (x: Objeto) => (enteros && x.type === 'value' && x.minInterval === undefined ? { ...x, minInterval: 1 } : x)
  const conEje = (e: unknown) =>
    Array.isArray(e) ? e.map((x) => conEntero(fusionar(eje, esObjeto(x) ? x : {}))) : conEntero(fusionar(eje, esObjeto(e) ? e : {}))
  const resultado: Objeto = { ...temaDelGrafico(), ...opciones }
  for (const clave of ['xAxis', 'yAxis']) if (opciones[clave] !== undefined) resultado[clave] = conEje(opciones[clave])
  const series = Array.isArray(opciones.series) ? opciones.series.map((x) => (esObjeto(x) ? x : {})) : []
  // anotación directa (préstamo de C): con una o dos líneas (o una sola serie de barras, cuyo nombre ya es el título), cada valor va
  // junto a su marca y la leyenda sobra; con tres series o más, o con barras agrupadas (sin un final donde rotular), queda
  const anotadas = series.length > 0 && (series.length === 1 || (series.length === 2 && series.every((x) => x.type === 'line')))
  if (series.length > 0) resultado.series = series.map((serie) => conMarcas(serie, horizontal(opciones), anotadas, series.length > 1))
  if (anotadas && series.some((x) => x.type === 'line')) {
    // el rótulo del final de la línea necesita su franja a la derecha de la grilla
    const grilla = esObjeto(opciones.grid) ? opciones.grid : {}
    const derecha = typeof grilla.right === 'number' ? grilla.right : 0
    const largo = series.length > 1 ? Math.max(...series.map((x) => String(x.name ?? '').length)) : 0
    resultado.grid = { ...grilla, right: Math.max(derecha, 40 + largo * 7) }
  }
  if (anotadas) delete resultado.legend
  // una leyenda abajo (la posición por defecto de ECharts 6, si la pantalla no dice top) no pisa las etiquetas del eje X: la
  // grilla le deja su franja
  if (esObjeto(opciones.legend) && !anotadas && opciones.legend.top === undefined) {
    const grilla = esObjeto(resultado.grid) ? resultado.grid : {}
    const abajo = typeof grilla.bottom === 'number' ? grilla.bottom : 0
    resultado.grid = { ...grilla, bottom: Math.max(abajo, 56) }
  }
  // §5.3 «Tooltip»: fondo text, texto surface, radio 4, relleno de 8 × 12, 13,5/19, sombra overlay, hasta 260 px; en un gráfico
  // por eje, el periodo en 700 (salvo que la pantalla escriba su propio formatter)
  if (esObjeto(opciones.tooltip)) {
    resultado.tooltip = fusionar(
      {
        backgroundColor: colorDe('--sg-text'),
        borderWidth: 0,
        padding: [8, 12],
        textStyle: { color: colorDe('--sg-surface'), fontSize: 13.5, lineHeight: 19 },
        extraCssText: 'border-radius: 4px; max-width: 260px; white-space: normal; box-shadow: var(--sg-shadow-overlay);',
        ...(opciones.tooltip.trigger === 'axis' ? { formatter: tooltipPorEje } : {})
      },
      opciones.tooltip
    )
  }
  // la descripción accesible propia de una pantalla (aria.label.description) se suma al aria del tema: no lo apaga
  if (esObjeto(opciones.aria)) resultado.aria = fusionar(temaDelGrafico().aria, opciones.aria)
  if (esObjeto(opciones.legend) && !anotadas)
    resultado.legend = fusionar(
      { icon: 'roundRect', itemWidth: 12, itemHeight: 12, itemGap: 14, textStyle: { color: colorDe('--sg-text-secondary'), fontSize: 13.5 } },
      opciones.legend
    )
  return resultado
}

// una cifra dicha en es-PE; sin cifra, «—» (nunca 0)
export function cifra(valor: unknown): string {
  const v = Array.isArray(valor) ? valor.at(-1) : valor
  return typeof v === 'number' && Number.isFinite(v) ? numeroPe(v) : '—'
}

// el tooltip de un gráfico por eje: el periodo en negrita y cada serie con su cifra; los nombres vienen de la API y se escapan
function tooltipPorEje(parametros: unknown): string {
  const filas = (Array.isArray(parametros) ? parametros : [parametros]).filter(esObjeto)
  const periodo = filas[0] ? escapar(String(filas[0].axisValueLabel ?? filas[0].name ?? '')) : ''
  const lineas = filas.map((f) => `${String(f.marker ?? '')}${escapar(String(f.seriesName ?? ''))}: ${cifra(f.value)}`)
  return [`<strong>${periodo}</strong>`, ...lineas].join('<br>')
}

// un gráfico de barras horizontales: el eje de categorías es el vertical
const horizontal = (opciones: Objeto): boolean => {
  const y = Array.isArray(opciones.yAxis) ? opciones.yAxis[0] : opciones.yAxis
  return esObjeto(y) && y.type === 'category'
}

// las marcas de §5.3 en cada serie: las barras con radio 2 y su valor encima (a la derecha si son horizontales; una pila no se
// rotula tramo por tramo) y, con la anotación directa, cada línea con su último valor (y su nombre si hay dos) al final. lo que la
// pantalla declara gana
function conMarcas(serie: Objeto, enHorizontal: boolean, anotada: boolean, conNombre: boolean): Objeto {
  const valores = { color: colorDe('--sg-text'), fontWeight: 700, fontSize: 13 }
  if (serie.type === 'bar') {
    const r: Objeto = { ...serie, itemStyle: fusionar({ borderRadius: 2 }, esObjeto(serie.itemStyle) ? serie.itemStyle : {}) }
    if (serie.label === undefined && serie.stack === undefined) {
      r.label = { show: true, position: enHorizontal ? 'right' : 'top', ...valores, formatter: (p: { value?: unknown }) => cifra(p.value) }
      r.labelLayout = { hideOverlap: true }
    }
    return r
  }
  if (anotada && serie.type === 'line' && serie.endLabel === undefined && serie.markLine === undefined) {
    // conNombre solo con dos líneas: con una, el nombre ya es el título del gráfico
    return {
      ...serie,
      endLabel: {
        show: true,
        ...valores,
        formatter: (p: { seriesName?: string; value?: unknown }) => (conNombre ? `${p.seriesName ?? ''} ${cifra(p.value)}` : cifra(p.value))
      }
    }
  }
  return serie
}

// si todos los valores de todas las series son enteros (los conteos); un valor puede ser un número, null, un par [x, y] o
// { value }
function soloEnteros(series: unknown): boolean {
  if (!Array.isArray(series) || series.length === 0) return false
  const valores = series.flatMap((serie) => (esObjeto(serie) && Array.isArray(serie.data) ? serie.data : []))
  const numeros = valores
    .map((v) => (esObjeto(v) ? v.value : v))
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v): v is number => typeof v === 'number')
  return numeros.length > 0 && numeros.every((n) => Number.isInteger(n))
}

export default function GraficoImpl({ etiqueta, opciones, alto = 280, alElegir }: Omit<GraficoProps, 'datos'> & { datos?: unknown }) {
  const caja = useRef<HTMLDivElement>(null)
  const grafico = useRef<ReturnType<typeof echarts.init> | null>(null)
  const ultimo = useRef(alElegir)
  ultimo.current = alElegir
  const ultimasOpciones = useRef(opciones)
  ultimasOpciones.current = opciones

  useEffect(() => {
    if (!caja.current) return
    const instancia = echarts.init(caja.current, undefined, { renderer: 'svg' })
    instancia.on('click', (p: { name?: string; data?: unknown }) => ultimo.current?.(String(p.name ?? ''), p.data))
    grafico.current = instancia
    const redimensionar = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instancia.resize())
    redimensionar?.observe(caja.current)
    const dejar = alCambiarTema(() => instancia.setOption(opcionesConTema(ultimasOpciones.current as Objeto), { notMerge: true }))
    return () => {
      dejar()
      redimensionar?.disconnect()
      instancia.dispose()
      grafico.current = null
    }
  }, [])

  useEffect(() => {
    grafico.current?.setOption(opcionesConTema(opciones as Objeto), { notMerge: true })
  }, [opciones])

  // ECharts escribe en la caja interior su propia descripción ARIA de los datos; el grupo exterior lleva el título
  return (
    <div role="group" aria-label={etiqueta}>
      <div ref={caja} style={{ height: alto }} className="w-full" />
    </div>
  )
}
