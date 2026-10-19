import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Dia } from './Dia'

// una fecha de negocio se ve igual en toda tabla y ficha: «24 set. 2026», nunca «2026-09-24», y no se parte en dos líneas
describe('Dia', () => {
  it('dice un día AAAA-MM-DD como fecha es-PE, con su valor de máquina', () => {
    render(<Dia valor="2026-09-24" />)
    const dia = screen.getByText('24 set. 2026')
    expect(dia.tagName).toBe('TIME')
    expect(dia).toHaveAttribute('datetime', '2026-09-24')
  })

  it('toma el día de Lima de un instante', () => {
    render(<Dia valor="2026-09-25T03:00:00Z" />)
    expect(screen.getByText('24 set. 2026')).toHaveAttribute('datetime', '2026-09-24')
  })

  it('sin fecha dice «—» y lo que no es una fecha sale tal cual', () => {
    const { container, rerender } = render(<Dia valor="" />)
    expect(container).toHaveTextContent('—')
    rerender(<Dia valor={null} />)
    expect(container).toHaveTextContent('—')
    rerender(<Dia valor="pronto" />)
    expect(container).toHaveTextContent('pronto')
  })
})
