import { useQueries } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { consulta, type Pagina, type Parametros } from '../datos/registros'
import { usePedir } from '../datos/http'

// los dos conteos de cada pestaña de Project 360 (ux-architecture.md §7.1, decisión 4 de la revisión de UX): el total del alcance
// y lo que pide acción (los vencidos), cada uno con size=1 y totalElements de la API genérica, por objeto y con el proyecto.
// QCS suma sus tres objetos. lo que la cuenta no lee no se pide; un conteo que no llegó o falló es null y no se dibuja
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

export function useConteosDelProyecto(proyecto: string | undefined, pestanas: readonly string[]): Record<string, Conteo> {
  const { can } = useAuth()
  const pedir = usePedir()
  const pedidos = pestanas.flatMap((pestana) =>
    (['total', 'accion'] as const).flatMap((clase) =>
      (CONTEOS[pestana]?.[clase] ?? []).filter((f) => can(f.objeto, 'READ')).map((f) => ({ pestana, clase, ...f }))
    )
  )
  const respuestas = useQueries({
    queries: pedidos.map(({ objeto, filtros }) => {
      const busqueda = consulta({ project: proyecto, ...filtros, size: 1 })
      return {
        queryKey: ['records', objeto, busqueda],
        queryFn: () => pedir<Pagina>(`/objects/${objeto}/records?${busqueda}`),
        enabled: Boolean(proyecto)
      }
    })
  })
  // una suma con una parte que falta (una de las tres QCS no llegó) engañaría: entonces null
  const sumas: Record<string, Record<'total' | 'accion', number | null | undefined>> = {}
  pedidos.forEach(({ pestana, clase }, i) => {
    const n = respuestas[i].data?.totalElements
    const suma = (sumas[pestana] ??= { total: undefined, accion: undefined })
    suma[clase] = n == null || suma[clase] === null ? null : (suma[clase] ?? 0) + n
  })
  return Object.fromEntries(Object.entries(sumas).map(([p, s]) => [p, { total: s.total ?? null, accion: s.accion ?? null }]))
}
