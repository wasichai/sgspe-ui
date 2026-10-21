import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { TablaPriorizada, type ColumnaPriorizada } from './TablaPriorizada'

// hallazgo U-06 (DD-05): una tabla ancha decide qué columnas se ven por su prioridad, y la que dice lo mismo en todas las
// filas sale de la tabla y queda en una nota encima
interface Fila {
  id: string
  titulo: string
  estado: string
  responsable: string
  monto: string
  notas: string
}

const FILAS: Fila[] = [
  { id: 'c1', titulo: 'Reservorio de Tunas', estado: 'En ejecución', responsable: 'Gestión de compromisos (demo)', monto: '1,200.00', notas: 'a' },
  { id: 'c2', titulo: 'Posta de Huaylla', estado: 'En ejecución', responsable: 'Gestión de compromisos (demo)', monto: '800.00', notas: 'b' }
]

const COLUMNAS: ColumnaPriorizada[] = [
  { id: 'titulo', encabezado: 'Compromiso', prioridad: 'esencial' },
  { id: 'estado', encabezado: 'Estado', prioridad: 'esencial' },
  { id: 'responsable', encabezado: 'Responsable', prioridad: 'secundaria' },
  { id: 'monto', encabezado: 'Monto', prioridad: 'secundaria', numerica: true },
  { id: 'notas', encabezado: 'Notas', prioridad: 'opcional' }
]

const valor = (fila: Fila, columna: string) => String(fila[columna as keyof Fila])

function dibujar(extra: Partial<Parameters<typeof TablaPriorizada<Fila>>[0]> = {}) {
  return montar(
    <TablaPriorizada<Fila> etiqueta="Compromisos" columnas={COLUMNAS} filas={FILAS} clave={(f) => f.id} celda={valor} valorPlano={valor} {...extra} />
  )
}

const tabla = () => screen.getByRole('table', { name: 'Compromisos' })
const filas = () => within(tabla()).getAllByRole('row').slice(1)

describe('TablaPriorizada', () => {
  it('CA-1.6.1: una columna no esencial con el mismo valor en todas las filas sale de la tabla y queda en una nota', () => {
    dibujar({ ocultarUniformes: true })
    expect(within(tabla()).queryByRole('columnheader', { name: 'Responsable' })).not.toBeInTheDocument()
    expect(within(tabla()).queryByText('Gestión de compromisos (demo)')).not.toBeInTheDocument()
    const nota = screen.getByRole('list', { name: 'Igual en todas las filas' })
    expect(within(nota).getAllByRole('listitem')).toHaveLength(1)
    expect(within(nota).getByRole('listitem')).toHaveTextContent(/^Responsable: Gestión de compromisos \(demo\)$/)
    // la columna que varía sigue en la tabla
    expect(within(tabla()).getByRole('columnheader', { name: 'Monto' })).toBeInTheDocument()
  })

  it('una columna esencial uniforme no se oculta ni lleva nota', () => {
    dibujar({ ocultarUniformes: true })
    expect(within(tabla()).getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument()
    expect(within(filas()[0]).getByRole('cell', { name: 'En ejecución' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Igual en todas las filas' })).not.toHaveTextContent('Estado')
  })

  it('sin ocultarUniformes, o con una sola fila, la columna uniforme se dibuja', () => {
    dibujar()
    expect(within(tabla()).getByRole('columnheader', { name: 'Responsable' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Igual en todas las filas' })).not.toBeInTheDocument()
    document.body.innerHTML = ''
    dibujar({ ocultarUniformes: true, filas: [FILAS[0]] })
    expect(within(tabla()).getByRole('columnheader', { name: 'Responsable' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Igual en todas las filas' })).not.toBeInTheDocument()
  })

  it('las secundarias se ven desde xl, en el encabezado y en cada celda; las esenciales siempre', () => {
    dibujar()
    const responsable = within(tabla()).getByRole('columnheader', { name: 'Responsable' })
    expect(responsable).toHaveClass('hidden', 'xl:table-cell')
    for (const fila of filas()) expect(within(fila).getByRole('cell', { name: 'Gestión de compromisos (demo)' })).toHaveClass('hidden', 'xl:table-cell')
    const compromiso = within(tabla()).getByRole('columnheader', { name: 'Compromiso' })
    expect(compromiso).not.toHaveClass('hidden')
    expect(within(filas()[0]).getByRole('cell', { name: 'Reservorio de Tunas' })).not.toHaveClass('hidden')
  })

  it('las opcionales no se dibujan', () => {
    dibujar()
    expect(within(tabla()).queryByRole('columnheader', { name: 'Notas' })).not.toBeInTheDocument()
    expect(within(tabla()).getAllByRole('columnheader')).toHaveLength(4)
    expect(within(filas()[0]).getAllByRole('cell')).toHaveLength(4)
  })

  it('una numérica va a la derecha y con cifras tabulares', () => {
    dibujar()
    expect(within(tabla()).getByRole('columnheader', { name: 'Monto' })).toHaveClass('text-right')
    expect(within(filas()[0]).getByRole('cell', { name: '1,200.00' })).toHaveClass('text-right', 'tabular-nums')
  })

  it('con alAbrir, cada fila se enfoca y Enter la abre', async () => {
    const alAbrir = vi.fn()
    dibujar({ alAbrir })
    expect(filas()[1]).toHaveAttribute('tabIndex', '0')
    filas()[1].focus()
    await userEvent.keyboard('{Enter}')
    expect(alAbrir).toHaveBeenCalledTimes(1)
    expect(alAbrir).toHaveBeenCalledWith(FILAS[1])
  })

  it('Enter en un control de la fila no abre la fila', async () => {
    const alAbrir = vi.fn()
    dibujar({ alAbrir, celda: (f, c) => (c === 'titulo' ? <a href={`/c/${f.id}`}>{f.titulo}</a> : valor(f, c)) })
    within(filas()[0]).getByRole('link', { name: 'Reservorio de Tunas' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(alAbrir).not.toHaveBeenCalled()
  })

  it('sin alAbrir, las filas no son enfocables', () => {
    dibujar()
    expect(filas()[0]).not.toHaveAttribute('tabIndex')
  })

  it('una columna con encabezado oculto lo deja solo a los lectores de pantalla', () => {
    dibujar({ columnas: [{ id: 'sel', encabezado: 'Seleccionar', prioridad: 'esencial', encabezadoOculto: true }, ...COLUMNAS] })
    const encabezado = within(tabla()).getByRole('columnheader', { name: 'Seleccionar' })
    expect(within(encabezado).getByText('Seleccionar')).toHaveClass('sr-only')
  })
})
