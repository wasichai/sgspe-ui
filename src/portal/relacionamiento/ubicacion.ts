import { useRef, useState } from 'react'

// la lectura de la ubicación del teléfono que comparten S26 (observaciones) y el modo rápido de campo de S24: a los 15 s sin
// respuesta se da por fallida (sin plazo, un permiso sin responder o un GPS lento la dejarían esperando para siempre), y una
// posición de hace menos de 30 s sirve para «aquí». mientras espera lo dice y no se repite; una respuesta que llega después de
// otra lectura, o de que la persona escribiera coordenadas (descartar), no cuenta
export const PLAZO_DE_UBICACION = 15_000
export const EDAD_MAXIMA_DE_UBICACION = 30_000

export type Punto = [number, number]

export function useUbicacionDelTelefono() {
  const [ubicando, setUbicando] = useState(false)
  const [sinUbicacion, setSinUbicacion] = useState(false)
  const vigente = useRef(0)
  // alLeer recibe [longitud, latitud]
  const leer = (alLeer: (punto: Punto) => void) => {
    setSinUbicacion(false)
    if (!navigator.geolocation) return setSinUbicacion(true)
    const mia = ++vigente.current
    setUbicando(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (vigente.current !== mia) return
        setUbicando(false)
        alLeer([p.coords.longitude, p.coords.latitude])
      },
      () => {
        if (vigente.current !== mia) return
        setUbicando(false)
        setSinUbicacion(true)
      },
      { timeout: PLAZO_DE_UBICACION, maximumAge: EDAD_MAXIMA_DE_UBICACION, enableHighAccuracy: true }
    )
  }
  // deja sin efecto la lectura en curso
  const descartar = () => {
    vigente.current += 1
    setUbicando(false)
  }
  return { leer, descartar, ubicando, sinUbicacion }
}
