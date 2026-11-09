import { Link } from 'react-router'
import { ApiError } from '@wasichai/core'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@wasichai/ui'
import { createContext, useContext, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Indicador } from '../datos/indicadores'
import { fechaYHoraPe, NS, numeroPe } from '../i18n'
import { Cargando, NoDisponible } from './Estados'
import { correlacionDe, useMensajeDeError } from './errores'
import { useDentroDeSeccion } from './Seccion'

// la fila de cifras de Civic Modern (design-system.md §5.3 «KPI», .kpis del lienzo): las cifras en una sola caja con borde de
// 1 px y separadores de 1 px, no tarjetas sueltas. cada celda ocupa lo que le toca y la fila se parte en el teléfono; los
// separadores son el borde derecho e inferior de cada celda, y la caja recorta los del borde (margen de -1 px y overflow
// oculto), así una fila incompleta no deja huecos. calculadoEn, la hora de cálculo del tablero (computedAt), al pie si existe
// columnas: 4 reparte las celdas en cuartos desde xl (las ocho cifras de la revisión ejecutiva en dos filas de cuatro, S03); sin
// columnas, cada celda ocupa lo que le toca
const EnRejilla = createContext<false | 'libre' | 4>(false)
const BASE_DE_CELDA = { libre: 'flex-1 basis-40', 4: 'basis-full sm:basis-1/2 xl:basis-1/4' } as const

// etiqueta: el nombre del grupo, si la región que lo contiene no lo nombra ya
export function RejillaDeKpi({
  etiqueta,
  calculadoEn,
  columnas,
  className,
  children
}: {
  etiqueta?: string
  calculadoEn?: string
  columnas?: 4
  className?: string
  children: ReactNode
}) {
  const { t } = useTranslation(NS)
  const instante = calculadoEn ? new Date(calculadoEn) : null
  return (
    <div className={cn('space-y-1', className)}>
      <div
        role={etiqueta ? 'group' : undefined}
        aria-label={etiqueta}
        className="flex flex-wrap overflow-hidden rounded-sg-md border border-sg-border bg-sg-surface"
      >
        <EnRejilla.Provider value={columnas ?? 'libre'}>{children}</EnRejilla.Provider>
      </div>
      {instante && !Number.isNaN(instante.getTime()) ? (
        <p className="text-sg-caption text-sg-text-muted">{t('tableros.calculado', { fecha: fechaYHoraPe(instante) })}</p>
      ) : null}
    </div>
  )
}

