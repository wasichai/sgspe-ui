import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CORRIDA_AI03, ESTADO_ACTIVO, RESPUESTA_DATOS, SUG_CLASIFICACION } from '../../test/ia'
import { montar } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { useMensajeDeError } from '../componentes/errores'
import { ErrorDeSgspe } from '../datos/http'
import { disponibilidadDe, useAceptarSugerencia, useCorrida, useEstadoDeIa, usePreguntarALosDatos } from './contrato'

// el contrato de F7 que lee el portal (api.md §3.3 y §4.14): el estado, las corridas con su clave, las preguntas sin clave,
// la aceptación con IK, IM y CR, y los textos de los errores de la IA
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

function Estado() {
  const estado = useEstadoDeIa()
  return <p>{estado.data ? `activa:${String(estado.data.enabled)}` : estado.isError ? 'sin estado' : 'leyendo'}</p>
}

function Acciones() {
  const corrida = useCorrida()
  const aceptar = useAceptarSugerencia()
  const preguntar = usePreguntarALosDatos()
  return (
    <>
      <button onClick={() => corrida.mutate({ caso: 'AI-03', objetivo: { object: 'evidence', recordId: 'ev1' } })}>Correr</button>
      <button onClick={() => aceptar.mutate({ sugerencia: SUG_CLASIFICACION, atributos: { field: 'category', value: 'EMPLEO' }, motivo: 'Revisado' })}>
        Aceptar
      </button>
      <button onClick={() => preguntar.mutate('¿Qué vence?')}>Preguntar</button>
    </>
  )
}

function Mensaje({ error }: { error: unknown }) {
  const mensaje = useMensajeDeError()
  return <p>{mensaje(error)}</p>
}
const con = (estado: number, codigo: string, campo: string) => new ErrorDeSgspe(estado, 'x', [{ field: campo, message: codigo }], 'c-1')

