import { cn } from '@wasichai/ui'
import { ChevronDown } from 'lucide-react'
import { createContext, useContext, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { SelectNativo } from './Campo'

// dónde se dibuja un filtro: como chip en la fila de la barra de filtros (BarraDeFiltros lo pone a sus frecuentes) o como campo
// con su rótulo encima (el drawer de «Más filtros», una pantalla que lo usa suelto)
export const FormaDelFiltro = createContext<'chip' | 'campo'>('campo')

// un filtro de una lista con su rótulo a la vista (design-system.md §7: <label> visible en cada campo), como «Estado» en
// Compromisos; sin elegir, dice «Todos»: un filtro vacío no filtra, no pide elegir. en la barra es un chip de 32 px (§5.3,
// «Barra de filtros y chips»): «Estado: Todos ▾», con el rótulo dentro y el select nativo (el teclado y el lector de pantalla
// del navegador) sin su caja; aplicado, borde de 2 px primary sobre primary-soft y el valor en 700. los dos puntos los pone el
// CSS: el nombre accesible sigue siendo el rótulo
export function FiltroDeLista({ etiqueta, className, ...select }: { etiqueta: string } & Omit<ComponentProps<typeof SelectNativo>, 'textoVacio'>) {
  const { t } = useTranslation(NS)
  const forma = useContext(FormaDelFiltro)
  if (forma === 'chip') {
    const aplicado = select.value != null && select.value !== ''
    return (
      <label
        className={cn(
          'relative inline-flex h-8 max-w-full items-center rounded-sg-md text-sm whitespace-nowrap',
          aplicado ? 'border-2 border-sg-primary bg-sg-primary-soft' : 'border border-sg-border-strong bg-sg-surface hover:bg-sg-surface-hover',
          className
        )}
      >
        <span className="pl-2.5 after:content-[':']">{etiqueta}</span>
        <SelectNativo
          textoVacio={t('comun.todos')}
          sinCaja
          className={cn('h-full min-w-0 cursor-pointer appearance-none bg-transparent pr-7 pl-1.5', aplicado && 'font-bold')}
          {...select}
        />
        <ChevronDown aria-hidden className="pointer-events-none absolute right-2 size-4 text-sg-text-secondary" />
      </label>
    )
  }
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="block text-sg-label font-bold">{etiqueta}</span>
      <SelectNativo textoVacio={t('comun.todos')} {...select} />
    </label>
  )
}
