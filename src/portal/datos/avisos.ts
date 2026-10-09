import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ApiError, useApiClient, useAuth } from '@wasichai/core'
import { useEffect } from 'react'
import { usePedir } from './http'
import { consulta } from './registros'

// los avisos de wasichai-notifications (decisión D2, ADR-0018; WAS-ADR-0046, 0047 y 0060): la bandeja, su resumen en vivo y
// las preferencias de correo son del módulo, en /api/auth/me/notifications*. @wasichai/* 0.5.1 no trae su interfaz, así que
// el portal la arma sobre su REST y su SSE:
// - GET …?kind=&state=&page=&size= → página de avisos (state: active, unread o snoozed; active por defecto);
// - GET …/summary → { kinds: { INFO, WARNING, ACTION: { active, unread, overdue } }, latest };
// - POST …/{id}/read, …/{id}/dismiss, …/{id}/snooze { until }, …/read-all { kind? } → 204;
// - GET …/stream: text/event-stream con eventos `summary` (el resumen, nunca los avisos) y comentarios de latido. el token va
//   en Authorization, nunca en la URL, así que se lee con fetch y no con EventSource (WAS-ADR-0047);
// - GET y PUT /api/auth/me/notification-preferences → { email: ['ACTION', 'WARNING', …] }.
// sin el módulo, toda ruta responde 404: el portal no dibuja la campana. una cuenta de servicio recibe 403
export type TipoDeAviso = 'INFO' | 'WARNING' | 'ACTION'
export const TIPOS_DE_AVISO: readonly TipoDeAviso[] = ['ACTION', 'WARNING', 'INFO']

export interface EnlaceDeAviso {
  type: 'RECORD' | 'ROUTE' | 'URL'
  object?: string | null
  recordId?: string | null
  tab?: string | null
  route?: string | null
  params?: Record<string, string> | null
  url?: string | null
}

export interface Aviso {
  id: string
  kind: TipoDeAviso
  title: string
  body: string | null
  // un enlace RECORD a un registro que quien lee no puede leer llega en null: la bandeja ya lo quitó
  link: EnlaceDeAviso | null
  publishAt: string
  expiresAt: string | null
  dueAt: string | null
  overdue: boolean
  // sgspe.approvals, sgspe.deadlines o la fuente del módulo (manual, rule:…, automation:…)
  source: string
  read: boolean
  snoozedUntil: string | null
  // un ACTION de una fuente no se descarta: se va cuando el trabajo se hace
  dismissible: boolean
}

export interface ConteoDeTipo {
  active: number
  unread: number
  overdue: number
}

export interface ResumenDeAvisos {
  kinds: Record<TipoDeAviso, ConteoDeTipo>
  latest: { id: string; kind: TipoDeAviso; title: string; publishAt: string; link?: EnlaceDeAviso | null } | null
}

export interface PaginaDeAvisos {
  content: Aviso[]
  page: number
  size: number
  totalElements: number | null
  totalPages: number | null
}

export type EstadoDeBandeja = 'active' | 'unread' | 'snoozed'

// las fuentes de SGSPE (api.md §4.10): aprobación pendiente y plazos
export const FUENTE_DE_APROBACIONES = 'sgspe.approvals'
export const FUENTE_DE_PLAZOS = 'sgspe.deadlines'

// el borde de un aviso por su tipo, en la campana, la bandeja y las aprobaciones (el texto del tipo va siempre al lado)
export const CLASE_DE_TIPO: Record<string, string> = {
  ACTION: 'border-l-sg-danger',
  WARNING: 'border-l-sg-warning',
  INFO: 'border-l-sg-info'
}

const BANDEJA = '/auth/me/notifications'

// sin el módulo (404) o para una cuenta de servicio (403) no hay bandeja: no es un error que mostrar
export const sinBandeja = (error: unknown): boolean => error instanceof ApiError && (error.status === 404 || error.status === 403)

export const sinLeer = (resumen: ResumenDeAvisos | undefined): number =>
  resumen ? TIPOS_DE_AVISO.reduce((total, tipo) => total + (resumen.kinds[tipo]?.unread ?? 0), 0) : 0

export function useResumenDeAvisos(activo = true) {
  const pedir = usePedir()
  return useQuery({ queryKey: ['notifications', 'summary'], queryFn: () => pedir<ResumenDeAvisos>(`${BANDEJA}/summary`), enabled: activo })
}

export interface FiltrosDeBandeja {
  kind?: TipoDeAviso
  state?: EstadoDeBandeja
  page?: number
  size?: number
}

export function useAvisos(filtros: FiltrosDeBandeja, activo = true) {
  const pedir = usePedir()
  const busqueda = consulta({ ...filtros })
  return useQuery({
    queryKey: ['notifications', 'list', busqueda],
    queryFn: () => pedir<PaginaDeAvisos>(`${BANDEJA}?${busqueda}`),
    enabled: activo
  })
}

const invalidarBandeja = (cliente: QueryClient) => void cliente.invalidateQueries({ queryKey: ['notifications'] })

// leer, descartar y posponer: el resumen y las listas se releen; el flujo SSE trae además el resumen nuevo
export function useAccionDeAviso() {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ aviso, accion, hasta }: { aviso: Aviso; accion: 'read' | 'dismiss' | 'snooze'; hasta?: string }) =>
      pedir<void>(`${BANDEJA}/${aviso.id}/${accion}`, { metodo: 'POST', json: accion === 'snooze' ? { until: hasta } : {} }),
    onSuccess: () => invalidarBandeja(cliente)
  })
}

