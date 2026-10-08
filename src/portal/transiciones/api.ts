import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePedir } from '../datos/http'
import type { Registro } from '../datos/registros'

// POST /api/sgspe/transition-checks (api.md §4.1): las guardas de SGSPE en seco, sin escribir. cada aviso es
// { code, message, field }: el código es una constante en inglés (WORKING_CRS_REQUIRED, PENDING_QUESTIONS, REASON_REQUIRED…),
// el mensaje viene en español y field es el campo que lo causa (scheduled_at, attended…), el objeto que la regla revisa
// (project_party, engagement_question, engagement_participant, project, area_of_influence), `reason`, `state` o null
export interface Aviso {
  code: string
  message: string
  field: string | null
}

export interface Comprobacion {
  allowed: boolean
  blocking: Aviso[]
  warnings: Aviso[]
}

export function useComprobacion(objeto: string, registroId: string, transicion: string | null) {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['transition-check', objeto, registroId, transicion],
    queryFn: async () => {
      const r = await pedir<Comprobacion>('/sgspe/transition-checks', { json: { object: objeto, recordId: registroId, transition: transicion } })
      return { allowed: r.allowed, blocking: r.blocking ?? [], warnings: r.warnings ?? [] }
    },
    enabled: Boolean(transicion)
  })
}

// aplica una transición por la API genérica con el motivo y la precondición de versión (api.md §2, §3.6, §3.7)
export function useAplicarTransicion(objeto: string) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ registro, transicion, motivo }: { registro: Registro; transicion: string; motivo?: string }) =>
      pedir<Registro>(`/objects/${objeto}/records/${registro.id}/transitions/${transicion}`, { metodo: 'POST', version: registro.updatedAt, motivo }),
    onSuccess: (_r, { registro }) => {
      for (const clave of [
        ['record', objeto, registro.id],
        ['records', objeto],
        ['transitions', objeto, registro.id],
        ['history', objeto, registro.id],
        ['transition-check', objeto, registro.id]
      ])
        void cliente.invalidateQueries({ queryKey: clave })
    }
  })
}
