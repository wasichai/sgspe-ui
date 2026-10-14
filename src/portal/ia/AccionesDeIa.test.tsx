import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  baseDeIa,
  CORRIDA_AI03,
  EQUIPO_IA,
  ESTADO_ACTIVO,
  ESTADO_SIN_ORGANIZACION,
  ESTADO_SIN_PROVEEDOR,
  EVIDENCIA_ACTA,
  GERENCIA_IA,
  INTERACCION,
  QUEJA,
  SUG_BORRADOR,
  SUG_CLASIFICACION
} from '../../test/ia'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { ProveedorDelAsistente } from './Asistente'
import { AccionesDeIa, casosDeEvidencia, casosDeInteraccion } from './AccionesDeIa'

// las acciones de IA de una ficha (screens.md §13; decisiones 19 y 20 del plan): cada caso con su objetivo y su clave; lo que
// dejó por revisar; los errores con su texto; nada si la organización no tiene la IA
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const montarEn = (ui: React.ReactElement, estado: unknown = ESTADO_ACTIVO, extra: MockRoute[] = []) => {
  fetch = mockFetch([...extra, ...baseDeIa(estado)])
  return () => montar(<ProveedorDelAsistente>{ui}</ProveedorDelAsistente>, { usuario: GERENCIA_IA, permisos: EQUIPO_IA })
}
const deLaEvidencia = (
  <AccionesDeIa objeto="evidence" registro={EVIDENCIA_ACTA} proyecto="p1" rotulo="Acta de la asamblea de agosto" casos={['AI-01', 'AI-03']} />
)
const correr = '/sgspe/ai/runs'

