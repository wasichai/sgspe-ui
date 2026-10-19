import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { montar, registro } from '../../test/montar'
import { ProyectoEnLista } from './ProyectoEnLista'

// la revisión de UX, etapa 3: el proyecto en una lista global es «código · nombre» y lleva a su Resumen
describe('ProyectoEnLista', () => {
  it('dice el código y el nombre, enlazados al resumen del proyecto', () => {
    montar(<ProyectoEnLista proyecto={registro('p 1', { code: 'PRJ-01', name: 'Pukaqaqa' })} />)
    const enlace = screen.getByRole('link', { name: 'PRJ-01 · Pukaqaqa' })
    expect(enlace).toHaveAttribute('href', '/projects/p%201/overview')
    expect(enlace).toHaveAttribute('title', 'PRJ-01 · Pukaqaqa')
    expect(screen.getByText('PRJ-01')).toHaveClass('font-sg-mono')
  })

  it('sin el proyecto todavía, «…»', () => {
    const { container } = montar(<ProyectoEnLista proyecto={undefined} />)
    expect(container).toHaveTextContent('…')
  })
})
