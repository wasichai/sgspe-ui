import { useRef } from 'react'

// el foco al cerrar un diálogo que no se abre con un DialogTrigger (se monta o se abre al pulsar un botón): Radix no sabe a quién
// volver y el foco se perdía en el body (revisión de UX, etapa 8). al abrir se guarda el elemento que tenía el foco (antes de que
// Radix lo lleve adentro) y al cerrar se le devuelve, si sigue en la página
export function useFocoDeRegreso(): { onOpenAutoFocus: () => void; onCloseAutoFocus: (evento: Event) => void } {
  const anterior = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: () => {
      anterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    },
    onCloseAutoFocus: (evento) => {
      const destino = anterior.current
      if (!destino || !destino.isConnected || destino === document.body) return
      evento.preventDefault()
      destino.focus()
    }
  }
}
