import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { montar, ubicacion } from '../../test/montar'
import { Rastro } from '../contexto/Rastro'
import { EnlaceDeRegistro } from './EnlaceDeRegistro'

// la revisión de UX, etapa 0: un solo estilo de enlace a un registro (el código en monoespaciado gris y el título como
// enlace) que, si se dice desde dónde se sale, suma ese paso al rastro
describe('EnlaceDeRegistro', () => {
  it('dibuja el código aparte y el título como enlace a la ficha', () => {
    montar(<EnlaceDeRegistro codigo="COM-2026-031" titulo="Reservorio de agua" ruta="/projects/p1/commitments/c1" />)
    const enlace = screen.getByRole('link', { name: 'Reservorio de agua' })
    expect(enlace).toHaveAttribute('href', '/projects/p1/commitments/c1')
    expect(screen.getByText('COM-2026-031')).toHaveClass('font-sg-mono')
  })

  it('sin ruta, el título sin enlace (nunca un enlace a «#»)', () => {
    montar(<EnlaceDeRegistro codigo="COM-2026-031" titulo="Reservorio de agua" ruta={null} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Reservorio de agua')).toBeInTheDocument()
  })

  it('con el código en el enlace, código y título son un solo enlace', () => {
    montar(<EnlaceDeRegistro codigo="Q-002" titulo="Agua turbia en el canal" ruta="/projects/p1/grievances/g2" codigoEnElEnlace />)
    expect(screen.getByRole('link', { name: 'Q-002 Agua turbia en el canal' })).toHaveAttribute('href', '/projects/p1/grievances/g2')
  })

  it('sin código, solo el título', () => {
    montar(<EnlaceDeRegistro titulo="Junta directiva" ruta="/projects/p1/stakeholders/g1" />)
    expect(screen.getByRole('link', { name: 'Junta directiva' })).toBeInTheDocument()
  })

  it('con «desde», al navegar suma la vista que deja al rastro', async () => {
    montar(
      <Routes>
        <Route
          path="/projects/p1/engagements/e1"
          element={<EnlaceDeRegistro titulo="Reservorio de agua" ruta="/projects/p1/commitments/c1" desde="Asamblea de agosto" />}
        />
        <Route path="/projects/p1/commitments/c1" element={<Rastro />} />
      </Routes>,
      { ruta: '/projects/p1/engagements/e1?tab=acuerdos' }
    )
    await userEvent.click(screen.getByRole('link', { name: 'Reservorio de agua' }))
    expect(ubicacion.actual).toBe('/projects/p1/commitments/c1')
    expect(screen.getByRole('link', { name: 'Asamblea de agosto' })).toHaveAttribute('href', '/projects/p1/engagements/e1?tab=acuerdos')
  })
})