describe('contrato de F7', () => {
  it('la disponibilidad dice primero el servidor, luego la organización, el proveedor y el rol', () => {
    expect(disponibilidadDe(undefined, 'AI-05')).toEqual({ disponible: false, motivo: 'sinServidor' })
    expect(disponibilidadDe({ ...ESTADO_ACTIVO, enabled: false, providerAvailable: false }, 'AI-05')).toEqual({ disponible: false, motivo: 'organizacion' })
    expect(disponibilidadDe({ ...ESTADO_ACTIVO, providerAvailable: false }, 'AI-05')).toEqual({ disponible: false, motivo: 'proveedor' })
    expect(disponibilidadDe({ ...ESTADO_ACTIVO, useCases: ['AI-05'] }, 'AI-06')).toEqual({ disponible: false, motivo: 'rol' })
    expect(disponibilidadDe(ESTADO_ACTIVO, 'AI-03')).toEqual({ disponible: true })
  })

  it('lee el estado de la IA; un backend sin F7 responde 404 y no hay estado', async () => {
    fetch = mockFetch([{ path: '/sgspe/ai/status', body: ESTADO_ACTIVO }])
    const { unmount } = montar(<Estado />)
    expect(await screen.findByText('activa:true')).toBeInTheDocument()
    unmount()
    fetch.restore()
    fetch = mockFetch([])
    montar(<Estado />)
    expect(await screen.findByText('sin estado')).toBeInTheDocument()
  })

  it('una corrida manda el caso y el objetivo con Idempotency-Key; una pregunta va sin clave', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      { method: 'POST', path: '/sgspe/ai/runs', responder: () => jsonResponse(CORRIDA_AI03, 201) },
      { method: 'POST', path: '/sgspe/ai/assistant/questions', responder: () => jsonResponse(RESPUESTA_DATOS) }
    ])
    montar(<Acciones />)
    await userEvent.click(screen.getByRole('button', { name: 'Correr' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai/runs')).toHaveLength(1))
    const [corrida] = red.a('POST', '/sgspe/ai/runs')
    expect(corrida.cuerpo).toEqual({ useCase: 'AI-03', target: { object: 'evidence', recordId: 'ev1' } })
    expect(corrida.cabeceras.get('Idempotency-Key')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Preguntar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai/assistant/questions')).toHaveLength(1))
    const [pregunta] = red.a('POST', '/sgspe/ai/assistant/questions')
    expect(pregunta.cuerpo).toEqual({ question: '¿Qué vence?' })
    expect(pregunta.cabeceras.has('Idempotency-Key')).toBe(false)
  })

  it('aceptar manda los valores revisados con IK, If-Match y el motivo', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/ai-suggestions/s1/accept',
        responder: () => jsonResponse({ suggestion: { ...SUG_CLASIFICACION, state: 'accepted' }, result: null })
      }
    ])
    montar(<Acciones />)
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai-suggestions/s1/accept')).toHaveLength(1))
    const [llamada] = red.a('POST', '/sgspe/ai-suggestions/s1/accept')
    expect(llamada.cuerpo).toEqual({ attributes: { field: 'category', value: 'EMPLEO' } })
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-09T15:00:00Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Revisado")
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('los errores de la IA se dicen con su texto, y AI_UNAVAILABLE según su campo', () => {
    fetch = mockFetch([])
    montar(
      <>
        <Mensaje error={con(503, 'AI_UNAVAILABLE', 'organization')} />
        <Mensaje error={con(503, 'AI_UNAVAILABLE', 'provider')} />
        <Mensaje error={con(422, 'AI_INPUT_TOO_LARGE', 'target')} />
        <Mensaje error={con(422, 'AI_NO_TEXT', 'target')} />
        <Mensaje error={con(502, 'AI_RUN_TRUNCATED', 'useCase')} />
      </>
    )
    expect(screen.getByText('Su organización no tiene la IA activada.')).toBeInTheDocument()
    expect(screen.getByText('El servicio de IA no responde. Reintente en unos minutos.')).toBeInTheDocument()
    expect(screen.getByText('El documento tiene más texto del que la IA puede leer de una vez: no se guardó ninguna propuesta.')).toBeInTheDocument()
    expect(
      screen.getByText('El documento no tiene texto que leer (por ejemplo, un PDF escaneado) o no es PDF ni Word: no se guardó ninguna propuesta.')
    ).toBeInTheDocument()
    expect(screen.getByText('La IA no terminó a tiempo y no guardó ninguna propuesta: reintente o pruebe con un documento más corto.')).toBeInTheDocument()
  })

  // plan 7.2a (decisión 13): la pregunta de AI-05 tiene tope (sgspe.ai.limits.question-chars) y responde AI_INPUT_TOO_LARGE
  // sobre question, que no es un documento
  it('una pregunta demasiado larga se dice como pregunta, no como documento', () => {
    fetch = mockFetch([])
    montar(<Mensaje error={con(422, 'AI_INPUT_TOO_LARGE', 'question')} />)
    expect(screen.getByText('La pregunta es demasiado larga para la IA: acórtela y vuelva a preguntar.')).toBeInTheDocument()
  })

  // plan 7.2b: AI_BUSY es el tope de corridas a la vez, no el proveedor caído; y los códigos de la corrida según su campo
  it('la IA ocupada no se dice como proveedor caído, y los rechazos de la corrida dicen su causa', () => {
    fetch = mockFetch([])
    montar(
      <>
        <Mensaje error={con(503, 'AI_BUSY', 'useCase')} />
        <Mensaje error={con(400, 'PROJECT_REQUIRED', 'target')} />
        <Mensaje error={con(403, 'FIELD_NOT_READABLE', 'person.given_names')} />
        <Mensaje error={con(400, 'TOO_MANY_RECORDS', 'target')} />
        <Mensaje error={con(403, 'PERSON_REQUIRED', '')} />
      </>
    )
    expect(screen.getByText('La IA está ocupada: reintente en unos segundos.')).toBeInTheDocument()
    expect(screen.queryByText('El servicio de IA no responde. Reintente en unos minutos.')).not.toBeInTheDocument()
    expect(screen.getByText('La IA solo lee documentos de un proyecto: este es de toda la organización.')).toBeInTheDocument()
    expect(screen.getByText('Su rol no puede leer los nombres de las personas, que la IA necesita para proteger los datos de la fuente.')).toBeInTheDocument()
    expect(screen.getByText('Hay demasiados registros para buscar posibles duplicados de una vez.')).toBeInTheDocument()
    expect(screen.getByText('Esta decisión la toma una persona, no una cuenta de servicio.')).toBeInTheDocument()
  })

  // plan 7.2b: los rechazos de la aceptación según su código y su campo (api.md §4.14)
  it('los rechazos de la aceptación dicen su causa', () => {
    fetch = mockFetch([])
    montar(
      <>
        <Mensaje error={con(409, 'SUGGESTION_NOT_ACCEPTABLE', 'suggestion_kind')} />
        <Mensaje error={con(400, 'PSEUDONYM_NOT_ALLOWED', 'attributes.stakeholder.stakeholder_type')} />
        <Mensaje error={con(400, 'FIELD_NOT_ALLOWED', 'attributes.field')} />
        <Mensaje error={con(400, 'DUPLICATE_NOT_FOUND', 'attributes.other_record_id')} />
        <Mensaje error={con(409, 'PROJECT_MISMATCH', 'attributes.other_record_id')} />
        <Mensaje error={con(409, 'STATE_MISMATCH', 'attributes.response')} />
        <Mensaje error={con(403, 'OBJECT_NOT_READABLE', 'target_record_id')} />
        <Mensaje error={con(400, 'PROJECT_REQUIRED', 'attributes.stakeholder')} />
      </>
    )
    expect(screen.getByText('Esta propuesta no se acepta: solo se rechaza o se marca como duplicada.')).toBeInTheDocument()
    expect(screen.getByText('Quedan datos reservados por la IA: reemplácelos por los valores reales antes de aceptar.')).toBeInTheDocument()
    expect(screen.getByText('La propuesta solo permite corregir el valor, no el dato que cambia.')).toBeInTheDocument()
    expect(screen.getByText('El otro registro del par no existe o su cuenta no lo lee.')).toBeInTheDocument()
    expect(screen.getByText('El otro registro del par es de otro proyecto: no se marca como duplicado.')).toBeInTheDocument()
    expect(screen.getByText('La queja ya no se puede rechazar desde su estado: deje la respuesta vacía para solo vincular el duplicado.')).toBeInTheDocument()
    expect(screen.getByText('El registro de la propuesta no existe o su cuenta no lo lee.')).toBeInTheDocument()
    expect(screen.getByText('La propuesta no es de un proyecto: no se puede registrar su grupo de interés.')).toBeInTheDocument()
  })
})
