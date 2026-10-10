import { Button, Table, Td, Th } from '@wasichai/ui'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CONTROL } from '../componentes/Campo'
import { KpiCard } from '../componentes/KpiCard'
import { desglose, useTablero, type FilaDeDesglose, type Indicador } from '../datos/indicadores'
import { Grafico } from '../graficos/Grafico'
import { diaPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import { ConsultaDeTablero, FiltrosDeTablero, indicadorDe, NotasDeIndicador, useFiltrosDeTablero, Zona } from '../tableros/comunes'

// S62 · tablero de riesgos (dashboards.md §5.8, screens.md §12): GET /api/sgspe/dashboards/risks en una llamada con los filtros de
// periodo, territorio y ámbito, y los cinco KPI-RSK en su orden: el mapa de calor 5 × 5 (KPI-RSK-02, vigente o residual, como una
// tabla de verdad con el nivel de cada celda cuando hay un solo proyecto, y los riesgos sin revisión dichos aparte), los activos
// (KPI-RSK-01), la distribución por territorio (KPI-RSK-03), los niveles semana a semana (KPI-RSK-04) y las medidas atrasadas
// (KPI-RSK-05). los riesgos no tienen alcance por registro: este tablero no lleva confidentialHidden. un indicador que la cuenta
// no lee dice «no disponible», nunca cero; 400 TOO_MANY_RECORDS es «acote los filtros»
const NIVELES = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'] as const
const TENDENCIAS = ['AUMENTA', 'SE MANTIENE', 'DISMINUYE'] as const
const DIMENSIONES = ['locality', 'community', 'areaOfInfluence', 'project'] as const
const ESCALA = [1, 2, 3, 4, 5]

export function TableroRiesgosPage() {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosDeTablero()
  const tablero = useTablero('risks', filtros)
  const { scope } = useContextFilters()
  const base = scope.kind === 'project' ? `/projects/${encodeURIComponent(scope.projectId)}` : ''
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('tableroRiesgos.titulo')}</h1>
        <Link to={`${base}/risks/register`} className="text-sm text-sg-primary-text underline">
          {t('tableroRiesgos.irAlRegistro')}
        </Link>
      </div>
      <FiltrosDeTablero calculado={tablero.data?.computedAt} alActualizar={() => void tablero.refetch()} />
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => {
          const ind = (code: string) => indicadorDe(datos.indicators, code)
          const titulo = (code: string, zona: keyof typeof ZONAS) => ind(code)?.label || t(`tableroRiesgos.zonas.${ZONAS[zona]}`)
          const tarjeta = (code: string, zona: keyof typeof ZONAS) => ind(code) ?? { code, label: titulo(code, zona), available: false }
          return (
            <div className="space-y-4">
              <Zona titulo={titulo('KPI-RSK-02', 'matriz')} indicador={ind('KPI-RSK-02')}>
                {(i) => <MapaDeCalor indicador={i} />}
              </Zona>
              <KpiCard
                titulo={titulo('KPI-RSK-01', 'activos')}
                indicador={tarjeta('KPI-RSK-01', 'activos')}
                notas={ind('KPI-RSK-01')?.available ? <NotasDeIndicador indicador={ind('KPI-RSK-01')} /> : null}
              />
              <Zona titulo={titulo('KPI-RSK-03', 'territorio')} indicador={ind('KPI-RSK-03')}>
                {(i) => <PorTerritorio indicador={i} />}
              </Zona>
              <Zona titulo={titulo('KPI-RSK-04', 'semanas')} indicador={ind('KPI-RSK-04')}>
                {(i) => <Semanas indicador={i} titulo={titulo('KPI-RSK-04', 'semanas')} />}
              </Zona>
              <KpiCard
                titulo={titulo('KPI-RSK-05', 'atrasadas')}
                indicador={tarjeta('KPI-RSK-05', 'atrasadas')}
                notas={ind('KPI-RSK-05')?.available ? <Atrasadas indicador={tarjeta('KPI-RSK-05', 'atrasadas')} /> : null}
              />
            </div>
          )
        }}
      </ConsultaDeTablero>
    </section>
  )
}

// el nombre de cada zona por su clave de textos
const ZONAS = { matriz: 'matriz', activos: 'activos', territorio: 'territorio', semanas: 'semanas', atrasadas: 'atrasadas' } as const

