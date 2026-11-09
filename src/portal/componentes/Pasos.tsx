import { cn } from '@wasichai/ui'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el StepIndicator de design-system.md §5.3 («Pasos») y §6.3: una fila de segmentos iguales con un borde superior de 4 px; hecho
// en progress con el número en un círculo de 24 px relleno y el check, actual en primary y 800, pendiente en border. «Paso n de
// N» arriba en pantallas chicas, donde la fila no cabe. se puede volver a cualquier paso ya visitado
export function Pasos({ pasos, actual, visitados, alIr }: { pasos: string[]; actual: number; visitados: number; alIr?: (indice: number) => void }) {
  const { t } = useTranslation(NS)
  return (
    <nav aria-label={t('comun.pasos')}>
      <p className="text-sg-body-sm font-bold text-sg-text-secondary lg:hidden">{t('comun.paso', { actual: actual + 1, total: pasos.length })}</p>
      <ol className="hidden lg:flex">
        {pasos.map((paso, i) => {
          const hecho = i < actual
          const esActual = i === actual
          const alcanzable = i <= visitados && !esActual
          return (
            <li key={paso} className={cn('min-w-0 flex-1 border-t-4', hecho ? 'border-sg-progress' : esActual ? 'border-sg-primary' : 'border-sg-border')}>
              <button
                type="button"
                disabled={!alcanzable || !alIr}
                aria-current={esActual ? 'step' : undefined}
                onClick={() => alIr?.(i)}
                className={cn(
                  'flex w-full items-center gap-2 py-2 pr-3 text-left text-sm leading-4.5 disabled:cursor-default',
                  hecho ? 'font-semibold text-sg-text' : esActual ? 'font-extrabold text-sg-primary-text' : 'font-semibold text-sg-text-secondary',
                  alcanzable && alIr ? 'hover:underline' : undefined
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold',
                    hecho
                      ? 'border-sg-progress bg-sg-progress text-sg-surface'
                      : esActual
                        ? 'border-sg-primary bg-sg-primary text-sg-on-primary'
                        : 'border-current'
                  )}
                >
                  {hecho ? <Check aria-hidden strokeWidth={3} className="size-3.5" /> : i + 1}
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
