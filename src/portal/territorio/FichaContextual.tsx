import type { UseQueryResult } from '@tanstack/react-query'
import { Button } from '@wasichai/ui'
import { MapPin, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Cargando, NoDisponible } from '../componentes/Estados'
import { montoPe } from '../componentes/Monto'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { useProyectos } from '../contexto/proyectos'
import { valorDeTerritorio } from '../contexto/rutas'
import { EnlaceConRastro, useSiguientePaso } from '../contexto/Rastro'
import { codigoDelError } from '../datos/http'
import { componentesDeFicha, useIndicador, type ComponenteDeFicha, type FilaDeDesglose, type FiltrosDeIndicador, type Indicador } from '../datos/indicadores'
import { texto } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { NotasDeIndicador } from '../tableros/comunes'
import { useFichaTerritorial, type AreaDeLaFicha, type FichaTerritorial } from './consultas'
import { rotuloDeFila, rotuloDeOpcion } from '../datos/opciones'
import { Seccion } from '../componentes/Seccion'

// la ficha contextual de S12 (screens.md S12, spec F6 §3.2 y §3.7): la parte territorial sale de sgspe.territory (…/card) y todas
// las cifras de KPI-TER-01, que calcula sgspe.dashboard (dashboards.md §4.8 y §5.9), con el proyecto y el periodo del mapa. cada
// componente trae su available: quien no lee stance pierde solo la postura (RQ-DSH-032); nunca un cero en lugar de «No disponible»
const FICHA: Record<'locality' | 'community', string> = { locality: 'localities', community: 'communities' }
// el orden de las cifras (el del servidor, TerritorySummary); una clave desconocida va al final
const ORDEN = ['KPI-STK-02', 'KPI-ENG-01', 'KPI-COM-02', 'KPI-COM-03', 'KPI-GRV-02', 'KPI-RSK-01', 'programs', 'KPI-INV-03', 'lastActivity']
// un 404 con uno de estos códigos es un lugar que no existe o no está al alcance (TerritoryCards): se dice con su texto. un 404
// sin código es un backend sin F6
const NO_ENCONTRADO = new Set(['LOCALITY_NOT_FOUND', 'COMMUNITY_NOT_FOUND'])

export function FichaContextual({
  objeto,
  id,
  proyecto,
  periodo,
  alCerrar
}: {
  objeto: 'locality' | 'community'
  id: string
  proyecto?: string
  periodo: { periodStart?: string; periodEnd?: string }
  alCerrar: () => void
}) {
  const { t } = useTranslation(NS)
  const paso = useSiguientePaso()
  const ficha = useFichaTerritorial(objeto, id, proyecto)
  const filtros: FiltrosDeIndicador = {
    [objeto]: id,
    ...(proyecto ? { project: [proyecto] } : {}),
    ...(periodo.periodStart ? { periodStart: periodo.periodStart } : {}),
    ...(periodo.periodEnd ? { periodEnd: periodo.periodEnd } : {})
  }
  const kpi = useIndicador('KPI-TER-01', filtros)
  const sufijo = proyecto ? `?project=${encodeURIComponent(proyecto)}` : ''
  const nombre = ficha.data ? texto(ficha.data.registro, 'name') : ''
  let encabezado = nombre
  if (!encabezado) encabezado = ficha.isPending ? t('comun.cargando') : ficha.data ? t('territorio.sinNombre') : t(`fichaTerritorial.tipos.${objeto}`)
  // las áreas de influencia que incluyen al lugar, como etiquetas de territorio bajo el título (S09: «Dentro de AIDS»)
  const areas = [...new Set((ficha.data?.areasOfInfluence ?? []).map((a) => a.areaType).filter((a): a is string => Boolean(a)))]
  const delPeriodo =
    periodo.periodStart && periodo.periodEnd ? t('fichaTerritorial.periodo', { desde: diaPe(periodo.periodStart), hasta: diaPe(periodo.periodEnd) }) : null
  return (
    <Seccion elemento="aside" anidada etiqueta={t('fichaTerritorial.titulo')} className="space-y-3 text-sm">
      {/* la cabecera de S09: sobrelínea con el tipo de lugar, el título, las áreas que lo incluyen y el periodo de las cifras */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t(`fichaTerritorial.tipos.${objeto}`)}</p>
          <h2 className="text-sg-h3 font-bold">{encabezado}</h2>
          <p className="flex flex-wrap items-center gap-2">
            {areas.map((a) => (
              <span
                key={a}
                className="inline-flex h-6 items-center gap-1 rounded-sg-sm border border-sg-territory-border bg-sg-territory-soft px-1.5 text-sg-caption font-bold text-sg-territory"
              >
                <MapPin aria-hidden className="size-3.5" />
                {t('fichaTerritorial.dentroDe', { area: a })}
              </span>
            ))}
            {delPeriodo ? <span className="text-sg-caption text-sg-text-secondary">{delPeriodo}</span> : null}
          </p>
        </div>
        <button type="button" aria-label={t('fichaTerritorial.cerrar')} onClick={alCerrar} className="rounded-sg-sm p-1 hover:bg-sg-surface-hover">
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <Cifras consulta={kpi} />
      <ParteTerritorial objeto={objeto} consulta={ficha} />
      {/* las acciones reales del lugar, al pie: su ficha y, con un proyecto, filtrarlo por el lugar */}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to={`/territory/${FICHA[objeto]}/${encodeURIComponent(id)}${sufijo}`} state={paso(t('mapa.mapaTerritorial'))}>
            {t('mapa.abrirFicha')}
          </Link>
        </Button>
        {proyecto ? (
          <Button asChild size="sm" variant="secondary">
            <Link to={`/projects/${encodeURIComponent(proyecto)}/overview?territory=${encodeURIComponent(valorDeTerritorio(objeto, id))}`}>
              {t('fichaTerritorial.filtrarProyecto')}
            </Link>
          </Button>
        ) : null}
      </div>
    </Seccion>
  )
}

