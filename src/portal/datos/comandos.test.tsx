import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createApiClient } from '@wasichai/core'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { useMensajeDeError } from '../componentes/errores'
import { enviarComando, REENVIOS_EN_CURSO, useComando } from './comandos'
import { crearPedido } from './http'
import { useCrear } from './registros'

// api.md §3.5 (decisión D3): una clave por acción, repetida en cada reintento; 409 IDEMPOTENCY_IN_FLIGHT espera Retry-After y
// reenvía con la misma clave; 422 IDEMPOTENCY_KEY_REUSED y un éxito renuevan la clave
let fetch: FetchMock | null = null
let red: Red | null = null
const cliente = createApiClient({ baseUrl: '/api', storagePrefix: 'sgspe' })
beforeEach(() => {
  localStorage.clear()
  cliente.setToken('t')
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const enCurso = () => problema(409, 'en curso', [{ field: 'Idempotency-Key', message: 'IDEMPOTENCY_IN_FLIGHT' }])
const conEspera = (respuesta: Response) => {
  respuesta.headers.set('Retry-After', '2')
  return respuesta
}

describe('enviarComando', () => {
  it('con la clave en curso espera Retry-After y reenvía con la misma clave', async () => {
    fetch = mockFetch([])
    let veces = 0
    red = espiarRed([
      { method: 'POST', path: '/sgspe/commitments/c1/reschedules', responder: () => (++veces === 1 ? conEspera(enCurso()) : jsonResponse({ ok: true }, 201)) }
    ])
    const esperas: number[] = []
    const r = await enviarComando<{ ok: boolean }>(
      crearPedido(cliente, vi.fn()),
      { ruta: '/sgspe/commitments/c1/reschedules', json: { a: 1 } },
      'k-1',
      async (ms) => {
        esperas.push(ms)
      }
    )
    expect(r).toEqual({ ok: true })
    expect(esperas).toEqual([2000])
    const [primera, segunda] = red.a('POST', '/sgspe/commitments/c1/reschedules')
    expect(primera.cabeceras.get('Idempotency-Key')).toBe('k-1')
    expect(segunda.cabeceras.get('Idempotency-Key')).toBe('k-1')
  })

  it('se rinde tras unos pocos reenvíos y deja subir el error', async () => {
    fetch = mockFetch([])
    red = espiarRed([{ method: 'POST', path: '/sgspe/evidence', responder: () => enCurso() }])
    await expect(enviarComando(crearPedido(cliente, vi.fn()), { ruta: '/sgspe/evidence', json: {} }, 'k', async () => {})).rejects.toMatchObject({
      status: 409
    })
    expect(red.a('POST', '/sgspe/evidence')).toHaveLength(REENVIOS_EN_CURSO + 1)
  })

  it('un PATCH sin clave no manda la cabecera y lleva la versión y el motivo', async () => {
    fetch = mockFetch([{ method: 'PATCH', path: '/sgspe/deliveries/d1', body: {} }])
    red = espiarRed()
    await enviarComando(crearPedido(cliente, vi.fn()), { ruta: '/sgspe/deliveries/d1', metodo: 'PATCH', json: {}, version: 'v1', motivo: 'corrige' }, null)
    const [llamada] = red.llamadas
    expect(llamada.cabeceras.has('Idempotency-Key')).toBe(false)
    expect(llamada.cabeceras.get('If-Match')).toBe('"v1"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''corrige")
  })
})

// una pantalla mínima con un comando: «Enviar» lo manda, «Otra acción» empieza una nueva
function Prueba() {
  const [n, setN] = useState(0)
  const comando = useComando<unknown, number>((valor) => ({ ruta: '/sgspe/commitment-candidates', json: { attributes: { proposed_text: `t${valor}` } } }))
  return (
    <>
      <button type="button" onClick={() => comando.mutate(n, { onSettled: () => setN(n + 1) })}>
        Enviar
      </button>
      <button type="button" onClick={comando.nuevaAccion}>
        Otra acción
      </button>
      <p>{comando.isError ? 'falló' : comando.isSuccess ? 'listo' : 'quieto'}</p>
    </>
  )
}

describe('useComando', () => {
  it('repite la clave tras un fallo y la renueva tras un éxito, una clave reusada o una acción nueva', async () => {
    fetch = mockFetch([])
    const respuestas = [
      () => problema(400, 'mal', [{ field: 'attributes.proposed_text', message: 'FIELD_REQUIRED' }]),
      () => jsonResponse({ id: 'k1' }, 201),
      () => problema(422, 'reusada', [{ field: 'Idempotency-Key', message: 'IDEMPOTENCY_KEY_REUSED' }]),
      () => problema(400, 'mal', []),
      () => jsonResponse({ id: 'k2' }, 201)
    ]
    let i = 0
    red = espiarRed([{ method: 'POST', path: '/sgspe/commitment-candidates', responder: () => respuestas[i++]() }])
    montar(<Prueba />)
    const enviar = screen.getByRole('button', { name: 'Enviar' })
    await userEvent.click(enviar)
    await screen.findByText('falló')
    await userEvent.click(enviar)
    await screen.findByText('listo')
    await userEvent.click(enviar)
    await screen.findByText('falló')
    await userEvent.click(enviar)
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitment-candidates')).toHaveLength(4))
    await userEvent.click(screen.getByRole('button', { name: 'Otra acción' }))
    await screen.findByText('quieto')
    await userEvent.click(enviar)
    await screen.findByText('listo')
    const claves = red.a('POST', '/sgspe/commitment-candidates').map((l) => l.cabeceras.get('Idempotency-Key'))
    // el fallo y su reintento comparten clave; el éxito la renueva; la reusada la renueva; la acción nueva la renueva
    expect(claves[0]).toBe(claves[1])
    expect(claves[2]).not.toBe(claves[1])
    expect(claves[3]).not.toBe(claves[2])
    expect(claves[4]).not.toBe(claves[3])
  })
})

// el alta genérica con la cabecera nativa de wasichai (WAS-ADR-0058): sus errores traen texto libre sobre el campo de la cabecera
function Alta() {
  const crear = useCrear('commitment_action')
  const mensaje = useMensajeDeError()
  return (
    <>
      <button type="button" onClick={() => crear.mutate({ atributos: { description: 'Visitar la obra' } })}>
        Crear
      </button>
      <p>{crear.isError ? mensaje(crear.error) : crear.isSuccess ? 'creada' : 'quieta'}</p>
    </>
  )
}

describe('alta genérica con Idempotency-Key nativa', () => {
  it('manda la clave, espera el 409 en curso sin código y un 422 sobre la clave dice que la acción ya se registró', async () => {
    fetch = mockFetch([{ path: '/metadata/objects/commitment_action', body: definicion('commitment_action', ['description']) }])
    const nativo = (status: number) => {
      const r = problema(status, 'x', [{ field: 'Idempotency-Key', message: 'a request with this key is in flight; send it again later' }])
      r.headers.set('Retry-After', '0')
      return r
    }
    const respuestas = [() => nativo(409), () => jsonResponse({ id: 'a1', attributes: {} }, 201), () => nativo(422)]
    let i = 0
    red = espiarRed([{ method: 'POST', path: '/objects/commitment_action/records', responder: () => respuestas[i++]() }])
    montar(<Alta />)
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(await screen.findByText('creada')).toBeInTheDocument()
    const [enCurso, reenvio] = red.a('POST', '/objects/commitment_action/records')
    expect(enCurso.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(reenvio.cabeceras.get('Idempotency-Key')).toBe(enCurso.cabeceras.get('Idempotency-Key'))
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(await screen.findByText('Esta acción ya se registró con otros datos: recargue para ver lo registrado.')).toBeInTheDocument()
    expect(red.a('POST', '/objects/commitment_action/records')[2].cabeceras.get('Idempotency-Key')).not.toBe(enCurso.cabeceras.get('Idempotency-Key'))
  })
})
