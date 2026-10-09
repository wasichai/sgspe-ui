import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useRef } from 'react'
import { ApiError } from '@wasichai/core'
import { codigoDelError, ErrorDeSgspe, nuevaClave, usePedir, type Pedido } from './http'

// los comandos de /api/sgspe/** de F3 (api.md §4.5 y §4.9): reprogramar, registrar una entrega, dar de alta y aceptar un
// candidato, registrar una evidencia. los marcados IK honran Idempotency-Key con el contrato nativo (§3.5, decisión D3):
// - una clave por acción del usuario, repetida en cada reintento de esa acción: un teléfono que perdió la red reenvía la
//   entrega y el servidor devuelve la respuesta guardada (Idempotent-Replayed) en lugar de crear otra;
// - la clave se renueva cuando la acción terminó bien o cuando empieza otra (nuevaAccion: abrir el formulario de nuevo,
//   cancelar); un comando que falló no dejó clave en el servidor, así que el reintento corregido repite la misma;
// - 409 con Retry-After sobre Idempotency-Key: la primera sigue en curso; se espera y se reenvía con la misma clave;
// - 422 sobre Idempotency-Key: la clave ya se usó con otra petición (la acción se registró antes con otros datos); la
//   pantalla lo dice y la próxima acción lleva una clave nueva.
// los comandos de SGSPE traen el código (IDEMPOTENCY_IN_FLIGHT, IDEMPOTENCY_KEY_REUSED); la cabecera nativa de wasichai en el alta
// genérica (WAS-ADR-0058) trae texto libre en errors[0].message con el mismo campo. el portal reconoce las dos por el estado y
// el campo
export interface Comando {
  // relativa a /api, como en usePedir: '/sgspe/commitments/c1/reschedules'
  ruta: string
  metodo?: 'POST' | 'PATCH' | 'DELETE'
  json: unknown
  // If-Match con el updatedAt leído (IM)
  version?: string | null
  // X-Change-Reason (CR)
  motivo?: string | null
}

const sobreLaClave = (error: unknown, estado: number): boolean =>
  error instanceof ApiError && error.status === estado && error.violations.some((v) => v.field === 'Idempotency-Key')
export const esClaveEnCurso = (error: unknown): boolean => codigoDelError(error) === 'IDEMPOTENCY_IN_FLIGHT' || sobreLaClave(error, 409)
export const esClaveReusada = (error: unknown): boolean => codigoDelError(error) === 'IDEMPOTENCY_KEY_REUSED' || sobreLaClave(error, 422)

// cuántas veces se reenvía una petición cuya clave sigue en curso antes de rendirse y decirlo
export const REENVIOS_EN_CURSO = 3

export type Esperar = (milisegundos: number) => Promise<void>
const dormir: Esperar = (milisegundos) => new Promise((resolver) => setTimeout(resolver, milisegundos))

export async function enviarComando<T>(pedir: Pedido, comando: Comando, clave: string | null, esperar: Esperar = dormir): Promise<T> {
  for (let intento = 0; ; intento++) {
    try {
      return await pedir<T>(comando.ruta, { metodo: comando.metodo ?? 'POST', json: comando.json, version: comando.version, motivo: comando.motivo, clave })
    } catch (error) {
      if (!esClaveEnCurso(error) || intento >= REENVIOS_EN_CURSO) throw error
      await esperar(((error as ErrorDeSgspe).reintentarEn ?? 1) * 1000)
    }
  }
}

export interface OpcionesDeComando<T, V> {
  // las consultas que el comando dejó viejas: el registro, sus listas, sus vínculos
  invalidar?: (resultado: T, variables: V) => QueryKey[]
  // false en los comandos sin IK (los PATCH): no mandan la cabecera
  conClave?: boolean
  esperar?: Esperar
}

export function useComando<T, V>(armar: (variables: V) => Comando, { invalidar, conClave = true, esperar }: OpcionesDeComando<T, V> = {}) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  const clave = useRef<string>(nuevaClave())
  // la renovación va en las opciones de useMutation, no en las de mutate: vale aunque la pantalla se haya cerrado mientras
  // el comando viajaba (revisión de la Tarea 17 de F2)
  const mutacion = useMutation({
    mutationFn: (variables: V) => enviarComando<T>(pedir, armar(variables), conClave ? clave.current : null, esperar),
    onSuccess: (resultado, variables) => {
      clave.current = nuevaClave()
      for (const queryKey of invalidar?.(resultado, variables) ?? []) void cliente.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      if (esClaveReusada(error)) clave.current = nuevaClave()
    }
  })
  return {
    ...mutacion,
    // otra acción del usuario: una clave nueva y sin el error de la anterior
    nuevaAccion: () => {
      clave.current = nuevaClave()
      mutacion.reset()
    },
    claveActual: () => clave.current
  }
}
