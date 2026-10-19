import { cn } from '@wasichai/ui'

// la insignia de lo que pide acción (ux-architecture.md §7.1) o de un total (gris): el número se ve y su significado va en un
// elemento oculto que el enlace cita con aria-describedby, para que el nombre del enlace siga siendo el de su sección. sin
// número (null, cero), nada
export function Insignia({
  n,
  id,
  descripcion,
  tono = 'accion',
  className
}: {
  n: number | null | undefined
  id: string
  descripcion: string
  tono?: 'accion' | 'total'
  className?: string
}) {
  if (!n) return null
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'min-w-4 rounded-full px-1 text-center text-sg-overline font-semibold tabular-nums',
          tono === 'accion' ? 'bg-sg-danger text-sg-on-critical' : 'bg-sg-surface-sunken text-sg-text-muted',
          className
        )}
      >
        {n > 99 ? '99+' : n}
      </span>
      <span id={id} hidden>
        {descripcion}
      </span>
    </>
  )
}
