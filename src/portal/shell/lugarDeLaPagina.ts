import { useEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router'

// el desplazamiento de <main> por entrada del historial (location.key): dura lo que la pestaña del portal
const posiciones = new Map<string, number>()
// cuántos cuadros se espera a que la página nueva se dibuje (los datos llegan después del primer cuadro): unos dos segundos
const CUADROS = 120

// volver de una ficha a la misma lista (tercera pasada de UX, 3.6): «Atrás» devuelve <main> al desplazamiento que tenía esa
// entrada del historial, cuando la página ya tiene el alto para volver; avanzar a otra página la empieza arriba y lleva el foco a
// su título (h1), salvo que la persona ya haya movido el foco. cambiar un filtro (la misma página) no mueve nada
export function useLugarDeLaPagina(main: RefObject<HTMLElement | null>) {
  const ubicacion = useLocation()
  const tipo = useNavigationType()
  const anterior = useRef(ubicacion)
  useEffect(() => {
    const el = main.current
    if (!el) return
    const guardar = () => posiciones.set(ubicacion.key, el.scrollTop)
    el.addEventListener('scroll', guardar, { passive: true })
    return () => el.removeEventListener('scroll', guardar)
  }, [main, ubicacion.key])
  useEffect(() => {
    const previa = anterior.current
    anterior.current = ubicacion
    const el = main.current
    if (!el || previa.key === ubicacion.key) return
    let cuadro = 0
    let intentos = 0
    if (tipo === 'POP') {
      const objetivo = posiciones.get(ubicacion.key)
      if (objetivo === undefined) return
      const volver = () => {
        if (el.scrollHeight - el.clientHeight >= objetivo || intentos++ >= CUADROS) el.scrollTop = objetivo
        else cuadro = requestAnimationFrame(volver)
      }
      volver()
      return () => cancelAnimationFrame(cuadro)
    }
    if (previa.pathname === ubicacion.pathname) return
    el.scrollTop = 0
    const conFoco = document.activeElement
    const enfocar = () => {
      // la persona ya movió el foco (escribe en un campo, abrió un menú): se respeta
      if (document.activeElement !== conFoco && document.activeElement !== document.body) return
      const titulo = el.querySelector('h1')
      if (titulo instanceof HTMLElement) {
        if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1')
        titulo.focus({ preventScroll: true })
      } else if (intentos++ < CUADROS) cuadro = requestAnimationFrame(enfocar)
    }
    cuadro = requestAnimationFrame(enfocar)
    return () => cancelAnimationFrame(cuadro)
    // la entrada del historial manda: tipo y la ruta van con ella
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacion.key])
}
