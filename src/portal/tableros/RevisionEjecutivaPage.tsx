import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { NoDisponible, Vacio } from '../componentes/Estados'
import { KpiCard } from '../componentes/KpiCard'
import { montoPe } from '../componentes/Monto'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { useProyectos } from '../contexto/proyectos'
import { aDiezmilesimos, deDiezmilesimos } from '../datos/decimales'
import { hoyEnLima } from '../datos/fechas'
import { desglose, useTablero, type FiltrosDeIndicador, type Indicador } from '../datos/indicadores'
import { porcentaje } from '../datos/inversion'
import { texto } from '../datos/registros'
import { Grafico } from '../graficos/Grafico'
import { diaPe, fechaPe, mesPe, NS, numeroPe, periodoPe } from '../i18n'
import { itemsDeAtencion } from './atencionEjecutiva'
import { ConsultaDeTablero, FiltrosDeTablero, indicadorDe, useFiltrosDeTablero, useRotuloDeCifra } from './comunes'
import { CODIGOS_DE_LAS_TILES, mesesDeTendencia, TOPE_DE_PROYECTOS, type MesDeTendencia, type TableroEjecutivo } from './contratoF8'
import { Seccion } from '../componentes/Seccion'

// S51 · revisión ejecutiva de 5 minutos (screens.md, dashboards.md §5.1): qué cambió, qué es crítico, dónde y quién lo atiende,
// con el tablero executive en una sola llamada (api.md §4.11). los proyectos elegidos viajan en la URL (?project= repetido);
// sin elegir, «mis proyectos». más de 25 pedidos es 400 TOO_MANY_RECORDS («acote los filtros»); tenerlos por defecto omite la
// tabla por proyecto. la postura no llega a esta revisión (dashboards.md §8): su tile dice no disponible.
// desde el rediseño de UX (P-07, área 4.8): abre con las cifras y su periodo y fecha de cálculo bajo el título (U-11, U-23), con
// los filtros plegados; lo crítico en una tabla corta; las cifras no disponibles al final; barras sólidas, sin trama
function useFiltrosEjecutivos(): FiltrosDeIndicador {
  const base = useFiltrosDeTablero()
  const [busqueda] = useSearchParams()
  const proyectos = busqueda.getAll('project')
  const clave = proyectos.join(',')
  return useMemo(() => (proyectos.length ? { ...base, project: proyectos } : base), [base, clave])
}

// un cálculo de más de 24 horas se dice (U-23)
export const HORAS_DE_UN_CALCULO_VIGENTE = 24

const conMayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const ultimoDiaDelMes = (dia: string) => {
  const [a, m] = dia.split('-').map(Number)
  return `${dia.slice(0, 8)}${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`
}

// el periodo de las cifras como se lee: sin fechas, el mes en curso de Lima (dashboards.md §3.1); un mes entero, por su nombre
function usePeriodo(): string {
  const { t } = useTranslation(NS)
  const [busqueda] = useSearchParams()
  const desde = busqueda.get('periodStart')
  const hasta = busqueda.get('periodEnd')
  if (!desde && !hasta) return conMayuscula(mesPe(hoyEnLima().slice(0, 7)))
  if (desde && hasta && desde.endsWith('-01') && hasta === ultimoDiaDelMes(desde)) return conMayuscula(mesPe(desde.slice(0, 7)))
  if (desde && hasta) return t('tablerosF8.ejecutivo.periodoEntre', { desde: diaPe(desde), hasta: diaPe(hasta) })
  return desde ? t('tablerosF8.ejecutivo.periodoDesde', { desde: diaPe(desde) }) : t('tablerosF8.ejecutivo.periodoHasta', { hasta: diaPe(hasta ?? '') })
}

// cuándo se calcularon las cifras, dicho como lapso mientras es de hoy; pasadas 24 horas, la fecha y el aviso de cálculo antiguo
function useCalculo(computedAt: string | undefined): { texto: string; antiguo: boolean } {
  const { t } = useTranslation(NS)
  const instante = computedAt ? Date.parse(computedAt) : NaN
  if (Number.isNaN(instante)) return { texto: t('tablerosF8.ejecutivo.calculando'), antiguo: false }
  const minutos = Math.max(0, Math.floor((Date.now() - instante) / 60_000))
  if (minutos < 1) return { texto: t('tablerosF8.ejecutivo.calculadoAhora'), antiguo: false }
  if (minutos < 60) return { texto: t('tablerosF8.ejecutivo.calculadoMinutos', { n: minutos }), antiguo: false }
  const horas = Math.floor(minutos / 60)
  if (horas < HORAS_DE_UN_CALCULO_VIGENTE) return { texto: t('tablerosF8.ejecutivo.calculadoHoras', { n: horas }), antiguo: false }
  return { texto: t('tablerosF8.ejecutivo.calculadoEl', { fecha: fechaPe(new Date(instante)) }), antiguo: true }
}

