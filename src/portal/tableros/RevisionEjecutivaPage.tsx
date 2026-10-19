import { Alert, Table, Td, Th } from '@wasichai/ui'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { NoDisponible, Vacio } from '../componentes/Estados'
import { KpiCard } from '../componentes/KpiCard'
import { montoPe } from '../componentes/Monto'
import { useProyectos } from '../contexto/proyectos'
import { aDiezmilesimos, deDiezmilesimos } from '../datos/decimales'
import { desglose, useTablero, type FiltrosDeIndicador, type Indicador } from '../datos/indicadores'
import { porcentaje } from '../datos/inversion'
import { texto } from '../datos/registros'
import { Grafico } from '../graficos/Grafico'
import { NS, numeroPe, periodoPe } from '../i18n'
import { itemsDeAtencion } from './atencionEjecutiva'
import { ConsultaDeTablero, FiltrosDeTablero, indicadorDe, useFiltrosDeTablero } from './comunes'
import { CODIGOS_DE_LAS_TILES, mesesDeTendencia, TOPE_DE_PROYECTOS, type MesDeTendencia, type TableroEjecutivo } from './contratoF8'

// S51 · revisión ejecutiva de 5 minutos (screens.md, dashboards.md §5.1): qué cambió, qué es crítico, dónde y quién lo atiende,
// con el tablero executive en una sola llamada (api.md §4.11). los proyectos elegidos viajan en la URL (?project= repetido);
// sin elegir, «mis proyectos». más de 25 pedidos es 400 TOO_MANY_RECORDS («acote los filtros»); tenerlos por defecto omite la
// tabla por proyecto. la postura no llega a esta revisión (dashboards.md §8): su tile dice no disponible
function useFiltrosEjecutivos(): FiltrosDeIndicador {
  const base = useFiltrosDeTablero()
  const [busqueda] = useSearchParams()
  const proyectos = busqueda.getAll('project')
  const clave = proyectos.join(',')
  return useMemo(() => (proyectos.length ? { ...base, project: proyectos } : base), [base, clave])
}

export function RevisionEjecutivaPage() {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosEjecutivos()
  const tablero = useTablero<TableroEjecutivo>('executive', filtros)
  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-sg-h1 font-semibold">{t('tablerosF8.ejecutivo.titulo')}</h1>
          <p className="text-sm text-sg-text-secondary">{t('tablerosF8.ejecutivo.ayuda')}</p>
        </div>
        <Link to="/dashboards/monitoring" className="text-sm text-sg-primary-text underline">
          {t('tablerosF8.ejecutivo.monitoreo')}
        </Link>
      </header>
      <FiltrosDeTablero calculado={tablero.data?.computedAt} alActualizar={() => void tablero.refetch()} />
      <ProyectosDeLaRevision />
      <ConsultaDeTablero consulta={tablero}>{(datos) => <Revision datos={datos} />}</ConsultaDeTablero>
    </div>
  )
}

function ProyectosDeLaRevision() {
  const { t } = useTranslation(NS)
  const proyectos = useProyectos()
  const [busqueda, fijar] = useSearchParams()
  const elegidos = busqueda.getAll('project')
  const alternar = (id: string) => {
    const siguiente = new URLSearchParams(busqueda)
    siguiente.delete('project')
    for (const p of elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]) siguiente.append('project', p)
    fijar(siguiente, { replace: true })
  }
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-sg-primary-text">{t('tablerosF8.ejecutivo.elegirProyectos', { n: elegidos.length })}</summary>
      <fieldset className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">{t('tablerosF8.ejecutivo.proyectos')}</legend>
        {(proyectos.data ?? []).map((p) => (
          <label key={p.id} className="flex items-center gap-2">
            <input type="checkbox" checked={elegidos.includes(p.id)} onChange={() => alternar(p.id)} />
            {texto(p, 'code')} · {texto(p, 'name')}
          </label>
        ))}
      </fieldset>
      {elegidos.length > TOPE_DE_PROYECTOS ? (
        <p role="note" className="text-sg-caption text-sg-warning">
          {t('tablerosF8.ejecutivo.demasiados', { tope: TOPE_DE_PROYECTOS })}
        </p>
      ) : null}
    </details>
  )
}

