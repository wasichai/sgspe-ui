import { Link } from 'react-router'
import { ApiError } from '@wasichai/core'
import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Indicador } from '../datos/indicadores'
import { NS, numeroPe } from '../i18n'
import { Cargando, NoDisponible } from './Estados'
import { correlacionDe, useMensajeDeError } from './errores'
import { Seccion } from './Seccion'

// una cifra con su contexto (design-system.md §5, dashboards.md §9.2): el valor, su unidad y, si es un porcentaje, el
// "n de N" que deja ver la base. sin permiso dice "no disponible" y por qué; un módulo que no llegó dice en qué fase llega
// si la consulta del indicador falló, error lo dice (con su correlación) en lugar de dejar "Cargando…" para siempre; un 403
// dice "No disponible", como el resto de las cifras sin permiso. notas va dentro de la tarjeta, bajo la cifra: lo que un
// tablero dice de ella (los filtros que no aplica, sus avisos). una lista que muestra la cifra fuera de su tablero puede decir con
// cifra y detalle qué cuenta, en palabras (hallazgo U-24): «0 %» y «0 de 4 recibidas… tienen respuesta», no «0» y «0 / 4 · %»
export function KpiCard({
  titulo,
  indicador,
  llegaEn,
  cargando,
  error,
  notas,
  a,
  alReintentar,
  anidada,
  cifra,
  detalle
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
  // dentro de una superficie que ya tiene borde, la cifra va sin caja propia: nunca una tarjeta dentro de otra (U-34)
  anidada?: boolean
  // la cifra como se lee (con su unidad) y la línea que dice qué cuenta, en lugar de «n / N · unidad»
  cifra?: (indicador: Indicador & { value: number }) => string
  detalle?: (indicador: Indicador & { value: number }) => ReactNode
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
  else {
    const conValor = indicador as Indicador & { value: number }
    const dicha = cifra ? cifra(conValor) : numeroPe(indicador.value)
    cuerpo = (
      <>
        <p className="text-sg-kpi font-semibold tabular-nums text-sg-text">
          {a ? (
            <Link to={a} aria-label={`${titulo}: ${dicha}`} className="hover:underline">
              {dicha}
            </Link>
          ) : (
            dicha
          )}
        </p>
        <p className="text-sg-caption text-sg-text-muted">
          {detalle ? (
            detalle(conValor)
          ) : (
            <>
              {indicador.numerator !== undefined && indicador.numerator !== null && indicador.denominator
                ? `${numeroPe(indicador.numerator)} / ${numeroPe(indicador.denominator)} · `
                : ''}
              {indicador.unit ?? ''}
            </>
          )}
        </p>
      </>
    )
  }
  return (
    <Seccion etiqueta={titulo} anidada={anidada} className="space-y-1">
      <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{titulo}</h3>
      {cuerpo}
      {notas}
    </Seccion>
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