// la sección de la ficha no se pudo leer entera si unavailable nombra uno de sus objetos o una ruta de ellos (enmienda 7.5)
const noLee = (f: FichaTerritorial, objetos: string[], rutas: string[] = []) =>
  f.unavailable.some((u) => objetos.includes(u.split('.')[0]) || rutas.includes(u))

function ParteTerritorial({ objeto, consulta }: { objeto: 'locality' | 'community'; consulta: UseQueryResult<FichaTerritorial> }) {
  const { t } = useTranslation(NS)
  if (consulta.isPending) return <Cargando compacto />
  if (!consulta.data) {
    // un lugar que no existe o no está al alcance se dice con su texto; un 404 sin código (backend sin F6) o un 403 dejan la
    // ficha del lugar a mano con «Abrir la ficha»
    const codigo = codigoDelError(consulta.error)
    return <p className="text-sg-text-muted">{codigo && NO_ENCONTRADO.has(codigo) ? t(`comun.codigos.${codigo}`) : t('fichaTerritorial.sinResumen')}</p>
  }
  const f = consulta.data
  // los lugares de una sección: los que llegaron y, si la cuenta no la lee entera, «No disponible»; «Ninguna» solo si se leyó
  // toda y está vacía
  const lugares = (lista: { id: string; name: string | null }[], incompleta: boolean): ReactNode => (
    <>
      {lista.length > 0 ? lista.map((l) => l.name ?? '—').join(', ') : null}
      {incompleta ? <NoDisponible /> : lista.length === 0 ? t('fichaTerritorial.ninguna') : null}
    </>
  )
  const sinUnidad = noLee(f, ['administrative_unit'], [`${objeto}.administrative_unit`])
  const sinAreas = noLee(f, ['area_of_influence', 'area_of_influence_member'])
  return (
    <dl role="group" aria-label={t('fichaTerritorial.zonas')} className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1">
      <dt className="text-sg-text-muted">{t('fichaTerritorial.distrito')}</dt>
      <dd>{f.administrativeUnit?.name ?? (sinUnidad ? <NoDisponible /> : '—')}</dd>
      {objeto === 'locality' ? (
        <>
          <dt className="text-sg-text-muted">{t('fichaTerritorial.comunidades')}</dt>
          <dd>{lugares(f.communities, noLee(f, ['community']))}</dd>
        </>
      ) : (
        <>
          <dt className="text-sg-text-muted">{t('fichaTerritorial.sectores')}</dt>
          <dd>{lugares(f.sectors, noLee(f, ['community_sector']))}</dd>
        </>
      )}
      <dt className="text-sg-text-muted">{t('fichaTerritorial.areas')}</dt>
      <dd>
        {f.areasOfInfluence.length > 0 ? (
          <ul>
            {f.areasOfInfluence.map((a) => (
              <AreaDeInfluencia key={a.id} area={a} />
            ))}
          </ul>
        ) : null}
        {sinAreas ? <NoDisponible /> : f.areasOfInfluence.length === 0 ? t('fichaTerritorial.ninguna') : null}
      </dd>
    </dl>
  )
}

