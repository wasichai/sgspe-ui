import { cn } from '@wasichai/ui'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// un campo con su etiqueta visible y su error enlazado por aria-describedby (design-system.md §3.8 y §7)
export function Campo({
  etiqueta,
  error,
  ayuda,
  children
}: {
  etiqueta: string
  error?: string
  ayuda?: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
}) {
  const id = useId()
  const descripcion = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sg-label font-medium text-sg-text">
        {etiqueta}
      </label>
      {children({ id, 'aria-describedby': descripcion, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className="text-sg-caption text-sg-danger">
          {error}
        </p>
      ) : ayuda ? (
        <p id={`${id}-ayuda`} className="text-sg-caption text-sg-text-muted">
          {ayuda}
        </p>
      ) : null}
    </div>
  )
}

export const CONTROL = 'h-9 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface px-2.5 text-sm text-sg-text'

// un select nativo: accesible, con teclado y fácil de probar; las opciones son los valores ENUM tal como se guardan
export function SelectNativo({
  opciones,
  vacio = true,
  className,
  ...props
}: Omit<React.ComponentProps<'select'>, 'children'> & { opciones: readonly (string | { valor: string; etiqueta: string })[]; vacio?: boolean }) {
  const { t } = useTranslation(NS)
  return (
    <select className={cn(CONTROL, className)} {...props}>
      {vacio ? <option value="">{t('comun.seleccionar')}</option> : null}
      {opciones.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        )
      )}
    </select>
  )
}
