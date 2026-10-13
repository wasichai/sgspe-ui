import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// la marca de procedencia de design-system.md §4.4: fondo violeta, borde discontinuo y chispa, siempre con su texto
export function MarcaDeIa({ clase }: { clase: 'sugerencia' | 'resumen' }) {
  const { t } = useTranslation(NS)
  return (
    <span className="inline-flex items-center gap-1 rounded-sg-md border border-dashed border-sg-ai-border bg-sg-ai-soft px-1.5 text-sg-caption text-sg-ai">
      <Sparkles aria-hidden className="size-3.5" />
      {t(`ia.marcas.${clase}`)}
    </span>
  )
}
