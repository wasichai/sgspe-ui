import { cn } from '@wasichai/ui'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { rotuloDeOpcion } from '../datos/opciones'
import { NS } from '../i18n'

// un campo con su etiqueta visible y su error enlazado por aria-describedby (design-system.md §3.8 y §7)
// id: el del control, cuando la pantalla lo fija; si no, uno propio
export function Campo({
  etiqueta,
  error,
  ayuda,
  id: idPropio,
  children
}: {
  etiqueta: string
  error?: string
  ayuda?: string
  id?: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
}) {
  const generado = useId()
  const id = idPropio ?? generado
  const descripcion = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sg-body-sm font-medium text-sg-text">
        {etiqueta}
      </label>
      {children({ id, 'aria-describedby': descripcion, 'aria-invalid': error ? true : undefined })}
      {!error && ayuda ? (
        <p id={`${id}-ayuda`} className="text-sg-caption text-sg-text-muted">
          {ayuda}
        </p>
      ) : null}
      {/* la región existe antes del error: un lector de pantalla anuncia el error al aparecer (WCAG 4.1.3) */}
      <div aria-live="polite">
        {error ? (
          <p id={`${id}-error`} className="text-sg-caption text-sg-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export const CONTROL = 'h-9 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface px-2.5 text-sm text-sg-text'

// un select nativo: accesible, con teclado y fácil de probar; las opciones son los valores ENUM tal como se guardan
// textoVacio: lo que dice la opción vacía; en un formulario, «Seleccionar…»; en un filtro, «Todos» (FiltroDeLista)
export function SelectNativo({
  opciones,
  vacio = true,
  textoVacio,
  className,
  ...props
}: Omit<React.ComponentProps<'select'>, 'children'> & {
  opciones: readonly (string | { valor: string; etiqueta: string })[]
  vacio?: boolean
  textoVacio?: string
}) {
  const { t } = useTranslation(NS)
  return (
    <select className={cn(CONTROL, className)} {...props}>
      {vacio ? <option value="">{textoVacio ?? t('comun.seleccionar')}</option> : null}
      {opciones.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>
            {rotuloDeOpcion(o)}
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
