import { useQueryClient } from '@tanstack/react-query'
import { useComando } from '../datos/comandos'
import type { Registro } from '../datos/registros'

// las entregas de un compromiso (api.md §4.5, RF-COM-008): registrar solo captura datos y recalcula executed_amount, sin
// cambiar el estado (POST …/deliveries: IK y CR, con las evidencias ya subidas en `evidence`); corregir es PATCH
// /api/sgspe/deliveries/{id} con IM y CR, y con el compromiso cumplido o cancelado responde 409 DELIVERY_FROZEN (P55). los dos responden
// { delivery, commitment }: el compromiso, con su ejecutado nuevo, queda en la caché de su ficha
export interface Entregado {
  delivery: Registro
  commitment: Registro
}

// los estados en que se registra una entrega: en ejecución (fuera de ellos, 409 STATE_MISMATCH)
export const ESTADOS_DE_EJECUCION: readonly string[] = ['approved', 'in_progress', 'blocked']
// los estados en que las entregas ya no cambian (DELIVERY_FROZEN): cumplido, y cancelado porque es final (P55)
export const ESTADOS_CONGELADOS: readonly string[] = ['fulfilled', 'verified', 'closed', 'cancelled']

const invalidar = (cliente: ReturnType<typeof useQueryClient>, compromiso: string) => (r: Entregado) => {
  cliente.setQueryData(['record', 'commitment', compromiso], r.commitment)
  return [
    ['records', 'delivery'],
    ['records', 'commitment'],
    ['related'],
    ['history', 'commitment', compromiso],
    ['transition-check', 'commitment', compromiso]
  ]
}

export function useRegistrarEntrega(compromiso: string) {
  const cliente = useQueryClient()
  return useComando<Entregado, { atributos: Record<string, unknown>; evidencias: string[]; motivo: string }>(
    ({ atributos, evidencias, motivo }) => ({
      ruta: `/sgspe/commitments/${compromiso}/deliveries`,
      json: { attributes: atributos, ...(evidencias.length > 0 ? { evidence: evidencias } : {}) },
      motivo
    }),
    { invalidar: invalidar(cliente, compromiso) }
  )
}

export function useCorregirEntrega(compromiso: string) {
  const cliente = useQueryClient()
  return useComando<Entregado, { entrega: Registro; cambios: Record<string, unknown>; motivo: string }>(
    ({ entrega, cambios, motivo }) => ({
      ruta: `/sgspe/deliveries/${entrega.id}`,
      metodo: 'PATCH',
      json: { attributes: cambios },
      version: entrega.updatedAt,
      motivo
    }),
    { conClave: false, invalidar: invalidar(cliente, compromiso) }
  )
}
