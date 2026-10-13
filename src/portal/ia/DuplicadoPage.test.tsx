import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeIa, EQUIPO_IA, GERENCIA_IA, SUG_CLASIFICACION, SUG_DUPLICADO, TRANSICIONES_DE_SUGERENCIA } from '../../test/ia'
import { montar, pagina, ubicacion } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { DuplicadoPage } from './DuplicadoPage'

// «Posible duplicado» (screens.md §13, AI-07): los dos registros lado a lado; en una queja, aceptar escribe duplicate_of y la
// rechaza con respuesta; «No es duplicado» rechaza la propuesta; nada se fusiona (RQ-AI-015)
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const montarDuplicado = (id = 's3', extra: MockRoute[] = [], aceptar: (() => Response) | null = null) => {
  fetch = mockFetch([
    ...extra,
    { path: '/objects/ai_suggestion/records/s3', body: SUG_DUPLICADO },
    { path: '/objects/ai_suggestion/records/s1', body: SUG_CLASIFICACION },
    { path: /^\/objects\/ai_suggestion\/records\/s\d\/transitions$/, body: TRANSICIONES_DE_SUGERENCIA },
    ...baseDeIa()
  ])
  red = espiarRed([
    {
      method: 'POST',
      path: '/sgspe/ai-suggestions/s3/accept',
      responder: aceptar ?? (() => jsonResponse({ suggestion: { ...SUG_DUPLICADO, state: 'accepted' }, result: null }))
    },
    { method: 'POST', path: '/objects/ai_suggestion/records/s3/transitions/reject', responder: () => jsonResponse({ ...SUG_DUPLICADO, state: 'rejected' }) }
  ])
  montar(<DuplicadoPage />, {
    ruta: `/projects/p1/ai-review/${id}`,
    camino: '/projects/:projectId/ai-review/:suggestionId',
    usuario: GERENCIA_IA,
    permisos: EQUIPO_IA
  })
}

