import type { DatosDelGrafico } from './Grafico'

// la descripción accesible de un gráfico con sus propios datos, ya dichos para la persona (montos con moneda, «Por aprobar»): para
// aria.label.description cuando un valor falta. ECharts diría «NaN» de una barra null y el índice de la categoría junto a cada valor
export function descripcionDeDatos(etiqueta: string, { columnas, filas }: DatosDelGrafico): string {
  const detalle = filas.map(
    (fila) =>
      `${String(fila[0])}: ${fila
        .slice(1)
        .map((celda, j) => `${columnas[j + 1]} ${String(celda)}`)
        .join(', ')}`
  )
  return `${etiqueta}. ${detalle.join('; ')}.`
}
