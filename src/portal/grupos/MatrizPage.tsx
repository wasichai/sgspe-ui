import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { NoDisponible } from '../componentes/Estados'
import { useProyecto } from '../contexto/proyectos'
import { desglose, useIndicador, type Indicador } from '../datos/indicadores'
import { atributo, type Registro } from '../datos/registros'
import { Grafico } from '../graficos/Grafico'
import { escapar, useVersionDeTema } from '../graficos/tema'
import { rotuloDeOpcion } from '../datos/opciones'
import { NS, numeroPe } from '../i18n'
import { colorDe } from '../mapa/colores'
import { ConsultaDeTablero, FiltrosDeTablero, FiltrosIgnorados, useFiltrosDeTablero } from '../tableros/comunes'

// los umbrales que el servidor aplicó viajan en el desglose thresholds de KPI-STK-03 (interest y power): esa es la fuente. si
// el desglose no llega, valen los del proyecto, y si tampoco están no se supone ninguno (sin líneas ni cuadrantes)
interface Umbrales {
  interes: number
  poder: number
}
function umbralesDe(i: Indicador, proyecto: Registro): Umbrales | null {
  const deLaCifra = (clave: string) => {
    const valor = desglose(i, 'thresholds').find((f) => f.key === clave)?.value
    return typeof valor === 'number' ? valor : null
  }
  const delProyecto = (campo: string) => {
    const valor = atributo(proyecto, campo)
    return valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor)) ? null : Number(valor)
  }
  const interes = deLaCifra('interest') ?? delProyecto('interest_threshold')
  const poder = deLaCifra('power') ?? delProyecto('power_threshold')
  return interes === null || poder === null ? null : { interes, poder }
}

// S19 · matriz interés × poder (screens.md §5, dashboards.md §5.3): KPI-STK-03 de un solo proyecto con sus umbrales, los
// cuadrantes rotulados con los grupos de influencia, puntos de un solo color y anillo para el grupo ajustado a mano. la
// lista de puntos es la alternativa de teclado; la postura solo se lista si la API la devuelve (a quien no la lee no llega)
// y la matriz nunca filtra por ella. los filtros del tablero van fuera de la consulta, para que "acote los filtros" los deje
// a la vista; los umbrales son los de la cifra (umbralesDe) y hasta leerlos no se dibuja ninguno supuesto
export function MatrizPage() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const proyecto = useProyecto(projectId)
  // los filtros del tablero (periodo, ámbito y territorio) y, siempre, el proyecto de la ruta: la matriz es de uno solo
  const filtros = useFiltrosDeTablero()
  const indicador = useIndicador('KPI-STK-03', { ...filtros, project: [projectId] })
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h2 font-semibold">{t('grupos.matriz.titulo')}</h1>
        <Link to={`/projects/${encodeURIComponent(projectId)}/stakeholders`} className="text-sm text-sg-primary-text underline">
          {t('grupos.matriz.verTabla')}
        </Link>
      </div>
      <FiltrosDeTablero alActualizar={() => void indicador.refetch()} />
      <ConsultaDeTablero consulta={proyecto}>
        {(p) => (
          <ConsultaDeTablero consulta={indicador}>
            {(i) => {
              if (!i.available) return <NoDisponible motivo={i.unavailableReason} />
              const umbrales = umbralesDe(i, p)
              return (
                <>
                  {umbrales ? (
                    <p className="text-sm text-sg-text-muted">
                      {t('grupos.matriz.umbrales', { interes: numeroPe(umbrales.interes), poder: numeroPe(umbrales.poder) })}
                    </p>
                  ) : null}
                  <FiltrosIgnorados indicador={i} />
                  <Matriz
                    filas={desglose(i, 'stakeholder')}
                    sinEvaluar={typeof i.denominator === 'number' && typeof i.numerator === 'number' ? i.denominator - i.numerator : 0}
                    umbrales={umbrales}
                    proyecto={projectId}
                  />
                </>
              )
            }}
          </ConsultaDeTablero>
        )}
      </ConsultaDeTablero>
    </section>
  )
}

interface Punto {
  key: string
  label?: string
  interest?: number
  power?: number
  influenceGroup?: string
  overridden?: boolean
  overrideReason?: string
  stance?: string
}

