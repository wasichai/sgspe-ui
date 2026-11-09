import type { UseQueryResult } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { CONTROL } from '../componentes/Campo'
import { AtajosDePeriodo } from '../componentes/AtajosDePeriodo'
import { CampoFecha } from '../componentes/CampoFecha'
import { Consulta, NoDisponible } from '../componentes/Estados'
import { sonDemasiadosRegistros, useCatalogoDeIndicadores, type FiltrosDeIndicador, type Indicador } from '../datos/indicadores'
import { codigoDelError } from '../datos/http'
import { texto, useDefinicion, useTodos } from '../datos/registros'
import { Grafico } from '../graficos/Grafico'
import { escapar, useVersionDeTema } from '../graficos/tema'
import { colorDe } from '../mapa/colores'
import { fechaPe, NS, numeroPe, periodoPe } from '../i18n'
import { hoyEnLima } from '../datos/fechas'
import { useContextFilters } from '../shell/context'
import { rotuloDeFila, rotuloDeOpcion } from '../datos/opciones'
import { Seccion } from '../componentes/Seccion'

// la fila de filtros de dashboards.md §3.1, en la URL: proyecto (el del contexto; sin él, las asignaciones de la persona),
// periodo, territorio (el chip) y ámbito; desde F3, la campaña de exploración y el responsable (?explorationCampaign=, ?owner=),
// que solo ofrece el tablero de compromisos. una sola llamada por pantalla (api.md §4.11)
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
    const campana = busqueda.get('explorationCampaign')
    const responsable = busqueda.get('owner')
    if (campana) filtros.explorationCampaign = campana
    if (responsable) filtros.owner = responsable
    if (territory?.kind === 'locality') filtros.locality = territory.id
    if (territory?.kind === 'community') filtros.community = territory.id
    if (territory?.kind === 'admin-unit') filtros.administrativeUnit = territory.id
    if (territory?.kind === 'area') filtros.areaOfInfluence = territory.id
    return filtros
  }, [scope, territory, busqueda])
}

// el nombre de una cifra (tercera pasada de UX, 3.11): el del diccionario por su código, en el idioma de quien mira, o el que trae
// el servidor si la cifra no está en el diccionario
export function useRotuloDeCifra(): (indicador: { code: string; label: string }) => string {
  const { t } = useTranslation(NS)
  return (indicador) => t(`tableros.cifras.${indicador.code}`, { defaultValue: indicador.label })
}

