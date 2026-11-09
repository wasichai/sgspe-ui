import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// la marca de procedencia de design-system.md §4.4 y §5.3, siempre con su texto y la chispa. como etiqueta (SUGERENCIA IA): 24 px,
// 12,5 px 700 MAYÚSCULAS, borde discontinuo de 1,5 px ai-border sobre ai-soft. como encabezado de un bloque de IA (.ai-h del
// lienzo): sin caja, en ai 12,5 px 800 MAYÚSCULAS, con el aviso de que es una propuesta que se verifica antes de usar
// el aviso del encabezado: «verifique antes de usar» o, en un entregable, «no es parte del informe» hasta que una persona lo adopte
export function MarcaDeIa({
  clase,
  forma = 'etiqueta',
  aviso = 'verifique',
  pendiente = false
}: {
  clase: 'sugerencia' | 'resumen'
  forma?: 'etiqueta' | 'encabezado'
  aviso?: 'verifique' | 'noEsDelInforme'
  // la etiqueta de algo que espera una decisión («Sugerencia de IA pendiente», la cabecera de una sección de S50)
  pendiente?: boolean
}) {
  const { t } = useTranslation(NS)
  if (forma === 'encabezado')
    return (
      <p data-marca-de-ia className="flex items-start gap-2 text-sg-caption font-extrabold uppercase tracking-[0.06em] text-sg-ai">
        <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {/* una frase: en una columna angosta se parte como texto, no en dos columnas */}
        <span>
          <span>{t(`ia.marcas.${clase}`)}</span> <span>· {t(`ia.marcas.${aviso}`)}</span>
        </span>
      </p>
    )
  return (
    <span
      data-marca-de-ia
      className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-sg-md border-[1.5px] border-dashed border-sg-ai-border bg-sg-ai-soft px-1.75 text-sg-caption font-bold uppercase tracking-[0.03em] text-sg-ai"
    >
      <Sparkles aria-hidden className="size-3.5" />
      {t(`ia.marcas.${clase}`)}
      {pendiente ? <span className="font-semibold normal-case tracking-normal">{t('ia.marcas.pendiente')}</span> : null}
    </span>
  )
}

// el bloque de IA de design-system.md §5.3 (.ai-box del lienzo): todo lo que propone la IA va en una caja con borde discontinuo
// de 2 px ai-border sobre ai-soft, radio 4 y relleno de 14 × 16 px; nunca se mezcla con un dato registrado
export const CAJA_DE_IA = 'rounded-sg-md border-2 border-dashed border-sg-ai-border bg-sg-ai-soft px-4 py-3.5'