// la línea que acompaña a cada zona de cifras: su periodo y su fecha de cálculo (P-07 (u))
function Pie({ children }: { children: ReactNode }) {
  return <p className="text-sg-caption text-sg-text-muted">{children}</p>
}

export function RevisionEjecutivaPage() {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosEjecutivos()
  const tablero = useTablero<TableroEjecutivo>('executive', filtros)
  const [busqueda] = useSearchParams()
  const elegidos = busqueda.getAll('project').length
  // los filtros abren plegados (U-11), salvo que la URL ya pida más proyectos de los que admite la tabla: hay que quitar alguno
  const [abierto, fijarAbierto] = useState(elegidos > TOPE_DE_PROYECTOS)
  const panel = useId()
  const periodo = usePeriodo()
  const calculo = useCalculo(tablero.data?.computedAt)
  const proyectos = elegidos ? t('tablerosF8.ejecutivo.proyectosElegidos', { count: elegidos }) : t('tablerosF8.ejecutivo.todosSusProyectos')
  const pie = t('tablerosF8.ejecutivo.pie', { periodo, calculado: calculo.texto })
  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-sg-h1 font-semibold">{t('tablerosF8.ejecutivo.titulo')}</h1>
          <p className="text-sm text-sg-text-secondary">{t('tablerosF8.ejecutivo.resumen', { periodo, proyectos, calculado: calculo.texto })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" aria-expanded={abierto} aria-controls={panel} onClick={() => fijarAbierto((x) => !x)}>
            {t('tablerosF8.ejecutivo.cambiarFiltros')}
          </Button>
          <Link to="/dashboards/monitoring" className="text-sm text-sg-primary-text underline">
            {t('tablerosF8.ejecutivo.monitoreo')}
          </Link>
        </div>
      </header>
      {calculo.antiguo ? (
        <div
          role="note"
          aria-label={t('tablerosF8.ejecutivo.antiguo.titulo')}
          className="flex flex-wrap items-center gap-3 rounded-sg-md border border-sg-border bg-sg-surface p-3 text-sm text-sg-warning"
        >
          <span>{t('tablerosF8.ejecutivo.antiguo.texto')}</span>
          <Button variant="secondary" size="sm" onClick={() => void tablero.refetch()}>
            {t('tablerosF8.ejecutivo.antiguo.actualizar')}
          </Button>
        </div>
      ) : null}
      {abierto ? (
        <div id={panel} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
          <FiltrosDeTablero alActualizar={() => void tablero.refetch()} />
          <ProyectosDeLaRevision />
        </div>
      ) : null}
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => <Revision datos={datos} pie={pie} calculado={calculo.texto} alElegirProyectos={() => fijarAbierto(true)} />}
      </ConsultaDeTablero>
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
  const cuantos = elegidos.length ? t('tablerosF8.ejecutivo.elegidos', { count: elegidos.length }) : t('tablerosF8.ejecutivo.todosSusProyectos')
  return (
    <details className="text-sm" open={elegidos.length > TOPE_DE_PROYECTOS || undefined}>
      <summary className="cursor-pointer text-sg-primary-text">{t('tablerosF8.ejecutivo.elegirProyectos', { elegidos: cuantos })}</summary>
      <p className="mt-1 text-sg-caption text-sg-text-muted">{t('tablerosF8.ejecutivo.elegirAyuda', { tope: TOPE_DE_PROYECTOS })}</p>
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

// las disponibles primero, en su orden: una cifra no disponible no ocupa el centro
const disponiblesPrimero = <T,>(lista: T[], disponible: (x: T) => boolean): T[] => [...lista].sort((a, b) => Number(!disponible(a)) - Number(!disponible(b)))

function Revision({ datos, pie, calculado, alElegirProyectos }: { datos: TableroEjecutivo; pie: string; calculado: string; alElegirProyectos: () => void }) {
  const { t } = useTranslation(NS)
  const rotulo = useRotuloDeCifra()
  const proyectosDelPedido = datos.filters.project
  if (Array.isArray(proyectosDelPedido) && proyectosDelPedido.length === 0)
    return (
      <Vacio titulo={t('tablerosF8.ejecutivo.sinProyectos')}>
        <Link to="/projects" className="text-sg-primary-text underline">
          {t('tablerosF8.ejecutivo.irAProyectos')}
        </Link>
      </Vacio>
    )
  const indicador = (code: string): Indicador => indicadorDe(datos.indicators, code) ?? { code, label: code, available: false }
  const tiles = disponiblesPrimero(
    CODIGOS_DE_LAS_TILES.map((code) => indicador(code)),
    (i) => i.available
  )
  const inversion = indicador('KPI-INV-03')
  const tendencia = indicador('KPI-EXE-03')
  const zonas = disponiblesPrimero(
    [
      { disponible: inversion.available, zona: <InversionPorMoneda key="inversion" indicador={inversion} pie={pie} /> },
      { disponible: tendencia.available, zona: <Tendencia key="tendencia" indicador={tendencia} calculado={calculado} /> }
    ],
    (z) => z.disponible
  )
  return (
    <div className="space-y-5">
      <LoCritico datos={datos} pie={pie} />
      <section aria-label={t('tablerosF8.ejecutivo.tiles')} className="space-y-2">
        <h2 className="sr-only">{t('tablerosF8.ejecutivo.tiles')}</h2>
        <Pie>{pie}</Pie>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((i) => (
            <KpiCard key={i.code} titulo={rotulo(i)} indicador={i} notas={<NotaDeConfidenciales oculta={i.confidentialHidden} />} />
          ))}
          <Seccion etiqueta={t('tablerosF8.ejecutivo.postura')} className="space-y-1">
            <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('tablerosF8.ejecutivo.postura')}</h3>
            <NoDisponible />
            <p className="text-sg-caption text-sg-text-muted">{t('tablerosF8.ejecutivo.posturaAyuda')}</p>
          </Seccion>
        </div>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">{zonas.map((z) => z.zona)}</div>
      <PorProyecto datos={datos} pie={pie} alElegirProyectos={alElegirProyectos} />
    </div>
  )
}

