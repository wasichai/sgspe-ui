import { cn } from '@wasichai/ui'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { SelectNativo } from './Campo'

// un filtro de una lista con su rótulo a la vista (design-system.md §7: <label> visible en cada campo), como «Estado» en
// Compromisos; sin elegir, dice «Todos»: un filtro vacío no filtra, no pide elegir
export function FiltroDeLista({ etiqueta, className, ...select }: { etiqueta: string } & Omit<ComponentProps<typeof SelectNativo>, 'textoVacio'>) {
  const { t } = useTranslation(NS)
  return (
    <label className={cn('space-y-1 text-sm', className)}>
      <span className="block text-sg-label">{etiqueta}</span>
      <SelectNativo textoVacio={t('comun.todos')} {...select} />
    </label>
  )
}
