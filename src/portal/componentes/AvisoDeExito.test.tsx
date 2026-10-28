import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation, useNavigate } from 'react-router'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { AvisoDeExito, conHecho } from './AvisoDeExito'

// tercera pasada de UX (2.12, DD-34): un alta no abre la ficha en silencio; la ficha dice lo que se hizo, una sola vez, y conserva lo
// demás del estado del historial (el rastro, el origen de la ficha)
function Alta() {
  const navegar = useNavigate()
  return (
    <button type="button" onClick={() => navegar('/ficha', { state: conHecho({ rastro: 'lista' }, 'Se registró la queja Q-005.') })}>
      Registrar
    </button>
  )
}

function Ficha() {
  const { state } = useLocation()
  return (
    <>
      <AvisoDeExito />
      <p>estado: {JSON.stringify(state)}</p>
    </>
  )
}

describe('AvisoDeExito', () => {
  it('dice lo que hizo el alta y lo saca del historial, sin tocar el resto del estado', async () => {
    montar(
      <Routes>
        <Route path="/" element={<Alta />} />
        <Route path="/ficha" element={<Ficha />} />
      </Routes>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Se registró la queja Q-005.')
    // volver a esta entrada del historial no lo repetiría: el estado ya no lo trae, y el aviso sigue a la vista
    expect(await screen.findByText('estado: {"rastro":"lista"}')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Se registró la queja Q-005.')
  })

  it('sin nada hecho no dice nada', () => {
    montar(<AvisoDeExito />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
