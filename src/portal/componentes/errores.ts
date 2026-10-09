import { ApiError } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { ErrorDeSgspe, esCodigo } from '../datos/http'
import { NS } from '../i18n'
import { ES_COMUN } from '../textos/comun'

// los errores de la API en el lenguaje del dominio (api.md §3.3, screens.md §2). una guarda o un comando de SGSPE trae su
// código en errors[0].message (ruling P15): la interfaz dice el texto de ese código, nunca el código; un código que el
// portal no conoce muestra el detail del servidor, ya en español. sin código (los errores de wasichai), el detail de un 400
// o un 409 es el del servidor, y 403, 404, 412, 422 y 428 tienen su texto fijo
const CON_DETALLE = new Set([400, 409])
const CODIGOS = new Set(Object.keys(ES_COMUN.codigos))

// lo que una pantalla dice distinto de un código, por ejemplo con la acción que ofrece: { MEMBERS_REQUIRED: '…' }
export type MensajesPropios = Partial<Record<string, string>>

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
      if (!esCodigo(v.message)) continue
      const propio = propios[v.message]
      if (propio) dichos.add(propio)
      else if (v.message === 'HAS_DEPENDENTS' && !v.field) dichos.add(t('comun.dependientesSinCampo'))
      else if (CODIGOS.has(v.message)) dichos.add(t(`comun.codigos.${v.message}`, { campo: v.field ?? '' }))
      else if (error.message) dichos.add(error.message)
    }
    if (dichos.size > 0) return [...dichos].join(' ')
    if (CON_DETALLE.has(error.status) && error.message) return error.message
    const clave = String(error.status)
    return ['400', '403', '404', '409', '412', '422', '428'].includes(clave) ? t(`comun.errores.${clave}`) : error.message || t('comun.errores.red')
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
      const texto = !esCodigo(v.message)
        ? v.message
        : CODIGOS.has(v.message)
          ? t(`comun.codigos.${v.message}`, { campo: v.field })
          : error.message || t(`comun.errores.${error.status}`)
      // dos violaciones del mismo campo se unen: la segunda no pisa a la primera
      const textos = (porCampo[v.field] ??= [])
      if (!textos.includes(texto)) textos.push(texto)
    }
    return Object.fromEntries(Object.entries(porCampo).map(([campo, textos]) => [campo, textos.join(' ')]))
  }
}

export const esConflictoDeVersion = (error: unknown): boolean => error instanceof ApiError && error.status === 412
