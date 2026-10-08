import { ApiError } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { campoDelError, codigoDelError, ErrorDeSgspe, esCodigo } from '../datos/http'
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
    const codigo = codigoDelError(error)
    if (codigo) {
      const propio = propios[codigo]
      if (propio) return propio
      if (CODIGOS.has(codigo)) return t(`comun.codigos.${codigo}`, { campo: campoDelError(error) ?? '' })
      if (error.message) return error.message
    }
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
    return Object.fromEntries(
      error.violations.map((v) => {
        if (!esCodigo(v.message)) return [v.field, v.message]
        return [v.field, CODIGOS.has(v.message) ? t(`comun.codigos.${v.message}`, { campo: v.field }) : error.message || t(`comun.errores.${error.status}`)]
      })
    )
  }
}

export const esConflictoDeVersion = (error: unknown): boolean => error instanceof ApiError && error.status === 412
