import { Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { unir } from './clases'
import { rotuloDeOpcion } from '../datos/opciones'
import { NS } from '../i18n'

// la situación de plazo de un compromiso, una QCS o una tarea (deadline_status), la de vigencia de un acuerdo (validity_status) y,
// desde F4, la de revisión de un riesgo (review_status): las deriva JOB-01 y nunca son un estado del workflow (RN-WFL-001), así que
// acompañan al chip de estado sin reemplazarlo. el valor se guarda en mayúsculas (ASM-025) y se ve con su rótulo. su forma es la de
// la situación derivada (design-system.md §4.2 y §5.3): sin caja, reloj, versalitas en 800 y subrayado punteado de 2 px del color
// (vencido, por vencer, al día o sin plazo), con el detalle opcional («VENCIDO · 54 DÍAS»). vacío: no se dibuja nada
type Situacion = 'late' | 'soon' | 'ok' | 'neu'
const SITUACION: Record<string, Situacion> = {
  'AL DIA': 'ok',
  VIGENTE: 'ok',
  'POR VENCER': 'soon',
  VENCIDO: 'late',
  'POR REVISAR': 'soon',
  'REVISION VENCIDA': 'late'
}
const COLOR: Record<Situacion, string> = {
  late: 'text-sg-danger',
  soon: 'text-sg-warning',
  ok: 'text-sg-success',
  neu: 'text-sg-text-muted'
}

export function SituacionDePlazo({
  valor,
  vigencia = false,
  revision = false,
  detalle
}: {
  valor: unknown
  vigencia?: boolean
  revision?: boolean
  // lo que precisa la situación: los días («54 días», «vence en 3 días hábiles»)
  detalle?: ReactNode
}) {
  const { t } = useTranslation(NS)
  if (typeof valor !== 'string' || valor === '') return null
  const situacion = Object.hasOwn(SITUACION, valor) ? SITUACION[valor] : 'neu'
  const rotulo = rotuloDeOpcion(valor)
  const conDetalle = typeof detalle === 'string' || typeof detalle === 'number' ? `${rotulo} · ${detalle}` : rotulo
  return (
    <span
      data-situacion={valor}
      aria-label={`${t(revision ? 'comun.situacionDeRevision' : vigencia ? 'comun.situacionDeVigencia' : 'comun.situacionDePlazo')}: ${conDetalle}`}
      className={unir(
        'inline-flex items-center gap-1.25 border-b-2 border-dotted border-current pb-px text-sg-caption leading-4.5 font-extrabold tracking-wide whitespace-nowrap uppercase',
        COLOR[situacion]
      )}
    >
      <Clock aria-hidden className="size-3.5" />
      {rotulo}
      {detalle !== undefined && detalle !== null ? <> · {detalle}</> : null}
    </span>
  )
}
