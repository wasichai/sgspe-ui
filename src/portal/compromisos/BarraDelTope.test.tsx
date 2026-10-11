import { screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { permisos } from '../../test/portal'
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

  // spec F5, elección 6: el tope suma los compromisos y los aportes comprometidos en la moneda de la campaña; el registro que se
  // aprueba no se cuenta dos veces
  it('suma los aportes comprometidos de la campaña en su moneda y no cuenta el registro que se aprueba', async () => {
    const aporte = (id: string, total: string, estado: string, moneda = 'PEN') =>
      registro(id, { project: 'p1', exploration_campaign: 'camp1', total_amount: total, currency: moneda }, { state: estado })
    fetch = mockFetch([
      { path: '/objects/commitment/records', body: pagina([comprometido('c1', '10000')]) },
      {
        path: '/objects/social_contribution/records',
        body: pagina([
          aporte('a1', '5000', 'approved'),
          aporte('a2', '3000', 'requested'),
          aporte('a3', '2000', 'delivered', 'USD'),
          aporte('a9', '4000', 'approved')
        ])
      }
    ])
    const campana = registro('camp1', { project: 'p1', name: 'Campaña 2026', social_support_cap: '20000', currency: 'PEN' })
    montar(<BarraDelTope campana={campana} monto="4000" moneda="PEN" excluir="a9" de="aporte" />)
    const tope = await screen.findByRole('region', { name: 'Tope de apoyo social de la campaña' })
    // 10 000 del compromiso y 5 000 del aporte aprobado; el solicitado, el de otra moneda y el que se aprueba no cuentan
    expect(await within(tope).findByText('Aprobado en la campaña')).toBeInTheDocument()
    expect(within(tope).getByText('Aprobado en la campaña').nextElementSibling).toHaveTextContent('S/ 15,000.00')
    expect(within(tope).getByText('Este aporte').nextElementSibling).toHaveTextContent('S/ 4,000.00')
    expect(within(tope).getByText('Queda').nextElementSibling).toHaveTextContent(/^S\/ 1,000\.00$/)
  })

  it('a quien no lee los aportes le dice que no los incluye; un tenant sin aportes (404) no lo dice', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/records', body: pagina([comprometido('c1', '10000')]) }])
    const campana = registro('camp1', { project: 'p1', name: 'Campaña 2026', social_support_cap: '20000', currency: 'PEN' })
    const { unmount } = montar(<BarraDelTope campana={campana} monto="0" moneda="PEN" />, { permisos: permisos({ commitment: ['READ'] }) })
    expect(await screen.findByText('Lo aprobado no incluye los aportes: su cuenta no los lee.')).toBeInTheDocument()
    unmount()
    // ADMIN lee todo: un tenant de F4 responde 404 por social_contribution y la barra suma solo los compromisos, sin aviso
    montar(<BarraDelTope campana={campana} monto="0" moneda="PEN" />)
    const tope = await screen.findByRole('region', { name: 'Tope de apoyo social de la campaña' })
    expect(within(tope).getByText('Queda').nextElementSibling).toHaveTextContent(/^S\/ 10,000\.00$/)
    expect(screen.queryByText(/no incluye los aportes/)).not.toBeInTheDocument()
  })
})
