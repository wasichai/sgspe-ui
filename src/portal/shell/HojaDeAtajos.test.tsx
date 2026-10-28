import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { abrirHojaDeAtajos, HojaDeAtajos } from './HojaDeAtajos'

// tercera pasada de UX, 4.7: la hoja de atajos se abre con «?» desde cualquier pantalla, salvo mientras se escribe en un campo, y
// desde el menú de la cuenta; la tecla de la búsqueda es la del teclado de quien mira (Ctrl fuera de Mac)
afterEach(() => localStorage.clear())

describe('la hoja de atajos', () => {
  it('«?» la abre con la tecla de la búsqueda de este teclado, y Esc la cierra', async () => {
    montar(<HojaDeAtajos />)
    await userEvent.keyboard('?')
    const hoja = await screen.findByRole('dialog', { name: 'Atajos de teclado' })
    const filas = within(within(hoja).getByRole('table', { name: 'Atajos' }))
      .getAllByRole('row')
      .slice(1)
    expect(filas[0]).toHaveTextContent('Ctrl KBuscar en el portal')
    expect(filas.map((f) => within(f).getAllByRole('cell')[0].textContent)).toEqual(['Ctrl K', '?', 'Tab', 'Enter', 'Espacio', 'J', 'K', 'Esc'])
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('mientras se escribe en un campo, «?» es una letra más', async () => {
    montar(
      <>
        <label>
          Nota
          <input />
        </label>
        <HojaDeAtajos />
      </>
    )
    await userEvent.type(screen.getByLabelText('Nota'), '¿Cuándo?')
    expect(screen.getByLabelText('Nota')).toHaveValue('¿Cuándo?')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('el menú de la cuenta la abre', async () => {
    montar(<HojaDeAtajos />)
    act(() => abrirHojaDeAtajos())
    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeInTheDocument()
  })
})
