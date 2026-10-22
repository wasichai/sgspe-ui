import { cn } from '@wasichai/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { NS } from '../i18n'

// una fila de pestañas que no cabe (las de Project 360 en una pantalla mediana) se desplaza en horizontal: un botón a cada lado
// dice que hay más y desplaza, y la pestaña activa (aria-current) se trae a la vista al cambiar de ruta y cuando aparece
// después (las del proyecto llegan con los permisos; U-19); otro cambio de la fila, como un conteo, no la desplaza. con rol «tablist»
// (las pestañas de una ficha, PestanasDeFicha) la fila es una lista de pestañas en lugar de una navegación, y la activa es la
// de aria-selected
export function PestanasDesplazables({
  etiqueta,
  rol = 'navigation',
  className,
  children
}: {
  etiqueta: string
  rol?: 'navigation' | 'tablist'
  className?: string
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
    // la última activa que se trajo a la vista: solo una activa nueva vuelve a desplazar la fila
    let llevada: Element | null = null
    const llevar = () => {
      const activa = el.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]')
      if (activa && activa !== llevada) activa.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
      llevada = activa
      medir()
    }
    llevar()
    const observador = typeof MutationObserver === 'undefined' ? null : new MutationObserver(llevar)
    observador?.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current', 'aria-selected'] })
    el.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    return () => {
      observador?.disconnect()
      el.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
    }
  }, [medir, pathname, search])
  const desplazar = (sentido: 1 | -1) => nav.current?.scrollBy?.({ left: sentido * nav.current.clientWidth * 0.8, behavior: 'smooth' })
  const fila = 'flex gap-1 overflow-x-auto border-b border-sg-border [scrollbar-width:none]'
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
