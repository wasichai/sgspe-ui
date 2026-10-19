import { EncabezadoDePagina } from '../componentes/Pagina'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { Table, Td, Th } from '@wasichai/ui'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NoDisponible } from '../componentes/Estados'
import { KpiCard } from '../componentes/KpiCard'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { OBJETOS_DE_QCS } from '../datos/atencion'
import { desglose, useTablero, type Indicador } from '../datos/indicadores'
import { Grafico } from '../graficos/Grafico'
import { NS, numeroPe, periodoPe } from '../i18n'
import { Barras, ConsultaDeTablero, FiltrosDeTablero, indicadorDe, NotasDeIndicador, useFiltrosDeTablero, Zona } from '../tableros/comunes'
import { rotuloDeFila } from '../datos/opciones'

// S34 · tablero de QCS (dashboards.md §5.7, screens.md §12): GET /api/sgspe/dashboards/attention en una llamada, con los filtros de
// periodo, territorio y ámbito. zonas: el flujo por tipo (KPI-GRV-01 a 06, desglose `type`), las absueltas (KPI-GRV-07, «n de
// N»), el tiempo de atención (KPI-GRV-10: mediana de días y dentro de plazo, por tipo; las solicitudes no tienen plazo), los
// desgloses (KPI-GRV-08: severidad, categoría, territorio, grupo de interés y canal, los 10 primeros y «Otros») y la tendencia de
// recibidas frente a cerradas (KPI-GRV-09). el tablero lee como quien llama: si excluye QCS confidenciales que la cuenta no lee
// lo dice (confidentialHidden), nunca cuántas. cada planteamiento cuenta una vez, aunque se haya reclasificado
const FLUJO = ['KPI-GRV-01', 'KPI-GRV-02', 'KPI-GRV-03', 'KPI-GRV-04', 'KPI-GRV-05', 'KPI-GRV-06'] as const
const DIMENSIONES = ['severity', 'category', 'territory', 'stakeholder', 'channel'] as const

