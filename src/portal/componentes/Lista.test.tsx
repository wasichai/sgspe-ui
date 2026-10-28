import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { montar, ubicacion } from '../../test/montar'
import { ordenEnUrl, useParametrosDeLista, VacioDeLista, VistasGuardadas } from './Lista'

// la revisión de UX, etapa 3: las vistas dicen cuántos tienen y el vacío por filtros dice cuántos habría sin ellos
describe('VistasGuardadas', () => {
  it('cada vista con su conteo en la descripción; el nombre de la pestaña no cambia', async () => {
    const alCambiar = vi.fn()
    montar(
      <VistasGuardadas
        vistas={[
          { id: 'abiertos', etiqueta: 'Abiertos', conteo: 12 },
          { id: 'vencidos', etiqueta: 'Vencidos', conteo: 3 },
          { id: 'candidatos', etiqueta: 'Candidatos' }
        ]}
        actual="abiertos"
        alCambiar={alCambiar}
      />
    )
    expect(screen.getByRole('tab', { name: 'Abiertos' })).toHaveAccessibleDescription('12 registros')
    expect(screen.getByRole('tab', { name: 'Vencidos' })).toHaveTextContent('Vencidos3')
    expect(screen.getByRole('tab', { name: 'Candidatos' })).not.toHaveAccessibleDescription()
    await userEvent.click(screen.getByRole('tab', { name: 'Vencidos' }))
    expect(alCambiar).toHaveBeenCalledWith('vencidos')
  })
})

describe('VacioDeLista', () => {
  it('con filtros, dice cuántos hay sin ellos y ofrece limpiarlos', async () => {
    const alLimpiar = vi.fn()
    montar(<VacioDeLista conFiltros alLimpiar={alLimpiar} sinFiltros={3} />)
    expect(screen.getByText('Nada coincide con los filtros')).toBeInTheDocument()
    expect(screen.getByText('Sin los filtros hay 3.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(alLimpiar).toHaveBeenCalled()
  })
})

// tercera pasada de UX, 3.6 (DD-37): el orden de una tabla vive en la URL, así que volver de una ficha lo conserva
function ConOrden() {
  const lista = useParametrosDeLista('todos')
  const [orden, ordenar] = ordenEnUrl(lista, { columna: 'vence', dir: 'asc' }, ['vence', 'codigo'])
  return (
    <>
      <p>
        orden: {orden.columna} {orden.dir}
      </p>
      <button type="button" onClick={() => ordenar({ columna: 'codigo', dir: 'desc' })}>
        Por código
      </button>
    </>
  )
}

describe('ordenEnUrl', () => {
  it('lee el orden de la URL, lo escribe al ordenar y vuelve a la primera página', async () => {
    montar(<ConOrden />, { ruta: '/lista?page=2&state=open', camino: '/lista' })
    expect(screen.getByText('orden: vence asc')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Por código' }))
    expect(screen.getByText('orden: codigo desc')).toBeInTheDocument()
    expect(ubicacion.actual).toBe('/lista?state=open&sort=codigo&dir=desc')
  })

  it('una columna que la pantalla no ordena vuelve al orden inicial', () => {
    montar(<ConOrden />, { ruta: '/lista?sort=titulo&dir=asc', camino: '/lista' })
    expect(screen.getByText('orden: vence asc')).toBeInTheDocument()
  })
})