function Matriz({ filas, sinEvaluar, umbrales, proyecto }: { filas: Punto[]; sinEvaluar: number; umbrales: Umbrales | null; proyecto: string }) {
  const { t } = useTranslation(NS)
  // los colores salen de los tokens del tema activo: al cambiar de tema se recalculan las opciones
  const tema = useVersionDeTema()
  const navegar = useNavigate()
  // lo que la API deja leer de quien mira (decisión 23): sin etiqueta, nunca el identificador
  const nombre = (p: Punto) => p.label ?? t('comun.personaRegistrada')
  const puntos = filas.filter((f) => typeof f.interest === 'number' && typeof f.power === 'number')
  const opciones = useMemo(
    () => ({
      grid: { left: 48, right: 24, top: 24, bottom: 48 },
      xAxis: { type: 'value', min: 1, max: 5, name: t('grupos.matriz.interes'), nameLocation: 'middle', nameGap: 28 },
      yAxis: { type: 'value', min: 1, max: 5, name: t('grupos.matriz.poder'), nameLocation: 'middle', nameGap: 32 },
      tooltip: { formatter: (p: { data: { value: [number, number, string, string] } }) => `${escapar(p.data.value[3])}: ${escapar(p.data.value[2])}` },
      series: [
        {
          type: 'scatter',
          symbolSize: 12,
          data: puntos.map((p) => ({
            value: [p.interest, p.power, rotuloDeOpcion(p.influenceGroup ?? ''), nombre(p)],
            name: p.key,
            // SVG no lee var() ni currentColor en los atributos de ECharts: el anillo sale del token
            itemStyle: p.overridden ? { borderWidth: 3, borderColor: colorDe('--sg-text') } : undefined
          })),
          ...(umbrales
            ? {
                markLine: {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { type: 'dashed' },
                  data: [{ xAxis: umbrales.interes }, { yAxis: umbrales.poder }]
                },
                markArea: {
                  silent: true,
                  itemStyle: { color: 'transparent' },
                  // cada rótulo en la esquina exterior de su cuadrante y con fondo: en el centro lo tapaban los puntos
                  label: {
                    color: colorDe('--sg-text-secondary'),
                    backgroundColor: colorDe('--sg-surface'),
                    padding: [2, 4],
                    borderRadius: 2,
                    fontSize: 11
                  },
                  data: [
                    [
                      { name: t('grupos.matriz.cuadrantes.POLITICO'), coord: [1, umbrales.poder], label: { position: 'insideTopLeft' } },
                      { coord: [umbrales.interes, 5] }
                    ],
                    [
                      { name: t('grupos.matriz.cuadrantes.ESTRATEGICO'), coord: [umbrales.interes, umbrales.poder], label: { position: 'insideTopRight' } },
                      { coord: [5, 5] }
                    ],
                    [
                      { name: t('grupos.matriz.cuadrantes.VULNERABLE'), coord: [1, 1], label: { position: 'insideBottomLeft' } },
                      { coord: [umbrales.interes, umbrales.poder] }
                    ],
                    [
                      { name: t('grupos.matriz.cuadrantes.PARA MONITOREO'), coord: [umbrales.interes, 1], label: { position: 'insideBottomRight' } },
                      { coord: [5, umbrales.poder] }
                    ]
                  ]
                }
              }
            : {})
        }
      ]
    }),
    [JSON.stringify(puntos), umbrales?.interes, umbrales?.poder, t, tema]
  )
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-2">
        {sinEvaluar > 0 ? <p className="text-sm text-sg-text-muted">{t('grupos.matriz.sinEvaluar', { count: sinEvaluar })}</p> : null}
        {puntos.length === 0 ? <p className="text-sm text-sg-text-muted">{t('grupos.matriz.sinPuntos')}</p> : null}
        <Grafico
          etiqueta={t('grupos.matriz.titulo')}
          alto={420}
          opciones={opciones}
          alElegir={(id) => navegar(`/projects/${encodeURIComponent(proyecto)}/stakeholders/${encodeURIComponent(id)}`)}
          datos={{
            columnas: [t('grupos.columnas.grupo'), t('grupos.matriz.interes'), t('grupos.matriz.poder'), t('grupos.columnas.influencia')],
            filas: puntos.map((p) => [nombre(p), numeroPe(p.interest!), numeroPe(p.power!), rotuloDeOpcion(p.influenceGroup ?? '')])
          }}
        />
      </div>
      <nav aria-label={t('grupos.matriz.puntos')} className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
        <h2 className="font-medium">
          {t('grupos.matriz.puntos')} <span className="font-normal text-sg-text-muted">({numeroPe(puntos.length)})</span>
        </h2>
        <ul className="max-h-[420px] overflow-y-auto">
          {puntos.map((p) => (
            <li key={p.key}>
              <Link to={`/projects/${encodeURIComponent(proyecto)}/stakeholders/${encodeURIComponent(p.key)}`} className="text-sg-primary-text underline">
                {nombre(p)}
              </Link>{' '}
              · {rotuloDeOpcion(p.influenceGroup ?? '')} ({numeroPe(p.interest!)}, {numeroPe(p.power!)})
              {p.overridden ? (
                <span className="text-sg-caption text-sg-text-muted" title={p.overrideReason}>
                  {' '}
                  · {t('grupos.matriz.ajustado')}
                </span>
              ) : null}
              {p.stance ? <span className="text-sg-caption text-sg-text-muted"> · {rotuloDeOpcion(p.stance)}</span> : null}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