describe('posible duplicado', () => {
  it('compara los dos registros lado a lado con las coincidencias marcadas y sus razones', async () => {
    montarDuplicado()
    const tabla = await screen.findByRole('table', { name: 'Posible duplicado' })
    await waitFor(() => expect(within(within(tabla).getByRole('row', { name: /^code/ })).getByText('Difiere')).toBeInTheDocument())
    expect(within(within(tabla).getByRole('row', { name: /^description/ })).getByText('Coincide')).toBeInTheDocument()
    expect(within(tabla).getByText('Q-001')).toBeInTheDocument()
    expect(within(tabla).getByText('Q-002')).toBeInTheDocument()
    expect(screen.getByText('Mismo anexo y misma fecha')).toBeInTheDocument()
  })

  // api.md §4.14 y SuggestionAcceptance (plan 7.2b): en una queja la respuesta es opcional; sin ella solo se escribe duplicate_of
  it('en una queja, «Es duplicado» sin respuesta solo vincula el duplicado, con su motivo, y vuelve a la bandeja', async () => {
    montarDuplicado()
    await userEvent.click(await screen.findByRole('radio', { name: 'Es duplicado' }))
    expect(screen.getByText('Al confirmar, esta queja queda vinculada como duplicado de la otra; su estado no cambia.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(screen.queryByText('Este dato es obligatorio')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Mismo pedido, misma fecha')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai-suggestions/s3/accept')).toHaveLength(1))
    expect(red!.a('POST', '/sgspe/ai-suggestions/s3/accept')[0].cuerpo).toEqual({ attributes: { other_record_id: 'g2' } })
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/ai-review'))
  })

  it('en una queja, con respuesta además la rechaza como duplicada, y lo dice antes de confirmar', async () => {
    montarDuplicado()
    await userEvent.click(await screen.findByRole('radio', { name: 'Es duplicado' }))
    const respuesta = screen.getByLabelText('Respuesta a quien planteó la queja (opcional)')
    expect(respuesta).toHaveAccessibleDescription(
      'Con respuesta, la queja además se rechaza como duplicada: solo puede hacerlo quien tiene ese paso en el flujo de quejas. Sin respuesta, solo se vincula.'
    )
    await userEvent.type(respuesta, 'Su pedido se atiende en la queja Q-002.')
    expect(screen.getByText('Al confirmar, esta queja queda vinculada como duplicado de la otra y se rechaza con esta respuesta.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Mismo pedido, misma fecha')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai-suggestions/s3/accept')).toHaveLength(1))
    expect(red!.a('POST', '/sgspe/ai-suggestions/s3/accept')[0].cuerpo).toEqual({
      attributes: { other_record_id: 'g2', response: 'Su pedido se atiende en la queja Q-002.' }
    })
  })

  it('con respuesta y sin el rol que rechaza la queja, sugiere dejar la respuesta vacía', async () => {
    montarDuplicado('s3', [], () => problema(403, 'x', [{ field: '', message: 'ROLE_REQUIRED' }]))
    await userEvent.click(await screen.findByRole('radio', { name: 'Es duplicado' }))
    await userEvent.type(screen.getByLabelText('Respuesta a quien planteó la queja (opcional)'), 'Se atiende en la Q-002.')
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Mismo pedido')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Su rol no puede rechazar la queja: deje la respuesta vacía para solo vincular el duplicado.')).toBeInTheDocument()
  })

  it('una respuesta escrita en «Es duplicado» no bloquea «No es duplicado» ni se manda', async () => {
    montarDuplicado()
    await userEvent.click(await screen.findByRole('radio', { name: 'Es duplicado' }))
    await userEvent.type(screen.getByLabelText('Respuesta a quien planteó la queja (opcional)'), 'Llamar a [[PERSONA]')
    await userEvent.click(screen.getByRole('radio', { name: 'No es duplicado' }))
    expect(screen.getByText('Al confirmar, la propuesta queda rechazada con su motivo.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Son anexos distintos')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/ai_suggestion/records/s3/transitions/reject')).toHaveLength(1))
    expect(red!.a('POST', '/objects/ai_suggestion/records/s3/transitions/reject')[0].cuerpo ?? {}).not.toHaveProperty('response')
    expect(red!.a('POST', '/sgspe/ai-suggestions/s3/accept')).toHaveLength(0)
  })

  it('«No es duplicado» rechaza la propuesta por WF-K con su motivo', async () => {
    montarDuplicado()
    await userEvent.click(await screen.findByRole('radio', { name: 'No es duplicado' }))
    expect(screen.getByText('Al confirmar, la propuesta queda rechazada con su motivo.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Son anexos distintos')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/ai_suggestion/records/s3/transitions/reject')).toHaveLength(1))
    expect(red!.a('POST', '/objects/ai_suggestion/records/s3/transitions/reject')[0].cabeceras.get('X-Change-Reason')).toBe("UTF-8''Son%20anexos%20distintos")
    expect(red!.a('POST', '/sgspe/ai-suggestions/s3/accept')).toHaveLength(0)
  })

  it('una propuesta que no es un posible duplicado lo dice', async () => {
    montarDuplicado('s1')
    expect(await screen.findByText('Esta propuesta no es un posible duplicado.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a la bandeja' })).toHaveAttribute('href', '/projects/p1/ai-review')
  })

  it('sin asignación vigente al proyecto no ofrece decidir', async () => {
    montarDuplicado('s3', [{ path: '/objects/project_assignment/records', body: pagina([]) }])
    const tabla = await screen.findByRole('table', { name: 'Posible duplicado' })
    await waitFor(() => expect(within(within(tabla).getByRole('row', { name: /^code/ })).getByText('Difiere')).toBeInTheDocument())
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryByRole('radio', { name: 'Es duplicado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  })

  // plan 7.2b: la queja con respuesta se rechaza por WF-E1; si ya no se puede rechazar desde su estado, o la otra es de otro
  // proyecto o no se lee, se dice con su texto
  it.each([
    [
      409,
      'STATE_MISMATCH',
      'attributes.response',
      'La queja ya no se puede rechazar desde su estado: deje la respuesta vacía para solo vincular el duplicado.'
    ],
    [409, 'PROJECT_MISMATCH', 'attributes.other_record_id', 'El otro registro del par es de otro proyecto: no se marca como duplicado.'],
    [400, 'DUPLICATE_NOT_FOUND', 'attributes.other_record_id', 'El otro registro del par no existe o su cuenta no lo lee.']
  ])('un %i %s sobre %s se dice con su texto', async (estado, codigo, campo, texto) => {
    montarDuplicado('s3', [], () => problema(estado, 'x', [{ field: campo, message: codigo }]))
    await userEvent.click(await screen.findByRole('radio', { name: 'Es duplicado' }))
    await userEvent.type(screen.getByLabelText('Respuesta a quien planteó la queja (opcional)'), 'Su pedido se atiende en la queja Q-002.')
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Mismo pedido')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(texto)).toBeInTheDocument()
  })
})