// el área trae solo el id de su proyecto (hueco H9): el código sale de los proyectos que la cuenta lee; uno que no lee es
// «Proyecto reservado», nunca su id
function AreaDeInfluencia({ area: a }: { area: AreaDeLaFicha }) {
  const { t } = useTranslation(NS)
  const proyectos = useProyectos()
  const proyecto = a.project ? proyectos.data?.find((p) => p.id === a.project) : undefined
  let nombreDelProyecto: string | null = null
  if (proyecto) nombreDelProyecto = texto(proyecto, 'code') || texto(proyecto, 'name')
  else if (!a.project || proyectos.data) nombreDelProyecto = t('fichaTerritorial.proyectoReservado')
  const rotulo = `${a.areaType ?? '—'} · v${a.versionNumber ?? '—'}`
  const detalle = [nombreDelProyecto, a.memberCondition ? rotuloDeOpcion(a.memberCondition) : ''].filter(Boolean).join(' · ')
  return (
    <li>
      {a.project ? (
        <EnlaceConRastro to={`/projects/${encodeURIComponent(a.project)}/areas/${encodeURIComponent(a.id)}`} className="text-sg-primary-text underline">
          {rotulo}
        </EnlaceConRastro>
      ) : (
        <span>{rotulo}</span>
      )}{' '}
      {detalle ? <span className="text-sg-text-muted">{detalle}</span> : null}
    </li>
  )
}

function Cifras({ consulta }: { consulta: UseQueryResult<Indicador> }) {
  const { t } = useTranslation(NS)
  const indicador = consulta.data
  let cuerpo
  if (consulta.isPending) cuerpo = <Cargando compacto />
  // un 403, un 404 (backend sin F6) o un error: la cifra no está disponible, nunca un cero
  else if (!indicador) cuerpo = <NoDisponible />
  else if (!indicador.available) cuerpo = <NoDisponible motivo={indicador.unavailableReason} />
  else {
    const posicion = (c: ComponenteDeFicha) => (ORDEN.includes(c.key) ? ORDEN.indexOf(c.key) : ORDEN.length)
    const componentes = [...componentesDeFicha(indicador)].sort((a, b) => posicion(a) - posicion(b))
    cuerpo = (
      <>
        <div className="divide-y divide-sg-border-subtle border-y border-sg-border-subtle">
          {componentes.map((c) => (
            <Cifra key={c.key} componente={c} />
          ))}
        </div>
        <NotasDeIndicador indicador={indicador} />
      </>
    )
  }
  return (
    <section aria-label={t('fichaTerritorial.cifrasTitulo')} className="space-y-2">
      <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('fichaTerritorial.cifrasTitulo')}</h3>
      {cuerpo}
    </section>
  )
}

const filasDe = (c: ComponenteDeFicha, por: string): FilaDeDesglose[] => c.breakdowns?.find((d) => d.by === por)?.rows ?? []

// los montos de KPI-INV-03 por moneda: las filas por fuente se suman dentro de cada moneda, nunca entre monedas (ASM-063)
function montosPorMoneda(c: ComponenteDeFicha): { moneda: string; monto: number }[] {
  const sumas = new Map<string, number>()
  for (const fila of filasDe(c, 'source')) {
    const moneda = typeof fila.currency === 'string' ? fila.currency : ''
    sumas.set(moneda, (sumas.get(moneda) ?? 0) + (fila.value ?? 0))
  }
  return [...sumas].map(([moneda, monto]) => ({ moneda, monto }))
}

