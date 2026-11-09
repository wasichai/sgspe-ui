import { cn } from '@wasichai/ui'
import { TriangleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { rotuloDeOpcion } from '../datos/opciones'
import { NS } from '../i18n'

// un campo con su etiqueta visible y su error enlazado por aria-describedby (design-system.md §3.8, §5.3 y §7): el rótulo
// (label, 15 px 700) arriba, la ayuda debajo del rótulo, el error (14,5 px 700 danger con su ícono) entre el rótulo y el control,
// y el control al final, separados 6 px. el control con error lleva el borde de 3 px danger (aria-invalid, ver CONTROL)
// id: el del control, cuando la pantalla lo fija; si no, uno propio
export function Campo({
  etiqueta,
  error,
  ayuda,
  id: idPropio,
  requerido = false,
  enLinea = false,
  children
}: {
  etiqueta: string
  error?: string
  ayuda?: string
  id?: string
  // obligatorio: lo dice al lector de pantalla (aria-required); la etiqueta lo dice con su texto donde la pantalla lo pone
  requerido?: boolean
  // la etiqueta junto al control, en una franja de filtros de una línea (el periodo del mapa): la ayuda queda para el lector de
  // pantalla y el error, debajo
  enLinea?: boolean
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; 'aria-required'?: boolean }) => ReactNode
}) {
  const generado = useId()
  const id = idPropio ?? generado
  // con error, el control lo describe el error, que dice cómo corregir; la ayuda sigue a la vista. sin error, la ayuda
  const descripcion = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined
  return (
    <div className={enLinea ? 'flex flex-wrap items-center gap-x-2 gap-y-1' : 'flex flex-col gap-1.5'}>
      <label htmlFor={id} className="block text-sg-label font-bold text-sg-text">
        {etiqueta}
      </label>
      {ayuda ? (
        <p id={`${id}-ayuda`} className={enLinea ? 'sr-only' : 'text-sg-body-sm text-sg-text-secondary'}>
          {ayuda}
        </p>
      ) : null}
      {/* la región existe antes del error: un lector de pantalla anuncia el error al aparecer (WCAG 4.1.3) */}
      <div aria-live="polite" className="empty:hidden">
        {error ? <MensajeDeError id={`${id}-error`}>{error}</MensajeDeError> : null}
      </div>
      {children({ id, 'aria-describedby': descripcion, 'aria-invalid': error ? true : undefined, 'aria-required': requerido || undefined })}
    </div>
  )
}

// el error de un campo: 14,5 px 700 danger con el ícono de alerta, que no es lo único que lo dice (el texto lo dice)
export function MensajeDeError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sg-table font-bold text-sg-danger">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

// el control de un campo (design-system.md §5.3): 44 px (36 px en la densidad compacta, h-sg-field), relleno de 12 px, borde de
// 2 px border-control, radio 4, surface; con error (aria-invalid), borde de 3 px danger; deshabilitado, hundido y sin cursor
// sin text-sg-text: el control hereda el color (preflight), y cn (tailwind-merge) tomaría text-sg-body por un color y lo quitaría
export const CONTROL = [
  'h-sg-field w-full rounded-sg-md border-2 border-sg-border-control bg-sg-surface px-3 text-sg-body',
  'placeholder:text-sg-text-muted aria-[invalid=true]:border-3 aria-[invalid=true]:border-sg-danger',
  'disabled:cursor-not-allowed disabled:border-sg-border disabled:bg-sg-surface-sunken disabled:text-sg-text-muted'
].join(' ')

// un select nativo: accesible, con teclado y fácil de probar; las opciones son los valores ENUM tal como se guardan
// textoVacio: lo que dice la opción vacía; en un formulario, «Seleccionar…»; en un filtro, «Todos» (FiltroDeLista). conserva el
// chevrón nativo del navegador a la derecha. sinCaja: sin el aspecto de CONTROL, para quien lo pone dentro de su propia caja
// (el chip de un filtro)
export function SelectNativo({
  opciones,
  vacio = true,
  textoVacio,
  sinCaja = false,
  className,
  ...props
}: Omit<React.ComponentProps<'select'>, 'children'> & {
  opciones: readonly (string | { valor: string; etiqueta: string })[]
  vacio?: boolean
  textoVacio?: string
  sinCaja?: boolean
}) {
  const { t } = useTranslation(NS)
  return (
    <select className={sinCaja ? className : cn(CONTROL, className)} {...props}>
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
