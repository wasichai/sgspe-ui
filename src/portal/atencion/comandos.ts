import type { QueryKey } from '@tanstack/react-query'
import { RUTA_DE_COMANDO, type ObjetoDeQcs } from '../datos/atencion'
import { useComando } from '../datos/comandos'
import type { Registro } from '../datos/registros'

// los comandos de QCS de /api/sgspe (api.md §4.4 y §4.6, plan 4.2a): reclasificar, aceptar una solicitud y derivar una pregunta de
// reunión. los tres honran Idempotency-Key (IK): useComando repite la clave en cada reintento de la misma acción y la renueva al
// cambiar de ruta (P63), al terminar bien o con nuevaAccion. reclasificar y aceptar llevan If-Match con la versión leída (IM); los
// tres, el motivo (CR): las QCS son requiresReason

const registroDe = (objeto: string, id: string): QueryKey[] => [
  ['record', objeto, id],
  ['records', objeto],
  ['transitions', objeto, id],
  ['history', objeto, id]
]

// las cifras de QCS (tarjetas de S35, KPI-ENG-05 y los tableros) salen de los indicadores: cambiar el estado o el tipo de una QCS las
// deja viejas
const cifras = (): QueryKey[] => [['indicator'], ['dashboard']]

export interface Reclasificacion {
  original: Registro
  created: Registro
}

export interface PedidoDeReclasificacion {
  registro: Registro
  destino: ObjetoDeQcs
  // los campos del registro nuevo: el código (cada tipo numera los suyos) y lo que se completa o cambia
  atributos: Record<string, unknown>
  motivo: string
}

// POST /api/sgspe/{grievances|inquiries|stakeholder-requests}/{id}/reclassify → 201 { original, created }: crea la QCS del otro
// tipo con los campos comunes y la recepción del primer registro de la cadena, y cierra el original
export function useReclasificar(objeto: ObjetoDeQcs) {
  return useComando<Reclasificacion, PedidoDeReclasificacion>(
    ({ registro, destino, atributos, motivo }) => ({
      ruta: `/sgspe/${RUTA_DE_COMANDO[objeto]}/${encodeURIComponent(registro.id)}/reclassify`,
      json: { targetType: destino, attributes: atributos },
      version: registro.updatedAt,
      motivo
    }),
    { invalidar: (_r, { registro, destino }) => [...registroDe(objeto, registro.id), ['records', destino], ...cifras()] }
  )
}

export interface Aceptacion {
  request: Registro
  commitment: Registro
}

export interface PedidoDeAceptacion {
  solicitud: Registro
  // la respuesta a la solicitud y cuándo se comunicó (aceptar es responderla, api.md §4.6)
  respuesta: string
  respondidaEn: string
  // los valores del compromiso que nace en draft (sin el proyecto, que es el de la solicitud)
  atributos: Record<string, unknown>
  motivo: string
}

// POST /api/sgspe/stakeholder-requests/{id}/accept → 201 { request, commitment }: en F4 crea solo un compromiso (el aporte
// social llega en F5: creates distinto de commitment es 400 INVALID_TARGET)
export function useAceptarSolicitud() {
  return useComando<Aceptacion, PedidoDeAceptacion>(
    ({ solicitud, respuesta, respondidaEn, atributos, motivo }) => ({
      ruta: `/sgspe/stakeholder-requests/${encodeURIComponent(solicitud.id)}/accept`,
      json: { creates: 'commitment', response: respuesta, respondedAt: respondidaEn, attributes: atributos },
      version: solicitud.updatedAt,
      motivo
    }),
    { invalidar: (_r, { solicitud }) => [...registroDe('stakeholder_request', solicitud.id), ['records', 'commitment'], ...cifras()] }
  )
}

export interface Derivacion {
  question: Registro
  created: Registro
}

export interface PedidoDeDerivacion {
  pregunta: Registro
  destino: ObjetoDeQcs
  // los campos de la QCS que nace: el proyecto, la interacción y la pregunta de origen, el canal REUNION y la recepción los pone el
  // servidor
  atributos: Record<string, unknown>
  motivo: string
}

// POST /api/sgspe/engagement-questions/{id}/referral → 201 { question, created }: la pregunta queda con referred_at y cuenta como
// atendida para cerrar la interacción (RN-ENG-005), sin que la regla lea la QCS, que puede ser confidencial
export function useDerivarPregunta() {
  return useComando<Derivacion, PedidoDeDerivacion>(
    ({ pregunta, destino, atributos, motivo }) => ({
      ruta: `/sgspe/engagement-questions/${encodeURIComponent(pregunta.id)}/referral`,
      json: { target: destino, attributes: atributos },
      motivo
    }),
    {
      invalidar: (_r, { pregunta, destino }) => [
        // la pregunta leída sola también: ahora lleva referred_at
        ['record', 'engagement_question', pregunta.id],
        ['records', 'engagement_question'],
        ['records', destino],
        ['transition-check', 'engagement'],
        ...cifras()
      ]
    }
  )
}