// KPI-RSK-02: la matriz de probabilidad (filas, de 5 a 1) por impacto (columnas, de 1 a 5), con el conteo de cada celda y, si el
// servidor lo manda (un solo proyecto, sus umbrales), el nivel. vigente o residual; los riesgos sin revisión se dicen aparte
function MapaDeCalor({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const [residual, setResidual] = useState(false)
  const filas = desglose(indicador, residual ? 'residual' : 'matrix')
  const celda = (p: number, i: number) => filas.find((f) => f.probability === p && f.impact === i) ?? filas.find((f) => f.key === `${p}-${i}`)
  const sinEvaluar = desglose(indicador, 'assessment').find((f) => f.key === 'SIN EVALUAR')?.value
  const valoracion = residual ? t('tableroRiesgos.residual') : t('tableroRiesgos.vigente')
  return (
    <div className="space-y-2">
      <div role="group" aria-label={t('tableroRiesgos.valoracion')} className="flex gap-2">
        {[false, true].map((r) => (
          <Button key={String(r)} size="sm" variant={residual === r ? 'primary' : 'secondary'} aria-pressed={residual === r} onClick={() => setResidual(r)}>
            {r ? t('tableroRiesgos.residual') : t('tableroRiesgos.vigente')}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <Table aria-label={t('tableroRiesgos.tablaMatriz', { valoracion })}>
          <thead>
            <tr>
              <Th scope="col">
                {t('tableroRiesgos.probabilidad')} \ {t('tableroRiesgos.impacto')}
              </Th>
              {ESCALA.map((i) => (
                <Th key={i} scope="col">
                  {i}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...ESCALA].reverse().map((p) => (
              <tr key={p}>
                <Th scope="row">{p}</Th>
                {ESCALA.map((i) => {
                  const f = celda(p, i)
                  const nivel = typeof f?.level === 'string' ? f.level : null
                  return (
                    <Td key={i} className="text-sm tabular-nums">
                      {f?.value === null || f?.value === undefined ? '—' : numeroPe(f.value)}
                      {nivel ? (
                        <span className="block text-sg-caption text-sg-text-muted">{t(`tableroRiesgos.niveles.${nivel}`, { defaultValue: nivel })}</span>
                      ) : null}
                    </Td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {typeof sinEvaluar === 'number' && sinEvaluar > 0 ? (
        <p className="text-sg-caption text-sg-text-muted">{t('tableroRiesgos.sinEvaluar', { n: numeroPe(sinEvaluar) })}</p>
      ) : null}
    </div>
  )
}

const cifra = (fila: FilaDeDesglose, clave: string): string => {
  const valor = fila[clave]
  return typeof valor === 'number' ? numeroPe(valor) : '—'
}

// KPI-RSK-03: los riesgos activos por localidad, comunidad, área de influencia o proyecto, con su nivel vigente
function PorTerritorio({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const disponibles = DIMENSIONES.filter((d) => indicador.breakdowns?.some((b) => b.by === d))
  const [elegida, setDimension] = useState<string | null>(null)
  const conFilas = disponibles.filter((d) => desglose(indicador, d).length > 0)
  // la elegida solo si llegó (otros filtros pueden no traerla); si no, la primera que tiene filas: sin localidades ni comunidades
  // registradas el tablero abre por proyecto y no dice «no hay riesgos» (humo F4, D5). sin desgloses no se afirma que no hay riesgos
  const dimension = elegida !== null && disponibles.includes(elegida as (typeof disponibles)[number]) ? elegida : (conFilas[0] ?? disponibles[0])
  if (!dimension) return <p className="text-sm text-sg-text-muted">{t('tableroRiesgos.sinDesglose')}</p>
  const filas = desglose(indicador, dimension)
  // el vacío dice qué falta: si otro desglose tiene filas, hay riesgos activos sin esa dimensión registrada; si ninguno, no hay riesgos
  const vacio = conFilas.length > 0 ? t(`tableroRiesgos.sinDimension.${dimension}`) : t('tableroRiesgos.sinFilas')
  const nombre = t(`tableroRiesgos.dimensiones.${dimension}`, { defaultValue: dimension })
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        {t('tableroRiesgos.dimension')}
        <select className={CONTROL + ' w-auto'} value={dimension} onChange={(e) => setDimension(e.target.value)}>
          {disponibles.map((d) => (
            <option key={d} value={d}>
              {t(`tableroRiesgos.dimensiones.${d}`)}
            </option>
          ))}
        </select>
      </label>
      {filas.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{vacio}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label={t('tableroRiesgos.tablaTerritorio', { dimension: nombre })}>
            <thead>
              <tr>
                <Th scope="col">{t('tableroRiesgos.nombre')}</Th>
                {NIVELES.map((n) => (
                  <Th key={n} scope="col">
                    {t(`tableroRiesgos.niveles.${n}`)}
                  </Th>
                ))}
                <Th scope="col">{t('tableroRiesgos.sinNivel')}</Th>
                <Th scope="col">{t('tableroRiesgos.total')}</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.key}>
                  <Td className="text-sm">{f.label ?? f.key}</Td>
                  {NIVELES.map((n) => (
                    <Td key={n} className="text-sm tabular-nums">
                      {cifra(f, n)}
                    </Td>
                  ))}
                  <Td className="text-sm tabular-nums">{cifra(f, 'SIN NIVEL')}</Td>
                  <Td className="text-sm tabular-nums">{cifra(f, 'value')}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}

// KPI-RSK-04: doce semanas (cada una por su lunes) con los riesgos por nivel en barras apiladas y las tendencias en la tabla
function Semanas({ indicador, titulo }: { indicador: Indicador; titulo: string }) {
  const { t } = useTranslation(NS)
  const serie = (indicador.series ?? []) as unknown as (Record<string, number | null | undefined> & { period: string })[]
  const opciones = useMemo(
    () => ({
      grid: { left: 40, right: 16, top: 32, bottom: 32 },
      legend: {},
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: serie.map((s) => diaPe(s.period)) },
      yAxis: { type: 'value' },
      series: NIVELES.map((n) => ({ type: 'bar', stack: 'nivel', name: t(`tableroRiesgos.niveles.${n}`), data: serie.map((s) => s[n] ?? null) }))
    }),
    [JSON.stringify(serie), t]
  )
  const columnas = [...NIVELES.map((n) => t(`tableroRiesgos.niveles.${n}`)), ...TENDENCIAS.map((x) => t(`tableroRiesgos.tendencias.${x}`))]
  return (
    <Grafico
      etiqueta={titulo}
      opciones={opciones}
      datos={{
        columnas: [t('tableroRiesgos.semana'), ...columnas],
        filas: serie.map((s) => [diaPe(s.period), ...[...NIVELES, ...TENDENCIAS].map((c) => (typeof s[c] === 'number' ? numeroPe(s[c] as number) : '—'))])
      }}
    />
  )
}

// KPI-RSK-05: las medidas atrasadas por riesgo, por responsable o una por una, según los desgloses que el servidor mande
function Atrasadas({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const disponibles = (['risk', 'owner', 'overdue'] as const).filter((d) => indicador.breakdowns?.some((b) => b.by === d))
  const [elegida, setDimension] = useState<string>(disponibles[0] ?? 'risk')
  // la elegida solo si llegó; si no, la primera
  const dimension = disponibles.includes(elegida as (typeof disponibles)[number]) ? elegida : disponibles[0]
  if (!dimension) return <NotasDeIndicador indicador={indicador} />
  const filas = desglose(indicador, dimension)
  const nombre = t(`tableroRiesgos.atrasadasDimensiones.${dimension}`)
  return (
    <div className="space-y-2 pt-2">
      <NotasDeIndicador indicador={indicador} />
      {disponibles.length > 1 ? (
        <label className="flex items-center gap-2 text-sm">
          {t('tableroRiesgos.atrasadasPor')}
          <select className={CONTROL + ' w-auto'} value={dimension} onChange={(e) => setDimension(e.target.value)}>
            {disponibles.map((d) => (
              <option key={d} value={d}>
                {t(`tableroRiesgos.atrasadasDimensiones.${d}`)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {filas.length === 0 ? null : (
        <Table aria-label={t('tableroRiesgos.tablaAtrasadas', { dimension: nombre })}>
          <thead>
            <tr>
              <Th scope="col">{nombre}</Th>
              <Th scope="col">{t('tableroRiesgos.cantidad')}</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.key}>
                <Td className="text-sm">{f.label ?? f.key}</Td>
                <Td className="text-sm tabular-nums">{f.value === null ? '—' : numeroPe(f.value)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
