import { ApiError } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { ErrorDeSgspe, esCodigo } from '../datos/http'
import { NS } from '../i18n'
import { ES_COMUN } from '../textos/comun'
import { tieneCodigos } from './codigosVisibles'

// los errores de la API en el lenguaje del dominio (api.md §3.3, screens.md §2). una guarda o un comando de SGSPE trae su
// código en errors[0].message (ruling P15): la interfaz dice el texto de ese código, nunca el código; un código que el
// portal no conoce muestra el detail del servidor, ya en español. sin código (los errores de wasichai), el detail de un 400
// o un 409 es el del servidor, y 403, 404, 412, 422 y 428 tienen su texto fijo. un detail que delata un código (un campo,
// una transición, un ID de requisito: «La transición decline exige response») dice el texto fijo de su estado (humo F4, D3)
const CON_DETALLE = new Set([400, 409])
const CODIGOS = new Set(Object.keys(ES_COMUN.codigos))

// el texto fijo de un estado; uno sin texto propio (un 500) dice el genérico de revisar los datos
const ESTADOS_CON_TEXTO = ['400', '403', '404', '409', '412', '422', '428']
const claveDeEstado = (estado: number): string => `comun.errores.${ESTADOS_CON_TEXTO.includes(String(estado)) ? estado : 400}`

// el detail del servidor, si se puede decir tal cual
const detalleVisible = (texto: string | undefined | null): string | null => (texto && !tieneCodigos(texto) ? texto : null)

// lo que una pantalla dice distinto de un código, por ejemplo con la acción que ofrece: { MEMBERS_REQUIRED: '…' }. una clave
// «CÓDIGO:campo» gana sobre «CÓDIGO» cuando el mismo código dice otra cosa según el campo (STATE_MISMATCH sobre record o engagement).
// una clave con el estado HTTP ('409') dice una respuesta de ese estado que no trae código
export type MensajesPropios = Partial<Record<string, string>>

const QCS = new Set(['grievance', 'inquiry', 'stakeholder_request'])
const campoDeComando = (campo: string) => /^(attributes\.)?(reclassified_from_|created_commitment$|created_contribution$)/.test(campo)

// la violación que wasichai 0.6.0 pone sobre un campo RELATION cuyo destino la cuenta no lee o no existe (RelationTargets, D30 de
// wasichai): con el alcance por proyecto (ADR-0029) es también un registro de otro proyecto. llega como texto libre en inglés, sin
// código, así que se reconoce por su texto exacto y se dice con comun.codigosEnCampo.registroNoLegible, en su campo
const SIN_REGISTRO = 'no record with this id'

// el texto propio de un código sobre un campo (plan 4.2a), si lo tiene: COMMAND_ONLY sobre un vínculo que solo escriben la
// reclasificación y la aceptación no es una transición de comando, OBJECT_NOT_READABLE sobre una QCS es una que la cuenta no lee
// y DELIVERY_FROZEN sobre social_contribution es el de un aporte, no el de un compromiso
const claveEnCampo = (codigo: string, campo: string | undefined): string | null => {
  if (!campo) return null
  if (codigo === 'COMMAND_ONLY' && campoDeComando(campo)) return 'comun.codigosEnCampo.vinculoDeComando'
  if (codigo === 'OBJECT_NOT_READABLE' && QCS.has(campo)) return 'comun.codigosEnCampo.qcsNoLeida'
  // DELIVERY_FROZEN dice las entregas de un compromiso; sobre el aporte, su entrega, sus evidencias y sus comprobantes
  if (codigo === 'DELIVERY_FROZEN' && /^(attributes\.)?social_contribution$/.test(campo)) return 'comun.codigosEnCampo.aporteEntregado'
  // F7: la IA sin activar en la organización o sin proveedor (api.md §3.3)
  if (codigo === 'AI_UNAVAILABLE' && campo === 'organization') return 'comun.codigosEnCampo.iaSinOrganizacion'
  if (codigo === 'AI_UNAVAILABLE' && campo === 'provider') return 'comun.codigosEnCampo.iaSinProveedor'
  // F7: AI_INPUT_TOO_LARGE sobre question es la pregunta de AI-05 que pasa sgspe.ai.limits.question-chars (plan 7.2a), no un
  // documento
  if (codigo === 'AI_INPUT_TOO_LARGE' && campo === 'question') return 'comun.codigosEnCampo.iaPreguntaLarga'
  return null
}

