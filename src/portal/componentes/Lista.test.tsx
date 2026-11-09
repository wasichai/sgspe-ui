import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { montar, ubicacion } from '../../test/montar'
import { ordenEnUrl, Paginador, paginasVisibles, useParametrosDeLista, VacioDeLista, VistasGuardadas } from './Lista'

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

// design-system.md §5.3: el paginador al pie con «Mostrando 1–8 de 23», botones de 32 px y el actual en primary
describe('Paginador', () => {
  it('dice el rango, marca la página actual y pasa a otra', async () => {
    const alPagina = vi.fn()
    montar(<Paginador pagina={{ page: 1, size: 8, totalElements: 23, totalPages: 3 }} alPagina={alPagina} />)
    const barra = screen.getByRole('navigation', { name: 'Paginación' })
    expect(barra).toHaveTextContent('Mostrando 9–16 de 23')
    expect(barra).toHaveClass('border-t')
    const actual = screen.getByRole('button', { name: 'Página 2' })
    expect(actual).toHaveAttribute('aria-current', 'page')
    expect(actual).toHaveClass('h-8', 'min-w-8', 'border-sg-primary', 'bg-sg-primary', 'text-sg-on-primary', 'rounded-sg-md')
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveClass('border-sg-border-strong')
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(alPagina).toHaveBeenCalledWith(2)
    await userEvent.click(screen.getByRole('button', { name: 'Página 1' }))
    expect(alPagina).toHaveBeenCalledWith(0)
  })

  it('en la primera página no hay anterior; con una sola página no se dibuja', () => {
    montar(<Paginador pagina={{ page: 0, size: 25, totalElements: 30, totalPages: 2 }} alPagina={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    document.body.innerHTML = ''
    montar(<Paginador pagina={{ page: 0, size: 25, totalElements: 3, totalPages: 1 }} alPagina={() => undefined} />)
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
  })

  it('ofrece la primera, la última y las vecinas de la actual, con saltos', () => {
    expect(paginasVisibles(0, 3)).toEqual([0, 1, 2])
    expect(paginasVisibles(5, 10)).toEqual([0, null, 4, 5, 6, null, 9])
  })
})
