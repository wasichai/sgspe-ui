import { useMutation, useQuery } from '@tanstack/react-query'
import { useComando } from '../datos/comandos'
import { usePedir } from '../datos/http'
import type { Registro } from '../datos/registros'

// el contrato de F7 (api.md §4.14) que lee el portal: el estado de la IA, las corridas de los casos con sugerencias, las
// preguntas al asistente (AI-05) y a los documentos (AI-06) y la aceptación de una sugerencia. las formas que api.md no fija
// las fija «Dependencias de otros planes» del plan 7.3; una pantalla no pide un endpoint de /api/sgspe/ai/** por su cuenta
export const CASOS = ['AI-01', 'AI-02', 'AI-03', 'AI-04', 'AI-05', 'AI-06', 'AI-07', 'AI-08'] as const
export type CasoDeIa = (typeof CASOS)[number]

export interface EstadoDeIa {
  enabled: boolean
  providerAvailable: boolean
  useCases: string[]
}

// por qué un caso no se ofrece: todavía se lee el estado, el servidor no tiene F7 (404 o error), la organización no tiene la
// IA activada, el proveedor no responde o el rol de la cuenta no tiene el caso
export type MotivoSinIa = 'cargando' | 'sinServidor' | 'organizacion' | 'proveedor' | 'rol'
export type Disponibilidad = { disponible: true } | { disponible: false; motivo: MotivoSinIa }

// el orden importa (decisión 4 del plan): la organización y el proveedor valen aunque useCases traiga casos
export function disponibilidadDe(estado: EstadoDeIa | undefined, caso: CasoDeIa): Disponibilidad {
  if (!estado) return { disponible: false, motivo: 'sinServidor' }
  if (!estado.enabled) return { disponible: false, motivo: 'organizacion' }
  if (!estado.providerAvailable) return { disponible: false, motivo: 'proveedor' }
  if (!estado.useCases.includes(caso)) return { disponible: false, motivo: 'rol' }
  return { disponible: true }
}

// la respuesta tal como llega: un despliegue a medias puede no traer useCases (D1 de la revisión de UX). lo que falta se
// lee como «no»: sin casos, sin organización activa, sin proveedor
export function estadoDe(cuerpo: unknown): EstadoDeIa {
  const e = (cuerpo ?? {}) as Partial<Record<keyof EstadoDeIa, unknown>>
  return {
    enabled: e.enabled === true,
    providerAvailable: e.providerAvailable === true,
    useCases: Array.isArray(e.useCases) ? e.useCases.filter((c): c is string => typeof c === 'string') : []
  }
}

// responde siempre 200 en un backend con F7 (api.md §4.14); un 404 es un backend sin F7. se relee al minuto: activar la IA
// pide redesplegar (spec §8), así que no cambia a menudo
export function useEstadoDeIa() {
  const pedir = usePedir()
  return useQuery({ queryKey: ['ia', 'estado'], queryFn: async () => estadoDe(await pedir<unknown>('/sgspe/ai/status')), staleTime: 60_000 })
}

export function useCasoDeIa(caso: CasoDeIa): Disponibilidad {
  const estado = useEstadoDeIa()
  if (estado.isPending) return { disponible: false, motivo: 'cargando' }
  return disponibilidadDe(estado.data, caso)
}

export interface Objetivo {
  object: string
  recordId: string
}

// RunAnswer de 7.2b (api.md §4.14): el id de la ai_interaction de la primera llamada (null si AI-07 no halló pares y no llamó al
// modelo) y los de todas sus llamadas (AI-01 hace dos), y lo guardado como lo devuelve la API genérica
export interface RespuestaDeCorrida {
  interaction: string | null
  interactions: string[]
  suggestions: Registro[]
  candidates: Registro[]
}

// un paso del asistente como lo devuelve wasichai-agent (AgentStep): la herramienta, con qué y qué volvió, ya seudonimizado
export interface PasoDelAsistente {
  tool: string
  input: Record<string, unknown>
  summary: string
}

export interface RespuestaDelAsistente {
  answer: string
  steps: PasoDelAsistente[]
  truncated: boolean
  interaction: string | null
}

export interface Cita {
  evidenceId: string
  chunkIndex: number
  quote: string
}

export interface RespuestaConCitas {
  answer: string
  citations: Cita[]
  // null si ningún fragmento pasó los filtros y no se llamó al modelo
  interaction: string | null
}

// result es el registro que el comando creó o cambió (null si solo se registra la decisión); stakeholder, el grupo de interés
// que se pidió con un actor
export interface Aceptada {
  suggestion: Registro
  result: Registro | null
  stakeholder?: Registro
}

// POST /api/sgspe/ai/runs con Idempotency-Key: una corrida guarda sugerencias o candidatos, que la bandeja lee
export function useCorrida() {
  return useComando<RespuestaDeCorrida, { caso: CasoDeIa; objetivo: Objetivo }>(
    ({ caso, objetivo }) => ({ ruta: '/sgspe/ai/runs', json: { useCase: caso, target: objetivo } }),
    {
      invalidar: () => [
        ['records', 'ai_suggestion'],
        ['records', 'commitment_candidate']
      ]
    }
  )
}

// las preguntas no llevan Idempotency-Key (api.md §4.14): no escriben datos de dominio
export function usePreguntarALosDatos() {
  const pedir = usePedir()
  return useMutation({
    mutationFn: (pregunta: string) => pedir<RespuestaDelAsistente>('/sgspe/ai/assistant/questions', { metodo: 'POST', json: { question: pregunta } })
  })
}

export function usePreguntarALosDocumentos() {
  const pedir = usePedir()
  return useMutation({
    mutationFn: ({ pregunta, proyecto }: { pregunta: string; proyecto: string }) =>
      pedir<RespuestaConCitas>('/sgspe/ai/knowledge/questions', { metodo: 'POST', json: { question: pregunta, project: proyecto } })
  })
}

// POST /api/sgspe/ai-suggestions/{id}/accept con IK, IM y CR: escribe los valores que la persona revisó (ai-architecture.md
// §4.2) y deja viejas la bandeja, la sugerencia y el registro destino
export function useAceptarSugerencia() {
  return useComando<Aceptada, { sugerencia: Registro; atributos: Record<string, unknown>; motivo: string }>(
    ({ sugerencia, atributos, motivo }) => ({
      ruta: `/sgspe/ai-suggestions/${sugerencia.id}/accept`,
      json: { attributes: atributos },
      version: sugerencia.updatedAt,
      motivo
    }),
    {
      invalidar: (r, { sugerencia }) => {
        const destino = String(sugerencia.attributes.target_object ?? '')
        return [
          ['records', 'ai_suggestion'],
          ['transitions', 'ai_suggestion'],
          ['records', destino],
          ['record', destino],
          ['related'],
          ...(r.stakeholder ? [['records', 'stakeholder']] : [])
        ]
      }
    }
  )
}
