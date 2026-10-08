import { useQueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch } from '@wasichai/testing'
import { describe, expect, it } from 'vitest'
import { espiarRed } from '../../test/red'
import { montar, registro as registroDe } from '../../test/montar'
import { useBorrar, useRegistro } from './registros'

// una pantalla mínima: el lector del registro tiene el botón de borrar y, borrado, deja de montarse, como la ficha que
// navega a la lista; lo que queda en la caché se ve desde el padre
function Lector({ borrar }: { borrar: ReturnType<typeof useBorrar> }) {
  const leido = useRegistro('stakeholder', 's1')
  return (
    <div>
      <p>{leido.data ? 'leído' : 'sin leer'}</p>
      <button onClick={() => leido.data && borrar.mutate({ registro: leido.data, motivo: 'Duplicado' })}>Borrar</button>
    </div>
  )
}

function Pantalla() {
  const cliente = useQueryClient()
  const borrar = useBorrar('stakeholder')
  if (!borrar.isSuccess) return <Lector borrar={borrar} />
  return <p>{`borrado, en caché: ${cliente.getQueryData(['record', 'stakeholder', 's1']) ? 'sí' : 'no'}`}</p>
}

describe('useBorrar', () => {
  it('manda el DELETE con If-Match y no relee el registro borrado: sale de la caché', async () => {
    const fetch = mockFetch([
      { method: 'DELETE', path: '/objects/stakeholder/records/s1', status: 204, body: null },
      { path: '/objects/stakeholder/records/s1', body: registroDe('s1', { stakeholder_type: 'IGLESIA' }) }
    ])
    const red = espiarRed()
    try {
      montar(<Pantalla />)
      await screen.findByText('leído')
      await userEvent.click(screen.getByRole('button', { name: 'Borrar' }))
      await screen.findByText('borrado, en caché: no')
      expect(red.a('DELETE', '/objects/stakeholder/records/s1')).toHaveLength(1)
      expect(red.a('DELETE', '/objects/stakeholder/records/s1')[0].cabeceras.get('If-Match')).toBe('"2026-10-05T15:00:00Z"')
      // una sola lectura (la inicial): el registro borrado no se vuelve a pedir
      await waitFor(() => expect(red.a('GET', '/objects/stakeholder/records/s1')).toHaveLength(1))
    } finally {
      red.restaurar()
      fetch.restore()
    }
  })
})
