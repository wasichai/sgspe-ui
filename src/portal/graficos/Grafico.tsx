import { cn } from '@wasichai/ui'
import type { EChartsCoreOption } from 'echarts/core'
import { Table } from 'lucide-react'
import { lazy, Suspense, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LimiteDeError } from '../componentes/LimiteDeError'
import { NS } from '../i18n'

// el Chart del portal (design-system.md §5, dashboards.md §9): una envoltura delgada de ECharts, cargada bajo demanda,
// con la descripción ARIA activada y barras de color sólido (DD-15), y siempre con su tabla "Ver datos" debajo (RQ-DSH-035):
// el tooltip nunca es la única forma de leer un valor. «Ver datos» es un botón visible en la cabecera del gráfico (design-system.md
// §5.3 «Gráficos») que muestra la tabla debajo; cerrada, la tabla sigue en el árbol accesible (sr-only), así un lector de pantalla
// siempre la encuentra. si el chunk de ECharts no baja o init lanza, un aviso ocupa el lugar del gráfico y la tabla queda abierta.
// cambiar de biblioteca es cambiar este archivo (ASM-046)
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
  const [abierta, fijarAbierta] = useState(false)
  const idDeLaTabla = useId()
  // sin filas o con todo en cero (o sin cifra) no se dibujan ejes vacíos: se dice que no hay datos en el periodo
  if (sinDatos(datos))
    return (
      <figure aria-label={etiqueta} className="flex items-center justify-center rounded-sg-md bg-sg-surface-sunken p-6 text-sg-body-sm text-sg-text-muted">
        {t('comun.sinDatosEnElPeriodo')}
      </figure>
    )
  const visible = abierta || fallo
  return (
    <figure className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          aria-expanded={visible}
          aria-controls={idDeLaTabla}
          onClick={() => fijarAbierta((a) => !a)}
          className="inline-flex h-8 items-center gap-1.5 rounded-sg-md px-1 text-sm font-semibold text-sg-primary-text underline underline-offset-2 hover:decoration-2"
        >
          <Table className="size-4" aria-hidden />
          {t('comun.verDatos')}
        </button>
      </div>
      <LimiteDeError mensaje={t('tableros.fallo')} alFallar={() => fijarFallo(true)}>
        <Suspense fallback={<div style={{ height: alto }} className="rounded-sg-md bg-sg-surface-sunken" aria-busy="true" />}>
          <GraficoImpl etiqueta={etiqueta} datos={datos} alto={alto} {...props} />
        </Suspense>
      </LimiteDeError>
      <table id={idDeLaTabla} className={cn('w-full text-sg-body-sm', !visible && 'sr-only')}>
        <caption className="sr-only">{etiqueta}</caption>
        <thead>
          <tr>
            {datos.columnas.map((c, j) => (
              <th
                key={c}
                scope="col"
                className={cn(
                  'border-b border-sg-border-strong px-2 py-1 text-sg-caption font-semibold text-sg-text-secondary',
                  j === 0 ? 'text-left' : 'text-right'
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((celda, j) => (
                <td key={j} className={cn('border-b border-sg-border-subtle px-2 py-1 tabular-nums', j === 0 ? 'text-left' : 'text-right')}>
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