// las clases enteras, para que Tailwind las vea: la celda de una rejilla, la cifra sola con su caja y la que va dentro de otra
// superficie sin caja (nunca una tarjeta dentro de otra, U-34). relleno de 14 × 18 px
const CELDA = 'flex min-w-0 flex-col gap-1 -mr-px -mb-px border-r border-b border-sg-border px-4.5 py-3.5'
const SOLA = 'flex min-w-0 flex-col gap-1 rounded-sg-md border border-sg-border bg-sg-surface px-4.5 py-3.5'
const SIN_CAJA = 'flex min-w-0 flex-col gap-1'
const TONO_DE_CIFRA = { danger: 'text-sg-danger', warning: 'text-sg-warning' } as const

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
  detalle,
  tono,
  codigo,
  meta
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
  // la cifra en danger o warning, solo cuando el rótulo ya dice que es lo vencido o lo por vencer: lo decide la pantalla
  tono?: 'danger' | 'warning'
  // el código del indicador, en la monoespaciada, si la pantalla lo muestra (el catálogo lo nombra; las demás, por su rótulo)
  codigo?: string
  // la meta del periodo (S03): «63 de 70 (meta)», el avance en un medidor y lo que falta; sin meta (null) no se dice nada
  meta?: number | null
}) {
  const { t } = useTranslation(NS)
  const enRejilla = useContext(EnRejilla)
  const dentro = useDentroDeSeccion()
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
    // sin cifra propia, un porcentaje lleva su signo junto a la cifra y debajo su base, «n de N» (rediseño de UX, 2026-10-20: se
    // leía «0 / 1 · %»); otra unidad («QCS», «compromisos») va debajo
    const porcentaje = indicador.unit === '%'
    const dicha = cifra ? cifra(conValor) : `${numeroPe(indicador.value)}${porcentaje ? ' %' : ''}`
    const base =
      porcentaje && indicador.numerator !== undefined && indicador.numerator !== null && indicador.denominator
        ? t('comun.nDeN', { n: numeroPe(indicador.numerator), total: numeroPe(indicador.denominator) })
        : ''
    const dibujada =
      porcentaje && !cifra ? (
        <>
          <span>{numeroPe(indicador.value)}</span>
          <span className="text-sg-h3"> %</span>
        </>
      ) : (
        dicha
      )
    cuerpo = (
      <>
        {/* sin cn: tailwind-merge confunde el tamaño text-sg-kpi con un color y lo quitaría */}
        <p className={`text-sg-kpi tabular-nums ${tono ? TONO_DE_CIFRA[tono] : 'text-sg-text'}`}>
          {a ? (
            <Link to={a} aria-label={`${titulo}: ${dicha}`} className="hover:underline">
              {dibujada}
            </Link>
          ) : (
            dibujada
          )}
          {conMeta(meta) ? (
            <span className="ml-1.5 text-sg-body-sm font-semibold text-sg-text-secondary">{t('tableros.deMeta', { meta: numeroPe(meta) })}</span>
          ) : null}
        </p>
        {conMeta(meta) ? (
          <MetaDeLaCifra valor={indicador.value} meta={meta} />
        ) : (
          <p className="text-sg-body-sm text-sg-text-muted">{detalle ? detalle(conValor) : porcentaje ? base : (indicador.unit ?? '')}</p>
        )}
      </>
    )
  }
  return (
    <section aria-label={titulo} className={enRejilla ? `${CELDA} ${BASE_DE_CELDA[enRejilla]}` : anidada || dentro ? SIN_CAJA : SOLA}>
      {/* el código del indicador junto al rótulo, en la monoespaciada de 11,5 px (design-system.md §5.3 «KPI») */}
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <h3 className="text-sm font-semibold text-sg-text-secondary">{titulo}</h3>
        {codigo ? <span className="font-sg-mono text-[11.5px] text-sg-text-muted">{codigo}</span> : null}
      </div>
      {cuerpo}
      {notas}
    </section>
  )
}

const conMeta = (meta: number | null | undefined): meta is number => typeof meta === 'number' && Number.isFinite(meta) && meta > 0

// el avance frente a la meta: un medidor de 8 px (el relleno, hasta el 100 %) y «90 % de la meta · faltan 7»
function MetaDeLaCifra({ valor, meta }: { valor: number; meta: number }) {
  const { t } = useTranslation(NS)
  const porcentaje = Math.round((valor / meta) * 1000) / 10
  const diferencia = valor - meta
  const avance = t('tableros.avanceDeMeta', { porcentaje: numeroPe(porcentaje) })
  return (
    <>
      <div
        role="progressbar"
        aria-label={avance}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, porcentaje)}
        className="h-2 overflow-hidden rounded-sg-xs border border-sg-border-strong bg-sg-surface-sunken"
      >
        <div className="h-full bg-sg-primary" style={{ width: `${Math.min(100, porcentaje)}%` }} />
      </div>
      <p className="text-sg-body-sm text-sg-text-muted">
        {diferencia === 0
          ? avance
          : t('tableros.diferenciaDeMeta', {
              porcentaje: numeroPe(porcentaje),
              diferencia: diferencia < 0 ? t('tableros.faltan', { n: numeroPe(-diferencia) }) : t('tableros.sobran', { n: numeroPe(diferencia) })
            })}
      </p>
    </>
  )
}

// la meta del periodo de un indicador: la del último punto de su serie que la trae (dashboards.md §9.2); sin serie ni meta, null
export function metaDelPeriodo(indicador: Indicador | undefined): number | null {
  const punto = [...(indicador?.series ?? [])].reverse().find((p) => typeof p.target === 'number')
  return punto?.target ?? null
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
