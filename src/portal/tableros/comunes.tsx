import type { UseQueryResult } from '@tanstack/react-query'
import { ApiError } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { CONTROL } from '../componentes/Campo'
import { Consulta, NoDisponible } from '../componentes/Estados'
import { sonDemasiadosRegistros, useCatalogoDeIndicadores, type FiltrosDeIndicador, type Indicador } from '../datos/indicadores'
import { codigoDelError } from '../datos/http'
import { useDefinicion } from '../datos/registros'
import { Grafico } from '../graficos/Grafico'
import { fechaPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'

// la fila de filtros de dashboards.md §3.1, en la URL: proyecto (el del contexto; sin él, las asignaciones de la persona),
// periodo, territorio (el chip) y ámbito. una sola llamada por pantalla (api.md §4.11)
export function useFiltrosDeTablero(): FiltrosDeIndicador {
  const { scope, territory } = useContextFilters()
  const [busqueda] = useSearchParams()
  return useMemo(() => {
    const filtros: FiltrosDeIndicador = {}
    if (scope.kind === 'project') filtros.project = [scope.projectId]
    const desde = busqueda.get('periodStart')
    const hasta = busqueda.get('periodEnd')
    const ambito = busqueda.get('scope')
    if (desde) filtros.periodStart = desde
    if (hasta) filtros.periodEnd = hasta
    if (ambito) filtros.scope = ambito
    if (territory?.kind === 'locality') filtros.locality = territory.id
    if (territory?.kind === 'community') filtros.community = territory.id
    if (territory?.kind === 'admin-unit') filtros.administrativeUnit = territory.id
    if (territory?.kind === 'area') filtros.areaOfInfluence = territory.id
    return filtros
  }, [scope, territory, busqueda])
}

export function FiltrosDeTablero({ calculado, alActualizar }: { calculado?: string; alActualizar: () => void }) {
  const { t } = useTranslation(NS)
  const [busqueda, fijar] = useSearchParams()
  const definicion = useDefinicion('stakeholder')
  const ambitos = definicion.data?.fields.find((f) => f.name === 'stakeholder_scope')?.enumOptions ?? []
  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(busqueda)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    fijar(siguiente, { replace: true })
  }
  return (
    <div role="group" aria-label={t('tableros.filtros')} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="space-y-1">
        <span className="block text-sg-label">{t('tableros.desde')}</span>
        <input type="date" className={CONTROL} value={busqueda.get('periodStart') ?? ''} onChange={(e) => cambiar('periodStart', e.target.value)} />
      </label>
      <label className="space-y-1">
        <span className="block text-sg-label">{t('tableros.hasta')}</span>
        <input type="date" className={CONTROL} value={busqueda.get('periodEnd') ?? ''} onChange={(e) => cambiar('periodEnd', e.target.value)} />
      </label>
      <label className="space-y-1">
        <span className="block text-sg-label">{t('tableros.ambito')}</span>
        <select className={CONTROL} value={busqueda.get('scope') ?? ''} onChange={(e) => cambiar('scope', e.target.value)}>
          <option value="">{t('comun.ninguno')}</option>
          {ambitos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <Button variant="secondary" size="sm" onClick={alActualizar}>
        {t('tableros.actualizar')}
      </Button>
      {calculado ? <span className="text-sg-caption text-sg-text-muted">{t('tableros.calculado', { fecha: fechaPe(new Date(calculado)) })}</span> : null}
    </div>
  )
}

// un tablero se ofrece si la cuenta puede leer al menos uno de sus indicadores (api.md §4.11, RF-IAM-002)
export function useTableroDisponible(tablero: string): boolean {
  const catalogo = useCatalogoDeIndicadores()
  return (catalogo.data ?? []).some((i) => i.dashboard === tablero && i.available)
}

export const indicadorDe = (indicadores: Indicador[] | undefined, code: string) => indicadores?.find((i) => i.code === code)

// las categorías de un desglose en barras horizontales: las 10 de mayor valor y el resto en "Otros" (dashboards.md §3.3). una
// fila sin cifra (value null) queda al final y conserva el null: el gráfico la deja sin barra y la tabla dice "—", nunca 0.
// "Otros" suma solo las cifras que hay, y es null si ninguna la tiene
export function diezYOtros(filas: { key: string; label?: string; value: number | null }[], otros: string): { nombre: string; valor: number | null }[] {
  const ordenadas = [...filas]
    .sort((a, b) => (a.value === null ? 1 : 0) - (b.value === null ? 1 : 0) || (b.value ?? 0) - (a.value ?? 0))
    .map((f) => ({ nombre: f.label ?? f.key, valor: f.value }))
  if (ordenadas.length <= 10) return ordenadas
  const resto = ordenadas.slice(10).filter((f) => f.valor !== null)
  return [...ordenadas.slice(0, 10), { nombre: otros, valor: resto.length === 0 ? null : resto.reduce((s, f) => s + (f.valor ?? 0), 0) }]
}

// los filtros pedidos que el indicador no aplica (ignoredFilters, ruling P27): se dicen, para que la cifra no se lea como
// filtrada por ellos. sin filtros ignorados no dibuja nada
export function FiltrosIgnorados({ indicador }: { indicador: Indicador | undefined }) {
  const { t } = useTranslation(NS)
  const ignorados = indicador?.ignoredFilters ?? []
  if (ignorados.length === 0) return null
  const filtros = ignorados.map((f) => t(`tableros.nombresDeFiltro.${f}`, { defaultValue: f })).join(', ')
  return (
    <p role="note" className="text-sg-caption text-sg-text-muted">
      {t('tableros.ignorados', { filtros })}
    </p>
  )
}

// la consulta de un tablero o un indicador: 400 TOO_MANY_RECORDS no es un error de carga sino un estado propio, "acote los
// filtros", con los filtros a la vista (dashboards.md §6.2); un 403 es "no disponible" con su motivo (el código de la guarda,
// como NOT_ASSIGNED); lo demás, como Consulta (alerta con su correlación y reintento)
export function ConsultaDeTablero<T>({ consulta, children }: { consulta: UseQueryResult<T>; children: (datos: T) => ReactNode }) {
  const { t } = useTranslation(NS)
  if (consulta.isError && consulta.error instanceof ApiError && consulta.error.status === 403) return <NoDisponible motivo={codigoDelError(consulta.error)} />
  if (consulta.isError && sonDemasiadosRegistros(consulta.error))
    return (
      <Alert tone="warning" title={t('tableros.acotar.titulo')}>
        {t('tableros.acotar.texto')}
      </Alert>
    )
  return <Consulta consulta={consulta}>{children}</Consulta>
}

// una zona de un tablero: el título, "no disponible" si la cuenta no puede leer el indicador (RQ-DSH-032) o su contenido,
// con los filtros que el indicador no aplica. un indicador ausente de la respuesta tampoco se lee como vacío
export function Zona({ titulo, indicador, children }: { titulo: string; indicador: Indicador | undefined; children: (i: Indicador) => ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
      {indicador?.available ? (
        <>
          <FiltrosIgnorados indicador={indicador} />
          {children(indicador)}
        </>
      ) : (
        <NoDisponible motivo={indicador?.unavailableReason} />
      )}
    </section>
  )
}

// barras horizontales de un desglose
export function Barras({ titulo, filas }: { titulo: string; filas: { nombre: string; valor: number | null }[] }) {
  const { t } = useTranslation(NS)
  const opciones = useMemo(
    () => ({
      grid: { left: 160, right: 24, top: 8, bottom: 24 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: filas.map((f) => f.nombre).reverse(), axisLabel: { width: 150, overflow: 'truncate' } },
      tooltip: {},
      series: [{ type: 'bar', data: filas.map((f) => f.valor).reverse() }]
    }),
    [JSON.stringify(filas)]
  )
  return (
    <Grafico
      etiqueta={titulo}
      alto={Math.max(160, filas.length * 28)}
      opciones={opciones}
      datos={{ columnas: [t('tableros.categoria'), t('tableros.valor')], filas: filas.map((f) => [f.nombre, f.valor === null ? '—' : numeroPe(f.valor)]) }}
    />
  )
}

// una serie mensual con la meta como línea de referencia en el mismo eje (dashboards.md §9.2)
export function SerieConMeta({
  titulo,
  serie,
  tipo
}: {
  titulo: string
  serie: { period: string; value: number | null; target?: number | null }[]
  tipo: 'bar' | 'line'
}) {
  const { t } = useTranslation(NS)
  const conMeta = serie.some((s) => s.target !== undefined && s.target !== null)
  const opciones = useMemo(
    () => ({
      grid: { left: 40, right: 16, top: 24, bottom: 32 },
      xAxis: { type: 'category', data: serie.map((s) => s.period) },
      yAxis: { type: 'value' },
      tooltip: { trigger: 'axis' },
      legend: conMeta ? {} : undefined,
      series: [
        { type: tipo, name: t('tableros.valor'), data: serie.map((s) => s.value) },
        ...(conMeta
          ? [
              {
                type: 'line',
                name: t('tableros.meta'),
                step: 'middle',
                symbol: 'none',
                lineStyle: { type: 'dashed' },
                data: serie.map((s) => s.target ?? null)
              }
            ]
          : [])
      ]
    }),
    [JSON.stringify(serie), tipo, conMeta, t]
  )
  return (
    <Grafico
      etiqueta={titulo}
      opciones={opciones}
      datos={{
        columnas: [t('tableros.periodo'), t('tableros.valor'), ...(conMeta ? [t('tableros.meta')] : [])],
        filas: serie.map((s) => [
          s.period,
          s.value === null ? '—' : numeroPe(s.value),
          ...(conMeta ? [s.target === null || s.target === undefined ? '—' : numeroPe(s.target)] : [])
        ])
      }}
    />
  )
}
