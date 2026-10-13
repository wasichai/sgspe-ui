import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeIa, EQUIPO_IA, GERENCIA_IA, SUG_CLASIFICACION, SUG_DUPLICADO, TRANSICIONES_DE_SUGERENCIA } from '../../test/ia'
import { montar, ubicacion } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
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

const montarDuplicado = (id = 's3') => {
  fetch = mockFetch([
    { path: '/objects/ai_suggestion/records/s3', body: SUG_DUPLICADO },
    { path: '/objects/ai_suggestion/records/s1', body: SUG_CLASIFICACION },
    { path: /^\/objects\/ai_suggestion\/records\/s\d\/transitions$/, body: TRANSICIONES_DE_SUGERENCIA },
    ...baseDeIa()
  ])
  red = espiarRed([
    {
      method: 'POST',
      path: '/sgspe/ai-suggestions/s3/accept',
      responder: () => jsonResponse({ suggestion: { ...SUG_DUPLICADO, state: 'accepted' }, result: null })
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

  it('en una queja, «Es duplicado» pide la respuesta y el motivo, acepta con la otra queja y vuelve a la bandeja', async () => {
    montarDuplicado()
    await userEvent.click(await screen.findByRole('radio', { name: 'Es duplicado' }))
    expect(screen.getByText('Al confirmar, una de las dos quejas queda rechazada como duplicado de la otra, con esta respuesta.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByText('Este dato es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Respuesta a quien planteó la queja'), 'Su pedido se atiende en la queja Q-002.')
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Mismo pedido, misma fecha')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai-suggestions/s3/accept')).toHaveLength(1))
    expect(red!.a('POST', '/sgspe/ai-suggestions/s3/accept')[0].cuerpo).toEqual({
      attributes: { other_record_id: 'g2', response: 'Su pedido se atiende en la queja Q-002.' }
    })
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/ai-review'))
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
})
