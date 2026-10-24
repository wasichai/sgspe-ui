import type { OrdenDeTabla } from './TablaPriorizada'

// el orden por columna de una lista que se filtra y pagina en el navegador (05-especificacion §1.6), con la misma columna que
// pediría al servidor: los textos con el colador del español (tildes y eñes en su lugar), los números como números y una
// posición de negocio (el nivel de un riesgo, la prioridad de un grupo) como su índice. lo que no tiene valor va al final en los
// dos sentidos, y dos filas iguales conservan el orden en que llegaron (estable)
export type ValorDeOrden = string | number | null | undefined

const COLADOR = new Intl.Collator('es')

const vacio = (v: ValorDeOrden) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))

export function compararValores(a: ValorDeOrden, b: ValorDeOrden): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return COLADOR.compare(String(a), String(b))
}

export function ordenarEnCliente<T>(filas: readonly T[], orden: OrdenDeTabla | undefined, valor: (fila: T, columna: string) => ValorDeOrden): T[] {
  if (!orden) return [...filas]
  const signo = orden.dir === 'desc' ? -1 : 1
  return filas
    .map((fila, indice) => ({ fila, indice, valor: valor(fila, orden.columna) }))
    .sort((x, y) => {
      const sinX = vacio(x.valor)
      const sinY = vacio(y.valor)
      if (sinX || sinY) return sinX === sinY ? x.indice - y.indice : sinX ? 1 : -1
      return signo * compararValores(x.valor, y.valor) || x.indice - y.indice
    })
    .map(({ fila }) => fila)
}

// la posición de un código en su orden de negocio; uno que no está en la lista no tiene posición (va al final)
export function posicionEn(orden: readonly string[], codigo: unknown): number | null {
  const i = orden.indexOf(String(codigo ?? ''))
  return i < 0 ? null : i
}
