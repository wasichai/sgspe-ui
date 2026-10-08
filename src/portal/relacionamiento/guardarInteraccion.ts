import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError, type ObjectDefinition } from '@wasichai/core'
import { usePedir, type Pedido } from '../datos/http'
import { atributosDeEscritura, geometriasDeEscritura, type Geometria, type Registro } from '../datos/registros'

// registrar una interacción por la API genérica (api.md §4.4): la interacción, sus vínculos con grupos de interés y temas,
// sus participantes, sus preguntas y, al final, la transición elegida. son escrituras sucesivas: si una falla, lo ya
// escrito queda y la ficha de la interacción permite completarlo (no hay transacción en la API genérica)
export interface Participante {
  participant_name?: string
  represented_group?: string
  sex?: string
  participant_scope?: string
  represented_people_count: number
  attended: boolean
  stakeholder?: string
}

export interface Pregunta {
  question_text: string
  answered_on_site: boolean
  answer?: string
  raised_by_role?: string
  topic?: string
}

export interface NuevaInteraccion {
  proyecto: string
  atributos: Record<string, unknown>
  ubicacion?: Geometria | null
  grupos: string[]
  temas: string[]
  participantes: Participante[]
  preguntas: Pregunta[]
  transicion: 'register_held_unplanned' | 'schedule' | null
  // la clave de idempotencia de esta acción (api.md §3.5): una por registro que la persona hace, la misma en un reintento
  clave?: string
}

export class GuardadoParcial extends Error {
  constructor(
    readonly interaccion: Registro,
    readonly causa: unknown
  ) {
    super('guardado parcial')
  }
}

const limpio = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined))

// la definición de un objeto para quien llama (decisión 18): al crear viaja lo que el formulario trae y ella marca editable
export type DefinicionDe = (objeto: string) => Promise<ObjectDefinition>

export async function guardarInteraccion(pedir: Pedido, n: NuevaInteraccion, definicionDe: DefinicionDe): Promise<Registro> {
  // las definiciones se leen antes de escribir nada: si faltan, el error no deja una interacción a medias
  const [definicion, deParticipante, dePregunta] = await Promise.all([
    definicionDe('engagement'),
    n.participantes.length > 0 ? definicionDe('engagement_participant') : undefined,
    n.preguntas.length > 0 ? definicionDe('engagement_question') : undefined
  ])
  const escribible = (objeto: string, def: ObjectDefinition | undefined, atributos: object) => (def ? atributosDeEscritura(objeto, def, limpio(atributos)) : {})
  const geometrias = geometriasDeEscritura(definicion, n.ubicacion ? { location: n.ubicacion } : undefined)
  const interaccion = await pedir<Registro>('/objects/engagement/records', {
    json: { attributes: escribible('engagement', definicion, { ...n.atributos, project: n.proyecto }), ...(geometrias ? { geometries: geometrias } : {}) },
    clave: n.clave
  })
  try {
    for (const grupo of n.grupos) await pedir(`/objects/engagement/records/${interaccion.id}/related/engagement_stakeholder`, { json: { otherId: grupo } })
    for (const tema of n.temas) await pedir(`/objects/engagement/records/${interaccion.id}/related/engagement_topic`, { json: { otherId: tema } })
    for (const p of n.participantes)
      await pedir('/objects/engagement_participant/records', {
        json: { attributes: escribible('engagement_participant', deParticipante, { ...p, engagement: interaccion.id }) }
      })
    for (const q of n.preguntas)
      await pedir('/objects/engagement_question/records', {
        json: { attributes: escribible('engagement_question', dePregunta, { ...q, engagement: interaccion.id }) }
      })
    // la transición lleva el updatedAt que devolvió el alta: los conteos de asistentes que el servidor recalcula al agregar
    // participantes y los vínculos tocan solo derivados y vínculos, que no son un conflicto de If-Match (api.md §3.6). el
    // servidor lo comprueba en las 500 entradas más recientes del historial; una asamblea con más escrituras que esas deja
    // la del alta fuera de la ventana y responde 412: se relee el updatedAt y se reintenta una sola vez
    if (n.transicion) {
      const transicion = (version: string | null) =>
        pedir<Registro>(`/objects/engagement/records/${interaccion.id}/transitions/${n.transicion}`, { metodo: 'POST', version })
      try {
        return await transicion(interaccion.updatedAt)
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 412) throw e
        const actual = await pedir<Registro>(`/objects/engagement/records/${interaccion.id}`)
        return await transicion(actual.updatedAt)
      }
    }
    return interaccion
  } catch (causa) {
    throw new GuardadoParcial(interaccion, causa)
  }
}

export function useGuardarInteraccion() {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (n: NuevaInteraccion) =>
      guardarInteraccion(pedir, n, (objeto) =>
        cliente.ensureQueryData({ queryKey: ['objects', objeto], queryFn: () => pedir<ObjectDefinition>(`/metadata/objects/${objeto}`) })
      ),
    // aunque falle a mitad quedó algo escrito. cambian las interacciones y sus participantes, los vínculos con grupos de
    // interés y temas, los grupos de interés (último contacto, JOB-03) y las cifras de los indicadores y los tableros
    onSettled: () => {
      for (const clave of [
        ['records', 'engagement'],
        ['records', 'engagement_participant'],
        ['records', 'engagement_question'],
        ['records', 'stakeholder'],
        ['record', 'stakeholder'],
        ['related'],
        ['indicator'],
        ['dashboard']
      ])
        void cliente.invalidateQueries({ queryKey: clave })
    }
  })
}
