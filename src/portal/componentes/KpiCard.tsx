import { Link } from 'react-router'
import { ApiError } from '@wasichai/core'
import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Indicador } from '../datos/indicadores'
import { NS, numeroPe } from '../i18n'
import { Cargando, NoDisponible } from './Estados'
import { correlacionDe, useMensajeDeError } from './errores'

// una cifra con su contexto (design-system.md §5, dashboards.md §9.2): el valor, su unidad y, si es un porcentaje, el
// "n de N" que deja ver la base. sin permiso dice "no disponible" y por qué; un módulo que no llegó dice en qué fase llega
// si la consulta del indicador falló, error lo dice (con su correlación) en lugar de dejar "Cargando…" para siempre; un 403
// dice "No disponible", como el resto de las cifras sin permiso. notas va dentro de la tarjeta, bajo la cifra: lo que un
// tablero dice de ella (los filtros que no aplica, sus avisos)
export function KpiCard({
  titulo,
  indicador,
  llegaEn,
  cargando,
  error,
  notas,
  a,
  alReintentar
}: {
  titulo: string
  indicador?: Indicador
  llegaEn?: string
  cargando?: boolean
  error?: unknown
  notas?: ReactNode
  // la lista con el filtro puesto: la cifra la enlaza (design P8; revisión de UX, etapa 6)
  a?: string
  // con un fallo propio, «Reintentar» junto a la cifra; si falla todo el tablero, el aviso único lo ofrece y la tarjeta no
  alReintentar?: () => void
}) {
  const { t } = useTranslation(NS)
  let cuerpo
  if (llegaEn) cuerpo = <p className="text-sm text-sg-text-muted">{t('comun.llegaEn', { fase: llegaEn })}</p>
  // sin permiso sobre el indicador (403) no es una falla: la cifra no está disponible para esta cuenta
  // un fallo que no es de permiso se dice en una línea, con el detalle en title (D4, revisión de UX, etapa 7): el texto largo de
  // una lectura fallida, repetido en cada tarjeta, tapaba el tablero
  else if (error && !indicador) cuerpo = <CifraFallida error={error} alReintentar={alReintentar} />
  else if (cargando || !indicador) cuerpo = <Cargando compacto />
  else if (!indicador.available) cuerpo = <NoDisponible motivo={indicador.unavailableReason} />
  // sin valor en el periodo (un porcentaje sin base, una mediana sin casos) se dice, sin «—» ni la unidad suelta
  else if (indicador.value === null || indicador.value === undefined) cuerpo = <p className="text-sm text-sg-text-muted">{t('comun.sinDatosEnElPeriodo')}</p>
  else
    cuerpo = (
      <>
        <p className="text-sg-kpi font-semibold tabular-nums text-sg-text">
          {a ? (
            <Link to={a} aria-label={`${titulo}: ${numeroPe(indicador.value)}`} className="hover:underline">
              {numeroPe(indicador.value)}
            </Link>
          ) : (
            numeroPe(indicador.value)
          )}
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
      {notas}
    </section>
  )
}

// una cifra o un gráfico que no se pudo cargar, en una línea: también la usan los gráficos de un tablero cuyo aviso único está en
// otro lugar de la pantalla
// sin permiso (403) no es una falla: la cifra no está disponible para esta cuenta, con su candado (RQ-DSH-032)
export function CifraFallida({ error, alReintentar }: { error: unknown; alReintentar?: () => void }) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  if (error instanceof ApiError && error.status === 403) return <NoDisponible />
  // el detalle, con el id de correlación para soporte, va en title
  const correlacion = correlacionDe(error)
  const detalle = [mensaje(error), correlacion ? t('comun.correlacion', { id: correlacion }) : ''].filter(Boolean).join(' · ')
  return (
    <p className="flex flex-wrap items-center gap-1 text-sm text-sg-text-secondary" title={detalle}>
      <AlertTriangle aria-hidden className="size-3.5 text-sg-warning" />
      {t('comun.cifraFallida')}
      {alReintentar ? (
        <>
          {' · '}
          <button type="button" className="text-sg-primary-text underline" onClick={alReintentar}>
            {t('comun.reintentar')}
          </button>
        </>
      ) : null}
    </p>
  )
}
