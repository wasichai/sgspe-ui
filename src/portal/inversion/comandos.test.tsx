import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { APORTE, INVERSION } from '../../test/inversion'
import { montar, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import type { Registro } from '../datos/registros'
import { useCorregirEntregaDeAporte, useRegistrarEntregaDeAporte } from './comandos'

// la entrega de un aporte (spec F5 §3.5): la captura manda la entrega sin monto con sus evidencias por id, If-Match del aporte, el
// motivo y una Idempotency-Key que se repite al reintentar la misma acción (un teléfono que perdió la red no duplica la entrega) y
// cambia con otro aporte; la corrección es el PATCH de la entrega con su versión y el motivo, sin clave
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const ADQUIRIDO = { ...APORTE, state: 'procured' }
const OTRO = registro('a2', { project: 'p1', code: 'AP-002' }, { state: 'procured' })

function Registrar({ aporte }: { aporte: Registro }) {
  const comando = useRegistrarEntregaDeAporte(aporte)
  return (
    <>
      <button
        type="button"
        onClick={() =>
          comando.mutate({
            atributos: { delivery_date: '2026-10-10', conformity_given: true, conformity_by: 'Directiva' },
            evidencias: ['ev1', 'ev2'],
            motivo: 'entrega en la plaza'
          })
        }
      >
        Registrar {aporte.id}
      </button>
      <p>{comando.isError ? 'falló' : comando.isSuccess ? 'registrada' : 'quieto'}</p>
    </>
  )
}

function Corregir() {
  const comando = useCorregirEntregaDeAporte('a1')
  const entrega = registro('dl1', { social_contribution: 'a1' }, { updatedAt: '2026-10-10T16:00:00Z' })
  return (
    <button type="button" onClick={() => comando.mutate({ entrega, cambios: { place: 'Plaza de armas' }, motivo: 'lugar corregido' })}>
      Corregir
    </button>
  )
}

describe('comandos de aportes', () => {
  it('la captura manda la entrega con sus evidencias, If-Match del aporte, el motivo y una clave que se repite al reintentar; otro aporte lleva otra', async () => {
    fetch = mockFetch([])
    let veces = 0
    red = espiarRed([
      {
        method: 'POST',
        path: /^\/sgspe\/social-contributions\/a[12]\/deliveries$/,
        responder: () => (veces++ === 0 ? problema(503, 'sin red') : jsonResponse({ delivery: registro('dl1', {}), contribution: ADQUIRIDO }, 201))
      }
    ])
    montar(
      <>
        <Registrar aporte={ADQUIRIDO} />
        <Registrar aporte={OTRO} />
      </>,
      { usuario: INVERSION }
    )
    await userEvent.click(screen.getByRole('button', { name: 'Registrar a1' }))
    expect(await screen.findByText('falló')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar a1' }))
    expect(await screen.findByText('registrada')).toBeInTheDocument()
    const [primera, segunda] = red.a('POST', '/sgspe/social-contributions/a1/deliveries')
    expect(primera.cuerpo).toEqual({
      attributes: { delivery_date: '2026-10-10', conformity_given: true, conformity_by: 'Directiva' },
      evidence: ['ev1', 'ev2']
    })
    expect(primera.cabeceras.get('If-Match')).toBe(`"${APORTE.updatedAt}"`)
    expect(primera.cabeceras.get('X-Change-Reason')).toBe("UTF-8''entrega%20en%20la%20plaza")
    expect(segunda.cabeceras.get('Idempotency-Key')).toBe(primera.cabeceras.get('Idempotency-Key'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar a2' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/social-contributions/a2/deliveries')).toHaveLength(1))
    expect(red.a('POST', '/sgspe/social-contributions/a2/deliveries')[0].cabeceras.get('Idempotency-Key')).not.toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  it('la corrección es el PATCH de la entrega con su versión y el motivo, sin clave', async () => {
    fetch = mockFetch([{ method: 'PATCH', path: '/sgspe/deliveries/dl1', body: { delivery: registro('dl1', {}) } }])
    red = espiarRed()
    montar(<Corregir />, { usuario: INVERSION })
    await userEvent.click(screen.getByRole('button', { name: 'Corregir' }))
    await waitFor(() => expect(red!.a('PATCH', '/sgspe/deliveries/dl1')).toHaveLength(1))
    const [correccion] = red.a('PATCH', '/sgspe/deliveries/dl1')
    expect(correccion.cuerpo).toEqual({ attributes: { place: 'Plaza de armas' } })
    expect(correccion.cabeceras.get('If-Match')).toBe('"2026-10-10T16:00:00Z"')
    expect(correccion.cabeceras.get('Idempotency-Key')).toBeNull()
  })
})
