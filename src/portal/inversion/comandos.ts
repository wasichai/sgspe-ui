import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useComando } from '../datos/comandos'
import type { Registro } from '../datos/registros'

// los comandos de aportes de /api/sgspe (spec F5 §3.5, api.md §4.6): capturar la única entrega de un aporte en procured, con sus
// evidencias ya subidas (IK, IM del aporte y CR: el aporte es requiresReason), y corregirla mientras siga en procured (PATCH de la
// entrega: IM de la entrega y CR, sin IK). ninguno cambia el estado: «Registrar entrega» (register_delivery, P8) es la transición
// humana que sigue. la captura responde { delivery, contribution }: el aporte queda en la caché de su ficha
export interface EntregaDeAporte {
  delivery: Registro
  contribution: Registro
}

export interface PedidoDeEntrega {
  // los campos de la entrega sin delivered_amount (FIELD_NOT_ALLOWED), commitment ni social_contribution (los fija el comando)
  atributos: Record<string, unknown>
  // las evidencias ya subidas, por id (ACTA DE RECEPCION, FOTO, COMPROBANTE)
  evidencias: string[]
  motivo: string
}

export interface CorreccionDeEntrega {
  entrega: Registro
  // solo los campos que cambiaron
  cambios: Record<string, unknown>
  motivo: string
}

// lo que la entrega deja viejo: sus listas, sus vínculos de evidencia, el aporte y su consulta en seco (register_delivery)
const viejas = (aporte: string): QueryKey[] => [
  ['records', 'delivery'],
  ['related'],
  ['record', 'social_contribution', aporte],
  ['history', 'social_contribution', aporte],
  ['transition-check', 'social_contribution', aporte]
]

export function useRegistrarEntregaDeAporte(aporte: Registro) {
  const cliente = useQueryClient()
  return useComando<EntregaDeAporte, PedidoDeEntrega>(
    ({ atributos, evidencias, motivo }) => ({
      ruta: `/sgspe/social-contributions/${encodeURIComponent(aporte.id)}/deliveries`,
      json: { attributes: atributos, ...(evidencias.length > 0 ? { evidence: evidencias } : {}) },
      version: aporte.updatedAt,
      motivo
    }),
    {
      invalidar: (r) => {
        cliente.setQueryData(['record', 'social_contribution', aporte.id], r.contribution)
        // el aporte ya está en la caché con su versión nueva: no se relee, se invalida lo demás
        return viejas(aporte.id).filter((clave) => clave[0] !== 'record')
      }
    }
  )
}

export function useCorregirEntregaDeAporte(aporte: string) {
  return useComando<unknown, CorreccionDeEntrega>(
    ({ entrega, cambios, motivo }) => ({
      ruta: `/sgspe/deliveries/${encodeURIComponent(entrega.id)}`,
      metodo: 'PATCH',
      json: { attributes: cambios },
      version: entrega.updatedAt,
      motivo
    }),
    { conClave: false, invalidar: () => viejas(aporte) }
  )
}
