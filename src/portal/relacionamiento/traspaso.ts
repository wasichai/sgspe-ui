import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useClaveDelBorrador } from '../datos/borrador'
import type { Punto } from './ubicacion'

// lo cargado que pasa de un modo al otro con el conmutador de la cabecera (tercera pasada de UX, 2.5): el tipo, los grupos
// presentes, los asistentes contados por sexo y ámbito y el punto. viaja en el estado del historial y cada modo lo pone sobre
// su borrador; lo demás (el título, la nota, las preguntas) queda en el borrador del modo que se deja y vuelve al volver a él
export type ClaveDeConteo = `${string}|${string}`
export interface Traspaso {
  tipo: string
  grupos: string[]
  conteos: Record<ClaveDeConteo, number>
  punto: Punto | null
}

// el traspaso del estado del historial, si lo hay y tiene la forma de uno
export function traspasoDe(estado: unknown): Traspaso | null {
  const t = (estado as { traspaso?: Partial<Traspaso> } | null)?.traspaso
  if (!t || typeof t !== 'object') return null
  return {
    tipo: typeof t.tipo === 'string' ? t.tipo : '',
    grupos: Array.isArray(t.grupos) ? t.grupos.filter((g): g is string => typeof g === 'string') : [],
    conteos: t.conteos && typeof t.conteos === 'object' ? t.conteos : {},
    punto: Array.isArray(t.punto) && t.punto.length === 2 ? t.punto : null
  }
}

// el traspaso con el que se abrió el modo, leído una vez: se saca del historial en cuanto se lee, para que recargar la página no
// lo vuelva a poner encima de un borrador más nuevo
export function useTraspaso(): Traspaso | null {
  const ubicacion = useLocation()
  const navegar = useNavigate()
  const [traspaso] = useState(() => traspasoDe(ubicacion.state))
  useEffect(() => {
    if (!traspaso) return
    navegar({ pathname: ubicacion.pathname, search: ubicacion.search, hash: ubicacion.hash }, { replace: true, state: null, preventScrollReset: true })
    // solo al montar: el traspaso ya se leyó
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return traspaso
}

// los asistentes de una fila del asistente, contados por sexo y ámbito; los que no dicen uno de los dos no se cuentan
export function conteosDe(participantes: { sex?: string; participant_scope?: string; represented_people_count?: number; attended?: boolean }[]) {
  const conteos: Record<ClaveDeConteo, number> = {}
  for (const p of participantes) {
    const n = Number(p.represented_people_count) || 0
    if (!p.attended || !p.sex || !p.participant_scope || n <= 0) continue
    const clave: ClaveDeConteo = `${p.sex}|${p.participant_scope}`
    conteos[clave] = (conteos[clave] ?? 0) + n
  }
  return conteos
}

// los conteos del modo rápido como filas «grupo sin nombres» del asistente
export function filasDe(conteos: Record<ClaveDeConteo, number>) {
  return Object.entries(conteos)
    .filter(([, n]) => n > 0)
    .map(([clave, n]) => {
      const [sex, participant_scope] = clave.split('|')
      return { tipo: 'grupo' as const, participant_name: '', represented_group: '', sex, participant_scope, represented_people_count: n, attended: true }
    })
}

// el borrador de cada modo, por proyecto y, abierta desde una visita de campo, por visita: lo de una visita no pasa a otra
export function useClavesDelBorrador(proyecto: string, visita: string | null) {
  return { asistente: useClaveDelBorrador('interaccion', proyecto, visita), rapido: useClaveDelBorrador('interaccionRapida', proyecto, visita) }
}
