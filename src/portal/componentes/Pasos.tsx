import { cn } from '@wasichai/ui'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el StepIndicator de design-system.md §5 y §6.3: lateral en escritorio, "Paso n de N" arriba en pantallas chicas; se
// puede volver a cualquier paso ya visitado
export function Pasos({ pasos, actual, visitados, alIr }: { pasos: string[]; actual: number; visitados: number; alIr?: (indice: number) => void }) {
  const { t } = useTranslation(NS)
  return (
    <nav aria-label={t('comun.pasos')}>
      <p className="text-sm text-sg-text-muted lg:hidden">{t('comun.paso', { actual: actual + 1, total: pasos.length })}</p>
      <ol className="hidden space-y-1 lg:block">
        {pasos.map((paso, i) => {
          const hecho = i < actual
          const alcanzable = i <= visitados && i !== actual
          return (
            <li key={paso}>
              <button
                type="button"
                disabled={!alcanzable || !alIr}
                aria-current={i === actual ? 'step' : undefined}
                onClick={() => alIr?.(i)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sg-md px-2.5 py-2 text-left text-sm',
                  i === actual ? 'bg-sg-primary-soft font-medium text-sg-primary-text' : 'text-sg-text-secondary',
                  alcanzable ? 'hover:bg-sg-surface-hover' : 'cursor-default'
                )}
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-sg-border-strong text-sg-caption">
                  {hecho ? <Check aria-hidden className="size-3" /> : i + 1}
                </span>
                {paso}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
