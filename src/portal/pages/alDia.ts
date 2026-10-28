import { useEffect, useRef, useState } from 'react'

// el inicio se mantiene al día (tercera pasada de UX, 4.8): la persona deja la pestaña abierta toda la mañana y vuelve a ella.
// el portal no relee al volver a la pestaña (refetchOnWindowFocus de wasichai está apagado), así que lo de «Lo que me toca hoy»
// se relee aquí si lo leído tiene más de un minuto, y la sección dice cuánto hace que se leyó

export const UN_MINUTO = 60_000

// la hora de ahora, que cambia cada minuto y al volver a la pestaña: así «hace N min» no se queda quieto
export function useAhora(): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const cada = setInterval(() => setAhora(Date.now()), UN_MINUTO)
    const alVolver = () => {
      if (document.visibilityState === 'visible') setAhora(Date.now())
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(cada)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])
  return ahora
}

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

// cuántos minutos hace, redondeado hacia abajo; una hora o más, en horas
export function minutosDesde(actualizado: number, ahora: number): number {
  return Math.max(0, Math.floor((ahora - actualizado) / UN_MINUTO))
}
