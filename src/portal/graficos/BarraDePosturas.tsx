import { useTranslation } from 'react-i18next'
import type { Indicador } from '../datos/indicadores'
import { rotuloDeFila } from '../datos/opciones'
import { NS, numeroPe } from '../i18n'
import { NoDisponible } from '../componentes/Estados'

// la barra de posturas de KPI-STK-02 (dashboards.md §9.2): una escala ordenada con los colores divergentes de tokens.css,
// A FAVOR, NEUTRAL, EN CONTRA PERO ABIERTO A ESCUCHAR y EN CONTRA, más "sin evaluar"; cada tramo dice su valor en texto.
// sin permiso para leer stance, "no disponible" (RQ-DSH-032)
export const ORDEN_DE_POSTURAS = ['A FAVOR', 'NEUTRAL', 'EN CONTRA PERO ABIERTO A ESCUCHAR', 'EN CONTRA'] as const
export const COLOR_DE_POSTURA: Record<string, string> = {
  'A FAVOR': 'var(--sg-stance-favor)',
  NEUTRAL: 'var(--sg-stance-neutral)',
  'EN CONTRA PERO ABIERTO A ESCUCHAR': 'var(--sg-stance-open)',
  'EN CONTRA': 'var(--sg-stance-against)'
}

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
      <div className="flex h-3 overflow-hidden rounded-full bg-sg-surface-sunken" aria-hidden>
        {ordenadas.map((f) =>
          total && f.value ? (
            <div key={f.key} style={{ width: `${(f.value / total) * 100}%`, backgroundColor: COLOR_DE_POSTURA[f.key] ?? 'var(--sg-neutral-soft)' }} />
          ) : null
        )}
      </div>
      <ul className="grid gap-1 text-sg-caption sm:grid-cols-2">
        {ordenadas.map((f) => (
          <li key={f.key} className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: COLOR_DE_POSTURA[f.key] ?? 'var(--sg-neutral-soft)' }} aria-hidden />
            {rotuloDeFila(f)}: {numeroPe(f.value ?? 0)}
          </li>
        ))}
      </ul>
      {total === 0 ? <p className="text-sg-caption text-sg-text-muted">{t('comun.vacio')}</p> : null}
    </figure>
  )
}
