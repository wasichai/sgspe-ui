import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeIa, EQUIPO_IA, ESTADO_ACTIVO, ESTADO_SIN_ORGANIZACION, ESTADO_SIN_PROVEEDOR, GERENCIA_IA, RESPUESTA_DATOS } from '../../test/ia'
import { montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { BotonPreguntar, ProveedorDelAsistente, useAsistente } from './Asistente'

// S05 y flujo 18: el panel pregunta a los datos como la persona; la respuesta trae cómo se obtuvo y los registros consultados;
// la organización sin IA, el proveedor caído y el rol sin el caso se dicen con su razón
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

function AbrirConContexto() {
  const asistente = useAsistente()
  return <button onClick={() => asistente?.abrir({ registro: { objeto: 'grievance', id: 'g1', rotulo: 'Q-001' } })}>Abrir con contexto</button>
}

const montarAsistente = (estado: unknown = ESTADO_ACTIVO, rutas: MockRoute[] = []) => {
  fetch = mockFetch([...rutas, ...baseDeIa(estado)])
  montar(
    <ProveedorDelAsistente>
      <BotonPreguntar />
      <AbrirConContexto />
    </ProveedorDelAsistente>,
    { ruta: '/projects/p1/overview', usuario: GERENCIA_IA, permisos: EQUIPO_IA }
  )
}
const abrirPanel = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Preguntar' }))
  return screen.findByRole('dialog', { name: 'Asistente de IA' })
}
const preguntar = async (panel: HTMLElement, texto: string) => {
  await userEvent.type(within(panel).getByLabelText('Su pregunta'), texto)
  await userEvent.click(within(panel).getByRole('button', { name: 'Preguntar' }))
}

