import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { Seccion } from './Seccion'

// toda página arma sus bloques con la misma superficie titulada (U-34, DD-08): el título nombra la región, y una sección
// dentro de otra no repite el borde ni baja el peso del encabezado a mano
describe('Seccion', () => {
  it('con título, el encabezado nombra la región', () => {
    montar(
      <Seccion titulo="Reuniones">
        <p>contenido</p>
      </Seccion>
    )
    const region = screen.getByRole('region', { name: 'Reuniones' })
    expect(region.tagName).toBe('SECTION')
    const encabezado = within(region).getByRole('heading', { name: 'Reuniones' })
    expect(encabezado.tagName).toBe('H2')
    expect(encabezado).toHaveClass('text-sg-h3', 'font-semibold')
    expect(region).toHaveAttribute('aria-labelledby', encabezado.id)
    expect(region).toHaveClass('rounded-sg-lg', 'border', 'border-sg-border', 'bg-sg-surface', 'p-4', 'space-y-2')
    expect(within(region).getByText('contenido')).toBeInTheDocument()
  })

  it('anidada, no lleva borde y su encabezado es h3', () => {
    montar(
      <Seccion titulo="Detalle" anidada>
        <p>contenido</p>
      </Seccion>
    )
    const region = screen.getByRole('region', { name: 'Detalle' })
    expect(region).not.toHaveClass('border')
    expect(region).not.toHaveClass('p-4')
    expect(region).not.toHaveClass('bg-sg-surface')
    expect(within(region).getByRole('heading', { name: 'Detalle' }).tagName).toBe('H3')
  })

  it('dentro de otra sección se dibuja anidada sin pedirlo', () => {
    montar(
      <Seccion titulo="Externa">
        <Seccion titulo="Interna">
          <p>contenido</p>
        </Seccion>
      </Seccion>
    )
    const interna = screen.getByRole('region', { name: 'Interna' })
    expect(interna).not.toHaveClass('border')
    expect(within(interna).getByRole('heading', { name: 'Interna' }).tagName).toBe('H3')
    expect(screen.getByRole('region', { name: 'Externa' })).toHaveClass('border')
  })

  it('el nivel explícito gana al del contexto', () => {
    montar(<Seccion titulo="Tercera" nivel={3} />)
    expect(screen.getByRole('heading', { name: 'Tercera' }).tagName).toBe('H3')
  })

  it('sin título, la etiqueta nombra la región', () => {
    montar(
      <Seccion etiqueta="Salud del proyecto">
        <p>cifras</p>
      </Seccion>
    )
    const region = screen.getByRole('region', { name: 'Salud del proyecto' })
    expect(region).toHaveAttribute('aria-label', 'Salud del proyecto')
    expect(within(region).queryByRole('heading')).not.toBeInTheDocument()
  })

  it('la descripción y las acciones van en la cabecera', () => {
    montar(
      <Seccion titulo="Áreas" descripcion="Las del proyecto" acciones={<button type="button">Agregar</button>}>
        <p>contenido</p>
      </Seccion>
    )
    const region = screen.getByRole('region', { name: 'Áreas' })
    const cabecera = within(region).getByRole('heading', { name: 'Áreas' }).closest('header')
    expect(cabecera).not.toBeNull()
    expect(within(cabecera as HTMLElement).getByRole('button', { name: 'Agregar' })).toBeInTheDocument()
    const descripcion = within(cabecera as HTMLElement).getByText('Las del proyecto')
    expect(descripcion).toHaveClass('text-sg-body-sm', 'text-sg-text-secondary')
  })

  it('combina la clase de quien la usa', () => {
    montar(<Seccion titulo="Paisaje" className="space-y-3 lg:col-span-2" />)
    const region = screen.getByRole('region', { name: 'Paisaje' })
    expect(region).toHaveClass('space-y-3', 'lg:col-span-2', 'border')
    expect(region).not.toHaveClass('space-y-2')
  })
})
