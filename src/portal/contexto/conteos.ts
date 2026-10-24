import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { useEffect } from 'react'
import { useSumasDeConteos } from '../datos/conteos'
import { usePedir } from '../datos/http'
import type { Parametros } from '../datos/registros'

// los dos conteos de cada pestaña de Project 360 (ux-architecture.md §7.1, decisión 4 de la revisión de UX): el total del alcance
// y lo que pide acción (los vencidos). desde B-03 (wasichai/sgspe#161) llegan en una sola lectura, GET
// /api/sgspe/projects/{id}/counts, con las claves `${pestaña}:${clase}` de CONTEOS: el servidor suma lo mismo que la API
// genérica con size=1, con el alcance de la cuenta, y da null lo que la cuenta no lee. si esa ruta responde 404 (un backend
// anterior) o 5xx, se vuelve a las lecturas de siempre: una por objeto, clase y pestaña, sumadas, y QCS suma sus tres objetos.
// lo que la cuenta no lee no se pide; un conteo que no llegó o falló es null y no se dibuja
interface Fuente {
  objeto: string
  filtros?: Parametros
}
const VENCIDO = { deadline_status: 'VENCIDO' }
const QCS = ['grievance', 'inquiry', 'stakeholder_request']

export const CONTEOS: Record<string, { total: Fuente[]; accion?: Fuente[] }> = {
  stakeholders: { total: [{ objeto: 'stakeholder' }] },
  engagements: { total: [{ objeto: 'engagement' }] },
  commitments: { total: [{ objeto: 'commitment' }], accion: [{ objeto: 'commitment', filtros: VENCIDO }] },
  attention: { total: QCS.map((objeto) => ({ objeto })), accion: QCS.map((objeto) => ({ objeto, filtros: VENCIDO })) },
  risks: { total: [{ objeto: 'social_risk' }] },
  programs: { total: [{ objeto: 'social_program' }] },
  documents: { total: [{ objeto: 'evidence' }] }
}

export interface Conteo {
  total: number | null
  accion: number | null
}

interface ConteosDelServidor {
  counts: Record<string, number | null>
  confidentialHidden: boolean
}

// la raíz de la clave de la lectura única: cualquier escritura la deja vieja
const CLAVE = 'project-counts'

// 404 (la ruta no existe todavía) o 5xx: las lecturas por pestaña siguen sirviendo. otro error (403, 422) no se arregla así
const vuelveALasLecturas = (error: unknown): boolean => error instanceof ApiError && (error.status === 404 || error.status >= 500)

export function useConteosDelProyecto(proyecto: string | undefined, pestanas: readonly string[]): Record<string, Conteo> {
  const { can } = useAuth()
  const pedir = usePedir()
  const cliente = useQueryClient()
  const unica = useQuery({
    queryKey: [CLAVE, proyecto],
    queryFn: () => pedir<ConteosDelServidor>(`/sgspe/projects/${encodeURIComponent(proyecto ?? '')}/counts`),
    enabled: Boolean(proyecto),
    retry: false
  })
  // las lecturas por pestaña compartían la clave de useRegistros y una escritura las invalidaba; la lectura única no es de
  // ningún objeto: se invalida tras cualquier mutación o cuando se invalida una lista de registros
  useEffect(() => {
    const invalidar = () => void cliente.invalidateQueries({ queryKey: [CLAVE] })
    const deMutaciones = cliente.getMutationCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'success') invalidar()
    })
    const deListas = cliente.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'invalidate' && e.query.queryKey[0] === 'records') invalidar()
    })
    return () => {
      deMutaciones()
      deListas()
    }
  }, [cliente])
  const lecturas = unica.isError && vuelveALasLecturas(unica.error)
  const pedidos = lecturas
    ? pestanas.flatMap((pestana) =>
        (['total', 'accion'] as const).flatMap((clase) =>
          (CONTEOS[pestana]?.[clase] ?? [])
            .filter((f) => can(f.objeto, 'READ'))
            .map((f) => ({ clave: `${pestana}:${clase}`, objeto: f.objeto, filtros: { project: proyecto, ...f.filtros } }))
        )
      )
    : []
  const sumas = useSumasDeConteos(pedidos, Boolean(proyecto) && lecturas)
  const conteos: Record<string, number | null | undefined> = lecturas ? sumas : (unica.data?.counts ?? {})
  return Object.fromEntries(pestanas.map((p) => [p, { total: conteos[`${p}:total`] ?? null, accion: conteos[`${p}:accion`] ?? null }]))
}
