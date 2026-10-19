import { cn } from '@wasichai/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { NS } from '../i18n'

// una fila de pestañas que no cabe (las de Project 360 en una pantalla mediana) se desplaza en horizontal: un botón a cada lado
// dice que hay más y desplaza, y la pestaña activa (aria-current) se trae a la vista al cambiar de ruta
export function PestanasDesplazables({ etiqueta, className, children }: { etiqueta: string; className?: string; children: ReactNode }) {
  const { t } = useTranslation(NS)
  const nav = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const [hay, setHay] = useState({ antes: false, despues: false })
  const medir = useCallback(() => {
    const el = nav.current
    if (!el) return
    setHay({ antes: el.scrollLeft > 1, despues: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
  }, [])
  useEffect(() => {
    const el = nav.current
    if (!el) return
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    return () => {
      el.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
    }
  }, [medir, pathname])
  const desplazar = (sentido: 1 | -1) => nav.current?.scrollBy?.({ left: sentido * nav.current.clientWidth * 0.8, behavior: 'smooth' })
  const boton = 'absolute top-0 bottom-px z-10 flex w-8 items-center justify-center bg-sg-bg text-sg-text-secondary hover:text-sg-text'
  return (
    <div className={cn('relative', className)}>
      {hay.antes ? (
        <button type="button" aria-label={t('comun.pestanasAnteriores')} onClick={() => desplazar(-1)} className={cn(boton, 'left-0')}>
          <ChevronLeft aria-hidden className="size-4" />
        </button>
      ) : null}
      <nav ref={nav} aria-label={etiqueta} className="flex gap-1 overflow-x-auto border-b border-sg-border [scrollbar-width:none]">
        {children}
      </nav>
      {hay.despues ? (
        <button type="button" aria-label={t('comun.pestanasMas')} onClick={() => desplazar(1)} className={cn(boton, 'right-0')}>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
