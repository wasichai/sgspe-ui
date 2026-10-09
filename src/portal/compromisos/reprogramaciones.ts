import { useQueryClient } from '@tanstack/react-query'
import { useComando } from '../datos/comandos'
import type { Registro } from '../datos/registros'

// POST /api/sgspe/commitments/{id}/reschedules (api.md §4.5, RF-COM-003): crea la commitment_reschedule inmutable y cambia
// due_date en una transacción, solo en approved, in_progress o blocked. IK, IM (la versión del compromiso) y CR. responde
// { reschedule, commitment }: el compromiso vuelve con su versión nueva y su deadline_status recalculado (un vencido
// reprogramado vuelve AL DIA) y queda en la caché de su ficha, sin esperar otra lectura
export interface Reprogramado {
  reschedule: Registro
  commitment: Registro
}

export const ESTADOS_REPROGRAMABLES: readonly string[] = ['approved', 'in_progress', 'blocked']

export function useReprogramar(compromiso: Registro) {
  const cliente = useQueryClient()
  const comando = useComando<Reprogramado, { nueva: string; motivo: string; acordada: boolean }>(
    ({ nueva, motivo, acordada }) => ({
      ruta: `/sgspe/commitments/${compromiso.id}/reschedules`,
      json: { attributes: { new_due_date: nueva, reschedule_reason: motivo, agreed_with_stakeholder: acordada } },
      version: compromiso.updatedAt,
      motivo
    }),
    {
      invalidar: (r) => {
        cliente.setQueryData(['record', 'commitment', compromiso.id], r.commitment)
        return [
          ['records', 'commitment_reschedule'],
          ['records', 'commitment'],
          ['history', 'commitment', compromiso.id]
        ]
      }
    }
  )
  return comando
}
