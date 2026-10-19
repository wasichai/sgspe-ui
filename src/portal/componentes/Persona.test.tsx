import { screen } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { Persona } from './Persona'

// una persona se nombra por su nombre visible, no por su correo (ASM-142, GET /api/sgspe/people): los correos de un mismo
// render se piden juntos, y sin el nombre (un backend sin el endpoint, un correo desconocido) se ve el correo
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

describe('Persona', () => {
  it('dice el nombre con el correo en el title, y pide los correos de un render en una sola consulta', async () => {
    fetch = mockFetch([
      {
        path: /^\/sgspe\/people\?/,
        body: [
          { email: 'ana@sgspe.test', displayName: 'Ana Pérez' },
          { email: 'luis@sgspe.test', displayName: 'Luis Quispe' }
        ]
      }
    ])
    red = espiarRed()
    montar(
      <>
        <Persona correo="ana@sgspe.test" />
        <Persona correo="Luis@sgspe.test" />
      </>
    )
    expect(await screen.findByText('Ana Pérez')).toHaveAttribute('title', 'ana@sgspe.test')
    expect(await screen.findByText('Luis Quispe')).toHaveAttribute('title', 'Luis@sgspe.test')
    expect(red.a('GET', /^\/sgspe\/people/)).toHaveLength(1)
  })

  it('sin el nombre muestra el correo; sin correo, «—»', async () => {
    fetch = mockFetch([{ path: /^\/sgspe\/people\?/, status: 404, body: { title: 'Not Found', status: 404 } }])
    const { container } = montar(
      <>
        <Persona correo="nadie@sgspe.test" />
        <Persona correo="" />
      </>
    )
    expect(await screen.findByText(/nadie/)).toHaveTextContent('nadie@sgspe.test')
    expect(container).toHaveTextContent('—')
  })
})
