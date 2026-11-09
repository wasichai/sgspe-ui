import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// la etiqueta TERRITORIO del lienzo de Civic Modern (.tag.terr, design-system.md §5.3): lo que es del territorio (una ubicación,
// las áreas de influencia), en territory-soft con su borde y el alfiler
export function EtiquetaDeTerritorio() {
  const { t } = useTranslation(NS)
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-sg-md border border-sg-territory-border bg-sg-territory-soft px-2 text-sg-caption font-bold tracking-wide whitespace-nowrap text-sg-territory uppercase">
      <MapPin aria-hidden className="size-3.5" />
      {t('p360.resumen.territorio')}
    </span>
  )
}
