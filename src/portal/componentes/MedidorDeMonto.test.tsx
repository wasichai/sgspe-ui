import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MedidorDeMonto } from './MedidorDeMonto'

// el medidor de un monto en una moneda (design-system.md §5.3 «Medidores»): la moneda y su avance, la barra con su nombre y lo que
// se dice debajo; sin avance, «—» y nunca 0 %
describe('MedidorDeMonto', () => {
  it('dice la moneda, el avance y la barra con su nombre; lo de debajo va dentro del grupo', () => {
    render(
      <MedidorDeMonto moneda="PEN" avance={45} etiqueta="Avance de lo ejecutado en PEN">
        <p>S/ 54,000.00 de S/ 120,000.00</p>
      </MedidorDeMonto>
    )
    const grupo = screen.getByRole('group', { name: 'PEN' })
    expect(within(grupo).getByText('45 %')).toBeInTheDocument()
    const barra = within(grupo).getByRole('progressbar', { name: 'Avance de lo ejecutado en PEN' })
    expect(barra).toHaveAttribute('aria-valuenow', '45')
    expect(barra).toHaveAttribute('aria-valuetext', '45 %')
    expect(within(grupo).getByText('S/ 54,000.00 de S/ 120,000.00')).toBeInTheDocument()
  })

  it('sin avance dice «—», no da un valor a la barra y la deja vacía; uno por encima de 100 no la desborda', () => {
    const { rerender } = render(<MedidorDeMonto moneda="USD" avance={null} etiqueta="Avance en USD" />)
    const barra = screen.getByRole('progressbar', { name: 'Avance en USD' })
    expect(barra).not.toHaveAttribute('aria-valuenow')
    expect(barra).toHaveAttribute('aria-valuetext', '—')
    expect((barra.firstElementChild as HTMLElement).style.width).toBe('0%')
    rerender(<MedidorDeMonto moneda="USD" avance={130} etiqueta="Avance en USD" />)
    expect((screen.getByRole('progressbar', { name: 'Avance en USD' }).firstElementChild as HTMLElement).style.width).toBe('100%')
  })
})
