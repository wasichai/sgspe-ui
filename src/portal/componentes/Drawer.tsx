import { useFocoDeRegreso } from './foco'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import type { ReactNode } from 'react'

// el drawer de design-system.md §5: 560 px para formularios, desde la derecha, reemplazable y no apilable; foco atrapado
// y vuelta al origen al cerrar (Radix). en tableta ocupa la pantalla (screens.md, S20)
export function Drawer({
  titulo,
  descripcion,
  abierto,
  alCerrar,
  children,
  pie
}: {
  titulo: string
  descripcion?: string
  abierto: boolean
  alCerrar: () => void
  children: ReactNode
  pie?: ReactNode
}) {
  // al cerrarse, el foco vuelve a quien lo abrió (revisión de UX, etapa 8)
  const regreso = useFocoDeRegreso()
  return (
    <Dialog open={abierto} onOpenChange={(abrir) => !abrir && alCerrar()}>
      <DialogContent
        {...regreso}
        {...(descripcion ? {} : { 'aria-describedby': undefined })}
        className="left-auto right-0 top-0 flex h-full max-w-[560px] translate-x-0 translate-y-0 flex-col rounded-none rounded-l-sg-xl p-0 lg:max-w-[560px]"
      >
        <div className="border-b border-sg-border px-5 py-4 pr-12">
          <DialogTitle className="text-sg-h3 font-semibold text-sg-text">{titulo}</DialogTitle>
          {descripcion ? <DialogDescription className="text-sm text-sg-text-secondary">{descripcion}</DialogDescription> : null}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {pie ? <div className="flex justify-end gap-2 border-t border-sg-border px-5 py-3">{pie}</div> : null}
      </DialogContent>
    </Dialog>
  )
}
