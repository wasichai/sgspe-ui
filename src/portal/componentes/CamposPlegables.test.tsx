import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { Restringido } from './Estados'
import { CamposPlegables } from './CamposPlegables'

// los atributos de una ficha (U-26, DD-06 del rediseño de UX): a la vista, los que tienen dato; los vacíos, plegados tras
// «Mostrar los N campos sin dato». un dato restringido no es un vacío: su candado se ve siempre
describe('CamposPlegables', () => {
  it('muestra los campos con dato y pliega los vacíos con su conteo', async () => {
    montar(
      <CamposPlegables
        campos={[
          { clave: 'a', termino: 'Prioridad', valor: 'Alta' },
          { clave: 'b', termino: 'Formalidad', valor: null },
          { clave: 'c', termino: 'Medio', valor: '' },
          { clave: 'd', termino: 'Fecha', valor: '—' },
          { clave: 'e', termino: 'Detalle', valor: <Restringido /> }
        ]}
      />
    )
    expect(screen.getByText('Prioridad')).toBeVisible()
    expect(screen.getByText('Alta')).toBeVisible()
    expect(screen.getByText('Detalle')).toBeVisible()
    expect(screen.getByText('Restringido')).toBeVisible()
    expect(screen.queryByText('Formalidad')).not.toBeInTheDocument()
    expect(screen.queryByText('Medio')).not.toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'Mostrar los 3 campos sin dato' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(boton)
    const plegados = screen.getByRole('button', { name: 'Ocultar los campos sin dato' })
    expect(plegados).toHaveAttribute('aria-expanded', 'true')
    const vacios = document.getElementById(plegados.getAttribute('aria-controls')!)!
    expect(within(vacios).getByText('Formalidad')).toBeVisible()
    expect(within(vacios).getAllByText('—')).toHaveLength(3)
    await userEvent.click(plegados)
    expect(screen.queryByText('Formalidad')).not.toBeInTheDocument()
  })

  it('con un solo vacío lo dice en singular, y sin vacíos no ofrece el botón', () => {
    const { unmount } = montar(
      <CamposPlegables
        campos={[
          { clave: 'a', termino: 'Prioridad', valor: 'Alta' },
          { clave: 'b', termino: 'Formalidad', valor: undefined }
        ]}
      />
    )
    expect(screen.getByRole('button', { name: 'Mostrar el campo sin dato' })).toBeInTheDocument()
    unmount()
    montar(<CamposPlegables campos={[{ clave: 'a', termino: 'Prioridad', valor: 'Alta' }]} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('en inglés', () => {
    localStorage.setItem('sgspe.lang', 'en')
    montar(
      <CamposPlegables
        campos={[
          { clave: 'a', termino: 'Priority', valor: null },
          { clave: 'b', termino: 'Formality', valor: null }
        ]}
      />
    )
    localStorage.removeItem('sgspe.lang')
    expect(screen.getByRole('button', { name: 'Show the 2 empty fields' })).toBeInTheDocument()
  })
})