describe('S05 · preguntar a los datos', () => {
  it('pregunta y muestra la respuesta, los registros consultados y cómo lo obtuvo', async () => {
    montarAsistente()
    red = espiarRed([{ method: 'POST', path: '/sgspe/ai/assistant/questions', responder: () => jsonResponse(RESPUESTA_DATOS) }])
    const panel = await abrirPanel()
    expect(within(panel).getByText('El asistente solo lee lo que su cuenta puede leer: no cambia ningún dato.')).toBeInTheDocument()
    await preguntar(panel, '¿Qué compromisos vencieron?')
    expect(await within(panel).findByText('Hay 2 compromisos vencidos en la Comunidad Ejemplo.')).toBeInTheDocument()
    expect(within(panel).getByRole('heading', { name: 'Vencidos' })).toBeInTheDocument()
    expect(within(panel).getByText('Resumen de IA')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Abrir el registro consultado 1' })).toHaveAttribute('href', '/r/commitment/c1')
    await userEvent.click(within(panel).getByText('Cómo lo obtuvo (pasos: 2)'))
    expect(within(panel).getByText('query_records')).toBeInTheDocument()
    // el resumen de un paso llega seudonimizado: su marcador por llamada se dice como reservado
    expect(within(panel).getByText('persona')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/ai/assistant/questions')[0].cuerpo).toEqual({ question: '¿Qué compromisos vencieron?' })
  })

  it('una pregunta vacía no se envía', async () => {
    montarAsistente()
    red = espiarRed()
    const panel = await abrirPanel()
    await userEvent.click(within(panel).getByRole('button', { name: 'Preguntar' }))
    expect(within(panel).getByText('Escriba una pregunta.')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/ai/assistant/questions')).toHaveLength(0)
  })

  it('una respuesta truncada lo dice', async () => {
    montarAsistente()
    red = espiarRed([{ method: 'POST', path: '/sgspe/ai/assistant/questions', responder: () => jsonResponse({ ...RESPUESTA_DATOS, truncated: true }) }])
    const panel = await abrirPanel()
    await preguntar(panel, '¿Todo?')
    expect(
      await within(panel).findByText('La respuesta quedó incompleta: la IA llegó a su límite de pasos. Pruebe con una pregunta más acotada.')
    ).toBeInTheDocument()
    // la respuesta truncada trae un aviso fijo del servidor: el portal dice el suyo y no repite el otro
    expect(within(panel).queryByText('Hay 2 compromisos vencidos en la Comunidad Ejemplo.')).not.toBeInTheDocument()
    expect(within(panel).getAllByText(/La respuesta quedó incompleta/)).toHaveLength(1)
  })

  it('una pregunta demasiado larga para la IA dice cómo acortarla', async () => {
    montarAsistente()
    red = espiarRed([
      { method: 'POST', path: '/sgspe/ai/assistant/questions', responder: () => problema(422, 'x', [{ field: 'question', message: 'AI_INPUT_TOO_LARGE' }]) }
    ])
    const panel = await abrirPanel()
    await preguntar(panel, '¿Qué vence?')
    expect(await within(panel).findByText('La pregunta es demasiado larga para la IA: acórtela y vuelva a preguntar.')).toBeInTheDocument()
  })

  it('un 503 del proveedor ofrece volver a preguntar lo mismo', async () => {
    montarAsistente()
    let vez = 0
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/ai/assistant/questions',
        responder: () => (++vez === 1 ? problema(503, 'x', [{ field: 'provider', message: 'AI_UNAVAILABLE' }]) : jsonResponse(RESPUESTA_DATOS))
      }
    ])
    const panel = await abrirPanel()
    await preguntar(panel, '¿Qué vence?')
    expect(await within(panel).findByText('El servicio de IA no responde. Reintente en unos minutos.')).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Volver a preguntar' }))
    expect(await within(panel).findByText('Hay 2 compromisos vencidos en la Comunidad Ejemplo.')).toBeInTheDocument()
    const llamadas = red.a('POST', '/sgspe/ai/assistant/questions')
    expect(llamadas).toHaveLength(2)
    expect(llamadas[1].cuerpo).toEqual(llamadas[0].cuerpo)
  })

  it('un 503 de la organización sin IA no ofrece volver a preguntar', async () => {
    montarAsistente()
    red = espiarRed([
      { method: 'POST', path: '/sgspe/ai/assistant/questions', responder: () => problema(503, 'x', [{ field: 'organization', message: 'AI_UNAVAILABLE' }]) }
    ])
    const panel = await abrirPanel()
    await preguntar(panel, '¿Qué vence?')
    expect(await within(panel).findByText('Su organización no tiene la IA activada.')).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Volver a preguntar' })).not.toBeInTheDocument()
  })

  it('con la organización sin IA el panel lo dice y no deja preguntar', async () => {
    montarAsistente(ESTADO_SIN_ORGANIZACION)
    const panel = await abrirPanel()
    expect(
      within(panel).getByText('Su organización no tiene la IA activada. Las propuestas ya registradas se siguen revisando en la bandeja de cada proyecto.')
    ).toBeInTheDocument()
    expect(within(panel).queryByLabelText('Su pregunta')).not.toBeInTheDocument()
  })

  it('sin proveedor lo dice con Reintentar', async () => {
    montarAsistente(ESTADO_SIN_PROVEEDOR)
    const panel = await abrirPanel()
    expect(within(panel).getByText('El servicio de IA no responde en este momento.')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('a un rol sin el caso se le dice que no está disponible para su rol', async () => {
    montarAsistente({ enabled: true, providerAvailable: true, useCases: [] })
    const panel = await abrirPanel()
    expect(within(panel).getByText('La IA no está disponible para su rol.')).toBeInTheDocument()
  })

  it('desde una ficha muestra el contexto y prellena la pregunta con el objeto y el id, nunca con el rótulo', async () => {
    montarAsistente()
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir con contexto' }))
    const panel = await screen.findByRole('dialog', { name: 'Asistente de IA' })
    expect(within(panel).getByText('Contexto: Q-001')).toBeInTheDocument()
    await waitFor(() => expect(within(panel).getByLabelText('Su pregunta')).toHaveValue('Sobre el registro grievance g1: '))
  })
})
