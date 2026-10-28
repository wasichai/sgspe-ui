import { useEffect, useState } from 'react'

// la hora que corre en pantalla (tercera pasada de UX, 4.6 y 4.8): «hace N min» en el inicio y en la espera de un borrador

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

// cuántos minutos hace, redondeado hacia abajo; una hora o más, en horas
export function minutosDesde(actualizado: number, ahora: number): number {
  return Math.max(0, Math.floor((ahora - actualizado) / UN_MINUTO))
}