function Revision({ datos }: { datos: TableroEjecutivo }) {
  const { t } = useTranslation(NS)
  const proyectosDelPedido = datos.filters.project
  if (Array.isArray(proyectosDelPedido) && proyectosDelPedido.length === 0)
    return (
      <Vacio titulo={t('tablerosF8.ejecutivo.sinProyectos')}>
        <Link to="/projects" className="text-sg-primary-text underline">
          {t('tablerosF8.ejecutivo.irAProyectos')}
        </Link>
      </Vacio>
    )
  const items = itemsDeAtencion(datos)
  const indicador = (code: string): Indicador => indicadorDe(datos.indicators, code) ?? { code, label: code, available: false }
  return (
    <div className="space-y-5">
      <section aria-label={t('tablerosF8.ejecutivo.atencion')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
        <h2 className="text-sg-h3 font-semibold">{t('tablerosF8.ejecutivo.atencion')}</h2>
        <p className="text-sg-caption text-sg-text-muted">{t('tablerosF8.ejecutivo.atencionAyuda')}</p>
        {items.length === 0 ? (
          <p className="text-sm text-sg-text-muted">{t('tablerosF8.ejecutivo.sinAtencion')}</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {items.map((i) => (
              <li key={`${i.code}-${i.proyecto ?? 'cartera'}`}>
                <Link to={i.ruta} className="text-sg-primary-text underline">
                  {t(`tablerosF8.ejecutivo.items.${i.code}`, {
                    proyecto: i.nombre ?? t('tablerosF8.ejecutivo.todaLaCartera'),
                    n: numeroPe(i.valor),
                    count: i.valor
                  })}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-label={t('tablerosF8.ejecutivo.tiles')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <h2 className="sr-only">{t('tablerosF8.ejecutivo.tiles')}</h2>
        {CODIGOS_DE_LAS_TILES.map((code) => (
          <KpiCard key={code} titulo={indicador(code).label} indicador={indicador(code)} />
        ))}
        <section aria-label={t('tablerosF8.ejecutivo.postura')} className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
          <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('tablerosF8.ejecutivo.postura')}</h3>
          <NoDisponible />
          <p className="text-sg-caption text-sg-text-muted">{t('tablerosF8.ejecutivo.posturaAyuda')}</p>
        </section>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <InversionPorMoneda indicador={indicador('KPI-INV-03')} />
        <Tendencia indicador={indicador('KPI-EXE-03')} />
      </div>
      <PorProyecto datos={datos} />
    </div>
  )
}

interface CifrasDeUnaMoneda {
  moneda: string
  ejecutado: bigint
  presupuesto: bigint | null
  tope: bigint | null
}

const sumar = (actual: bigint | null, valor: unknown): bigint | null => {
  const n = aDiezmilesimos(valor)
  return n === null ? actual : (actual ?? 0n) + n
}

// KPI-INV-03 por moneda, desde su desglose project (InvestmentKpis.executed): lo ejecutado, el presupuesto y los topes de cada
// moneda, en diezmilésimos exactos y nunca entre monedas (ASM-063). un presupuesto o un tope que no vino es null, nunca cero
export function inversionPorMoneda(indicador: Indicador): CifrasDeUnaMoneda[] {
  const porMoneda = new Map<string, CifrasDeUnaMoneda>()
  for (const fila of desglose(indicador, 'project')) {
    const moneda = typeof fila.currency === 'string' && fila.currency ? fila.currency : null
    if (!moneda) continue
    const actual = porMoneda.get(moneda) ?? { moneda, ejecutado: 0n, presupuesto: null, tope: null }
    porMoneda.set(moneda, {
      moneda,
      ejecutado: sumar(actual.ejecutado, fila.executed) ?? 0n,
      presupuesto: sumar(actual.presupuesto, fila.budget),
      tope: sumar(actual.tope, fila.cap)
    })
  }
  return [...porMoneda.values()].sort((a, b) => a.moneda.localeCompare(b.moneda))
}

function InversionPorMoneda({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const titulo = t('tablerosF8.ejecutivo.inversion')
  const monedas = indicador.available ? inversionPorMoneda(indicador) : []
  const texto_ = (n: bigint | null) => (n === null ? null : deDiezmilesimos(n))
  return (
    <section aria-label={titulo} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
      {!indicador.available ? (
        <NoDisponible motivo={indicador.unavailableReason} />
      ) : monedas.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('tablerosF8.ejecutivo.sinInversion')}</p>
      ) : (
        <ul className="space-y-3">
          {monedas.map((m) => {
            const avance = porcentaje(texto_(m.ejecutado), texto_(m.presupuesto))
            return (
              <li key={m.moneda} role="group" aria-label={m.moneda} className="space-y-1 text-sm">
                <div
                  role="progressbar"
                  aria-label={t('tablerosF8.ejecutivo.ejecutadoDe', { moneda: m.moneda })}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={avance ?? undefined}
                  aria-valuetext={avance === null ? '—' : `${numeroPe(avance)} %`}
                  className="h-2 rounded-full bg-sg-surface-sunken"
                >
                  <div className="h-2 rounded-full bg-sg-primary" style={{ width: `${Math.min(100, avance ?? 0)}%` }} />
                </div>
                <p>{t('tablerosF8.ejecutivo.ejecutado', { monto: montoPe(texto_(m.ejecutado), m.moneda) })}</p>
                <p>{t('tablerosF8.ejecutivo.presupuesto', { monto: montoPe(texto_(m.presupuesto), m.moneda) })}</p>
                <p>{t('tablerosF8.ejecutivo.tope', { monto: montoPe(texto_(m.tope), m.moneda) })}</p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

interface SerieDeTendencia {
  nombre: string
  valor: (m: MesDeTendencia) => number
}

function Linea({ titulo, meses, series }: { titulo: string; meses: MesDeTendencia[]; series: SerieDeTendencia[] }) {
  const { t } = useTranslation(NS)
  const opciones = {
    grid: { left: 32, right: 12, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: meses.map((m) => periodoPe(m.period)) },
    yAxis: { type: 'value', minInterval: 1 },
    tooltip: { trigger: 'axis' },
    legend: series.length > 1 ? { bottom: 0 } : undefined,
    series: series.map((s) => ({ type: 'line', name: s.nombre, data: meses.map(s.valor) }))
  }
  // cada serie con su título a la vista: tres gráficos sin nombre no se distinguen
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">{titulo}</h3>
      <Grafico
        etiqueta={titulo}
        alto={series.length > 1 ? 190 : 160}
        opciones={opciones}
        datos={{
          columnas: [t('tableros.periodo'), ...series.map((s) => s.nombre)],
          filas: meses.map((m) => [periodoPe(m.period), ...series.map((s) => numeroPe(s.valor(m)))])
        }}
      />
    </div>
  )
}

// KPI-EXE-03: tres gráficos pequeños, uno por medida (dashboards.md §9.2: nunca dos ejes Y)
function Tendencia({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const titulo = t('tablerosF8.ejecutivo.tendencia')
  const meses = mesesDeTendencia(indicador)
  return (
    <section aria-label={titulo} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
      {!indicador.available ? (
        <NoDisponible motivo={indicador.unavailableReason} />
      ) : meses.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('tableros.sinDatos')}</p>
      ) : (
        <div className="space-y-3">
          <Linea
            titulo={t('tablerosF8.ejecutivo.series.engagements')}
            meses={meses}
            series={[{ nombre: t('tablerosF8.ejecutivo.series.engagements'), valor: (m) => m.engagements }]}
          />
          <Linea
            titulo={t('tablerosF8.ejecutivo.series.grievances')}
            meses={meses}
            series={[
              { nombre: t('tablerosF8.ejecutivo.recibidas'), valor: (m) => m.grievancesReceived },
              { nombre: t('tablerosF8.ejecutivo.cerradas'), valor: (m) => m.grievancesClosed }
            ]}
          />
          <Linea
            titulo={t('tablerosF8.ejecutivo.series.overdue')}
            meses={meses}
            series={[{ nombre: t('tablerosF8.ejecutivo.series.overdue'), valor: (m) => m.overdueCommitments }]}
          />
        </div>
      )}
    </section>
  )
}

function PorProyecto({ datos }: { datos: TableroEjecutivo }) {
  const { t } = useTranslation(NS)
  const titulo = t('tablerosF8.ejecutivo.porProyecto')
  const filas = datos.byProject ?? []
  const columnas = filas[0]?.indicators.map((i) => ({ code: i.code, label: i.label })) ?? []
  return (
    <section aria-label={titulo} className="space-y-2">
      <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
      {datos.byProjectOmitted ? (
        <Alert tone="notice">{t('tablerosF8.ejecutivo.omitida', { tope: TOPE_DE_PROYECTOS })}</Alert>
      ) : filas.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('tableros.sinDatos')}</p>
      ) : (
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={titulo}>
            <thead>
              <tr>
                <Th scope="col">{t('tablerosF8.ejecutivo.proyecto')}</Th>
                {columnas.map((c) => (
                  <Th key={c.code} scope="col">
                    {c.label}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.project}>
                  <Td className="text-sm">
                    <Link to={`/projects/${encodeURIComponent(f.project)}/overview`} className="text-sg-primary-text underline">
                      {[f.code, f.name].filter(Boolean).join(' · ')}
                    </Link>
                  </Td>
                  {columnas.map((c) => {
                    const i = f.indicators.find((x) => x.code === c.code)
                    return (
                      <Td key={c.code} className="text-sm tabular-nums">
                        {!i?.available ? (
                          <NoDisponible motivo={i?.unavailableReason} enLista />
                        ) : i.value === null || i.value === undefined ? (
                          '—'
                        ) : (
                          numeroPe(i.value)
                        )}
                      </Td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  )
}
