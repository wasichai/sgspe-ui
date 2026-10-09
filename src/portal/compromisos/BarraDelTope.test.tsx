import { screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { BarraDelTope } from './BarraDelTope'

// la barra suma montos DECIMAL en diezmilésimos exactos: nunca en coma flotante
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const comprometido = (id: string, amount: unknown) =>
  registro(id, { project: 'p1', exploration_campaign: 'camp1', amount, currency: 'PEN' }, { state: 'approved' })

async function barra(tope: unknown, montos: unknown[], monto: string | null) {
  fetch = mockFetch([{ path: '/objects/commitment/records', body: pagina(montos.map((m, i) => comprometido(`c${i}`, m))) }])
  const campana = registro('camp1', { project: 'p1', name: 'Campaña 2026', social_support_cap: tope, currency: 'PEN' })
  montar(<BarraDelTope campana={campana} monto={monto} moneda="PEN" />)
  return screen.findByRole('region', { name: 'Tope de apoyo social de la campaña' })
}

describe('BarraDelTope', () => {
  it('una campaña justo en su tope (30000.30 = 10000.10 + 20000.20) no supera el tope y queda S/ 0.00', async () => {
    const tope = await barra('30000.30', ['10000.10', 20000.2], '0')
    expect(await within(tope).findByText('S/ 30,000.30')).toBeInTheDocument()
    expect(within(tope).getByText('Queda').nextElementSibling).toHaveTextContent(/^S\/ 0\.00$/)
    expect(within(tope).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('un monto más allá de 2^53 se suma sin perder dígitos', async () => {
    const tope = await barra('9007199254740993.0005', ['9007199254740993.0002'], '0.0003')
    expect(await within(tope).findByText('S/ 9,007,199,254,740,993.0002')).toBeInTheDocument()
    expect(within(tope).getByText('Queda').nextElementSibling).toHaveTextContent(/^S\/ 0\.00$/)
    expect(within(tope).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('una diezmilésima por encima del tope sí lo supera', async () => {
    const tope = await barra('9007199254740993.0005', ['9007199254740993.0002'], '0.0004')
    expect(await within(tope).findByRole('alert')).toHaveTextContent('supera el tope')
    expect(within(tope).getByText('Queda').nextElementSibling).toHaveTextContent('-S/ 0.0001')
  })
})
