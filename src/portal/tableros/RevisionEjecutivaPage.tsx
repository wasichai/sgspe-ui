import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { CONTROL } from '../componentes/Campo'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { NoDisponible, Vacio } from '../componentes/Estados'
import { KpiCard, metaDelPeriodo, RejillaDeKpi } from '../componentes/KpiCard'
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
import { itemsDeAtencion, rutaDeCifra } from './atencionEjecutiva'
import { ConsultaDeTablero, FiltrosDeTablero, HoraDeCalculo, indicadorDe, useFiltrosDeTablero, useRotuloDeCifra } from './comunes'
import { ListaDeLoCritico } from './LoCritico'
import { CODIGOS_DE_LAS_TILES, mesesDeTendencia, TOPE_DE_PROYECTOS, type MesDeTendencia, type TableroEjecutivo } from './contratoF8'
import { MedidorDeMonto } from '../componentes/MedidorDeMonto'
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

// el mes en curso de Lima (AAAA-MM) y los once anteriores, para el selector de periodo
const ultimosDoceMeses = (hoy: string): string[] => {
  const [anio, mes] = hoy.split('-').map(Number)
  return Array.from({ length: 12 }, (_, i) => {
    const fecha = new Date(Date.UTC(anio, mes - 1 - i, 15))
    return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

// el periodo como selector (S03): uno de los últimos doce meses, que escribe periodStart y periodEnd en la URL (el mes en curso, sin
// fechas: dashboards.md §3.1). un periodo que no es un mes entero se elige con «Cambiar el periodo y los filtros» y aquí se dice
function SelectorDePeriodo({ periodo }: { periodo: string }) {
  const { t } = useTranslation(NS)
  const [busqueda, fijar] = useSearchParams()
  const id = useId()
  const hoy = hoyEnLima().slice(0, 7)
  const meses = ultimosDoceMeses(hoy)
  const desde = busqueda.get('periodStart')
  const hasta = busqueda.get('periodEnd')
  const elegido =
    !desde && !hasta
      ? hoy
      : desde && hasta && desde.endsWith('-01') && hasta === ultimoDiaDelMes(desde) && meses.includes(desde.slice(0, 7))
        ? desde.slice(0, 7)
        : 'otro'
  const elegir = (mes: string) => {
    const siguiente = new URLSearchParams(busqueda)
    if (mes === hoy) {
      siguiente.delete('periodStart')
      siguiente.delete('periodEnd')
    } else {
      siguiente.set('periodStart', `${mes}-01`)
      siguiente.set('periodEnd', ultimoDiaDelMes(`${mes}-01`))
    }
    fijar(siguiente, { replace: true })
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sg-label text-sg-text">
        {t('tablerosF8.ejecutivo.periodo')}
      </label>
      <select id={id} className={`${CONTROL} min-w-55`} value={elegido} onChange={(e) => elegir(e.target.value)}>
        {elegido === 'otro' ? (
          <option value="otro" disabled>
            {t('tablerosF8.ejecutivo.otroPeriodo', { periodo })}
          </option>
        ) : null}
        {meses.map((m) => (
          <option key={m} value={m}>
            {conMayuscula(mesPe(m))}
          </option>
        ))}
      </select>
    </div>
  )
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
  const pie = t('tablerosF8.ejecutivo.pie', { periodo, calculado: calculo.texto })
  const alcance = elegidos ? t('tablerosF8.ejecutivo.alcanceElegidos', { count: elegidos }) : t('tablerosF8.ejecutivo.alcanceTodos')
  return (
    <ContenedorDePagina>
      {/* S03: la sobrelínea «Revisión ejecutiva», el periodo como título y la hora de cálculo visible con su alcance (préstamo de
          D); a la derecha, el periodo como selector y los demás filtros plegados */}
      <EncabezadoDePagina
        antetitulo={t('tablerosF8.ejecutivo.titulo')}
        antetituloEnSans
        titulo={periodo}
        tituloDelDocumento={t('tablerosF8.ejecutivo.titulo')}
        descripcion={
          tablero.data ? <HoraDeCalculo instante={tablero.data.computedAt} alcance={alcance} /> : <span className="text-sg-body-sm">{calculo.texto}</span>
        }
        secundarias={
          <div className="flex flex-wrap items-end gap-3">
            <SelectorDePeriodo periodo={periodo} />
            <Button variant="secondary" aria-expanded={abierto} aria-controls={panel} onClick={() => fijarAbierto((x) => !x)}>
              {t('tablerosF8.ejecutivo.cambiarFiltros')}
            </Button>
            <Link to="/dashboards/monitoring" className="inline-flex min-h-10 items-center text-sg-body-sm font-semibold text-sg-primary-text underline">
              {t('tablerosF8.ejecutivo.monitoreo')}
            </Link>
          </div>
        }
      />
      {calculo.antiguo ? (
        <div
          role="note"
          aria-label={t('tablerosF8.ejecutivo.antiguo.titulo')}
          className="flex flex-wrap items-center gap-3 rounded-sg-md border-2 border-sg-warning-border bg-sg-warning-soft px-4 py-3 text-sg-body-sm text-sg-text"
        >
          <span>{t('tablerosF8.ejecutivo.antiguo.texto')}</span>
          <Button variant="secondary" size="sm" onClick={() => void tablero.refetch()}>
            {t('tablerosF8.ejecutivo.antiguo.actualizar')}
          </Button>
        </div>
      ) : null}
      {abierto ? (
        <div id={panel} className="space-y-3 rounded-sg-md border border-sg-border bg-sg-surface p-4 sm:px-5">
          <FiltrosDeTablero alActualizar={() => void tablero.refetch()} />
          <ProyectosDeLaRevision />
        </div>
      ) : null}
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => <Revision datos={datos} pie={pie} calculado={calculo.texto} alElegirProyectos={() => fijarAbierto(true)} />}
      </ConsultaDeTablero>
    </ContenedorDePagina>
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
  // cada tile lleva a la lista que cuenta lo mismo (tercera pasada de UX, 4.1), solo si la lista puede contarlo igual: con varios
  // proyectos elegidos o un filtro de territorio o de ámbito, que la lista no aplica, la cifra no se enlaza
  const filtros = useFiltrosEjecutivos()
  const proyectosDeLasCifras = filtros.project ?? []
  const comoLaLista =
    proyectosDeLasCifras.length <= 1 && !filtros.locality && !filtros.community && !filtros.administrativeUnit && !filtros.areaOfInfluence && !filtros.scope
  const enlaceDe = (code: string) => (comoLaLista ? rutaDeCifra(code, proyectosDeLasCifras[0] ?? null) : undefined)
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
  const zonas = [{ disponible: tendencia.available, zona: <Tendencia key="tendencia" indicador={tendencia} calculado={calculado} /> }]
  return (
    <div className="space-y-5">
      {/* ocho cifras en dos filas de cuatro (S03), cada una con su código y su meta si la trae; la postura, que esta revisión no
          muestra, al final y sin protagonismo */}
      <section aria-label={t('tablerosF8.ejecutivo.tiles')}>
        <h2 className="sr-only">{t('tablerosF8.ejecutivo.tiles')}</h2>
        <RejillaDeKpi columnas={4}>
          {tiles.map((i) => (
            <KpiCard
              key={i.code}
              titulo={rotulo(i)}
              codigo={i.code}
              indicador={i}
              meta={metaDelPeriodo(i)}
              tono={i.code === 'KPI-COM-03' ? 'danger' : undefined}
              a={enlaceDe(i.code)}
              notas={<NotaDeConfidenciales oculta={i.confidentialHidden} />}
            />
          ))}
          <KpiCard
            titulo={t('tablerosF8.ejecutivo.postura')}
            indicador={{ code: 'postura', label: t('tablerosF8.ejecutivo.postura'), available: false }}
            notas={<p className="text-sg-caption text-sg-text-muted">{t('tablerosF8.ejecutivo.posturaAyuda')}</p>}
          />
        </RejillaDeKpi>
      </section>
      {zonas.map((z) => z.zona)}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <LoCritico datos={datos} pie={pie} />
        <InversionPorMoneda indicador={inversion} pie={pie} />
      </div>
      <PorProyecto datos={datos} pie={pie} alElegirProyectos={alElegirProyectos} />
    </div>
  )
}

// «Qué es crítico y dónde se atiende» como tabla corta (P-07): el asunto lleva a la lista donde se atiende, con su proyecto y su
// cifra. el contrato no trae a la persona responsable: la fila dice el proyecto y enlaza la lista de su equipo
function LoCritico({ datos, pie }: { datos: TableroEjecutivo; pie: string }) {
  const { t } = useTranslation(NS)
  const items = itemsDeAtencion(datos)
  return (
    <Seccion
      titulo={t('tablerosF8.ejecutivo.critico')}
      acciones={<span className="text-sg-body-sm text-sg-text-secondary">{t('tablerosF8.ejecutivo.ordenado')}</span>}
    >
      <Pie>{pie}</Pie>
      {items.length === 0 ? <p className="text-sm text-sg-text-muted">{t('tablerosF8.ejecutivo.sinAtencion')}</p> : <ListaDeLoCritico items={items} />}
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

// un medidor por moneda (S03, design-system.md §5.3 «Medidores»): la moneda y su avance arriba, la barra de 16 px y «S/ 15,000.00
// de S/ 40,000.00» con los topes debajo; y la nota al pie: las monedas no se suman (ASM-063)
function InversionPorMoneda({ indicador, pie }: { indicador: Indicador; pie: string }) {
  const { t } = useTranslation(NS)
  const titulo = t('tablerosF8.ejecutivo.inversion')
  const monedas = indicador.available ? inversionPorMoneda(indicador) : []
  const texto_ = (n: bigint | null) => (n === null ? null : deDiezmilesimos(n))
  return (
    <Seccion titulo={titulo} acciones={<span className="font-sg-mono text-[11.5px] text-sg-text-muted">{indicador.code}</span>} className="space-y-3">
      <Pie>{pie}</Pie>
      {!indicador.available ? (
        <NoDisponible motivo={indicador.unavailableReason} />
      ) : monedas.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('tablerosF8.ejecutivo.sinInversion')}</p>
      ) : (
        <>
          <ul className="space-y-4">
            {monedas.map((m) => {
              const avance = porcentaje(texto_(m.ejecutado), texto_(m.presupuesto))
              return (
                <li key={m.moneda}>
                  <MedidorDeMonto moneda={m.moneda} avance={avance} etiqueta={t('tablerosF8.ejecutivo.ejecutadoDe', { moneda: m.moneda })}>
                    <p className="tabular-nums text-sg-text">
                      {t('tablerosF8.ejecutivo.ejecutadoDePresupuesto', {
                        ejecutado: montoPe(texto_(m.ejecutado), m.moneda),
                        presupuesto: montoPe(texto_(m.presupuesto), m.moneda)
                      })}
                    </p>
                    <p className="tabular-nums text-sg-text-secondary">{t('tablerosF8.ejecutivo.tope', { monto: montoPe(texto_(m.tope), m.moneda) })}</p>
                  </MedidorDeMonto>
                </li>
              )
            })}
          </ul>
          <p className="text-sg-caption text-sg-text-secondary">{t('tablerosF8.ejecutivo.monedasNoSeSuman')}</p>
        </>
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
    grid: { left: 32, right: 12, top: series.length > 1 ? 36 : 24, bottom: 24 },
    xAxis: { type: 'category', data: meses.map((m) => periodoPe(m.period)) },
    yAxis: { type: 'value', minInterval: 1 },
    tooltip: { trigger: 'axis' },
    legend: series.length > 1 ? { top: 0, left: 0 } : undefined,
    series: series.map((s) => ({ type: tipo, name: s.nombre, data: meses.map(s.valor) }))
  }
  // cada gráfico en su panel con su título (S03): tres gráficos sin nombre no se distinguen
  return (
    <Seccion titulo={titulo} nivel={3} className="min-w-0">
      <Grafico
        etiqueta={titulo}
        alto={series.length > 1 ? 190 : 160}
        opciones={opciones}
        datos={{
          columnas: [t('tableros.periodo'), ...series.map((s) => s.nombre)],
          filas: meses.map((m) => [periodoPe(m.period), ...series.map((s) => numeroPe(s.valor(m)))])
        }}
      />
    </Seccion>
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
    <section aria-labelledby="revision-tendencia" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="revision-tendencia" className="text-sg-h3 text-sg-text">
          {titulo}
        </h2>
        <Pie>{t('tablerosF8.ejecutivo.pie', { periodo, calculado })}</Pie>
      </div>
      {!indicador.available ? (
        <NoDisponible motivo={indicador.unavailableReason} />
      ) : meses.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('tableros.sinDatos')}</p>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-3">
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
    </section>
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
    <Seccion titulo={titulo}>
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
        <div className="overflow-x-auto rounded-sg-md border border-sg-border bg-sg-surface">
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
    </Seccion>
  )
}
