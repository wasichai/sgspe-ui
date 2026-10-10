import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// la nota de una cifra o una lista de QCS que no cuenta las confidenciales que quien mira no lee (confidentialHidden del tablero
// attention, de cada KPI-GRV, de KPI-ENG-05 y del reporte unificado; dashboards.md §8, ASM-095): el servidor solo dice que hay
// exclusión, nunca cuántas, y la nota tampoco. sin exclusión no dibuja nada
export function NotaDeConfidenciales({ oculta }: { oculta: boolean | null | undefined }) {
  const { t } = useTranslation(NS)
  if (oculta !== true) return null
  return (
    <p role="note" className="flex items-start gap-1 text-sg-caption text-sg-text-muted">
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {t('comun.confidencialesOcultas')}
    </p>
  )
}
