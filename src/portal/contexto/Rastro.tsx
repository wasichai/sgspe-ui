import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { NS } from '../i18n'

// el rastro de ux-architecture.md §8.1: lo recorrido en esta sesión (Mapa · CC Tunas Pampa › Junta directiva › …). vive
// en el estado del historial, no en la URL: se comparte el contexto, no el recorrido. aparece con más de un salto
export interface Paso {
  etiqueta: string
  ruta: string
}

export function useRastro(): Paso[] {
  const { state } = useLocation()
  const rastro = (state as { rastro?: Paso[] } | null)?.rastro
  return Array.isArray(rastro) ? rastro : []
}

// el estado para un Link que agrega la vista actual al rastro
export function useSiguientePaso(): (etiqueta: string) => { rastro: Paso[] } {
  const rastro = useRastro()
  const { pathname, search } = useLocation()
  return (etiqueta) => ({ rastro: [...rastro, { etiqueta, ruta: pathname + search }].slice(-8) })
}

export function Rastro() {
  const { t } = useTranslation(NS)
  const rastro = useRastro()
  if (rastro.length === 0) return null
  return (
    <nav aria-label={t('contexto.rastro')} className="text-sg-caption text-sg-text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {rastro.map((paso, i) => (
          <li key={`${paso.ruta}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <span aria-hidden>›</span> : null}
            <Link to={paso.ruta} state={{ rastro: rastro.slice(0, i) }} className="underline">
              {paso.etiqueta}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}
