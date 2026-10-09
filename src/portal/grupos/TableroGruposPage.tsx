import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { ApiError } from '@wasichai/core'
import { Cargando, ErrorDeCarga, NoDisponible } from '../componentes/Estados'
import { KpiCard } from '../componentes/KpiCard'
import { codigoDelError } from '../datos/http'
import { desglose, useCatalogoDeIndicadores, useTablero } from '../datos/indicadores'
import { COLOR_DE_POSTURA, ORDEN_DE_POSTURAS } from '../graficos/BarraDePosturas'
import { Grafico } from '../graficos/Grafico'
import { escapar, useVersionDeTema } from '../graficos/tema'
import { NS, numeroPe } from '../i18n'
import { colorDe } from '../mapa/colores'
import { useContextFilters } from '../shell/context'
import { Barras, ConsultaDeTablero, diezYOtros, FiltrosDeTablero, indicadorDe, SerieConMeta, useFiltrosDeTablero, Zona } from '../tableros/comunes'

// el tablero de grupos de interés (dashboards.md §5.3, RF-DSH-007), con GET /api/sgspe/dashboards/stakeholders: la
// clasificación (KPI-STK-01), las posturas (KPI-STK-02, divergente centrada en NEUTRAL), la matriz (KPI-STK-03, un solo
// proyecto), el cambio de postura de la oposición (KPI-STK-06) y la confianza (KPI-STK-08). los KPI-STK sin zona en F2
// (el catálogo los trae con dashboard null: KPI-STK-04, KPI-STK-05 y KPI-STK-07, dashboards.md §11) se listan al final y
// cada uno abre su detalle, también fuera de la consulta del tablero: no dependen de ella. una zona dice los filtros que su
// indicador no aplica (ignoredFilters: community en los KPI-STK) y 400 TOO_MANY_RECORDS deja el tablero en "acote los filtros"
export function TableroGruposPage() {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosDeTablero()
  const { scope } = useContextFilters()
  const tablero = useTablero('stakeholders', filtros)
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <h1 className="text-sg-h1 font-semibold">{t('grupos.tableroTitulo')}</h1>
      <FiltrosDeTablero calculado={tablero.data?.computedAt} alActualizar={() => void tablero.refetch()} />
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => {
          const ind = (code: string) => indicadorDe(datos.indicators, code)
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              <Zona titulo={t('grupos.zonas.clasificacion')} indicador={ind('KPI-STK-01')}>
                {(i) => <Barras titulo={t('grupos.zonas.clasificacion')} filas={diezYOtros(desglose(i, 'influence_group'), t('tableros.otros'))} />}
              </Zona>
              <Zona titulo={t('grupos.zonas.posturas')} indicador={ind('KPI-STK-02')}>
                {(i) => <Posturas filas={desglose(i, 'stance')} />}
              </Zona>
              <Zona titulo={t('grupos.zonas.matriz')} indicador={ind('KPI-STK-03')}>
                {() =>
                  scope.kind === 'project' ? (
                    <Link to={`/projects/${scope.projectId}/stakeholders/matrix`} className="text-sm text-sg-primary-text underline">
                      {t('tableros.verMatriz')}
                    </Link>
                  ) : (
                    <p className="text-sm text-sg-text-muted">{t('tableros.unSoloProyecto')}</p>
                  )
                }
              </Zona>
              <Zona titulo={t('grupos.zonas.cambio')} indicador={ind('KPI-STK-06')}>
                {(i) => (
                  <div className="space-y-2">
                    <KpiCard titulo={i.label} indicador={i} />
                    <Barras
                      titulo={t('grupos.zonas.cambio')}
                      filas={diezYOtros(
                        desglose(i, 'direction').map((f) => ({ ...f, label: t(`tableros.direcciones.${f.key}`, { defaultValue: f.key }) })),
                        t('tableros.otros')
                      )}
                    />
                  </div>
                )}
              </Zona>
              <Zona titulo={t('grupos.zonas.confianza')} indicador={ind('KPI-STK-08')}>
                {(i) => <SerieConMeta titulo={t('grupos.zonas.confianza')} serie={i.series ?? []} tipo="line" />}
              </Zona>
            </div>
          )
        }}
      </ConsultaDeTablero>
      <MasIndicadores />
    </section>
  )
}

