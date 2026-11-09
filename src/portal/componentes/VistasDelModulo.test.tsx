import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { VistasDelModulo } from './VistasDelModulo'

// la revisión de UX, etapa 7: el módulo aterriza en su lista y el tablero es otra vista del mismo encabezado, con el alcance de la
// barra
describe('VistasDelModulo', () => {
  it('ofrece «Lista · Tablero» con la vista actual marcada y el alcance de la ruta', () => {
    montar(<VistasDelModulo modulo="commitments" actual="lista" />, { ruta: '/projects/p1/commitments', camino: '/projects/:projectId/commitments' })
    const vistas = screen.getByRole('navigation', { name: 'Vistas del módulo' })
    expect(within(vistas).getByRole('link', { name: 'Lista' })).toHaveAttribute('aria-current', 'page')
    expect(within(vistas).getByRole('link', { name: 'Tablero' })).toHaveAttribute('href', '/projects/p1/commitments/dashboard')
    // como las pestañas de design-system.md §5.3: la fila con borde inferior de 2 px y la actual con el de 4 px primary
    expect(vistas).toHaveClass('border-b-2', 'border-sg-border')
    expect(within(vistas).getByRole('link', { name: 'Lista' })).toHaveClass('border-b-4', 'border-sg-primary', 'font-extrabold', 'text-sg-primary-text')
    expect(within(vistas).getByRole('link', { name: 'Tablero' })).toHaveClass('border-transparent', 'font-semibold', 'text-sg-text-secondary')
  })

  it('en lo global lleva al tablero global; sin tablero disponible, la lista no lo ofrece', () => {
    const { unmount } = montar(<VistasDelModulo modulo="risks" actual="tablero" />, { ruta: '/risks/dashboard' })
    expect(screen.getByRole('link', { name: 'Lista' })).toHaveAttribute('href', '/risks')
    unmount()
    montar(<VistasDelModulo modulo="risks" actual="lista" conTablero={false} />, { ruta: '/risks' })
    expect(screen.queryByRole('navigation', { name: 'Vistas del módulo' })).not.toBeInTheDocument()
  })
})
