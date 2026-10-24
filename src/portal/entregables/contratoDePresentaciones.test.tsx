import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRESENTACION_EN_COLA, PRESENTACION_LISTA } from '../../test/f8'
import { montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import {
  accionDelNivel,
  consultaDePresentaciones,
  nivelesPosibles,
  pideLista,
  rutaDeLaPresentacion,
  usePedirPresentacion,
  usePedirVideo,
  usePresentaciones
} from './contrato'

// el contrato de las presentaciones (api.md §4.12, ADR-0031): los niveles que admite cada público sobre el de la versión, la acción
// de descarga del nivel, la lista de verificación de EXTERNO y PUBLICO, el pedido con clave, el MP4 a pedido y el sondeo
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
  vi.useRealTimers()
})

describe('reglas de las presentaciones', () => {
  it('el nivel es igual o más restrictivo que el de la versión y el público lo admite', () => {
    expect(nivelesPosibles('INTERNO', 'DIRECCION')).toEqual(['INTERNO', 'EXTERNO', 'PUBLICO'])
    expect(nivelesPosibles('EXTERNO', 'CAMPO')).toEqual(['EXTERNO', 'PUBLICO'])
    expect(nivelesPosibles('INTERNO', 'INSTITUCIONES')).toEqual(['EXTERNO', 'PUBLICO'])
    expect(nivelesPosibles('EXTERNO', 'COMUNIDAD')).toEqual(['PUBLICO'])
    expect(nivelesPosibles('OTRO', 'DIRECCION')).toEqual([])
  })

  it('INTERNO pide DOWNLOAD_RESTRICTED y los demás EXPORT; solo INTERNO va sin lista de verificación', () => {
    expect(accionDelNivel('INTERNO')).toBe('DOWNLOAD_RESTRICTED')
    expect(accionDelNivel('EXTERNO')).toBe('EXPORT')
    expect(accionDelNivel('PUBLICO')).toBe('EXPORT')
    expect(pideLista('INTERNO')).toBe(false)
    expect(pideLista('EXTERNO')).toBe(true)
    expect(pideLista('PUBLICO')).toBe(true)
  })

  it('las rutas codifican el id y llevan la confirmación de la lista solo si se confirmó', () => {
    expect(rutaDeLaPresentacion('p 1', 'content', false)).toBe('/sgspe/presentations/p%201/content')
    expect(rutaDeLaPresentacion('p1', 'spec', true)).toBe('/sgspe/presentations/p1/spec?checklistConfirmed=true')
    expect(rutaDeLaPresentacion('p1', 'video', true)).toBe('/sgspe/presentations/p1/video?checklistConfirmed=true')
  })

  it('consulta cada 5 s mientras una presentación o su video está en cola o en proceso, y para ante un error', () => {
    expect(consultaDePresentaciones([PRESENTACION_EN_COLA], false)).toBe(5000)
    expect(consultaDePresentaciones([{ ...PRESENTACION_LISTA, videoStatus: 'EN PROCESO' }], false)).toBe(5000)
    expect(consultaDePresentaciones([PRESENTACION_LISTA], false)).toBe(false)
    expect(consultaDePresentaciones([PRESENTACION_EN_COLA], true)).toBe(false)
    expect(consultaDePresentaciones(undefined, false)).toBe(false)
  })
})

function Acciones() {
  const pedir = usePedirPresentacion('d1')
  const video = usePedirVideo('d1')
  return (
    <>
      <button onClick={() => pedir.mutate({ numero: 2, publico: 'INSTITUCIONES', nivel: 'EXTERNO' })}>Pedir</button>
      <button onClick={() => video.mutate({ presentacion: 'pr 1' })}>Video</button>
    </>
  )
}

function Lista() {
  const lista = usePresentaciones('d1')
  return <p>{lista.isError ? 'error' : lista.data ? lista.data.map((p) => p.status).join(',') : 'leyendo'}</p>
}

describe('comandos y sondeo de las presentaciones', () => {
  it('pide la presentación de una versión con su público, su nivel y una clave, y el MP4 sin cuerpo', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      { method: 'POST', path: '/sgspe/deliverables/d1/versions/2/presentations', responder: () => jsonResponse({ presentation: PRESENTACION_EN_COLA }, 202) },
      { method: 'POST', path: '/sgspe/presentations/pr%201/video', responder: () => jsonResponse({ presentation: PRESENTACION_LISTA }, 202) }
    ])
    montar(<Acciones />)
    await userEvent.click(screen.getByRole('button', { name: 'Pedir' }))
    await expect.poll(() => red!.a('POST', '/sgspe/deliverables/d1/versions/2/presentations').length).toBe(1)
    const [pedido] = red.a('POST', '/sgspe/deliverables/d1/versions/2/presentations')
    expect(pedido.cuerpo).toEqual({ audience: 'INSTITUCIONES', level: 'EXTERNO' })
    expect(pedido.cabeceras.get('Idempotency-Key')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Video' }))
    await expect.poll(() => red!.a('POST', '/sgspe/presentations/pr%201/video').length).toBe(1)
    const [video] = red.a('POST', '/sgspe/presentations/pr%201/video')
    expect(video.cuerpo).toBeNull()
    expect(video.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('vuelve a leer la lista mientras hay una en cola y se detiene cuando todas terminaron', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fetch = mockFetch([])
    let veces = 0
    red = espiarRed([
      { path: '/sgspe/deliverables/d1/presentations', responder: () => jsonResponse(++veces < 2 ? [PRESENTACION_EN_COLA] : [PRESENTACION_LISTA]) }
    ])
    montar(<Lista />)
    expect(await screen.findByText('EN COLA')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(12000))
    expect(await screen.findByText('LISTO')).toBeInTheDocument()
    const hasta = red.a('GET', '/sgspe/deliverables/d1/presentations').length
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(red.a('GET', '/sgspe/deliverables/d1/presentations')).toHaveLength(hasta)
  })

  it('ante un error deja de leer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fetch = mockFetch([])
    red = espiarRed([{ path: '/sgspe/deliverables/d1/presentations', responder: () => problema(500, 'falla') }])
    montar(<Lista />)
    expect(await screen.findByText('error', {}, { timeout: 10000 })).toBeInTheDocument()
    const hasta = red.a('GET', '/sgspe/deliverables/d1/presentations').length
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(red.a('GET', '/sgspe/deliverables/d1/presentations')).toHaveLength(hasta)
  })
})
