import { createContext, useContext, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import type { Paso } from './Rastro'

// el origen de una ficha (flujo F-C del rediseño de UX, 02-arquitectura-de-informacion §5): la lista de la que se abrió, con sus
// filtros en la ruta, su nombre, el conteo de su resultado si se conoce y las fichas visibles de su página en su orden. va en el
// estado del historial junto al rastro (ASM-075: se comparte el contexto, no el recorrido): una ficha abierta directamente no
// lo tiene. sin fichas (una tarea, la búsqueda), la ficha ofrece «Volver» pero no «Anterior» ni «Siguiente»
export interface Origen {
  ruta: string
  etiqueta: string
  total: number | null
  fichas: string[]
}

export interface EstadoDeNavegacion {
  rastro?: Paso[]
  origen?: Origen
}

// el origen del estado del historial, si tiene la forma esperada: el estado llega de otra entrada y no se da por bueno
export function leerOrigen(estado: unknown): Origen | null {
  const origen = (estado as EstadoDeNavegacion | null)?.origen
  if (!origen || typeof origen !== 'object') return null
  const { ruta, etiqueta, total, fichas } = origen
  if (typeof ruta !== 'string' || !ruta.startsWith('/') || typeof etiqueta !== 'string' || !etiqueta) return null
  return {
    ruta,
    etiqueta,
    total: typeof total === 'number' && Number.isFinite(total) ? total : null,
    fichas: Array.isArray(fichas) ? fichas.filter((f): f is string => typeof f === 'string') : []
  }
}

export function useOrigen(): Origen | null {
  return leerOrigen(useLocation().state)
}

// dónde está la ficha abierta entre las del origen: su camino es el de la ficha o uno de sus hijos, y lleva los parámetros de la
// ficha (?task= de una tarea); los demás (?tab=) no cuentan. -1 si no está
export function indiceDeFicha(fichas: readonly string[], pathname: string, search: string): number {
  const actuales = new URLSearchParams(search)
  return fichas.findIndex((ficha) => {
    const [camino, consulta = ''] = ficha.split('?')
    if (pathname !== camino && !pathname.startsWith(camino.endsWith('/') ? camino : `${camino}/`)) return false
    return [...new URLSearchParams(consulta)].every(([clave, valor]) => actuales.get(clave) === valor)
  })
}

// el estado del historial con otra ficha en lugar de la que se pidió: /r/:object/:recordId salta a la ficha del registro y el
// origen la reconoce por su ruta
export function conFichaReubicada(estado: unknown, pedida: string, ruta: string): unknown {
  const origen = leerOrigen(estado)
  if (!origen) return estado
  return { ...(estado as object), origen: { ...origen, fichas: origen.fichas.map((f) => (f === pedida ? ruta : f)) } }
}

// el resultado de una lista: los enlaces a fichas dentro de él llevan su origen (EnlaceDeRegistro, EnlaceConRastro). con
// vecinos, el origen lleva las fichas visibles en el orden de la página; sin él (el cajón de una tarea), solo «Volver». el
// conteo es el del resultado entero (la vista con sus filtros), no el de la página; sin él, el de un resultado que lo contiene
interface Resultado {
  total: number | null
  vecinos: boolean
}
const ContextoDeResultado = createContext<Resultado | null>(null)

export function useResultado(): Resultado | null {
  return useContext(ContextoDeResultado)
}

export const ATRIBUTO_DE_RESULTADO = 'data-resultado'
export const ATRIBUTO_DE_FICHA = 'data-ficha'

export function ResultadoDeLista({ total, vecinos = true, children }: { total?: number | null; vecinos?: boolean; children: ReactNode }) {
  const contenedor = useResultado()
  const valor: Resultado = { total: total ?? contenedor?.total ?? null, vecinos }
  return (
    <ContextoDeResultado.Provider value={valor}>
      {/* contents: el resultado no cambia la maqueta de la lista */}
      <div {...{ [ATRIBUTO_DE_RESULTADO]: '' }} className="contents">
        {children}
      </div>
    </ContextoDeResultado.Provider>
  )
}

// las fichas visibles de un resultado, en el orden de la página (el que se ve, con su orden por columna) y sin repetir
export function fichasDe(contenedor: Element): string[] {
  const rutas = [...contenedor.querySelectorAll(`a[${ATRIBUTO_DE_FICHA}]`)].map((a) => a.getAttribute(ATRIBUTO_DE_FICHA) ?? '')
  return [...new Set(rutas.filter(Boolean))]
}
