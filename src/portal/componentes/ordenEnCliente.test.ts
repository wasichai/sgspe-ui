import { describe, expect, it } from 'vitest'
import { ordenarEnCliente, posicionEn } from './ordenEnCliente'

// el orden en el navegador: el colador del español, los números como números, los vacíos al final y estable
interface Fila {
  id: string
  nombre?: string
  n?: number | null
}

const ids = (filas: Fila[]) => filas.map((f) => f.id)
const valor = (f: Fila, columna: string) => (columna === 'n' ? f.n : f.nombre)

describe('ordenarEnCliente', () => {
  it('ordena los textos con el colador del español: la tilde y la eñe no van al final', () => {
    const filas: Fila[] = [
      { id: 'z', nombre: 'Zapata' },
      { id: 'n', nombre: 'Ñahui' },
      { id: 'a', nombre: 'Ávila' },
      { id: 'm', nombre: 'Nuñez' },
      { id: 'b', nombre: 'Barrios' }
    ]
    expect(ids(ordenarEnCliente(filas, { columna: 'nombre', dir: 'asc' }, valor))).toEqual(['a', 'b', 'm', 'n', 'z'])
    expect(ids(ordenarEnCliente(filas, { columna: 'nombre', dir: 'desc' }, valor))).toEqual(['z', 'n', 'm', 'b', 'a'])
  })

  it('compara los números como números, deja los vacíos al final en los dos sentidos y es estable', () => {
    const filas: Fila[] = [{ id: 'v1', n: null }, { id: 'diez', n: 10 }, { id: 'dos-a', n: 2 }, { id: 'v2' }, { id: 'dos-b', n: 2 }, { id: 'nueve', n: 9 }]
    expect(ids(ordenarEnCliente(filas, { columna: 'n', dir: 'asc' }, valor))).toEqual(['dos-a', 'dos-b', 'nueve', 'diez', 'v1', 'v2'])
    expect(ids(ordenarEnCliente(filas, { columna: 'n', dir: 'desc' }, valor))).toEqual(['diez', 'nueve', 'dos-a', 'dos-b', 'v1', 'v2'])
  })

  it('sin orden deja las filas como llegaron, en una copia', () => {
    const filas: Fila[] = [{ id: 'b' }, { id: 'a' }]
    const copia = ordenarEnCliente(filas, undefined, valor)
    expect(ids(copia)).toEqual(['b', 'a'])
    expect(copia).not.toBe(filas)
  })

  it('la posición de negocio de un código; uno desconocido no tiene', () => {
    expect(posicionEn(['BAJO', 'MEDIO', 'ALTO'], 'ALTO')).toBe(2)
    expect(posicionEn(['BAJO', 'MEDIO', 'ALTO'], 'OTRO')).toBeNull()
    expect(posicionEn(['BAJO'], null)).toBeNull()
  })
})
