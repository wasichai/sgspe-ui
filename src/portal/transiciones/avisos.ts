import { useTranslation } from 'react-i18next'
import { tieneCodigos } from '../componentes/codigosVisibles'
import { campoDe, useDefinicion } from '../datos/registros'
import { NS } from '../i18n'
import { ES_COMUN } from '../textos/comun'
import type { Aviso } from './api'

const CODIGOS = new Set(Object.keys(ES_COMUN.codigos))

export interface TextoDeAviso {
  // null: la regla no trae nada que decir (sin mensaje y con un código que el portal no conoce); no se inventa una razón
  texto: string | null
  // la etiqueta del campo que lo causa, si el texto no la dice ya
  campo: string | null
}

// el nombre crudo de la API dicho en un mensaje como palabra suelta: «exige response», «(attended)», «La transición decline»
const nombra = (mensaje: string, nombre: string | null | undefined): boolean =>
  Boolean(nombre) && new RegExp(`(^|[^\\p{L}\\d_])${nombre!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\d_])`, 'u').test(mensaje)

// el texto de una regla de transition-checks (api.md §4.1). el mensaje del servidor viene en español y se dice tal cual,
// salvo si nombra la transición o el campo por su nombre en la API («La transición reject_acknowledged exige response») o
// delata otro código (un ID de requisito, un rol): entonces la interfaz dice el campo con su etiqueta y la acción con su
// nombre (humo F4, D3): «Para «Rechazar» falta «Respuesta»» si falta un dato, el texto del código si el portal lo conoce y,
// si no, un texto general. field puede ser también un objeto que la regla revisa, `reason` o `state`, con su etiqueta de
// respaldo; uno que no se reconoce no se nombra
export function useTextoDeAviso(objeto: string): (aviso: Aviso, transicion?: { name: string; label: string }) => TextoDeAviso {
  const { t } = useTranslation(NS)
  const definicion = useDefinicion(objeto)
  const etiqueta = (field: string | null): string | null =>
    field ? campoDe(definicion.data, field)?.label || t(`transiciones.campos.${field}`, { defaultValue: '' }) || null : null
  return (aviso, transicion) => {
    const campo = etiqueta(aviso.field)
    const mensaje = aviso.message?.trim() ?? ''
    if (mensaje && !tieneCodigos(mensaje) && !nombra(mensaje, aviso.field) && !nombra(mensaje, transicion?.name)) return { texto: mensaje, campo }
    if (aviso.code === 'FIELD_REQUIRED' && campo)
      return {
        texto: transicion ? t('transiciones.faltaCampo', { accion: transicion.label, campo }) : t('transiciones.faltaCampoSinAccion', { campo }),
        campo: null
      }
    if (CODIGOS.has(aviso.code)) return { texto: t(`comun.codigos.${aviso.code}`), campo }
    return { texto: mensaje ? t('transiciones.reglaSinTexto') : null, campo }
  }
}
