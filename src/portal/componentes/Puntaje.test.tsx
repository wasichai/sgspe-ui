import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { BarraDePuntaje, BarraPorSexo } from './Puntaje'

describe('BarraDePuntaje (S06, la evaluación con barras de puntaje)', () => {
  it('dice el nombre, la barra llena en proporción y el valor sobre la escala; su nombre accesible lo dice todo', () => {
    montar(<BarraDePuntaje etiqueta="Interés" valor={4} />)
    const barra = screen.getByRole('meter', { name: 'Interés' })
    expect(barra).toHaveAttribute('aria-valuenow', '4')
    expect(barra).toHaveAttribute('aria-valuemin', '1')
    expect(barra).toHaveAttribute('aria-valuemax', '5')
    expect(barra.querySelector('[data-relleno]')).toHaveStyle({ width: '75%' })
    expect(screen.getByText('4/5')).toBeInTheDocument()
  })

  it('sin valor (o con uno que no es número) dice «—» y no dibuja un medidor en cero', () => {
    montar(<BarraDePuntaje etiqueta="Confianza" valor={null} />)
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('BarraPorSexo (S07, los asistentes por sexo)', () => {
  it('dibuja dos tramos en proporción con su leyenda en texto: el color nunca va solo', () => {
    montar(<BarraPorSexo mujeres={21} hombres={17} />)
    const barra = screen.getByRole('img', { name: '21 mujeres, 17 hombres' })
    const tramos = barra.querySelectorAll('[data-tramo]')
    expect(tramos).toHaveLength(2)
    expect(tramos[0]).toHaveClass('bg-sg-data-1')
    expect(tramos[1]).toHaveClass('bg-sg-data-2')
    expect(tramos[0]).toHaveStyle({ flexGrow: '21' })
  })

  it('sin los dos conteos (o con ambos en cero) no dibuja nada', () => {
    montar(
      <>
        <BarraPorSexo mujeres={null} hombres={4} />
        <BarraPorSexo mujeres={0} hombres={0} />
      </>
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