export function useLeerTodos() {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (tipo?: TipoDeAviso) => pedir<void>(`${BANDEJA}/read-all`, { metodo: 'POST', json: tipo ? { kind: tipo } : {} }),
    onSuccess: () => invalidarBandeja(cliente)
  })
}

export type PreferenciasDeAvisos = Record<string, TipoDeAviso[]>

export function usePreferenciasDeAvisos() {
  const pedir = usePedir()
  return useQuery({ queryKey: ['notification-preferences'], queryFn: () => pedir<PreferenciasDeAvisos>('/auth/me/notification-preferences') })
}

export function useGuardarPreferencias() {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (preferencias: PreferenciasDeAvisos) => pedir<PreferenciasDeAvisos>('/auth/me/notification-preferences', { metodo: 'PUT', json: preferencias }),
    onSuccess: (guardadas) => cliente.setQueryData(['notification-preferences'], guardadas)
  })
}

// ---- el flujo SSE ----

export interface EventoSse {
  evento: string
  datos: string
}

// los eventos de un text/event-stream (WHATWG): bloques separados por una línea en blanco, con `event:` y `data:` (varias
// líneas de datos se unen con \n); las líneas que empiezan con `:` son comentarios (el latido). un bloque puede llegar partido
// entre dos lecturas
export async function* eventosSse(cuerpo: ReadableStream<Uint8Array>): AsyncGenerator<EventoSse> {
  const lector = cuerpo.getReader()
  const decodificador = new TextDecoder()
  let pendiente = ''
  try {
    for (;;) {
      const { value, done } = await lector.read()
      if (done) return
      pendiente += decodificador.decode(value, { stream: true }).replace(/\r\n?/g, '\n')
      let corte = pendiente.indexOf('\n\n')
      while (corte >= 0) {
        const bloque = pendiente.slice(0, corte)
        pendiente = pendiente.slice(corte + 2)
        let evento = 'message'
        const datos: string[] = []
        for (const linea of bloque.split('\n')) {
          if (linea === '' || linea.startsWith(':')) continue
          const dosPuntos = linea.indexOf(':')
          const campo = dosPuntos < 0 ? linea : linea.slice(0, dosPuntos)
          const valor = dosPuntos < 0 ? '' : linea.slice(dosPuntos + 1).replace(/^ /, '')
          if (campo === 'event') evento = valor
          else if (campo === 'data') datos.push(valor)
        }
        if (datos.length > 0) yield { evento, datos: datos.join('\n') }
        corte = pendiente.indexOf('\n\n')
      }
    }
  } finally {
    lector.releaseLock()
  }
}

// la espera antes de reconectar: 5 s, 10 s, 20 s… hasta un minuto. el flujo termina solo cuando vence el token
// (WAS-ADR-0047) o si se corta la red; reconectar lo vuelve a abrir con el token vigente
export const esperaDeReconexion = (intento: number): number => Math.min(60_000, 5_000 * 2 ** Math.max(0, intento))

export type Programar = (tarea: () => void, milisegundos: number) => () => void
const programarConReloj: Programar = (tarea, milisegundos) => {
  const plazo = setTimeout(tarea, milisegundos)
  return () => clearTimeout(plazo)
}

// abre el flujo del resumen mientras la sesión vive y deja cada resumen en la caché de ['notifications', 'summary'];
// cada resumen nuevo también relee las listas abiertas. un 404 (sin el módulo) o un 403 (cuenta de servicio) no se
// reintenta; un 401 cierra la sesión como cualquier pedido
export function useFlujoDeAvisos(activo = true, programar: Programar = programarConReloj) {
  const cliente = useApiClient()
  const { signOut } = useAuth()
  const consultas = useQueryClient()
  useEffect(() => {
    if (!activo) return
    const corte = new AbortController()
    let intento = 0
    let cancelarPlazo: (() => void) | null = null
    const abrir = async () => {
      try {
        const token = cliente.getToken()
        const respuesta = await fetch(`${cliente.baseUrl}${BANDEJA}/stream`, {
          headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          signal: corte.signal
        })
        if (respuesta.status === 401) {
          cliente.setToken(null)
          signOut()
          return
        }
        if (respuesta.status === 404 || respuesta.status === 403) return
        if (!respuesta.ok || !respuesta.body) throw new Error(`stream ${respuesta.status}`)
        intento = 0
        for await (const { evento, datos } of eventosSse(respuesta.body)) {
          if (evento !== 'summary') continue
          // la lectura inicial del resumen puede llegar después del primer evento: se cancela, así no pisa uno más nuevo
          await consultas.cancelQueries({ queryKey: ['notifications', 'summary'] })
          consultas.setQueryData(['notifications', 'summary'], JSON.parse(datos) as ResumenDeAvisos)
          void consultas.invalidateQueries({ queryKey: ['notifications', 'list'] })
        }
      } catch {
        if (corte.signal.aborted) return
      }
      if (corte.signal.aborted) return
      cancelarPlazo = programar(() => void abrir(), esperaDeReconexion(intento++))
    }
    void abrir()
    return () => {
      corte.abort()
      cancelarPlazo?.()
    }
  }, [activo, cliente, signOut, consultas, programar])
}
