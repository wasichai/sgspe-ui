import { useEffect, useRef } from 'react'
import { UN_MINUTO } from '../componentes/ahora'

// el inicio se mantiene al día (tercera pasada de UX, 4.8): la persona deja la pestaña abierta toda la mañana y vuelve a ella.
// el portal no relee al volver a la pestaña (refetchOnWindowFocus de wasichai está apagado), así que lo de «Lo que me toca hoy»
// se relee aquí si lo leído tiene más de un minuto, y la sección dice cuánto hace que se leyó

// relee al volver a la pestaña si lo leído tiene más de un minuto; la última releer y la última hora, sin volver a suscribirse
export function useReleerAlVolver(releer: () => void, actualizado: number | null) {
  const ultima = useRef({ releer, actualizado })
  useEffect(() => {
    ultima.current = { releer, actualizado }
  })
  useEffect(() => {
    const alVolver = () => {
      const { releer: ahoraReleer, actualizado: cuando } = ultima.current
      if (document.visibilityState === 'visible' && cuando !== null && Date.now() - cuando > UN_MINUTO) ahoraReleer()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [])
}
