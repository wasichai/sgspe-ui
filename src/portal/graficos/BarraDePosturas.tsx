import { cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import type { Indicador } from '../datos/indicadores'
import { rotuloDeFila } from '../datos/opciones'
import { NS, numeroPe } from '../i18n'
import { NoDisponible } from '../componentes/Estados'

// la barra de posturas de KPI-STK-02 (dashboards.md §9.2): una escala ordenada con los colores divergentes de tokens.css,
// A FAVOR, NEUTRAL, EN CONTRA PERO ABIERTO A ESCUCHAR y EN CONTRA, más "sin evaluar"; cada tramo dice su valor en texto.
// sin permiso para leer stance, "no disponible" (RQ-DSH-032). Civic Modern (design-system.md §5.3 «Postura»): la barra apilada
// lleva el número dentro de cada tramo que lo deja leer (blanco sobre A FAVOR y EN CONTRA, text sobre NEUTRAL, tinta oscura sobre
// ABIERTO) y, debajo, la leyenda en texto con el círculo de 12 px de cada postura
export const ORDEN_DE_POSTURAS = ['A FAVOR', 'NEUTRAL', 'EN CONTRA PERO ABIERTO A ESCUCHAR', 'EN CONTRA'] as const
export const COLOR_DE_POSTURA: Record<string, string> = {
  'A FAVOR': 'var(--sg-stance-favor)',
  NEUTRAL: 'var(--sg-stance-neutral)',
  'EN CONTRA PERO ABIERTO A ESCUCHAR': 'var(--sg-stance-open)',
  'EN CONTRA': 'var(--sg-stance-against)'
}

// las mismas posturas como utilidades de Tailwind (relleno y tinta del número dentro del tramo); COLOR_DE_POSTURA queda para el
// lienzo de ECharts, que lee las variables
const CLASE_DE_POSTURA: Record<string, { fondo: string; tinta: string }> = {
  'A FAVOR': { fondo: 'bg-sg-stance-favor', tinta: 'text-sg-on-primary' },
  NEUTRAL: { fondo: 'bg-sg-stance-neutral', tinta: 'text-sg-text' },
  'EN CONTRA PERO ABIERTO A ESCUCHAR': { fondo: 'bg-sg-stance-open', tinta: 'text-sg-level-medium-ink' },
  'EN CONTRA': { fondo: 'bg-sg-stance-against', tinta: 'text-sg-on-primary' }
}
const SIN_POSTURA = { fondo: 'bg-sg-neutral-soft', tinta: 'text-sg-text' }
// por debajo de esta parte del total el número no cabe en el tramo: lo dice la leyenda
const PARTE_CON_NUMERO = 0.08

export function BarraDePosturas({ indicador, titulo }: { indicador: Indicador; titulo: string }) {
  const { t } = useTranslation(NS)
  if (!indicador.available) return <NoDisponible motivo={indicador.unavailableReason} />
  const filas = indicador.breakdowns?.find((d) => d.by === 'stance')?.rows ?? []
  const total = filas.reduce((suma, f) => suma + (f.value ?? 0), 0)
  const ordenadas = [
    ...ORDEN_DE_POSTURAS.map((p) => filas.find((f) => f.key === p) ?? { key: p, value: 0 }),
    ...filas.filter((f) => !(ORDEN_DE_POSTURAS as readonly string[]).includes(f.key))
  ]
  return (
    <figure className="space-y-2">
      <figcaption className="sr-only">{titulo}</figcaption>
      <div className="flex h-6 overflow-hidden rounded-sg-xs border border-sg-border-strong bg-sg-surface-sunken" aria-hidden>
        {ordenadas.map((f) => {
          if (!total || !f.value) return null
          const clase = CLASE_DE_POSTURA[f.key] ?? SIN_POSTURA
          return (
            <div
              key={f.key}
              style={{ width: `${(f.value / total) * 100}%` }}
              className={cn('flex items-center px-1.5 text-sg-caption font-bold tabular-nums', clase.fondo, clase.tinta)}
            >
              {f.value / total >= PARTE_CON_NUMERO ? numeroPe(f.value) : null}
            </div>
          )
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {ordenadas.map((f) => (
          <li key={f.key} className="inline-flex items-center gap-1.5 text-sg-caption font-bold tracking-wide">
            <span
              className={cn(
                'inline-block size-3 flex-none rounded-full outline outline-1 -outline-offset-1 outline-sg-border-strong',
                (CLASE_DE_POSTURA[f.key] ?? SIN_POSTURA).fondo
              )}
              aria-hidden
            />
            <span>
              {rotuloDeFila(f)}: {numeroPe(f.value ?? 0)}
            </span>
          </li>
        ))}
      </ul>
      {total === 0 ? <p className="text-sg-caption text-sg-text-muted">{t('comun.vacio')}</p> : null}
    </figure>
  )
}
