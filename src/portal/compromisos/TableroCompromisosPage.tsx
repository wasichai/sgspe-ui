import { Table, Td, Th } from '@wasichai/ui'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { VistasGuardadas } from '../componentes/Lista'
import { useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Cargando } from '../componentes/Estados'
import { KpiCard } from '../componentes/KpiCard'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { montoPe } from '../componentes/Monto'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { desglose, useTablero, type Indicador } from '../datos/indicadores'
import { atributo, texto, useRegistros } from '../datos/registros'
import { Grafico } from '../graficos/Grafico'
import { diaPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { Barras, ConsultaDeTablero, diezYOtros, FiltrosDeTablero, indicadorDe, SerieConMeta, useFiltrosDeTablero, Zona } from '../tableros/comunes'

// S27 · tablero de compromisos (dashboards.md §5.6, screens.md §12): GET /api/sgspe/dashboards/commitments en una llamada, con
// los filtros de periodo, territorio, campaña y responsable (owner, que aplican KPI-COM-03, 04, 06 y 09; los demás lo declaran
// en ignoredFilters y la zona lo dice). zonas: estado (KPI-COM-01 a 06, los vencidos por días de atraso), desgloses (KPI-COM-07),
// cumplimiento a tiempo frente al plazo vigente y al original (KPI-COM-09), montos por moneda (KPI-COM-10), formales por tema
// (KPI-COM-08), la serie de vencidos (KPI-COM-11) y la tabla de pendientes. un indicador que la cuenta no lee dice «no
// disponible», nunca cero; 400 TOO_MANY_RECORDS es «Acote los filtros»
const DIMENSIONES = ['owner', 'project', 'territory', 'topic'] as const
const PENDIENTES = 20

export function TableroCompromisosPage() {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosDeTablero()
  const tablero = useTablero('commitments', filtros)
  const { scope } = useContextFilters()
  const base = scope.kind === 'project' ? `/projects/${encodeURIComponent(scope.projectId)}` : ''
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('tableroCompromisos.titulo')}</h1>
        <Link to={`${base}/commitments`} className="text-sm text-sg-primary-text underline">
          {t('tableroCompromisos.verLista')}
        </Link>
      </div>
      <FiltrosDeTablero calculado={tablero.data?.computedAt} alActualizar={() => void tablero.refetch()} conCampana conResponsable />
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => {
          const ind = (code: string) => indicadorDe(datos.indicators, code)
          return (
            <div className="space-y-4">
              <section aria-label={t('tableroCompromisos.zonas.estado')} className="space-y-2">
                <h2 className="text-sg-h3 font-semibold">{t('tableroCompromisos.zonas.estado')}</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {['KPI-COM-01', 'KPI-COM-02', 'KPI-COM-03', 'KPI-COM-04', 'KPI-COM-05', 'KPI-COM-06'].map((code) => (
                    <KpiCard key={code} titulo={ind(code)?.label ?? code} indicador={ind(code) ?? { code, label: code, available: false }} />
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Zona titulo={t('tableroCompromisos.porEstado')} indicador={ind('KPI-COM-01')}>
                    {(i) => <PorEstado indicador={i} />}
                  </Zona>
                  <Zona titulo={t('tableroCompromisos.diasDeAtraso')} indicador={ind('KPI-COM-03')}>
                    {(i) => (
                      <Barras
                        titulo={t('tableroCompromisos.diasDeAtraso')}
                        filas={desglose(i, 'daysOverdue').map((f) => ({ nombre: f.label ?? f.key, valor: f.value }))}
                      />
                    )}
                  </Zona>
                </div>
              </section>
              <Zona titulo={t('tableroCompromisos.zonas.desgloses')} indicador={ind('KPI-COM-07')}>
                {(i) => <Desgloses indicador={i} />}
              </Zona>
              <div className="grid gap-4 lg:grid-cols-2">
                <Zona titulo={t('tableroCompromisos.zonas.cumplimiento')} indicador={ind('KPI-COM-09')}>
                  {(i) => <ATiempo indicador={i} />}
                </Zona>
                <Zona titulo={t('tableroCompromisos.zonas.montos')} indicador={ind('KPI-COM-10')}>
                  {(i) => <Montos indicador={i} />}
                </Zona>
                <Zona titulo={t('tableroCompromisos.zonas.formales')} indicador={ind('KPI-COM-08')}>
                  {(i) => <Barras titulo={t('tableroCompromisos.zonas.formales')} filas={diezYOtros(desglose(i, 'commitment_theme'), t('tableros.otros'))} />}
                </Zona>
                <Zona titulo={t('tableroCompromisos.zonas.historia')} indicador={ind('KPI-COM-11')}>
                  {(i) => (
                    <div className="space-y-2">
                      <SerieConMeta titulo={t('tableroCompromisos.zonas.historia')} serie={i.series ?? []} tipo="line" />
                      <p className="text-sg-caption text-sg-text-muted">{t('tableroCompromisos.historiaAproximada')}</p>
                    </div>
                  )}
                </Zona>
              </div>
            </div>
          )
        }}
      </ConsultaDeTablero>
      <Pendientes proyecto={scope.kind === 'project' ? scope.projectId : undefined} />
    </section>
  )
}

// KPI-COM-01 por estado de WF-D, con la etiqueta del workflow y en su orden
function PorEstado({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const etiquetas = useEtiquetasDeEstado('commitment')
  return (
    <Barras
      titulo={t('tableroCompromisos.porEstado')}
      filas={desglose(indicador, 'workflow_state').map((f) => ({ nombre: etiquetas[f.key] ?? f.key, valor: f.value }))}
    />
  )
}

// KPI-COM-07: abiertos y vencidos por responsable, proyecto, territorio o tema; las 10 de más abiertos y «Otros» (2.2 ya los
// recorta). el gráfico dibuja los abiertos y la tabla dice los dos
function Desgloses({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const [dimension, setDimension] = useState<(typeof DIMENSIONES)[number]>('owner')
  const filas = desglose(indicador, dimension)
  return (
    <div className="space-y-2">
      <VistasGuardadas
        vistas={DIMENSIONES.map((d) => ({ id: d, etiqueta: t(`tableroCompromisos.dimensiones.${d}`) }))}
        actual={dimension}
        alCambiar={(d) => setDimension(d as (typeof DIMENSIONES)[number])}
      />
      <Barras titulo={t(`tableroCompromisos.dimensiones.${dimension}`)} filas={filas.map((f) => ({ nombre: f.label ?? f.key, valor: f.value }))} />
      <Table aria-label={t('tableroCompromisos.tablaDesglose', { dimension: t(`tableroCompromisos.dimensiones.${dimension}`) })}>
        <thead>
          <tr>
            <Th scope="col">{t('tableroCompromisos.columnasDesglose.nombre')}</Th>
            <Th scope="col">{t('tableroCompromisos.columnasDesglose.abiertos')}</Th>
            <Th scope="col">{t('tableroCompromisos.columnasDesglose.vencidos')}</Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={`${f.key}`}>
              <Td>{f.label ?? f.key}</Td>
              <Td className="tabular-nums">{f.value === null ? '—' : numeroPe(f.value)}</Td>
              <Td className="tabular-nums">{typeof f.overdue === 'number' ? numeroPe(f.overdue) : '—'}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

// KPI-COM-09: el porcentaje con su «n de N» frente al plazo vigente y al original (la primera reprogramación)
function ATiempo({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  return (
    <div className="space-y-2">
      <KpiCard titulo={indicador.label} indicador={indicador} />
      <dl className="grid gap-2 sm:grid-cols-2">
        {desglose(indicador, 'against').map((f) => (
          <div key={f.key} className="rounded-sg-md border border-sg-border p-2 text-sm">
            <dt className="text-sg-text-muted">{t(`tableroCompromisos.contraPlazo.${f.key}`, { defaultValue: f.key })}</dt>
            <dd className="tabular-nums">
              {f.value === null ? '—' : `${numeroPe(f.value)} %`} ·{' '}
              {t('tableroCompromisos.nDeN', { n: numeroPe(Number(f.numerator ?? 0)), total: numeroPe(Number(f.denominator ?? 0)) })}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// KPI-COM-10: por moneda, el monto comprometido frente al ejecutado (ASM-063); dos barras por moneda y su tabla
function Montos({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const filas = desglose(indicador, 'currency')
  const opciones = useMemo(
    () => ({
      grid: { left: 60, right: 16, top: 24, bottom: 32 },
      legend: {},
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: filas.map((f) => f.key) },
      yAxis: { type: 'value' },
      series: [
        { type: 'bar', name: t('tableroCompromisos.comprometido'), data: filas.map((f) => Number(f.committed ?? f.value ?? 0)) },
        { type: 'bar', name: t('tableroCompromisos.ejecutado'), data: filas.map((f) => Number(f.executed ?? 0)) }
      ]
    }),
    [JSON.stringify(filas), t]
  )
  return (
    <Grafico
      etiqueta={t('tableroCompromisos.zonas.montos')}
      opciones={opciones}
      datos={{
        columnas: [t('tableroCompromisos.moneda'), t('tableroCompromisos.comprometido'), t('tableroCompromisos.ejecutado')],
        filas: filas.map((f) => [f.key, montoPe(f.committed ?? f.value, f.key), montoPe(f.executed, f.key)])
      }}
    />
  )
}

// los compromisos vencidos y por vencer del alcance, con enlace a su ficha: dos lecturas por igualdad sobre deadline_status
function Pendientes({ proyecto }: { proyecto?: string }) {
  const { t } = useTranslation(NS)
  const vencidos = useRegistros('commitment', { project: proyecto, deadline_status: 'VENCIDO', sort: 'due_date', dir: 'asc', size: PENDIENTES })
  const porVencer = useRegistros('commitment', { project: proyecto, deadline_status: 'POR VENCER', sort: 'due_date', dir: 'asc', size: PENDIENTES })
  const fallida = [vencidos, porVencer].find((c) => c.isError && !c.data)
  const filas = [...(vencidos.data?.content ?? []), ...(porVencer.data?.content ?? [])]
  const truncado = (vencidos.data?.totalPages ?? 1) > 1 || (porVencer.data?.totalPages ?? 1) > 1
  return (
    <section aria-label={t('tableroCompromisos.zonas.pendientes')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="text-sg-h3 font-semibold">{t('tableroCompromisos.zonas.pendientes')}</h2>
      {vencidos.isPending || porVencer.isPending ? (
        <Cargando compacto />
      ) : fallida ? (
        <FalloDeLectura error={fallida.error} alReintentar={() => void fallida.refetch()} />
      ) : filas.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('tableroCompromisos.sinPendientes')}</p>
      ) : (
        <>
          {truncado ? <p className="text-sg-caption text-sg-text-muted">{t('tableroCompromisos.truncadoPendientes', { n: PENDIENTES })}</p> : null}
          <Table aria-label={t('tableroCompromisos.zonas.pendientes')}>
            <thead>
              <tr>
                {(['codigo', 'titulo', 'situacion', 'vence', 'responsable'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`tableroCompromisos.columnasPendientes.${c}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => (
                <tr key={c.id}>
                  <Td className="font-sg-mono text-sm">{texto(c, 'code')}</Td>
                  <Td className="text-sm">
                    <Link to={`/projects/${encodeURIComponent(texto(c, 'project'))}/commitments/${c.id}`} className="text-sg-primary-text underline">
                      {texto(c, 'title')}
                    </Link>
                  </Td>
                  <Td>
                    <SituacionDePlazo valor={atributo(c, 'deadline_status')} />
                  </Td>
                  <Td className="text-sm">{texto(c, 'due_date') ? diaPe(texto(c, 'due_date')) : '—'}</Td>
                  <Td className="text-sm">{texto(c, 'owner_user_email') || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </section>
  )
}
