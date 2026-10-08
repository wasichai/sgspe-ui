import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { useNombreDelGrupo } from '../componentes/NombreDeActor'
import { Consulta } from '../componentes/Estados'
import { KpiCard } from '../componentes/KpiCard'
import { ROL_DE_JEFATURA } from '../config'
import { useAsignadoAlProyecto } from '../contexto/ProyectoLayout'
import { useProyecto } from '../contexto/proyectos'
import { usePedir } from '../datos/http'
import { useIndicador } from '../datos/indicadores'
import { atributo, texto, usePuedeEditar, useTodos, type Registro } from '../datos/registros'
import { BarraDePosturas } from '../graficos/BarraDePosturas'
import { MiniMatriz, puntosDeMatriz } from '../graficos/MiniMatriz'
import { fechaPe, NS, numeroPe } from '../i18n'
import { useCapas } from '../mapa/api'
import { capa } from '../mapa/capas'
import { Mapa } from '../mapa/Mapa'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { vigente, PARAMETROS_F2 } from './parametros'

// S08 · Project 360, resumen (screens.md §3): cómo está el proyecto y qué pide atención hoy. de F2 a F7 una llamada por
// indicador con ?project= (KPI-STK-01 a 03, KPI-ENG-01 y 02); los de compromisos, QCS y riesgos dicen en qué fase llegan.
// la barra de posturas solo aparece con el indicador disponible (stance, security.md §7.9)
const TIPOS_FORMALES = ['REUNION', 'REUNION INFORMATIVA', 'TALLER', 'ASAMBLEA', 'MESA DE DIALOGO']
const DIA = 86_400_000

export function ResumenPage() {
  const { projectId = '' } = useParams()
  const proyecto = useProyecto(projectId)
  return <Consulta consulta={proyecto}>{(p) => <Resumen proyecto={p} />}</Consulta>
}