// «Qué es crítico y dónde se atiende» como tabla corta (P-07): el asunto lleva a la lista donde se atiende, con su proyecto y su
// cifra. el contrato no trae a la persona responsable: la fila dice el proyecto y enlaza la lista de su equipo
function LoCritico({ datos, pie }: { datos: TableroEjecutivo; pie: string }) {
  const { t } = useTranslation(NS)
  const titulo = t('tablerosF8.ejecutivo.critico')
  const items = itemsDeAtencion(datos)
  return (
    <Seccion titulo={titulo}>
      <Pie>{pie}</Pie>
      {items.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('tablerosF8.ejecutivo.sinAtencion')}</p>
      ) : (
        <Table aria-label={titulo}>
          <thead>
            <tr>
              <Th scope="col">{t('tablerosF8.ejecutivo.columnas.asunto')}</Th>
              <Th scope="col">{t('tablerosF8.ejecutivo.columnas.proyecto')}</Th>
              <Th scope="col" className="text-right">
                {t('tablerosF8.ejecutivo.columnas.cifra')}
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const asunto = t(`tableros.cifras.${i.code}`)
              const proyecto = i.nombre ?? t('tablerosF8.ejecutivo.todaLaCartera')
              return (
                <tr key={`${i.code}-${i.proyecto ?? 'cartera'}`}>
                  <Td className="text-sm">
                    <Link to={i.ruta} aria-label={t('tablerosF8.ejecutivo.enlaceDeAsunto', { asunto, proyecto })} className="text-sg-primary-text underline">
                      {asunto}
                    </Link>
                  </Td>
                  <Td className="text-sm text-sg-text-secondary">{proyecto}</Td>
                  <Td className="text-right text-sm tabular-nums">{numeroPe(i.valor)}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
      <p className="text-sg-caption text-sg-text-muted">{t('tablerosF8.ejecutivo.criticoAyuda')}</p>
    </Seccion>
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

function InversionPorMoneda({ indicador, pie }: { indicador: Indicador; pie: string }) {
  const { t } = useTranslation(NS)
  const titulo = t('tablerosF8.ejecutivo.inversion')
  const monedas = indicador.available ? inversionPorMoneda(indicador) : []
  const texto_ = (n: bigint | null) => (n === null ? null : deDiezmilesimos(n))
  return (
    <Seccion titulo={titulo} className="space-y-3">
      <Pie>{pie}</Pie>
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
    </Seccion>
  )
}

interface SerieDeTendencia {
  nombre: string
  valor: (m: MesDeTendencia) => number
}

// una medida por gráfico: los flujos del mes (interacciones, quejas) en barras sólidas, el saldo al cierre en línea; sin trama
function SerieMensual({ titulo, meses, series, tipo }: { titulo: string; meses: MesDeTendencia[]; series: SerieDeTendencia[]; tipo: 'bar' | 'line' }) {
  const { t } = useTranslation(NS)
  const opciones = {
    grid: { left: 32, right: 12, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: meses.map((m) => periodoPe(m.period)) },
    yAxis: { type: 'value', minInterval: 1 },
    tooltip: { trigger: 'axis' },
    legend: series.length > 1 ? { bottom: 0 } : undefined,
    series: series.map((s) => ({ type: tipo, name: s.nombre, data: meses.map(s.valor) }))
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

// KPI-EXE-03: tres gráficos pequeños, uno por medida (dashboards.md §9.2: nunca dos ejes Y), con sus propios 12 meses
function Tendencia({ indicador, calculado }: { indicador: Indicador; calculado: string }) {
  const { t } = useTranslation(NS)
  const titulo = t('tablerosF8.ejecutivo.tendencia')
  const meses = mesesDeTendencia(indicador)
  const primero = meses[0]?.period
  const ultimo = meses.at(-1)?.period
  const periodo = primero && ultimo ? t('tablerosF8.ejecutivo.meses', { desde: periodoPe(primero), hasta: periodoPe(ultimo) }) : titulo
  return (
    <Seccion titulo={titulo} className="space-y-3">
      <Pie>{t('tablerosF8.ejecutivo.pie', { periodo, calculado })}</Pie>
      {!indicador.available ? (
        <NoDisponible motivo={indicador.unavailableReason} />
      ) : meses.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('tableros.sinDatos')}</p>
      ) : (
        <div className="space-y-3">
          <SerieMensual
            tipo="bar"
            titulo={t('tablerosF8.ejecutivo.series.engagements')}
            meses={meses}
            series={[{ nombre: t('tablerosF8.ejecutivo.series.engagements'), valor: (m) => m.engagements }]}
          />
          <SerieMensual
            tipo="bar"
            titulo={t('tablerosF8.ejecutivo.series.grievances')}
            meses={meses}
            series={[
              { nombre: t('tablerosF8.ejecutivo.recibidas'), valor: (m) => m.grievancesReceived },
              { nombre: t('tablerosF8.ejecutivo.cerradas'), valor: (m) => m.grievancesClosed }
            ]}
          />
          <SerieMensual
            tipo="line"
            titulo={t('tablerosF8.ejecutivo.series.overdue')}
            meses={meses}
            series={[{ nombre: t('tablerosF8.ejecutivo.series.overdue'), valor: (m) => m.overdueCommitments }]}
          />
        </div>
      )}
    </Seccion>
  )
}

// una columna por medida, con su cifra a la derecha: nunca dos medidas en una escala de barras
function PorProyecto({ datos, pie, alElegirProyectos }: { datos: TableroEjecutivo; pie: string; alElegirProyectos: () => void }) {
  const { t } = useTranslation(NS)
  const titulo = t('tablerosF8.ejecutivo.porProyecto')
  const filas = datos.byProject ?? []
  const rotulo = useRotuloDeCifra()
  const columnas = filas[0]?.indicators.map((i) => ({ code: i.code, label: rotulo(i) })) ?? []
  return (
    <section aria-label={titulo} className="space-y-2">
      <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
      <Pie>{pie}</Pie>
      {datos.byProjectOmitted ? (
        <Alert tone="notice">
          <span className="flex flex-wrap items-center gap-3">
            {t('tablerosF8.ejecutivo.omitida', { tope: TOPE_DE_PROYECTOS })}
            <Button variant="secondary" size="sm" onClick={alElegirProyectos}>
              {t('tablerosF8.ejecutivo.elegirLosProyectos')}
            </Button>
          </span>
        </Alert>
      ) : filas.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('tableros.sinDatos')}</p>
      ) : (
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={titulo}>
            <thead>
              <tr>
                <Th scope="col">{t('tablerosF8.ejecutivo.proyecto')}</Th>
                {columnas.map((c) => (
                  <Th key={c.code} scope="col" className="text-right">
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
                      <Td key={c.code} className="text-right text-sm tabular-nums">
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