function Cifra({ componente: c }: { componente: ComponenteDeFicha }) {
  const { t } = useTranslation(NS)
  // programs y lastActivity no traen label: el título es siempre del portal
  const titulo = t(`fichaTerritorial.cifras.${c.key}`, { defaultValue: rotuloDeFila(c) })
  const numero = (v: ComponenteDeFicha['value']) => (typeof v === 'number' ? numeroPe(v) : '—')
  let valor
  if (!c.available) valor = <NoDisponible motivo={c.unavailableReason} />
  else if (c.key === 'KPI-STK-02') valor = <Posturas filas={filasDe(c, 'stance')} />
  else if (c.key === 'KPI-INV-03') {
    const montos = montosPorMoneda(c)
    valor =
      montos.length === 0 ? (
        <p className="text-sg-text-muted">{t('fichaTerritorial.sinInversion')}</p>
      ) : (
        <ul aria-label={t('fichaTerritorial.montos')}>
          {montos.map((m) => (
            <li key={m.moneda} className="tabular-nums">
              {montoPe(m.monto, m.moneda)}
            </li>
          ))}
        </ul>
      )
  } else if (c.key === 'programs') {
    const programas = filasDe(c, 'program')
    valor = (
      <>
        <p className="font-bold tabular-nums">{numero(c.value)}</p>
        {programas.length > 0 ? (
          <ul aria-label={t('fichaTerritorial.programas')} className="text-sg-caption">
            {programas.map((p) => (
              <li key={p.key}>{rotuloDeFila(p)}</li>
            ))}
          </ul>
        ) : null}
      </>
    )
  } else if (c.key === 'lastActivity')
    // AAAA-MM-DD es un día de Lima: diaPe lo formatea sin correrlo al día anterior
    valor = <p>{typeof c.value === 'string' ? diaPe(c.value) : t('fichaTerritorial.sinActividad')}</p>
  else valor = <p className="font-bold tabular-nums">{numero(c.value)}</p>
  // una cifra sola va en la fila, a la derecha del rótulo (la tabla compacta de S09); una lista o la postura, debajo
  const enLaFila = c.available && !['KPI-STK-02', 'KPI-INV-03', 'programs'].includes(c.key)
  return (
    <section aria-label={titulo} className="space-y-1 py-1.5">
      <div className={enLaFila ? 'flex items-baseline justify-between gap-3' : undefined}>
        <h4 className={enLaFila ? 'text-sg-body-sm text-sg-text' : 'text-sg-body-sm font-semibold text-sg-text'}>{titulo}</h4>
        {enLaFila ? valor : null}
      </div>
      {enLaFila ? null : valor}
      {c.available ? <NotaDeConfidenciales oculta={c.confidentialHidden} /> : null}
      <NotasDeIndicador indicador={c} />
    </section>
  )
}

// la barra de posturas (screens.md S12, «StanceBar»; design-system.md §5.3 «Postura»): una barra apilada con el color de cada
// postura y, debajo, cada postura con su texto y su cifra; el estado siempre con su texto
const COLOR_DE_POSTURA: Record<string, string> = {
  'A FAVOR': 'var(--sg-stance-favor)',
  NEUTRAL: 'var(--sg-stance-neutral)',
  'EN CONTRA PERO ABIERTO A ESCUCHAR': 'var(--sg-stance-open)',
  'EN CONTRA': 'var(--sg-stance-against)'
}
function Posturas({ filas }: { filas: FilaDeDesglose[] }) {
  const { t } = useTranslation(NS)
  const total = filas.reduce((s, f) => s + (f.value ?? 0), 0)
  return (
    <>
      {total > 0 ? (
        <span aria-hidden className="flex h-5 overflow-hidden rounded-sg-sm bg-sg-surface-sunken">
          {filas
            .filter((f) => (f.value ?? 0) > 0)
            .map((f) => (
              <span
                key={f.key}
                className="block h-full border-r border-sg-surface last:border-r-0"
                style={{ width: `${((f.value ?? 0) / total) * 100}%`, backgroundColor: COLOR_DE_POSTURA[f.key] ?? 'var(--sg-neutral)' }}
              />
            ))}
        </span>
      ) : null}
      <ul aria-label={t('fichaTerritorial.posturas')} className="flex flex-wrap gap-x-3 gap-y-0.5 text-sg-caption text-sg-text-secondary">
        {filas.map((f) => (
          <li key={f.key} className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full border border-sg-border-strong"
              style={{ backgroundColor: COLOR_DE_POSTURA[f.key] ?? 'var(--sg-neutral)' }}
            />
            <span>{rotuloDeFila(f)}</span>
            <span className="font-bold tabular-nums text-sg-text">{f.value === null ? '—' : numeroPe(f.value)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
