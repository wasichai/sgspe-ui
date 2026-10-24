import { useTranslation } from 'react-i18next'
import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate, type LinkProps } from 'react-router'
import { useVistaActual } from '../componentes/Pagina'
import { NS } from '../i18n'
import { ATRIBUTO_DE_FICHA, ATRIBUTO_DE_RESULTADO, fichasDe, useResultado, type EstadoDeNavegacion } from './Origen'

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

// lo que un enlace a una ficha suma dentro del resultado de una lista (ResultadoDeLista, flujo F-C): la marca de ficha, con que el
// resultado reúne sus fichas visibles, y un clic que lleva a la ficha con el origen en el estado del historial (la ruta de la
// lista con sus filtros, su nombre, su conteo y sus fichas). el origen se arma al hacer clic: las fichas son las de la página en
// ese momento, en el orden que se ve. fuera de un resultado, o con un modificador (otra pestaña), el enlace es el de siempre
export function useEnlaceConOrigen(
  ruta: string | undefined,
  estado: EstadoDeNavegacion,
  desde?: string
): { [ATRIBUTO_DE_FICHA]?: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void } {
  const resultado = useResultado()
  const vista = useVistaActual()
  const { pathname, search } = useLocation()
  const navegar = useNavigate()
  const etiqueta = desde || vista
  if (!resultado || !ruta || !etiqueta || ruta.split('?')[0] === pathname) return {}
  return {
    [ATRIBUTO_DE_FICHA]: ruta,
    onClick: (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const contenedor = e.currentTarget.closest(`[${ATRIBUTO_DE_RESULTADO}]`)
      const fichas = resultado.vecinos && contenedor ? fichasDe(contenedor) : []
      e.preventDefault()
      navegar(ruta, { state: { ...estado, origen: { ruta: pathname + search, etiqueta, total: resultado.total, fichas } } })
    }
  }
}

// un enlace a un registro que suma la vista actual al rastro (revisión de UX, etapa 6): el Link de las pantallas que llevan a una
// ficha. un state propio gana. dentro del resultado de una lista, lleva también su origen
export function EnlaceConRastro({ state, onClick, ...props }: LinkProps) {
  const paso = useSiguientePaso()
  const destino = typeof props.to === 'string' ? props.to : undefined
  const estado = state ?? paso(undefined, destino)
  const { onClick: conOrigen, ...marca } = useEnlaceConOrigen(destino, estado as EstadoDeNavegacion)
  return (
    <Link
      {...props}
      {...marca}
      state={estado}
      onClick={(e) => {
        onClick?.(e)
        conOrigen?.(e)
      }}
    />
  )
}
