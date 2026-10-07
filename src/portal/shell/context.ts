import { useMemo } from 'react'
import { useLocation } from 'react-router'

// el contexto del portal vive en la URL (ASM-075, docs/ux/ux-architecture.md §6 y §8): global, o un proyecto bajo
// /projects/:projectId, más un chip de territorio en ?territory=<tipo>:<id>. la misma página de lista o de ficha se monta
// con uno u otro alcance (ASM-076, design-system.md §9). es el gancho de F1: el selector de proyecto y la ContextBar de la
// barra superior llegan en F2 con los proyectos y lo leen de aquí (useContextFilters, screens.md §2)

export type Scope = { kind: 'mine' } | { kind: 'project'; projectId: string }

// lo que puede filtrar el chip de territorio: comunidad, localidad, unidad administrativa o área de influencia
export type TerritoryKind = 'community' | 'locality' | 'admin-unit' | 'area'

export interface TerritoryFilter {
  kind: TerritoryKind
  id: string
}

const TERRITORIOS: readonly string[] = ['community', 'locality', 'admin-unit', 'area']

// /projects/:projectId/… es el alcance de ese proyecto; /projects, /projects/new y cualquier otra ruta, el global
export function scopeFromPath(pathname: string): Scope {
  const match = /^\/projects\/([^/]+)(?:\/|$)/.exec(pathname)
  return match && match[1] !== 'new' ? { kind: 'project', projectId: decodeURIComponent(match[1]) } : { kind: 'mine' }
}

// ?territory=community:<id>; un tipo desconocido o sin identificador no filtra nada
export function territoryFromSearch(search: string): TerritoryFilter | null {
  const value = new URLSearchParams(search).get('territory')
  const at = value?.indexOf(':') ?? -1
  if (!value || at < 1 || at === value.length - 1) return null
  const kind = value.slice(0, at)
  return TERRITORIOS.includes(kind) ? { kind: kind as TerritoryKind, id: value.slice(at + 1) } : null
}

export function useContextFilters(): { scope: Scope; territory: TerritoryFilter | null } {
  const { pathname, search } = useLocation()
  return useMemo(() => ({ scope: scopeFromPath(pathname), territory: territoryFromSearch(search) }), [pathname, search])
}
