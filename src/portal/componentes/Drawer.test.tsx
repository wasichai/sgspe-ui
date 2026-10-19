import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { Drawer } from './Drawer'

// la revisión de UX, etapa 8: el drawer atrapa el foco, entra por su primer control y, al cerrarse, lo devuelve al botón que lo
// abrió (no se abre con un DialogTrigger, así que Radix no sabría a quién volver)
function ConDrawer() {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}>
        Editar
      </button>
      <Drawer titulo="Datos del registro" abierto={abierto} alCerrar={() => setAbierto(false)}>
        <label>
          Título
          <input />
        </label>
      </Drawer>
    </>
  )
}

describe('Drawer', () => {
  it('entra por su primer control y, al cerrarse con Escape, devuelve el foco a quien lo abrió', async () => {
    montar(<ConDrawer />)
    const boton = screen.getByRole('button', { name: 'Editar' })
    await userEvent.click(boton)
    const drawer = await screen.findByRole('dialog', { name: 'Datos del registro' })
    await waitFor(() => expect(within(drawer).getByLabelText('Título')).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(boton).toHaveFocus()
  })
})
