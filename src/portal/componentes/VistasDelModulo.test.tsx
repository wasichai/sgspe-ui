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
  })

  it('en lo global lleva al tablero global; sin tablero disponible, la lista no lo ofrece', () => {
    const { unmount } = montar(<VistasDelModulo modulo="risks" actual="tablero" />, { ruta: '/risks/dashboard' })
    expect(screen.getByRole('link', { name: 'Lista' })).toHaveAttribute('href', '/risks')
    unmount()
    montar(<VistasDelModulo modulo="risks" actual="lista" conTablero={false} />, { ruta: '/risks' })
    expect(screen.queryByRole('navigation', { name: 'Vistas del módulo' })).not.toBeInTheDocument()
  })
})
