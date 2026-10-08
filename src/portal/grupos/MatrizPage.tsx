import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { NoDisponible } from '../componentes/Estados'
import { useProyecto } from '../contexto/proyectos'
import { desglose, useIndicador } from '../datos/indicadores'
import { atributo } from '../datos/registros'
import { Grafico } from '../graficos/Grafico'
import { NS, numeroPe } from '../i18n'
import { colorDe } from '../mapa/colores'
import { useContextFilters } from '../shell/context'
import { ConsultaDeTablero, FiltrosIgnorados } from '../tableros/comunes'

// el tooltip de ECharts arma HTML: el nombre de un grupo de interés viene de la API y no se inserta sin escapar
const escapar = (texto: string): string => texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// S19 · matriz interés × poder (screens.md §5, dashboards.md §5.3): KPI-STK-03 de un solo proyecto con sus umbrales, los
// cuadrantes rotulados con los grupos de influencia, puntos de un solo color y anillo para el grupo ajustado a mano. la
// lista de puntos es la alternativa de teclado; la postura solo se lista si la API la devuelve (a quien no la lee no llega)
// y la matriz nunca filtra por ella. los umbrales son los del proyecto: hasta leerlo no se dibuja nada con un umbral supuesto
export function MatrizPage() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const { territory } = useContextFilters()
  const proyecto = useProyecto(projectId)
  const filtroTerritorial =
    territory?.kind === 'locality'
      ? { locality: territory.id }
      : territory?.kind === 'area'
        ? { areaOfInfluence: territory.id }
        : territory?.kind === 'community'
          ? { community: territory.id }
          : {}
  const indicador = useIndicador('KPI-STK-03', { project: [projectId], ...filtroTerritorial })
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sg-h2 font-semibold">{t('grupos.matriz.titulo')}</h1>
          {proyecto.data ? (
            <p className="text-sm text-sg-text-muted">
              {t('grupos.matriz.umbrales', {
                interes: numeroPe(Number(atributo(proyecto.data, 'interest_threshold') ?? 3)),
                poder: numeroPe(Number(atributo(proyecto.data, 'power_threshold') ?? 3))
              })}
            </p>
          ) : null}
        </div>
        <Link to={`/projects/${projectId}/stakeholders`} className="text-sm text-sg-primary-text underline">
          {t('grupos.matriz.verTabla')}
        </Link>
      </div>
      <ConsultaDeTablero consulta={proyecto}>
        {(p) => (
          <ConsultaDeTablero consulta={indicador}>
            {(i) =>
              i.available ? (
                <>
                  <FiltrosIgnorados indicador={i} />
                  <Matriz
                    filas={desglose(i, 'stakeholder')}
                    sinEvaluar={typeof i.denominator === 'number' && typeof i.numerator === 'number' ? i.denominator - i.numerator : 0}
                    umbralInteres={Number(atributo(p, 'interest_threshold') ?? 3)}
                    umbralPoder={Number(atributo(p, 'power_threshold') ?? 3)}
                    proyecto={projectId}
                  />
                </>
              ) : (
                <NoDisponible motivo={i.unavailableReason} />
              )
            }
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

function Matriz({
  filas,
  sinEvaluar,
  umbralInteres,
  umbralPoder,
  proyecto
}: {
  filas: Punto[]
  sinEvaluar: number
  umbralInteres: number
  umbralPoder: number
  proyecto: string
}) {
  const { t } = useTranslation(NS)
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
            value: [p.interest, p.power, p.influenceGroup ?? '', nombre(p)],
            name: p.key,
            // SVG no lee var() ni currentColor en los atributos de ECharts: el anillo sale del token
            itemStyle: p.overridden ? { borderWidth: 3, borderColor: colorDe('--sg-text') } : undefined
          })),
          markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed' }, data: [{ xAxis: umbralInteres }, { yAxis: umbralPoder }] },
          markArea: {
            silent: true,
            itemStyle: { color: 'transparent' },
            label: { position: 'inside' },
            data: [
              [{ name: t('grupos.matriz.cuadrantes.POLITICO'), coord: [1, umbralPoder] }, { coord: [umbralInteres, 5] }],
              [{ name: t('grupos.matriz.cuadrantes.ESTRATEGICO'), coord: [umbralInteres, umbralPoder] }, { coord: [5, 5] }],
              [{ name: t('grupos.matriz.cuadrantes.VULNERABLE'), coord: [1, 1] }, { coord: [umbralInteres, umbralPoder] }],
              [{ name: t('grupos.matriz.cuadrantes.PARA MONITOREO'), coord: [umbralInteres, 1] }, { coord: [5, umbralPoder] }]
            ]
          }
        }
      ]
    }),
    [JSON.stringify(puntos), umbralInteres, umbralPoder, t]
  )
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-2">
        {sinEvaluar > 0 ? <p className="text-sm text-sg-text-muted">{t('grupos.matriz.sinEvaluar', { count: sinEvaluar })}</p> : null}
        {puntos.length === 0 ? <p className="text-sm text-sg-text-muted">{t('grupos.matriz.sinPuntos')}</p> : null}
        <Grafico
          etiqueta={t('grupos.matriz.titulo')}
          alto={420}
          opciones={opciones}
          alElegir={(id) => navegar(`/projects/${proyecto}/stakeholders/${id}`)}
          datos={{
            columnas: [t('grupos.columnas.grupo'), t('grupos.matriz.interes'), t('grupos.matriz.poder'), t('grupos.columnas.influencia')],
            filas: puntos.map((p) => [nombre(p), numeroPe(p.interest!), numeroPe(p.power!), p.influenceGroup ?? ''])
          }}
        />
      </div>
      <nav aria-label={t('grupos.matriz.puntos')} className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
        <h2 className="font-medium">{t('grupos.matriz.puntos')}</h2>
        <ul className="max-h-[420px] overflow-y-auto">
          {puntos.map((p) => (
            <li key={p.key}>
              <Link to={`/projects/${proyecto}/stakeholders/${p.key}`} className="text-sg-primary-text underline">
                {nombre(p)}
              </Link>{' '}
              · {p.influenceGroup} ({numeroPe(p.interest!)}, {numeroPe(p.power!)})
              {p.overridden ? (
                <span className="text-sg-caption text-sg-text-muted" title={p.overrideReason}>
                  {' '}
                  · {t('grupos.matriz.ajustado')}
                </span>
              ) : null}
              {p.stance ? <span className="text-sg-caption text-sg-text-muted"> · {p.stance}</span> : null}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
