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

  // tercera pasada de UX (2.1, DD-36): con algo escrito, Esc o un clic fuera no descartan sin preguntar
  it('con algo escrito, Escape pide confirmar: «Seguir editando» lo conserva y «Descartar» lo cierra', async () => {
    montar(<ConDrawer />)
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const drawer = await screen.findByRole('dialog', { name: 'Datos del registro' })
    await userEvent.type(within(drawer).getByLabelText('Título'), 'Reservorio')
    await userEvent.keyboard('{Escape}')
    expect(await screen.findByText('¿Descartar lo escrito?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Seguir editando' }))
    await waitFor(() => expect(screen.queryByText('¿Descartar lo escrito?')).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Datos del registro' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Reservorio')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(await screen.findByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('enviar el formulario da lo escrito por guardado; mientras se guarda, no se cierra', async () => {
    function ConFormulario({ ocupado = false }: { ocupado?: boolean }) {
      const [abierto, setAbierto] = useState(true)
      return (
        <Drawer titulo="Datos del registro" abierto={abierto} alCerrar={() => setAbierto(false)} ocupado={ocupado}>
          <form onSubmit={(e) => e.preventDefault()}>
            <label>
              Título
              <input />
            </label>
            <button type="submit">Guardar</button>
          </form>
        </Drawer>
      )
    }
    const { unmount } = montar(<ConFormulario />)
    await userEvent.type(await screen.findByLabelText('Título'), 'Reservorio')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('¿Descartar lo escrito?')).not.toBeInTheDocument()
    unmount()
    montar(<ConFormulario ocupado />)
    await userEvent.type(await screen.findByLabelText('Título'), 'Reservorio')
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Datos del registro' })).toBeInTheDocument()
    expect(screen.queryByText('¿Descartar lo escrito?')).not.toBeInTheDocument()
  })
})