// conCampana y conResponsable: los filtros del tablero de compromisos (dashboards.md §4.4). la campaña se elige entre las del
// proyecto del contexto; el responsable es «solo los míos» (owner = quien mira)
export function FiltrosDeTablero({
  calculado,
  alActualizar,
  conCampana = false,
  conResponsable = false
}: {
  calculado?: string
  alActualizar: () => void
  conCampana?: boolean
  conResponsable?: boolean
}) {
  const { t } = useTranslation(NS)
  const [busqueda, fijar] = useSearchParams()
  const { user } = useAuth()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const campanas = useTodos('exploration_campaign', { project: proyecto }, conCampana && proyecto !== undefined)
  const definicion = useDefinicion('stakeholder')
  const ambitos = definicion.data?.fields.find((f) => f.name === 'stakeholder_scope')?.enumOptions ?? []
  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(busqueda)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    fijar(siguiente, { replace: true })
  }
  return (
    <div role="group" aria-label={t('tableros.filtros')} className="flex flex-wrap items-end gap-x-4 gap-y-3 text-sg-body-sm">
      {/* U-07: dd/mm/aaaa en los dos idiomas (CampoFecha), con el mismo valor AAAA-MM-DD en la URL que el <input type="date"> */}
      <CampoFecha
        etiqueta={t('tableros.desde')}
        valor={busqueda.get('periodStart')}
        max={busqueda.get('periodEnd') ?? undefined}
        alCambiar={(v) => cambiar('periodStart', v ?? '')}
      />
      <CampoFecha
        etiqueta={t('tableros.hasta')}
        valor={busqueda.get('periodEnd')}
        min={busqueda.get('periodStart') ?? undefined}
        alCambiar={(v) => cambiar('periodEnd', v ?? '')}
      />
      <AtajosDePeriodo
        desde={busqueda.get('periodStart')}
        hasta={busqueda.get('periodEnd')}
        alElegir={({ desde, hasta }) => {
          const siguiente = new URLSearchParams(busqueda)
          siguiente.set('periodStart', desde)
          siguiente.set('periodEnd', hasta)
          fijar(siguiente, { replace: true })
        }}
      />
      <label className="space-y-1">
        <span className="block text-sg-label">{t('tableros.ambito')}</span>
        <select className={CONTROL} value={busqueda.get('scope') ?? ''} onChange={(e) => cambiar('scope', e.target.value)}>
          <option value="">{t('tableros.todosLosAmbitos')}</option>
          {ambitos.map((a) => (
            <option key={a} value={a}>
              {rotuloDeOpcion(a)}
            </option>
          ))}
        </select>
      </label>
      {conCampana && proyecto ? (
        <label className="space-y-1">
          <span className="block text-sg-label">{t('tableros.campana')}</span>
          <select className={CONTROL} value={busqueda.get('explorationCampaign') ?? ''} onChange={(e) => cambiar('explorationCampaign', e.target.value)}>
            <option value="">{t('tableros.todasLasCampanas')}</option>
            {(campanas.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {texto(c, 'name')}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {conResponsable && user ? (
        <label className="flex min-h-8 items-center gap-2 pb-1 text-sg-body-sm">
          <input type="checkbox" checked={busqueda.get('owner') === user.id} onChange={(e) => cambiar('owner', e.target.checked ? user.id : '')} />
          {t('tableros.soloMios')}
        </label>
      ) : null}
      <Button variant="secondary" size="sm" onClick={alActualizar}>
        {t('tableros.actualizar')}
      </Button>
      {/* la hora de cálculo del tablero (design-system.md §5.3 «KPI», préstamo de D), legible y no como nota al margen */}
      {calculado ? (
        <span className="pb-2 text-sg-body-sm text-sg-text-secondary">{t('tableros.calculado', { fecha: fechaPe(new Date(calculado)) })}</span>
      ) : null}
      {/* dashboards.md §3.1: sin fechas, el mes en curso; las series, los 12 meses que terminan hoy */}
      {!busqueda.get('periodStart') && !busqueda.get('periodEnd') ? (
        <p className="basis-full text-sg-caption text-sg-text-muted">{t('tableros.periodoPorDefecto')}</p>
      ) : null}
    </div>
  )
}

// «07:40», la hora de Lima de 24 h
const horaPe = (valor: Date): string =>
  new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Lima' }).format(valor)

// cuándo se calcularon las cifras, legible (préstamo de D): «Calculado hoy 07:40» si es de hoy en Lima; si no, «Calculado el 16 oct.
// 2026 a las 07:40». sin un instante válido, null
export function useTextoDeCalculo(): (instante: string | undefined | null) => string | null {
  const { t } = useTranslation(NS)
  return (instante) => {
    const fecha = instante ? new Date(instante) : null
    if (!fecha || Number.isNaN(fecha.getTime())) return null
    return hoyEnLima(fecha) === hoyEnLima()
      ? t('tableros.calculadoHoy', { hora: horaPe(fecha) })
      : t('tableros.calculadoElDia', { fecha: fechaPe(fecha), hora: horaPe(fecha) })
  }
}

// la hora de cálculo visible bajo el título de un tablero (design-system.md §5.3 «KPI»), con lo que abarca si se dice
// («con los datos de los 4 proyectos de su alcance»)
export function HoraDeCalculo({ instante, alcance }: { instante: string | undefined | null; alcance?: string }) {
  const texto = useTextoDeCalculo()(instante)
  if (!texto) return null
  return <span className="text-sg-body-sm text-sg-text-secondary">{alcance ? `${texto} ${alcance}` : texto}</span>
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
    .map((f) => ({ nombre: rotuloDeFila(f), valor: f.value }))
  if (ordenadas.length <= 10) return ordenadas
  const resto = ordenadas.slice(10).filter((f) => f.valor !== null)
  return [...ordenadas.slice(0, 10), { nombre: otros, valor: resto.length === 0 ? null : resto.reduce((s, f) => s + (f.valor ?? 0), 0) }]
}

// lo que las notas leen de un indicador o de una fila de KPI-TER-01 (ComponenteDeFicha): sus filtros ignorados y sus avisos
type NotasDe = Pick<Indicador, 'ignoredFilters' | 'warnings'>

// los filtros pedidos que el indicador no aplica (ignoredFilters, ruling P27): se dicen, para que la cifra no se lea como
// filtrada por ellos. sin filtros ignorados no dibuja nada
export function FiltrosIgnorados({ indicador }: { indicador: NotasDe | undefined }) {
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

// los avisos de un indicador (warnings, api.md §4.11): textos del servidor que dicen que la cifra está incompleta o que algo no
// se sumó (una moneda distinta de la de la campaña, reprogramaciones excluidas). se dicen como texto, nunca como marcado, y
// nunca se callan. sin avisos no dibuja nada
export function AvisosDeIndicador({ indicador }: { indicador: NotasDe | undefined }) {
  const { t } = useTranslation(NS)
  const avisos = indicador?.warnings ?? []
  if (avisos.length === 0) return null
  return (
    <ul aria-label={t('tableros.avisos')} className="space-y-1 text-sg-caption text-sg-warning">
      {avisos.map((aviso, n) => (
        <li key={n}>{aviso}</li>
      ))}
    </ul>
  )
}

// lo que acompaña a una cifra para que no se lea de más: los filtros que no aplica y sus avisos. lo usan las zonas y las
// tarjetas de un tablero
export function NotasDeIndicador({ indicador }: { indicador: NotasDe | undefined }) {
  return (
    <>
      <FiltrosIgnorados indicador={indicador} />
      <AvisosDeIndicador indicador={indicador} />
    </>
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
// con los filtros que el indicador no aplica y sus avisos. un indicador ausente de la respuesta tampoco se lee como vacío
export function Zona({ titulo, indicador, children }: { titulo: string; indicador: Indicador | undefined; children: (i: Indicador) => ReactNode }) {
  return (
    <Seccion titulo={titulo}>
      {indicador?.available ? (
        <>
          <NotasDeIndicador indicador={indicador} />
          {children(indicador)}
        </>
      ) : (
        <NoDisponible motivo={indicador?.unavailableReason} />
      )}
    </Seccion>
  )
}

// barras horizontales de un desglose
export function Barras({ titulo, filas }: { titulo: string; filas: { nombre: string; valor: number | null }[] }) {
  const { t } = useTranslation(NS)
  const opciones = useMemo(
    () => ({
      // a la derecha, la franja del valor rotulado de cada barra (§5.3 «Gráficos»)
      grid: { left: 160, right: 56, top: 8, bottom: 24 },
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

// una serie mensual con la meta en el mismo eje (dashboards.md §9.2): una línea discontinua de 2 px text (4 3) con su rótulo
// «meta N» (design-system.md §5.3 «Gráficos»). si la meta es la misma todo el periodo, una línea de referencia; si cambia de
// mes a mes, una línea escalonada rotulada al final. sin leyenda: la serie es la del título y la meta lleva su rótulo. el tooltip
// dice el periodo en negrita y la cifra con su meta
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
  const metas = serie.map((s) => s.target ?? null)
  const conMeta = metas.some((m) => m !== null)
  const metaFija = conMeta && metas.every((m) => m === metas[0]) ? metas[0] : null
  const version = useVersionDeTema()
  const opciones = useMemo(() => {
    const rotulo = (valor: unknown) => t('tableros.metaDe', { valor: typeof valor === 'number' ? numeroPe(valor) : '—' })
    const trazo = { color: colorDe('--sg-text'), type: [4, 3], width: 2 }
    const texto = { color: colorDe('--sg-text'), fontWeight: 700, fontSize: 13 }
    const valor = (v: number | null | undefined) => (v === null || v === undefined ? '—' : numeroPe(v))
    return {
      grid: { left: 40, right: conMeta ? 72 : 16, top: 24, bottom: 32 },
      xAxis: { type: 'category', data: serie.map((s) => periodoPe(s.period)) },
      yAxis: { type: 'value' },
      tooltip: {
        trigger: 'axis',
        formatter: (parametros: { dataIndex: number; axisValueLabel?: string; marker?: string }[]) => {
          const p = parametros[0]
          if (!p) return ''
          const punto = serie[p.dataIndex]
          const meta = conMeta ? ` · ${escapar(rotulo(punto?.target ?? null))}` : ''
          return `<strong>${escapar(String(p.axisValueLabel ?? ''))}</strong><br>${p.marker ?? ''}${escapar(t('tableros.valor'))}: ${valor(punto?.value)}${meta}`
        }
      },
      series: [
        {
          type: tipo,
          name: t('tableros.valor'),
          data: serie.map((s) => s.value),
          ...(metaFija !== null
            ? {
                markLine: {
                  silent: true,
                  symbol: 'none',
                  lineStyle: trazo,
                  label: { position: 'insideEndTop', ...texto, formatter: () => rotulo(metaFija) },
                  data: [{ yAxis: metaFija }]
                }
              }
            : {})
        },
        ...(conMeta && metaFija === null
          ? [
              {
                type: 'line',
                name: t('tableros.meta'),
                step: 'middle',
                symbol: 'none',
                color: colorDe('--sg-text'),
                lineStyle: trazo,
                endLabel: { show: true, ...texto, formatter: (p: { value?: unknown }) => rotulo(p.value) },
                data: metas
              }
            ]
          : [])
      ]
    }
    // version: los colores resueltos de los tokens se recalculan al cambiar de tema
  }, [JSON.stringify(serie), tipo, conMeta, metaFija, t, version])
  return (
    <Grafico
      etiqueta={titulo}
      opciones={opciones}
      datos={{
        columnas: [t('tableros.periodo'), t('tableros.valor'), ...(conMeta ? [t('tableros.meta')] : [])],
        filas: serie.map((s) => [
          periodoPe(s.period),
          s.value === null ? '—' : numeroPe(s.value),
          ...(conMeta ? [s.target === null || s.target === undefined ? '—' : numeroPe(s.target)] : [])
        ])
      }}
    />
  )
}

// la nota al pie de una tabla de un tablero (design-system.md §5.3 «Tablas», préstamo de C): bajo la tabla, en caption
// text-secondary, lo que la tabla necesita para leerse («Montos en la moneda de cada fila…», «— = sin cifra.»)
export function NotaAlPie({ children }: { children: ReactNode }) {
  return <p className="text-sg-caption text-sg-text-secondary">{children}</p>
}
