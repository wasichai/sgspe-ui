import { cn } from '@wasichai/ui'
import { AlarmClock, CircleAlert, CircleCheck, CircleDashed, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { rotuloDeOpcion } from '../datos/opciones'
import { NS } from '../i18n'
import { CLASE_DE_TONO, type Tono } from './apariencias'

// la situación de plazo de un compromiso, una QCS o una tarea (deadline_status), la de vigencia de un acuerdo (validity_status) y,
// desde F4, la de revisión de un riesgo (review_status): las deriva JOB-01 y nunca son un estado del workflow (RN-WFL-001). el
// valor se guarda en mayúsculas (ASM-025) y se ve con su rótulo («Al día»), con tono e ícono, nunca solo color
// (design-system.md §4.1). vacío fuera de los estados en que JOB-01 la calcula: no se dibuja nada
const APARIENCIA: Record<string, { tono: Tono; Icono: LucideIcon }> = {
  'AL DIA': { tono: 'success', Icono: CircleCheck },
  VIGENTE: { tono: 'success', Icono: CircleCheck },
  'POR VENCER': { tono: 'warning', Icono: AlarmClock },
  VENCIDO: { tono: 'danger', Icono: CircleAlert },
  'POR REVISAR': { tono: 'warning', Icono: AlarmClock },
  'REVISION VENCIDA': { tono: 'danger', Icono: CircleAlert }
}

export function SituacionDePlazo({ valor, vigencia = false, revision = false }: { valor: unknown; vigencia?: boolean; revision?: boolean }) {
  const { t } = useTranslation(NS)
  if (typeof valor !== 'string' || valor === '') return null
  const { tono, Icono } = APARIENCIA[valor] ?? { tono: 'neutral' as Tono, Icono: CircleDashed }
  const rotulo = rotuloDeOpcion(valor)
  return (
    <span
      data-situacion={valor}
      aria-label={`${t(revision ? 'comun.situacionDeRevision' : vigencia ? 'comun.situacionDeVigencia' : 'comun.situacionDePlazo')}: ${rotulo}`}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-sg-sm px-2 py-0.5 text-sg-caption font-medium', CLASE_DE_TONO[tono])}
    >
      <Icono aria-hidden className="size-3.5" />
      {rotulo}
    </span>
  )
}
