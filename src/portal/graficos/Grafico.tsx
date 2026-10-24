import type { EChartsCoreOption } from 'echarts/core'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LimiteDeError } from '../componentes/LimiteDeError'
import { NS } from '../i18n'

// el Chart del portal (design-system.md §5, dashboards.md §9): una envoltura delgada de ECharts, cargada bajo demanda,
// con la descripción ARIA activada y barras de color sólido (DD-15), y siempre con su tabla "Ver datos" debajo (RQ-DSH-035):
// el tooltip nunca es la única forma de leer un valor. si el chunk de ECharts no baja o init lanza, un aviso ocupa el lugar
// del gráfico y la tabla queda abierta. cambiar de biblioteca es cambiar este archivo (ASM-046)
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

const SIN_CIFRA = new Set<string | number>([0, '0', '—', ''])
// la primera columna es la categoría (el mes, el grupo); las demás, las cifras
export const sinDatos = ({ filas }: DatosDelGrafico): boolean => filas.every((fila) => fila.slice(1).every((celda) => SIN_CIFRA.has(celda)))

export function Grafico({ etiqueta, datos, alto = 280, ...props }: GraficoProps) {
  const { t } = useTranslation(NS)
  const [fallo, fijarFallo] = useState(false)
  // sin filas o con todo en cero (o sin cifra) no se dibujan ejes vacíos: se dice que no hay datos en el periodo
  if (sinDatos(datos))
    return (
      <figure aria-label={etiqueta} className="flex items-center justify-center rounded-sg-md bg-sg-surface-sunken p-6 text-sm text-sg-text-muted">
        {t('comun.sinDatosEnElPeriodo')}
      </figure>
    )
  return (
    <figure className="space-y-2">
      <LimiteDeError mensaje={t('tableros.fallo')} alFallar={() => fijarFallo(true)}>
        <Suspense fallback={<div style={{ height: alto }} className="rounded-sg-md bg-sg-surface-sunken" aria-busy="true" />}>
          <GraficoImpl etiqueta={etiqueta} datos={datos} alto={alto} {...props} />
        </Suspense>
      </LimiteDeError>
      <details open={fallo || undefined}>
        <summary className="cursor-pointer text-sg-caption text-sg-primary-text">{t('comun.verDatos')}</summary>
        <table className="mt-2 w-full text-sg-body-sm">
          <caption className="sr-only">{etiqueta}</caption>
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
