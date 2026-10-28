import { useFocoDeRegreso } from './foco'
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el drawer de design-system.md §5: 560 px para formularios, desde la derecha, reemplazable y no apilable; foco atrapado
// y vuelta al origen al cerrar (Radix). en tableta ocupa la pantalla (screens.md, S20). con algo escrito, cerrarlo por Esc, la X o un
// clic fuera pide confirmar (tercera pasada de UX, 2.1; DD-36): lo escrito se marca solo (todo control que cambia dispara input o
// change, que burbujean) y un guardado que salió bien lo limpia (useMarcarGuardado: FormularioDeRegistro lo llama solo; enviar no
// basta, porque el envío puede no pasar la validación); conCambios de la pantalla manda sobre lo detectado. lo que la pantalla
// cierra por su cuenta (Cancelar, Guardar) no pregunta, y mientras guarda (ocupado) no se cierra
const ContextoDelCajon = createContext<(() => void) | null>(null)

// para lo que guarda dentro de un cajón que sigue abierto (un ítem más): lo guardado ya no se pierde al cerrarlo
export const useMarcarGuardado = (): (() => void) | null => useContext(ContextoDelCajon)

export function Drawer({
  titulo,
  descripcion,
  abierto,
  alCerrar,
  children,
  pie,
  conCambios,
  ocupado = false
}: {
  titulo: string
  descripcion?: string
  abierto: boolean
  alCerrar: () => void
  children: ReactNode
  pie?: ReactNode
  conCambios?: boolean
  ocupado?: boolean
}) {
  const { t } = useTranslation(NS)
  // al cerrarse, el foco vuelve a quien lo abrió (revisión de UX, etapa 8)
  const regreso = useFocoDeRegreso()
  const [tocado, setTocado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  // abrirlo o cerrarlo empieza limpio
  const [abiertoAntes, setAbiertoAntes] = useState(abierto)
  if (abiertoAntes !== abierto) {
    setAbiertoAntes(abierto)
    setTocado(false)
    setConfirmando(false)
  }
  const pedirCierre = () => {
    if (ocupado) return
    if (conCambios ?? tocado) setConfirmando(true)
    else alCerrar()
  }
  return (
    <>
      <Dialog open={abierto} onOpenChange={(abrir) => !abrir && pedirCierre()}>
        <DialogContent
          {...regreso}
          {...(descripcion ? {} : { 'aria-describedby': undefined })}
          onInput={() => setTocado(true)}
          onChange={() => setTocado(true)}
          className="left-auto right-0 top-0 flex h-full max-w-[560px] translate-x-0 translate-y-0 flex-col rounded-none rounded-l-sg-xl p-0 lg:max-w-[560px]"
        >
          <div className="border-b border-sg-border px-5 py-4 pr-12">
            <DialogTitle className="text-sg-h3 font-semibold text-sg-text">{titulo}</DialogTitle>
            {descripcion ? <DialogDescription className="text-sm text-sg-text-secondary">{descripcion}</DialogDescription> : null}
          </div>
          {/* data-cajon: las acciones de un formulario largo quedan fijas al pie del área que se desplaza (index.css) */}
          <div data-cajon className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <ContextoDelCajon.Provider value={() => setTocado(false)}>{children}</ContextoDelCajon.Provider>
          </div>
          {pie ? <div className="flex justify-end gap-2 border-t border-sg-border px-5 py-3">{pie}</div> : null}
        </DialogContent>
      </Dialog>
      {confirmando ? (
        <ConfirmDialog
          title={t('paginas.cajon.descartarTitulo')}
          description={t('paginas.cajon.descartarTexto')}
          confirmLabel={t('paginas.cajon.descartar')}
          cancelLabel={t('paginas.cajon.seguir')}
          variant="danger"
          onConfirm={() => {
            setConfirmando(false)
            alCerrar()
          }}
          onCancel={() => setConfirmando(false)}
        />
      ) : null}
    </>
  )
}
