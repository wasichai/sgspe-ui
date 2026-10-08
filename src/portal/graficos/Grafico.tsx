import type { EChartsCoreOption } from 'echarts/core'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el Chart del portal (design-system.md §5, dashboards.md §9): una envoltura delgada de ECharts, cargada bajo demanda,
// con la descripción ARIA y los patrones de relleno activados, y siempre con su tabla "Ver datos" debajo (RQ-DSH-035):
// el tooltip nunca es la única forma de leer un valor. cambiar de biblioteca es cambiar este archivo (ASM-046)
export interface DatosDelGrafico {
  columnas: string[]
  filas: (string | number)[][]
}

export interface GraficoProps {
  etiqueta: string
  opciones: EChartsCoreOption
  datos: DatosDelGrafico
  alto?: number
  alElegir?: (nombre: string, datos: unknown) => void
}

const GraficoImpl = lazy(() => import('./GraficoImpl'))

export function Grafico({ etiqueta, datos, alto = 280, ...props }: GraficoProps) {
  const { t } = useTranslation(NS)
  return (
    <figure className="space-y-2">
      <Suspense fallback={<div style={{ height: alto }} className="rounded-sg-md bg-sg-surface-sunken" aria-busy="true" />}>
        <GraficoImpl etiqueta={etiqueta} datos={datos} alto={alto} {...props} />
      </Suspense>
      <details>
        <summary className="cursor-pointer text-sg-caption text-sg-primary-text">{t('comun.verDatos')}</summary>
        <table aria-label={etiqueta} className="mt-2 w-full text-sg-body-sm">
          <thead>
            <tr>
              {datos.columnas.map((c) => (
                <th key={c} scope="col" className="border-b border-sg-border px-2 py-1 text-left">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.filas.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) => (
                  <td key={j} className="border-b border-sg-border-subtle px-2 py-1 tabular-nums">
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