describe('acciones de IA en las fichas', () => {
  it('una evidencia en PDF o Word que se descarga ofrece extraer y, si es un acta, detectar compromisos', () => {
    expect(casosDeEvidencia(EVIDENCIA_ACTA, true)).toEqual(['AI-01', 'AI-03'])
    expect(casosDeEvidencia(EVIDENCIA_ACTA, false)).toEqual([])
    const informe = registro('ev2', {
      evidence_type: 'INFORME',
      file: { id: 'f2', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 10 }
    })
    expect(casosDeEvidencia(informe, true)).toEqual(['AI-01'])
    const foto = registro('ev3', { evidence_type: 'ACTA', file: { id: 'f3', contentType: 'image/jpeg', size: 10 } })
    expect(casosDeEvidencia(foto, true)).toEqual([])
    expect(casosDeInteraccion(INTERACCION)).toEqual(['AI-02', 'AI-03'])
    expect(casosDeInteraccion(registro('e2', { project: 'p1', minutes: '' }))).toEqual(['AI-02'])
  })

  it('correr un caso manda su objetivo con clave y dice qué dejó, con el enlace a la bandeja', async () => {
    const abrir = montarEn(deLaEvidencia)
    red = espiarRed([{ method: 'POST', path: correr, responder: () => jsonResponse(CORRIDA_AI03, 201) }])
    abrir()
    const conIa = await screen.findByRole('region', { name: 'Con IA' })
    await userEvent.click(within(conIa).getByRole('button', { name: 'Detectar posibles compromisos' }))
    expect(await within(conIa).findByText('Sugerencias por revisar: 0. Candidatos por revisar: 1.')).toBeInTheDocument()
    expect(within(conIa).getByRole('link', { name: 'Revisar en la bandeja' })).toHaveAttribute('href', '/projects/p1/ai-review')
    const [llamada] = red.a('POST', correr)
    expect(llamada.cuerpo).toEqual({ useCase: 'AI-03', target: { object: 'evidence', recordId: 'ev1' } })
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('una corrida truncada se dice con su texto y se reintenta con la misma clave', async () => {
    const abrir = montarEn(deLaEvidencia)
    let vez = 0
    red = espiarRed([
      {
        method: 'POST',
        path: correr,
        responder: () => (++vez === 1 ? problema(502, 'x', [{ field: 'useCase', message: 'AI_RUN_TRUNCATED' }]) : jsonResponse(CORRIDA_AI03, 201))
      }
    ])
    abrir()
    const conIa = await screen.findByRole('region', { name: 'Con IA' })
    await userEvent.click(within(conIa).getByRole('button', { name: 'Extraer datos del documento' }))
    expect(
      await within(conIa).findByText('La IA no terminó a tiempo y no guardó ninguna propuesta: reintente o pruebe con un documento más corto.')
    ).toBeInTheDocument()
    await userEvent.click(within(conIa).getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(red!.a('POST', correr)).toHaveLength(2))
    const [primera, segunda] = red.a('POST', correr)
    expect(segunda.cabeceras.get('Idempotency-Key')).toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  it('cambiar de caso empieza una acción nueva con otra clave', async () => {
    const abrir = montarEn(deLaEvidencia)
    red = espiarRed([{ method: 'POST', path: correr, responder: () => problema(422, 'x', [{ field: 'target', message: 'AI_NO_TEXT' }]) }])
    abrir()
    const conIa = await screen.findByRole('region', { name: 'Con IA' })
    await userEvent.click(within(conIa).getByRole('button', { name: 'Extraer datos del documento' }))
    expect(await within(conIa).findByText(/no tiene texto que leer/)).toBeInTheDocument()
    expect(within(conIa).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    await userEvent.click(within(conIa).getByRole('button', { name: 'Detectar posibles compromisos' }))
    await waitFor(() => expect(red!.a('POST', correr)).toHaveLength(2))
    const [primera, segunda] = red.a('POST', correr)
    expect(segunda.cabeceras.get('Idempotency-Key')).not.toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  it('sin IA en la organización la ficha no ofrece acciones', async () => {
    montarEn(deLaEvidencia, ESTADO_SIN_ORGANIZACION)()
    await waitFor(() => expect(fetch!.calls.some((c) => c.path === '/sgspe/ai/status')).toBe(true))
    expect(screen.queryByRole('region', { name: 'Con IA' })).not.toBeInTheDocument()
  })

  it('sin proveedor las acciones se ven deshabilitadas con la razón', async () => {
    montarEn(deLaEvidencia, ESTADO_SIN_PROVEEDOR)()
    const conIa = await screen.findByRole('region', { name: 'Con IA' })
    expect(within(conIa).getByText('El servicio de IA no responde: las acciones vuelven cuando responda.')).toBeInTheDocument()
    expect(within(conIa).getByRole('button', { name: 'Extraer datos del documento' })).toBeDisabled()
  })

  it('quien no escribe en el proyecto no corre casos, pero puede preguntar sobre el registro', async () => {
    montarEn(deLaEvidencia, ESTADO_ACTIVO, [{ path: '/objects/project_assignment/records', body: pagina([]) }])()
    const conIa = await screen.findByRole('region', { name: 'Con IA' })
    expect(within(conIa).queryByRole('button', { name: 'Extraer datos del documento' })).not.toBeInTheDocument()
    await userEvent.click(within(conIa).getByRole('button', { name: 'Preguntar sobre este registro' }))
    const panel = await screen.findByRole('dialog', { name: 'Asistente de IA' })
    expect(within(panel).getByText('Contexto: Acta de la asamblea de agosto')).toBeInTheDocument()
  })

  it('las propuestas pendientes sobre el registro llevan a la bandeja', async () => {
    montarEn(<AccionesDeIa objeto="grievance" registro={QUEJA} proyecto="p1" rotulo="Q-001" casos={['AI-08']} />, ESTADO_ACTIVO, [
      { path: '/objects/ai_suggestion/records', body: pagina([SUG_CLASIFICACION]) }
    ])()
    expect(await screen.findByRole('link', { name: 'Propuestas pendientes sobre este registro: 1' })).toHaveAttribute('href', '/projects/p1/ai-review')
    expect(screen.getByRole('button', { name: 'Sugerir categoría, prioridad y tema' })).toBeInTheDocument()
  })

  it('el borrador del acta queda en el editor', async () => {
    const abrir = montarEn(<AccionesDeIa objeto="engagement" registro={INTERACCION} proyecto="p1" rotulo="Asamblea de agosto" casos={['AI-02']} />)
    red = espiarRed([
      {
        method: 'POST',
        path: correr,
        responder: () => jsonResponse({ interaction: 'ai3', interactions: ['ai3'], suggestions: [SUG_BORRADOR], candidates: [] }, 201)
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Redactar el borrador del acta' }))
    expect(await screen.findByText('El borrador quedó listo en el editor del acta.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir el editor del acta' })).toHaveAttribute('href', '/projects/p1/engagements/e1/minutes')
  })

  // plan 7.2b: con el tope de corridas lleno el servidor responde 503 AI_BUSY con Retry-After; no es el proveedor caído
  it('la IA ocupada se dice como tal y se reintenta con la misma clave', async () => {
    const abrir = montarEn(deLaEvidencia)
    let vez = 0
    red = espiarRed([
      {
        method: 'POST',
        path: correr,
        responder: () => {
          if (++vez > 1) return jsonResponse(CORRIDA_AI03, 201)
          const r = problema(503, 'x', [{ field: 'useCase', message: 'AI_BUSY' }])
          r.headers.set('Retry-After', '10')
          return r
        }
      }
    ])
    abrir()
    const conIa = await screen.findByRole('region', { name: 'Con IA' })
    await userEvent.click(within(conIa).getByRole('button', { name: 'Extraer datos del documento' }))
    expect(await within(conIa).findByText('La IA está ocupada: reintente en unos segundos.')).toBeInTheDocument()
    expect(within(conIa).queryByText(/no responde/)).not.toBeInTheDocument()
    await userEvent.click(within(conIa).getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(red!.a('POST', correr)).toHaveLength(2))
    const [primera, segunda] = red.a('POST', correr)
    expect(segunda.cabeceras.get('Idempotency-Key')).toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  // plan 7.2c: AI-07 sin pares candidatos no llama al modelo y responde interaction null, sin sugerencias
  it('una búsqueda de duplicados sin pares dice que no hubo nada que proponer', async () => {
    const abrir = montarEn(
      <AccionesDeIa objeto="project" registro={registro('p1', { name: 'Proyecto Ejemplo A' })} proyecto="p1" rotulo="Proyecto" casos={['AI-07']} />
    )
    red = espiarRed([
      { method: 'POST', path: correr, responder: () => jsonResponse({ interaction: null, interactions: [], suggestions: [], candidates: [] }, 201) }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Buscar posibles duplicados' }))
    expect(await screen.findByText('La IA no encontró nada que proponer.')).toBeInTheDocument()
    expect(red.a('POST', correr)[0].cuerpo).toEqual({ useCase: 'AI-07', target: { object: 'project', recordId: 'p1' } })
  })

  // los casos de useCases dependen de los permisos de la cuenta (AiStatus): la ficha ofrece solo los suyos
  it('ofrece solo los casos que el estado de la IA trae para la cuenta', async () => {
    montarEn(deLaEvidencia, { ...ESTADO_ACTIVO, useCases: ['AI-01', 'AI-05'] })()
    const conIa = await screen.findByRole('region', { name: 'Con IA' })
    expect(within(conIa).getByRole('button', { name: 'Extraer datos del documento' })).toBeInTheDocument()
    expect(within(conIa).queryByRole('button', { name: 'Detectar posibles compromisos' })).not.toBeInTheDocument()
  })
})
