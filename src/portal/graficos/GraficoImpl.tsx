import { useEffect, useRef } from 'react'
import { alCambiarTema, colorDe } from '../mapa/colores'
import { echarts } from './echarts'
import type { GraficoProps } from './Grafico'

// ECharts sobre un div: el tema sale de los tokens (texto, bordes y la paleta categórica de tokens.css) y se reaplica al
// cambiar de tema; aria y decal activados (dashboards.md §9.3 y §9.4)
export const PALETA = ['--sg-data-1', '--sg-data-2', '--sg-data-3', '--sg-data-4', '--sg-data-5', '--sg-data-6']

export function temaDelGrafico() {
  return {
    color: PALETA.map(colorDe),
    textStyle: { color: colorDe('--sg-text-secondary'), fontFamily: 'IBM Plex Sans, system-ui, sans-serif' },
    aria: { enabled: true, decal: { show: true } },
    animation: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  }
}

export default function GraficoImpl({ etiqueta, opciones, alto = 280, alElegir }: Omit<GraficoProps, 'datos'> & { datos?: unknown }) {
  const caja = useRef<HTMLDivElement>(null)
  const grafico = useRef<ReturnType<typeof echarts.init> | null>(null)
  const ultimo = useRef(alElegir)
  ultimo.current = alElegir

  useEffect(() => {
    if (!caja.current) return
    const instancia = echarts.init(caja.current, undefined, { renderer: 'svg' })
    instancia.on('click', (p: { name?: string; data?: unknown }) => ultimo.current?.(String(p.name ?? ''), p.data))
    grafico.current = instancia
    const redimensionar = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => instancia.resize())
    redimensionar?.observe(caja.current)
    const dejar = alCambiarTema(() => instancia.setOption(temaDelGrafico()))
    return () => {
      dejar()
      redimensionar?.disconnect()
      instancia.dispose()
      grafico.current = null
    }
  }, [])

  useEffect(() => {
    grafico.current?.setOption({ ...temaDelGrafico(), ...opciones }, { notMerge: true })
  }, [opciones])

  // ECharts escribe en la caja interior su propia descripción ARIA de los datos; el grupo exterior lleva el título
  return (
    <div role="group" aria-label={etiqueta}>
      <div ref={caja} style={{ height: alto }} className="w-full" />
    </div>
  )
}
