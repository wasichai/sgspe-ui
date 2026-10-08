import type { GraficoProps } from '../portal/graficos/Grafico'

// el Grafico del portal sin ECharts, para probar las pantallas: dibuja solo su tabla "Ver datos" y un botón por fila que la
// elige, como un clic en el gráfico. se instala con vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))
export function Grafico({ etiqueta, datos, alElegir, opciones }: GraficoProps) {
  const serie = (opciones as { series?: { data?: { name?: string }[] }[] }).series?.[0]?.data ?? []
  return (
    <figure aria-label={etiqueta}>
      <table aria-label={etiqueta}>
        <thead>
          <tr>
            {datos.columnas.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((celda, j) => (
                <td key={j}>{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {alElegir
        ? serie.map((punto, i) =>
            typeof punto === 'object' && punto?.name ? (
              <button key={i} type="button" onClick={() => alElegir(String(punto.name), punto)}>
                {`punto ${String(punto.name)}`}
              </button>
            ) : null
          )
        : null}
    </figure>
  )
}