export function useMensajeDeError(): (error: unknown, propios?: MensajesPropios) => string {
  const { t } = useTranslation(NS)
  return (error, propios = {}) => {
    if (!(error instanceof ApiError)) return t('comun.errores.red')
    // la cabecera nativa Idempotency-Key de wasichai (WAS-ADR-0058) responde con texto libre sobre el campo de la cabecera: se
    // dice como los códigos de SGSPE del mismo contrato
    if (error.violations.some((v) => v.field === 'Idempotency-Key' && !esCodigo(v.message))) {
      if (error.status === 409) return t('comun.codigos.IDEMPOTENCY_IN_FLIGHT')
      if (error.status === 422) return t('comun.codigos.IDEMPOTENCY_KEY_REUSED')
    }
    // todas las violaciones con código, no solo la primera; si dos dicen lo mismo, se dice una vez
    const dichos = new Set<string>()
    for (const v of error.violations) {
      if (v.message === SIN_REGISTRO) {
        dichos.add(t('comun.codigosEnCampo.registroNoLegible'))
        continue
      }
      if (!esCodigo(v.message)) continue
      const propio = (v.field ? propios[`${v.message}:${v.field}`] : undefined) ?? propios[v.message]
      const enCampo = claveEnCampo(v.message, v.field)
      if (propio) dichos.add(propio)
      else if (enCampo) dichos.add(t(enCampo))
      else if (CODIGOS.has(v.message)) dichos.add(t(`comun.codigos.${v.message}`))
      else dichos.add(detalleVisible(error.message) ?? t(claveDeEstado(error.status)))
    }
    if (dichos.size > 0) return [...dichos].join(' ')
    // una respuesta sin código (un 409 de wasichai, sin violaciones con código) se dice con el texto propio de su estado, si la
    // pantalla lo da: { '409': '…' }
    const propioDelEstado = propios[String(error.status)]
    if (propioDelEstado) return propioDelEstado
    if (CON_DETALLE.has(error.status) && detalleVisible(error.message)) return error.message
    const clave = String(error.status)
    return ESTADOS_CON_TEXTO.includes(clave) ? t(`comun.errores.${clave}`) : detalleVisible(error.message) || t('comun.errores.red')
  }
}

export const correlacionDe = (error: unknown): string | null => (error instanceof ErrorDeSgspe ? error.correlationId : null)

// los errores de campo de un 400 o un 409 (errors[].field), para ponerlos junto a su control (screens.md §2): el texto de
// cada código (o el detail si el portal no lo conoce), y el texto libre de wasichai tal cual. nunca el código crudo
export function useErroresDeCampo(): (error: unknown) => Record<string, string> {
  const { t } = useTranslation(NS)
  return (error) => {
    if (!(error instanceof ApiError) || (error.status !== 400 && error.status !== 409)) return {}
    const porCampo: Record<string, string[]> = {}
    for (const v of error.violations) {
      const enCampo = esCodigo(v.message) ? claveEnCampo(v.message, v.field) : null
      const texto =
        v.message === SIN_REGISTRO
          ? t('comun.codigosEnCampo.registroNoLegible')
          : !esCodigo(v.message)
            ? (detalleVisible(v.message) ?? t(claveDeEstado(error.status)))
            : enCampo
              ? t(enCampo)
              : CODIGOS.has(v.message)
                ? t(`comun.codigos.${v.message}`)
                : (detalleVisible(error.message) ?? t(claveDeEstado(error.status)))
      // dos violaciones del mismo campo se unen: la segunda no pisa a la primera
      const textos = (porCampo[v.field] ??= [])
      if (!textos.includes(texto)) textos.push(texto)
    }
    return Object.fromEntries(Object.entries(porCampo).map(([campo, textos]) => [campo, textos.join(' ')]))
  }
}

export const esConflictoDeVersion = (error: unknown): boolean => error instanceof ApiError && error.status === 412