// los indicadores del módulo que no tienen zona: el nombre lleva a su detalle, con los mismos filtros; sin permiso, "no
// disponible"
function MasIndicadores() {
  const { t } = useTranslation(NS)
  const { scope } = useContextFilters()
  const { search } = useLocation()
  const catalogo = useCatalogoDeIndicadores()
  const sinZona = (catalogo.data ?? []).filter((i) => i.dashboard === null && i.code.startsWith('KPI-STK-'))
  // solo un catálogo leído y sin esos indicadores deja la sección fuera; en carga o con error se dice (nunca "vacío")
  if (catalogo.data && sinZona.length === 0) return null
  const base = scope.kind === 'project' ? `/projects/${scope.projectId}/stakeholders/indicators` : '/stakeholders/indicators'
  let cuerpo
  if (catalogo.isPending) cuerpo = <Cargando compacto />
  else if (catalogo.isError)
    cuerpo =
      catalogo.error instanceof ApiError && catalogo.error.status === 403 ? (
        <NoDisponible motivo={codigoDelError(catalogo.error)} />
      ) : (
        <ErrorDeCarga error={catalogo.error} alReintentar={() => void catalogo.refetch()} />
      )
  else
    cuerpo = (
      <ul className="space-y-1 text-sm">
        {sinZona.map((i) => (
          <li key={i.code} className="flex flex-wrap items-center gap-2">
            <span className="font-sg-mono text-sg-caption text-sg-text-muted">{i.code}</span>
            {i.available ? (
              <Link to={`${base}/${i.code}${search}`} className="text-sg-primary-text underline">
                {i.label}
              </Link>
            ) : (
              <>
                <span>{i.label}</span>
                <NoDisponible />
              </>
            )}
          </li>
        ))}
      </ul>
    )
  return (
    <section aria-label={t('tableros.masIndicadores')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="text-sg-h3 font-semibold">{t('tableros.masIndicadores')}</h2>
      <p className="text-sm text-sg-text-muted">{t('tableros.masIndicadoresAyuda')}</p>
      {cuerpo}
    </section>
  )
}

// la barra apilada divergente de posturas: el orden del catálogo y sus colores de tokens.css (dashboards.md §9.2 y §9.3). se
// centra en NEUTRAL: su mitad va a cada lado del centro, lo favorable a la izquierda y lo opuesto a la derecha. el tooltip
// dice el conteo real de la postura (no la mitad de NEUTRAL ni el valor negativo del truco divergente). una postura sin cifra
// (null) no dibuja barra y la tabla dice "—"; una ausente del desglose es un conteo de cero. los colores salen del tema activo
function Posturas({ filas }: { filas: { key: string; value: number | null }[] }) {
  const { t } = useTranslation(NS)
  const tema = useVersionDeTema()
  const cifras = new Map(filas.map((f) => [f.key, f.value]))
  const orden = [...ORDEN_DE_POSTURAS, ...filas.map((f) => f.key).filter((k) => !(ORDEN_DE_POSTURAS as readonly string[]).includes(k))]
  const valor = (k: string) => cifras.get(k) ?? 0
  const mitad = valor('NEUTRAL') / 2
  const opciones = useMemo(() => {
    const color = (k: string) => colorDe(COLOR_DE_POSTURA[k]?.slice(4, -1) ?? '--sg-data-6')
    const barra = (k: string, dato: number, nombre = k) => ({ type: 'bar', stack: 'posturas', name: nombre, data: [dato], itemStyle: { color: color(k) } })
    return {
      grid: { left: 16, right: 16, top: 32, bottom: 24 },
      legend: { top: 0, data: orden },
      xAxis: { type: 'value', show: false },
      yAxis: { type: 'category', data: [''], show: false },
      // el nombre de la postura viene de la API y el tooltip arma HTML
      tooltip: {
        formatter: (p: { seriesName?: string }) => {
          const nombre = p.seriesName ?? ''
          return `${escapar(nombre)}: ${cifras.get(nombre) === null ? '—' : numeroPe(valor(nombre))}`
        }
      },
      // del centro hacia la izquierda: la mitad de NEUTRAL y A FAVOR; hacia la derecha: la otra mitad y lo demás
      series: [
        barra('NEUTRAL', -mitad),
        barra('A FAVOR', -valor('A FAVOR')),
        barra('NEUTRAL', mitad),
        ...orden.filter((k) => k !== 'A FAVOR' && k !== 'NEUTRAL').map((k) => barra(k, valor(k)))
      ]
    }
  }, [JSON.stringify(filas), tema])
  return (
    <Grafico
      etiqueta={t('grupos.zonas.posturas')}
      alto={140}
      opciones={opciones}
      datos={{
        columnas: [t('tableros.categoria'), t('tableros.valor')],
        filas: orden.map((k) => [k, cifras.get(k) === null ? '—' : numeroPe(valor(k))])
      }}
    />
  )
}