function Resumen({ proyecto }: { proyecto: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const asignado = useAsignadoAlProyecto(proyecto.id)
  // un rol con "u" sobre project (el analista SIG, que solo vincula concesiones) no completa el borrador
  const editaProyecto = usePuedeEditar('project')
  const filtros = { project: [proyecto.id] }
  const stk01 = useIndicador('KPI-STK-01', filtros)
  const stk02 = useIndicador('KPI-STK-02', filtros)
  const stk03 = useIndicador('KPI-STK-03', filtros)
  const eng01 = useIndicador('KPI-ENG-01', filtros)
  const eng02 = useIndicador('KPI-ENG-02', filtros)
  const jefatura = useTodos('project_assignment', { project: proyecto.id, role_name: ROL_DE_JEFATURA, active: true })
  const areas = useTodos('area_of_influence', { project: proyecto.id })
  const capas = useCapas(['LYR-09', 'LYR-13'], { project: proyecto.id })
  const parametro = (campo: string) =>
    vigente(
      proyecto.attributes,
      PARAMETROS_F2.find((p) => p.campo === campo)!
    ) as number

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-sg-h1 font-semibold">{texto(proyecto, 'name')}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-sg-text-secondary">
            <EstadoChip objeto="project" estado={proyecto.state} />
            <span>
              {t('p360.resumen.jefatura')}:{' '}
              {jefatura.data?.length ? (
                jefatura.data.map((j) => texto(j, 'member_user_email')).join(', ')
              ) : (
                <span className="text-sg-warning">{t('proyectos.sinJefatura')}</span>
              )}
            </span>
            <span>
              {t('p360.resumen.etapa')}: {texto(proyecto, 'stage') || '—'}
            </span>
            <span>
              {t('p360.resumen.fase')}: {texto(proyecto, 'exploration_phase') || '—'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {asignado && can('engagement', 'CREATE') ? (
            <Button asChild size="sm">
              <Link to={`/projects/${proyecto.id}/engagements/new`}>{t('p360.resumen.registrarInteraccion')}</Link>
            </Button>
          ) : null}
          {proyecto.state === 'draft' && editaProyecto ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/projects/new?draft=${proyecto.id}`}>{t('p360.resumen.completar')}</Link>
            </Button>
          ) : null}
          <BotonesDeTransicion objeto="project" registro={proyecto} />
          <button
            type="button"
            aria-disabled="true"
            title={t('p360.resumen.iaLlega')}
            className="flex h-8 cursor-not-allowed items-center gap-1.5 rounded-sg-md border border-dashed border-sg-ai-border px-2.5 text-sg-body-sm text-sg-ai opacity-60"
          >
            <Sparkles aria-hidden className="size-4" />
            {t('p360.resumen.resumenIa')}
          </button>
        </div>
      </header>
      <Atencion proyecto={proyecto} inactividad={parametro('inactivity_days')} revision={parametro('stakeholder_review_days')} />
      <section aria-label={t('p360.resumen.salud')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard titulo={t('p360.resumen.kpis.gruposVigentes')} indicador={stk01.data} cargando={stk01.isPending} />
        <KpiCard titulo={t('p360.resumen.kpis.interacciones')} indicador={eng01.data} cargando={eng01.isPending} />
        <KpiCard titulo={t('p360.resumen.kpis.compromisos')} llegaEn="F3" />
        <KpiCard titulo={t('p360.resumen.kpis.qcs')} llegaEn="F4" />
        <KpiCard titulo={t('p360.resumen.kpis.riesgos')} llegaEn="F4" />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label={t('p360.resumen.paisaje')} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
          <h2 className="text-sg-h3 font-semibold">{t('p360.resumen.paisaje')}</h2>
          <div className="flex flex-wrap gap-6">
            <div className="space-y-1">
              <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('p360.resumen.matriz')}</h3>
              <MiniMatriz
                etiqueta={t('p360.resumen.matriz')}
                disponible={stk03.data?.available !== false}
                puntos={puntosDeMatriz(stk03.data)}
                umbralInteres={parametro('interest_threshold')}
                umbralPoder={parametro('power_threshold')}
              />
              {stk03.data?.available && stk03.data.denominator !== undefined && stk03.data.denominator !== null ? (
                <p className="text-sg-caption text-sg-text-muted">
                  {t('p360.resumen.sinEvaluar', { n: numeroPe((stk03.data.denominator ?? 0) - (stk03.data.numerator ?? 0)) })}
                </p>
              ) : null}
              <Link to={`/projects/${proyecto.id}/stakeholders/matrix`} className="text-sg-caption text-sg-primary-text underline">
                {t('p360.resumen.verMatriz')}
              </Link>
            </div>
            {stk02.data?.available ? (
              <div className="min-w-56 flex-1 space-y-1">
                <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('p360.resumen.posturas')}</h3>
                <BarraDePosturas indicador={stk02.data} titulo={t('p360.resumen.posturas')} />
              </div>
            ) : null}
          </div>
        </section>
        <section aria-label={t('p360.resumen.reuniones')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
          <h2 className="text-sg-h3 font-semibold">{t('p360.resumen.reuniones')}</h2>
          {eng02.data && !eng02.data.available ? null : (
            <ul className="space-y-1 text-sm">
              {(eng02.data?.series ?? []).slice(-6).map((s) => (
                <li key={s.period} className="flex items-center gap-2">
                  <span className="w-48">
                    {t('p360.resumen.reunionesMes', {
                      mes: s.period,
                      valor: numeroPe(s.value ?? 0),
                      meta: numeroPe(s.target ?? parametro('meetings_per_month_target'))
                    })}
                  </span>
                  <span className="h-2 flex-1 rounded-full bg-sg-surface-sunken" aria-hidden>
                    <span
                      className="block h-2 rounded-full bg-sg-primary"
                      style={{ width: `${Math.min(100, ((s.value ?? 0) / Math.max(1, s.target ?? parametro('meetings_per_month_target'))) * 100)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label={t('p360.resumen.areas')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
          <h2 className="text-sg-h3 font-semibold">{t('p360.resumen.areas')}</h2>
          <ul className="space-y-1 text-sm">
            {(areas.data ?? [])
              .filter((a) => a.state === 'approved')
              .map((a) => (
                <li key={a.id}>
                  <Link to={`/projects/${proyecto.id}/areas/${a.id}`} className="text-sg-primary-text underline">
                    {texto(a, 'area_type')} · v{texto(a, 'version_number')}
                  </Link>
                </li>
              ))}
          </ul>
          {areas.isSuccess && !areas.data.some((a) => a.state === 'approved') ? (
            <p className="text-sm text-sg-text-muted">{t('p360.resumen.sinAreas')}</p>
          ) : null}
          <Mapa
            etiqueta={t('mapa.mapaDelProyecto')}
            className="relative h-48 w-full overflow-hidden rounded-sg-md border border-sg-border"
            capas={capas
              .filter((c) => c.datos)
              .map((c) => ({ id: c.id, datos: c.datos!, color: '--sg-primary', seleccionable: false, miembros: capa(c.id)?.miembros }))}
          />
          <Link to={`/projects/${proyecto.id}/map`} className="text-sg-caption text-sg-primary-text underline">
            {t('p360.resumen.verMapa')}
          </Link>
        </section>
        <Actividad proyecto={proyecto.id} />
      </div>
    </div>
  )
}

// "Atención requerida" en F2 (screens.md S08): actas por redactar de reuniones formales realizadas, grupos de interés sin
// contacto pasado inactivity_days y evaluaciones más viejas que stakeholder_review_days. vencidos y bloqueados llegan en F3
function Atencion({ proyecto, inactividad, revision }: { proyecto: Registro; inactividad: number; revision: number }) {
  const { t } = useTranslation(NS)
  const interacciones = useTodos('engagement', { project: proyecto.id })
  const grupos = useTodos('stakeholder', { project: proyecto.id })
  const ahora = Date.now()
  const viejo = (fecha: unknown, dias: number) => typeof fecha === 'string' && ahora - Date.parse(fecha) > dias * DIA
  const items = [
    ...(interacciones.data ?? [])
      .filter((e) => e.state === 'held' && TIPOS_FORMALES.includes(texto(e, 'engagement_type')))
      .map((e) => ({ id: e.id, texto: t('p360.resumen.actaPendiente', { titulo: texto(e, 'title') }), ruta: `/projects/${proyecto.id}/engagements/${e.id}` })),
    ...(grupos.data ?? [])
      .filter((g) => g.state !== 'retired' && viejo(atributo(g, 'last_contact_date'), inactividad))
      .map((g) => ({ id: `c-${g.id}`, grupo: g, clave: 'p360.resumen.sinContacto', dias: inactividad, ruta: `/projects/${proyecto.id}/stakeholders/${g.id}` })),
    ...(grupos.data ?? [])
      .filter((g) => g.state === 'assessed' && viejo(atributo(g, 'last_assessment_date'), revision))
      .map((g) => ({
        id: `e-${g.id}`,
        grupo: g,
        clave: 'p360.resumen.evaluacionVencida',
        dias: revision,
        ruta: `/projects/${proyecto.id}/stakeholders/${g.id}`
      }))
  ]
  return (
    <section aria-label={t('p360.resumen.atencion')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="text-sg-h3 font-semibold">{t('p360.resumen.atencion')}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('p360.resumen.sinAtencion')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.id}>
              <Link to={i.ruta} className="text-sg-primary-text underline">
                {'grupo' in i ? <AvisoDeGrupo grupo={i.grupo} clave={i.clave} dias={i.dias} /> : i.texto}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AvisoDeGrupo({ grupo, clave, dias }: { grupo: Registro; clave: string; dias: number }) {
  const { t } = useTranslation(NS)
  const nombre = useNombreDelGrupo(grupo)
  return <>{t(clave, { nombre, dias })}</>
}

interface Entrada {
  id: string
  userEmail: string
  operation: string
  occurredAt: string
  reason: string | null
}

function Actividad({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const historia = useQuery({
    queryKey: ['history', 'project', proyecto],
    queryFn: () => pedir<Entrada[]>(`/objects/project/records/${proyecto}/history?limit=10`)
  })
  return (
    <section aria-label={t('p360.resumen.actividad')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="text-sg-h3 font-semibold">{t('p360.resumen.actividad')}</h2>
      <ol className="space-y-1 text-sm">
        {(historia.data ?? []).map((e) => (
          <li key={e.id}>
            <span className="text-sg-text-muted">{fechaPe(new Date(e.occurredAt))}</span> · {e.userEmail} ·{' '}
            {t(`p360.resumen.operaciones.${e.operation}`, { defaultValue: e.operation })}
            {e.reason ? <span className="text-sg-text-secondary"> — {e.reason}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