export function TableroAtencionPage() {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosDeTablero()
  const tablero = useTablero('attention', filtros)
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina titulo={t('tableroAtencion.titulo')} vistas={<VistasDelModulo modulo="attention" actual="tablero" />} />
      <FiltrosDeTablero calculado={tablero.data?.computedAt} alActualizar={() => void tablero.refetch()} />
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => {
          const ind = (code: string) => indicadorDe(datos.indicators, code)
          const oculta = datos.confidentialHidden === true || datos.indicators.some((i) => i.confidentialHidden === true)
          return (
            <div className="space-y-4">
              <NotaDeConfidenciales oculta={oculta} />
              <p className="text-sg-caption text-sg-text-muted">
                {t('tableroAtencion.unaVez')} {t('tableroAtencion.sinPersona')}
              </p>
              <section aria-label={t('tableroAtencion.zonas.flujo')} className="space-y-2">
                <h2 className="text-sg-h3 font-semibold">{t('tableroAtencion.zonas.flujo')}</h2>
                {/* una sola vista del flujo: la tabla por tipo con el total destacado y las notas de cada indicador (antes, las
                    mismas seis cifras salían también en tarjetas) */}
                <Flujo indicadores={FLUJO.map((code) => ind(code))} />
              </section>
              <div className="grid gap-4 lg:grid-cols-2">
                <Zona titulo={t('tableroAtencion.zonas.absueltas')} indicador={ind('KPI-GRV-07')}>
                  {(i) => <KpiCard titulo={i.label} indicador={i} />}
                </Zona>
                <Zona titulo={t('tableroAtencion.zonas.tiempos')} indicador={ind('KPI-GRV-10')}>
                  {(i) => <Tiempos indicador={i} />}
                </Zona>
              </div>
              <Zona titulo={t('tableroAtencion.zonas.desgloses')} indicador={ind('KPI-GRV-08')}>
                {(i) => (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* cada desglose con su título a la vista: sin él, cinco gráficos (o cinco vacíos) no se distinguen */}
                    {DIMENSIONES.filter((d) => i.breakdowns?.some((b) => b.by === d)).map((d) => (
                      <div key={d} className="space-y-1">
                        <h3 className="text-sm font-medium">{t(`tableroAtencion.dimensiones.${d}`)}</h3>
                        <Barras
                          titulo={t(`tableroAtencion.dimensiones.${d}`)}
                          filas={desglose(i, d).map((f) => ({ nombre: rotuloDeFila(f), valor: f.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Zona>
              <Zona titulo={t('tableroAtencion.zonas.tendencia')} indicador={ind('KPI-GRV-09')}>
                {(i) => <Tendencia indicador={i} />}
              </Zona>
            </div>
          )
        }}
      </ConsultaDeTablero>
    </section>
  )
}

// el flujo por tipo: una fila por indicador y una columna por tipo, del desglose `type`; un indicador que la cuenta no lee dice
// «No disponible» en su fila, y un tipo sin fila es «—», nunca 0
function Flujo({ indicadores }: { indicadores: (Indicador | undefined)[] }) {
  const { t } = useTranslation(NS)
  const cifra = (v: unknown) => (typeof v === 'number' ? numeroPe(v) : '—')
  return (
    <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
      <Table aria-label={t('tableroAtencion.flujo')}>
        <thead>
          <tr>
            <Th scope="col">{t('tableroAtencion.indicador')}</Th>
            {OBJETOS_DE_QCS.map((o) => (
              <Th key={o} scope="col">
                {t(`comun.qcs.plural.${o}`)}
              </Th>
            ))}
            <Th scope="col">{t('tableroAtencion.total')}</Th>
          </tr>
        </thead>
        <tbody>
          {indicadores.map((i, n) =>
            i === undefined ? null : (
              <tr key={i.code ?? n}>
                <Th scope="row" className="text-sm font-normal">
                  {i.label}
                  {i.available ? <NotasDeIndicador indicador={i} /> : null}
                </Th>
                {i.available ? (
                  <>
                    {OBJETOS_DE_QCS.map((o) => (
                      <Td key={o} className="text-sm tabular-nums">
                        {cifra(desglose(i, 'type').find((f) => f.key === o)?.value)}
                      </Td>
                    ))}
                    <Td className="text-sm font-semibold tabular-nums">{cifra(i.value)}</Td>
                  </>
                ) : (
                  <Td colSpan={OBJETOS_DE_QCS.length + 1} className="text-sm">
                    <NoDisponible motivo={i.unavailableReason} />
                  </Td>
                )}
              </tr>
            )
          )}
        </tbody>
      </Table>
    </div>
  )
}

// KPI-GRV-10: la mediana de días y el porcentaje dentro de plazo de todas, y por tipo; las solicitudes no tienen plazo (GAP-005)
function Tiempos({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const cifra = (v: unknown, unidad = '') => (typeof v === 'number' ? `${numeroPe(v)}${unidad}` : '—')
  return (
    <div className="space-y-2">
      <KpiCard titulo={indicador.label} indicador={indicador} />
      <Table aria-label={t('tableroAtencion.tiempos')}>
        <thead>
          <tr>
            {(['tipo', 'mediana', 'atendidas', 'aTiempo'] as const).map((c) => (
              <Th key={c} scope="col">
                {t(`tableroAtencion.columnasDeTiempos.${c}`)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {desglose(indicador, 'type').map((f) => (
            <tr key={f.key}>
              <Td className="text-sm">{t(`comun.qcs.plural.${f.key}`, { defaultValue: rotuloDeFila(f) })}</Td>
              <Td className="text-sm tabular-nums">{cifra(f.value)}</Td>
              <Td className="text-sm tabular-nums">{cifra(f.attended)}</Td>
              <Td className="text-sm tabular-nums">{f.key === 'stakeholder_request' ? t('tableroAtencion.sinPlazo') : cifra(f.onTime, ' %')}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

// KPI-GRV-09: doce meses, recibidas y cerradas en un mismo eje (dashboards.md §5.7)
function Tendencia({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const serie = (indicador.series ?? []) as { period: string; received?: number | null; closed?: number | null }[]
  const opciones = useMemo(
    () => ({
      grid: { left: 40, right: 16, top: 24, bottom: 32 },
      xAxis: { type: 'category', data: serie.map((s) => periodoPe(s.period)) },
      yAxis: { type: 'value' },
      tooltip: { trigger: 'axis' },
      legend: {},
      series: [
        { type: 'line', name: t('tableroAtencion.tendencia.recibidas'), data: serie.map((s) => s.received ?? null) },
        { type: 'line', name: t('tableroAtencion.tendencia.cerradas'), data: serie.map((s) => s.closed ?? null) }
      ]
    }),
    [JSON.stringify(serie), t]
  )
  const cifra = (v: number | null | undefined) => (typeof v === 'number' ? numeroPe(v) : '—')
  return (
    <Grafico
      etiqueta={t('tableroAtencion.zonas.tendencia')}
      opciones={opciones}
      datos={{
        columnas: [t('tableroAtencion.tendencia.periodo'), t('tableroAtencion.tendencia.recibidas'), t('tableroAtencion.tendencia.cerradas')],
        filas: serie.map((s) => [periodoPe(s.period), cifra(s.received), cifra(s.closed)])
      }}
    />
  )
}
