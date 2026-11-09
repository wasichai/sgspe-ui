import { cn } from '@wasichai/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { NS } from '../i18n'

// una fila de pestañas que no cabe (las de Project 360 en una pantalla mediana) se desplaza en horizontal: un botón a cada lado
// dice que hay más y desplaza, y la pestaña activa (aria-current) se trae a la vista al cambiar de ruta y con cada cambio de la
// fila (las del proyecto llegan con los permisos y sus conteos después, y las ensanchan; U-19), hasta que la persona la
// desplace por su cuenta: desde ahí manda ella, hasta la próxima ruta. con rol «tablist»
// (las pestañas de una ficha, PestanasDeFicha) la fila es una lista de pestañas en lugar de una navegación, y la activa es la
// de aria-selected. con rol «grupo» la fila no es un punto de referencia propio: vive dentro de una navegación que la contiene
// (la navegación local del proyecto, que en tableta es esta fila y en escritorio una columna; filaClassName cambia su forma)
export function PestanasDesplazables({
  etiqueta,
  rol = 'navigation',
  className,
  filaClassName,
  children
}: {
  etiqueta: string
  rol?: 'navigation' | 'tablist' | 'grupo'
  className?: string
  filaClassName?: string
  children: ReactNode
}) {
  const { t } = useTranslation(NS)
  const nav = useRef<HTMLElement & HTMLDivElement>(null)
  const { pathname, search } = useLocation()
  const [hay, setHay] = useState({ antes: false, despues: false })
  const medir = useCallback(() => {
    const el = nav.current
    if (!el) return
    setHay({ antes: el.scrollLeft > 1, despues: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
  }, [])
  useEffect(() => {
    const el = nav.current
    if (!el) return
    // tocada: la persona desplazó la fila (rueda, toque, teclado o los botones); desde ahí la fila no se mueve sola
    let tocada = false
    const tocar = () => {
      tocada = true
    }
    const llevar = () => {
      if (!tocada) el.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
      medir()
    }
    llevar()
    const contenedor = el.parentElement
    const gestos = ['wheel', 'pointerdown', 'touchstart', 'keydown'] as const
    for (const g of gestos) contenedor?.addEventListener(g, tocar, { passive: true })
    const observador = typeof MutationObserver === 'undefined' ? null : new MutationObserver(llevar)
    observador?.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current', 'aria-selected'] })
    el.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    return () => {
      observador?.disconnect()
      for (const g of gestos) contenedor?.removeEventListener(g, tocar)
      el.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
    }
  }, [medir, pathname, search])
  const desplazar = (sentido: 1 | -1) => nav.current?.scrollBy?.({ left: sentido * nav.current.clientWidth * 0.8, behavior: 'smooth' })
  const fila = filaClassName ?? 'flex gap-1 overflow-x-auto border-b border-sg-border [scrollbar-width:none]'
  const boton = 'absolute top-0 bottom-px z-10 flex w-8 items-center justify-center bg-sg-bg text-sg-text-secondary hover:text-sg-text'
  return (
    <div className={cn('relative', className)}>
      {hay.antes ? (
        <button type="button" aria-label={t('comun.pestanasAnteriores')} onClick={() => desplazar(-1)} className={cn(boton, 'left-0')}>
          <ChevronLeft aria-hidden className="size-4" />
        </button>
      ) : null}
      {rol === 'tablist' ? (
        <div ref={nav} role="tablist" aria-label={etiqueta} className={fila}>
          {children}
        </div>
      ) : rol === 'grupo' ? (
        <div ref={nav} className={fila}>
          {children}
        </div>
      ) : (
        <nav ref={nav} aria-label={etiqueta} className={fila}>
          {children}
        </nav>
      )}
      {hay.despues ? (
        <button type="button" aria-label={t('comun.pestanasMas')} onClick={() => desplazar(1)} className={cn(boton, 'right-0')}>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
