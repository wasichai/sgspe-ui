import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { KpiCard } from '../componentes/KpiCard'
import { useIndicador, type Desglose, type Indicador } from '../datos/indicadores'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { Barras, ConsultaDeTablero, diezYOtros, FiltrosDeTablero, FiltrosIgnorados, SerieConMeta, useFiltrosDeTablero } from './comunes'

// los desgloses de cada indicador que son categorías y se dibujan en barras (api.md §4.11). los demás no lo son: los
// puntos y los umbrales de la matriz (stakeholder y thresholds de KPI-STK-03), la cobertura de KPI-STK-06 (coverage) y
// el numerador y el denominador, que la cifra ya muestra como base; los cruces (influence_group_by_scope, stance_by_*)
// no se dibujan en F2. un código sin lista dibuja todo lo que no está en NO_SON_CATEGORIAS
export const DESGLOSES_EN_BARRAS: Record<string, readonly string[]> = {
  'KPI-STK-01': ['influence_group', 'stakeholder_type'],
  'KPI-STK-02': ['stance'],
  'KPI-STK-03': [],
  'KPI-STK-04': ['sex', 'scope', 'institution'],
  'KPI-STK-05': [],
  'KPI-STK-06': ['direction'],
  'KPI-STK-07': [],
  'KPI-STK-08': [],
  'KPI-ENG-01': ['engagement_type'],
  'KPI-ENG-04': ['topic'],
  'KPI-ENG-05': ['topic']
}
const NO_SON_CATEGORIAS = new Set(['stakeholder', 'thresholds', 'coverage', 'numerator', 'denominator'])

export const desglosesEnBarras = (i: Indicador): Desglose[] =>
  (i.breakdowns ?? []).filter((d) => (DESGLOSES_EN_BARRAS[i.code] ? DESGLOSES_EN_BARRAS[i.code].includes(d.by) : !NO_SON_CATEGORIAS.has(d.by)))

// el detalle de un indicador (GET /api/sgspe/dashboards/indicators/{code}, api.md §4.11): la cifra con su base, cada
// desglose que es una categoría en barras (los 10 mayores y "Otros") y la serie, con los filtros del tablero y los que la
// cifra no aplica. es la pantalla de KPI-STK-04, KPI-STK-05 y KPI-STK-07, que en F2 no tienen zona en un tablero (el
// catálogo los trae con dashboard null, dashboards.md §11); sirve igual para cualquier otro código. 400 TOO_MANY_RECORDS
// pide acotar los filtros
export function DetalleDeIndicadorPage() {
  const { t } = useTranslation(NS)
  const { code = '' } = useParams()
  const { search } = useLocation()
  const { scope } = useContextFilters()
  const filtros = useFiltrosDeTablero()
  const indicador = useIndicador(code, filtros)
  const tablero = scope.kind === 'project' ? `/projects/${encodeURIComponent(scope.projectId)}/stakeholders/dashboard` : '/stakeholders/dashboard'
  return (
    <section className="mx-auto max-w-[1100px] space-y-4">
      <Link to={`${tablero}${search}`} className="text-sm text-sg-primary-text underline">
        {t('tableros.volverAlTablero')}
      </Link>
      <h1 className="text-sg-h1 font-semibold">{indicador.data?.label ?? t('tableros.indicador')}</h1>
      <p className="font-sg-mono text-sg-caption text-sg-text-muted">{code}</p>
      <FiltrosDeTablero alActualizar={() => void indicador.refetch()} />
      <ConsultaDeTablero consulta={indicador}>
        {(i) => (
          <div className="space-y-4">
            <KpiCard titulo={i.label} indicador={i} />
            {i.available ? (
              <>
                <FiltrosIgnorados indicador={i} />
                <div className="grid gap-4 lg:grid-cols-2">
                  {desglosesEnBarras(i).map((d) => {
                    const titulo = t(`tableros.desgloses.${d.by}`, { defaultValue: d.by })
                    const filas =
                      d.by === 'direction' ? d.rows.map((f) => ({ ...f, label: t(`tableros.direcciones.${f.key}`, { defaultValue: f.key }) })) : d.rows
                    return (
                      <section key={d.by} aria-label={titulo} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
                        <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
                        {filas.length === 0 ? (
                          <p className="text-sm text-sg-text-muted">{t('tableros.sinDatos')}</p>
                        ) : (
                          <Barras titulo={titulo} filas={diezYOtros(filas, t('tableros.otros'))} />
                        )}
                      </section>
                    )
                  })}
                  {(i.series ?? []).length > 0 ? (
                    <section aria-label={t('tableros.serie')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
                      <h2 className="text-sg-h3 font-semibold">{t('tableros.serie')}</h2>
                      <SerieConMeta titulo={t('tableros.serie')} serie={i.series ?? []} tipo="line" />
                    </section>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        )}
      </ConsultaDeTablero>
    </section>
  )
}
