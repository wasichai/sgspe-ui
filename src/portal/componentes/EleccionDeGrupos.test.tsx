import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, registro } from '../../test/montar'
import type { Registro } from '../datos/registros'
import { EleccionDeGrupos } from './EleccionDeGrupos'

// la elección de varios grupos de interés en un alta (tercera pasada de UX, 2.7): con muchos grupos, una búsqueda por el nombre
// que se le muestra a quien mira, sin tildes ni mayúsculas; lo elegido no se esconde al buscar y la cuenta dice cuántos van
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const NOMBRES = ['Junta de regantes', 'Comunidad de Peña Blanca', 'Ronda campesina', 'Asociación de mujeres', 'Comité de vaso de leche', 'Municipalidad']
const GRUPOS = NOMBRES.map((_, i) => registro(`g${i}`, { organization: `o${i}` }))
const RETIRADO = registro('g9', { organization: 'o9' }, { state: 'retired' })

function Elegir({ grupos }: { grupos: Registro[] }) {
  const [elegidos, setElegidos] = useState<string[]>([])
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setElegidos(['enviado'])
      }}
    >
      <EleccionDeGrupos etiqueta="Grupos de interés" grupos={grupos} elegidos={elegidos} alCambiar={setElegidos} />
      <button type="submit">Enviar</button>
      <p>elegidos: {elegidos.join(',')}</p>
    </form>
  )
}

const rutas = () => [
  ...NOMBRES.map((name, i) => ({ path: `/objects/organization/records/o${i}`, body: registro(`o${i}`, { name }) })),
  { path: '/objects/organization/records/o9', body: registro('o9', { name: 'Grupo retirado' }) }
]

describe('EleccionDeGrupos', () => {
  it('con muchos grupos busca por el nombre sin tildes y no esconde lo ya elegido', async () => {
    fetch = mockFetch(rutas())
    montar(<Elegir grupos={[...GRUPOS, RETIRADO]} />)
    const grupo = screen.getByRole('group', { name: 'Grupos de interés' })
    await userEvent.click(await within(grupo).findByRole('checkbox', { name: 'Junta de regantes' }))
    expect(screen.getByText('elegidos: g0')).toBeInTheDocument()
    expect(within(grupo).getByText('1 elegido')).toBeInTheDocument()
    // un grupo retirado no se ofrece
    expect(within(grupo).queryByRole('checkbox', { name: 'Grupo retirado' })).not.toBeInTheDocument()

    const buscar = within(grupo).getByRole('searchbox', { name: 'Buscar un grupo de interés' })
    await userEvent.type(buscar, 'pena')
    expect(within(grupo).getByRole('checkbox', { name: 'Comunidad de Peña Blanca' })).toBeInTheDocument()
    expect(within(grupo).queryByRole('checkbox', { name: 'Ronda campesina' })).not.toBeInTheDocument()
    // lo elegido queda a la vista aunque no coincida: se puede quitar sin borrar la búsqueda
    expect(within(grupo).getByRole('checkbox', { name: 'Junta de regantes' })).toBeChecked()

    // Enter en la búsqueda no envía el formulario
    await userEvent.type(buscar, '{Enter}')
    expect(screen.queryByText('elegidos: enviado')).not.toBeInTheDocument()

    await userEvent.click(within(grupo).getByRole('checkbox', { name: 'Comunidad de Peña Blanca' }))
    expect(screen.getByText('elegidos: g0,g1')).toBeInTheDocument()
    expect(within(grupo).getByText('2 elegidos')).toBeInTheDocument()

    await userEvent.clear(buscar)
    await userEvent.type(buscar, 'xyz')
    expect(within(grupo).getByText('Ningún grupo de interés coincide con «xyz».')).toBeInTheDocument()
    // los elegidos siguen en la lista
    expect(within(grupo).getAllByRole('checkbox')).toHaveLength(2)
  })

  it('con pocos grupos no ofrece la búsqueda: se ven todos de un vistazo', async () => {
    fetch = mockFetch(rutas())
    montar(<Elegir grupos={GRUPOS.slice(0, 3)} />)
    const grupo = screen.getByRole('group', { name: 'Grupos de interés' })
    expect(await within(grupo).findByRole('checkbox', { name: 'Ronda campesina' })).toBeInTheDocument()
    expect(within(grupo).queryByRole('searchbox')).not.toBeInTheDocument()
    expect(within(grupo).queryByText(/elegido/)).not.toBeInTheDocument()
  })
})
