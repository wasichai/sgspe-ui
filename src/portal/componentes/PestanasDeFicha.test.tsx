import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { montar, ubicacion } from '../../test/montar'
import { PestanasDeFicha, type PestanaDeFicha } from './PestanasDeFicha'

// D6 de la revisión de UX: las pestañas de una ficha se desplazan cuando no caben, guardan la elegida en la URL (?tab=)
// y pueden llevar un conteo; lo escrito en una pestaña ya visitada no se pierde al cambiar de pestaña
const PESTANAS: PestanaDeFicha[] = [
  { id: 'resumen', etiqueta: 'Resumen', render: () => <p>Panel de resumen</p> },
  {
    id: 'entregas',
    etiqueta: 'Entregas',
    conteo: 2,
    render: () => (
      <label>
        Nota <input />
      </label>
    )
  },
  { id: 'actividad', etiqueta: 'Actividad', render: () => <p>Panel de actividad</p> }
]

describe('PestanasDeFicha', () => {
  it('abre la primera si la URL no dice otra, y la elegida queda en la URL sin perder lo demás', async () => {
    montar(<PestanasDeFicha etiqueta="Compromiso" pestanas={PESTANAS} />, { ruta: '/projects/p1/commitments/c1?territory=community:k1' })
    expect(screen.getByRole('tablist', { name: 'Compromiso' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel de resumen')
    await userEvent.click(screen.getByRole('tab', { name: 'Actividad' }))
    expect(screen.getByRole('tab', { name: 'Actividad' })).toHaveAttribute('aria-selected', 'true')
    expect(ubicacion.actual).toBe('/projects/p1/commitments/c1?territory=community%3Ak1&tab=actividad')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel de actividad')
  })

  // design-system.md §5.3 «Pestañas»: 15 px 600 text-secondary; la elegida en primary-text 800 con borde inferior de 4 px
  // primary; el conteo, una etiqueta en caption 700 con borde de 1 px
  it('la elegida va en primary-text 800 con el borde de 4 px primary; las demás en 600 text-secondary', () => {
    montar(<PestanasDeFicha etiqueta="Compromiso" pestanas={PESTANAS} />)
    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveClass(
      'border-b-4',
      'border-sg-primary',
      'font-extrabold',
      'text-sg-primary-text',
      'text-sg-body'
    )
    const otra = screen.getByRole('tab', { name: 'Entregas' })
    expect(otra).toHaveClass('border-b-4', 'border-transparent', 'font-semibold', 'text-sg-text-secondary')
    expect(screen.getByText('2')).toHaveClass('border', 'border-sg-border', 'text-sg-caption', 'font-bold')
  })

  it('abre la pestaña de la URL; una desconocida cae en la primera', () => {
    const { unmount } = montar(<PestanasDeFicha etiqueta="Compromiso" pestanas={PESTANAS} />, { ruta: '/c?tab=actividad' })
    expect(screen.getByRole('tab', { name: 'Actividad' })).toHaveAttribute('aria-selected', 'true')
    unmount()
    montar(<PestanasDeFicha etiqueta="Compromiso" pestanas={PESTANAS} />, { ruta: '/c?tab=otra' })
    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true')
  })

  it('muestra el conteo de una pestaña en su descripción, sin cambiar su nombre', () => {
    montar(<PestanasDeFicha etiqueta="Compromiso" pestanas={PESTANAS} />)
    expect(screen.getByRole('tab', { name: 'Entregas' })).toHaveAccessibleDescription('2 registros')
    expect(screen.getByRole('tab', { name: 'Entregas' })).toHaveTextContent('Entregas2')
  })

  it('lo escrito en una pestaña visitada sigue al volver', async () => {
    montar(<PestanasDeFicha etiqueta="Compromiso" pestanas={PESTANAS} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Entregas' }))
    await userEvent.type(screen.getByLabelText('Nota'), 'pendiente')
    await userEvent.click(screen.getByRole('tab', { name: 'Resumen' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Entregas' }))
    expect(screen.getByLabelText('Nota')).toHaveValue('pendiente')
  })

  it('las flechas, Inicio y Fin mueven el foco entre pestañas; solo la elegida está en el orden de tabulación', async () => {
    montar(<PestanasDeFicha etiqueta="Compromiso" pestanas={PESTANAS} />)
    const resumen = screen.getByRole('tab', { name: 'Resumen' })
    expect(resumen).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Actividad' })).toHaveAttribute('tabindex', '-1')
    resumen.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Entregas' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Actividad' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(resumen).toHaveFocus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Actividad' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(resumen).toHaveFocus()
  })
})
