import { useEffect, useRef } from 'react'
import { alCambiarTema, colorDe } from '../mapa/colores'
import { echarts } from './echarts'
import type { GraficoProps } from './Grafico'

// ECharts sobre un div: el tema sale de los tokens (la paleta categórica, el texto, los ejes, la cuadrícula y el tooltip, que
// siguen el tema claro y oscuro) y se reaplica al cambiar de tema; aria y decal activados (dashboards.md §9.3 y §9.4)
export const PALETA = ['--sg-data-1', '--sg-data-2', '--sg-data-3', '--sg-data-4', '--sg-data-5', '--sg-data-6']

export function temaDelGrafico() {
  return {
    color: PALETA.map(colorDe),
    textStyle: { color: colorDe('--sg-text-secondary'), fontFamily: 'IBM Plex Sans, system-ui, sans-serif' },
    aria: { enabled: true, decal: { show: true } },
    animation: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  }
}

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
    axisLine: { lineStyle: { color: colorDe('--sg-border-strong') } },
    axisTick: { lineStyle: { color: colorDe('--sg-border-strong') } },
    axisLabel: { color: colorDe('--sg-text-secondary') },
    splitLine: { lineStyle: { color: colorDe('--sg-border-subtle') } }
  }
  // un conteo no tiene «0,2 personas»: si toda serie es de enteros, el eje de valores avanza de uno en uno (salvo que la
  // pantalla diga su minInterval)
  const enteros = soloEnteros(opciones.series)
  const conEntero = (x: Objeto) => (enteros && x.type === 'value' && x.minInterval === undefined ? { ...x, minInterval: 1 } : x)
  const conEje = (e: unknown) =>
    Array.isArray(e) ? e.map((x) => conEntero(fusionar(eje, esObjeto(x) ? x : {}))) : conEntero(fusionar(eje, esObjeto(e) ? e : {}))
  const resultado: Objeto = { ...temaDelGrafico(), ...opciones }
  for (const clave of ['xAxis', 'yAxis']) if (opciones[clave] !== undefined) resultado[clave] = conEje(opciones[clave])
  // una leyenda abajo (la posición por defecto de ECharts 6, si la pantalla no dice top) no pisa las etiquetas del eje X: la
  // grilla le deja su franja
  if (esObjeto(opciones.legend) && opciones.legend.top === undefined) {
    const grilla = esObjeto(opciones.grid) ? opciones.grid : {}
    const abajo = typeof grilla.bottom === 'number' ? grilla.bottom : 0
    resultado.grid = { ...grilla, bottom: Math.max(abajo, 56) }
  }
  if (esObjeto(opciones.tooltip)) {
    resultado.tooltip = fusionar(
      {
        backgroundColor: colorDe('--sg-surface'),
        borderColor: colorDe('--sg-border'),
        textStyle: { color: colorDe('--sg-text') }
      },
      opciones.tooltip
    )
  }
  // la descripción accesible propia de una pantalla (aria.label.description) se suma al aria del tema: no lo apaga ni quita el decal
  if (esObjeto(opciones.aria)) resultado.aria = fusionar(temaDelGrafico().aria, opciones.aria)
  if (esObjeto(opciones.legend)) resultado.legend = fusionar({ textStyle: { color: colorDe('--sg-text-secondary') } }, opciones.legend)
  return resultado
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
