import { useTranslation } from 'react-i18next'
import type { Indicador } from '../datos/indicadores'
import { NS, numeroPe } from '../i18n'
import { Cargando, ErrorDeCarga, NoDisponible } from './Estados'

// una cifra con su contexto (design-system.md §5, dashboards.md §9.2): el valor, su unidad y, si es un porcentaje, el
// "n de N" que deja ver la base. sin permiso dice "no disponible" y por qué; un módulo que no llegó dice en qué fase llega
// si la consulta del indicador falló, error lo dice (con su correlación) en lugar de dejar "Cargando…" para siempre
export function KpiCard({
  titulo,
  indicador,
  llegaEn,
  cargando,
  error
}: {
  titulo: string
  indicador?: Indicador
  llegaEn?: string
  cargando?: boolean
  error?: unknown
}) {
  const { t } = useTranslation(NS)
  let cuerpo
  if (llegaEn) cuerpo = <p className="text-sm text-sg-text-muted">{t('comun.llegaEn', { fase: llegaEn })}</p>
  else if (error && !indicador) cuerpo = <ErrorDeCarga error={error} />
  else if (cargando || !indicador) cuerpo = <Cargando compacto />
  else if (!indicador.available) cuerpo = <NoDisponible motivo={indicador.unavailableReason} />
  else
    cuerpo = (
      <>
        <p className="text-sg-kpi font-semibold tabular-nums text-sg-text">
          {indicador.value === null || indicador.value === undefined ? '—' : numeroPe(indicador.value)}
        </p>
        <p className="text-sg-caption text-sg-text-muted">
          {indicador.numerator !== undefined && indicador.numerator !== null && indicador.denominator
            ? `${numeroPe(indicador.numerator)} / ${numeroPe(indicador.denominator)} · `
            : ''}
          {indicador.unit ?? ''}
        </p>
      </>
    )
  return (
    <section aria-label={titulo} className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{titulo}</h3>
      {cuerpo}
    </section>
  )
}
