import { useTranslation } from 'react-i18next'
import { Link, useLocation, type LinkProps } from 'react-router'
import { useVistaActual } from '../componentes/Pagina'
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

// el estado para un Link que agrega la vista actual al rastro. sin etiqueta, la vista se nombra con el título de la página
// (useVistaActual): todo enlace a un registro suma su paso (revisión de UX, etapa 6). un enlace a la misma pantalla (destino) no
// suma nada, y la vista que ya es el último paso no se repite
export function useSiguientePaso(): (etiqueta?: string, destino?: string) => { rastro: Paso[] } {
  const rastro = useRastro()
  const vista = useVistaActual()
  const { pathname, search } = useLocation()
  return (etiqueta, destino) => {
    const ruta = pathname + search
    const nombre = etiqueta || vista
    // la misma pantalla con otra búsqueda (una vista previa, ?peek=) tampoco es un paso
    if (!nombre || destino?.split('?')[0] === pathname || rastro.at(-1)?.ruta === ruta) return { rastro }
    return { rastro: [...rastro, { etiqueta: nombre, ruta }].slice(-8) }
  }
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

// un enlace a un registro que suma la vista actual al rastro (revisión de UX, etapa 6): el Link de las pantallas que llevan a una
// ficha. un state propio gana
export function EnlaceConRastro({ state, ...props }: LinkProps) {
  const paso = useSiguientePaso()
  return <Link {...props} state={state ?? paso(undefined, typeof props.to === 'string' ? props.to : undefined)} />
}
