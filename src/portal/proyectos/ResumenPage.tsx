import { EnlaceConRastro } from '../contexto/Rastro'
import { useAuth } from '@wasichai/core'
import { Button, cn } from '@wasichai/ui'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { useNombreDelGrupo } from '../componentes/NombreDeActor'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { Historia } from '../componentes/Historia'
import { Cargando, Consulta, NoDisponible, esProhibido } from '../componentes/Estados'
import { CifraFallida } from '../componentes/KpiCard'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { ROL_DE_JEFATURA } from '../config'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyecto } from '../contexto/proyectos'
import { diasEntre, hoyEnLima } from '../datos/fechas'
import { atributo, texto, usePuedeEditar, useTodos, type Registro } from '../datos/registros'
import { BarraDePosturas } from '../graficos/BarraDePosturas'
import { MiniMatriz, puntosDeMatriz } from '../graficos/MiniMatriz'
import { NS, numeroPe, periodoPe } from '../i18n'
import { AccionesDeIa } from '../ia/AccionesDeIa'
import { ResumenEjecutivo } from '../ia/ResumenEjecutivo'
import { useCapas } from '../mapa/api'
import { avisoDelMapa } from '../mapa/avisos'
import { capa } from '../mapa/capas'
import { Mapa } from '../mapa/Mapa'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { vigente, PARAMETROS_F2 } from './parametros'
import { TableroDelProyecto, useIndicadoresDelProyecto, type LecturaDeIndicador } from './TableroDelProyecto'
import { opcion } from '../datos/opciones'
import { ListaPriorizada, type EntradaPriorizada } from '../componentes/ListaPriorizada'
import { Persona } from '../componentes/Persona'
import { Seccion } from '../componentes/Seccion'

// S08 · Project 360, resumen (screens.md §3): cómo está el proyecto y qué pide atención hoy. desde F8, el tablero
// project en una sola llamada (TableroDelProyecto), repartido entre las zonas.
// desde F7, el resumen ejecutivo (AI-04), los posibles duplicados (AI-07) y la pregunta a los documentos (AI-06). el bloque de posturas siempre se dibuja: sin permiso sobre stance (security.md §7.9) dice "no disponible" y por qué. una
// consulta auxiliar que carga, falla o no se puede leer lo dice; nunca se lee como "sin datos" ni como "sin nada que atender"
// P-03 y DD-13: sin subrayado en las listas ni en los accesos sueltos; el subrayado queda para los enlaces dentro de un texto
const ACCESO = 'text-sg-caption font-medium text-sg-primary-text no-underline hover:underline focus-visible:underline'
const ENTRADA = 'text-sm font-medium text-sg-primary-text no-underline hover:underline focus-visible:underline'
const TIPOS_FORMALES = ['REUNION', 'REUNION INFORMATIVA', 'TALLER', 'ASAMBLEA', 'MESA DE DIALOGO']

export function ResumenPage() {
  const { projectId = '' } = useParams()
  const proyecto = useProyecto(projectId)
  return <Consulta consulta={proyecto}>{(p) => <Resumen proyecto={p} />}</Consulta>
}

function Resumen({ proyecto }: { proyecto: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const escribeEnElProyecto = useEscribeEnProyecto(proyecto.id)
  // un rol con "u" sobre project (el analista SIG, que solo vincula concesiones) no completa el borrador
  const editaProyecto = usePuedeEditar('project')
  // desde F8, una sola llamada al tablero project (decisión 6 del plan 8.3)
  const { tablero, de } = useIndicadoresDelProyecto(proyecto.id)
  const stk01 = de('KPI-STK-01')
  const stk02 = de('KPI-STK-02')
  const stk03 = de('KPI-STK-03')
  const eng01 = de('KPI-ENG-01')
  const eng02 = de('KPI-ENG-02')
  const com03 = de('KPI-COM-03')
  const grv02 = de('KPI-GRV-02')
  const rsk01 = de('KPI-RSK-01')
  const jefatura = useTodos('project_assignment', { project: proyecto.id, role_name: ROL_DE_JEFATURA, active: true })
  const areas = useTodos('area_of_influence', { project: proyecto.id })
  const capas = useCapas(['LYR-09', 'LYR-13'], { project: proyecto.id })
  // las capas son fijas y la consulta cubre todo el proyecto: un mapa en blanco dice si está bloqueado, falló o no tiene geometrías
  const avisoMapa = avisoDelMapa(capas, false)
  const base = `/projects/${encodeURIComponent(proyecto.id)}`
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
              {jefatura.isPending ? (
                t('comun.cargando')
              ) : jefatura.isError ? (
                esProhibido(jefatura.error) ? (
                  <NoDisponible />
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-sg-danger">{t('p360.resumen.jefaturaConError')}</span>
                    <Button variant="secondary" size="sm" onClick={() => void jefatura.refetch()}>
                      {t('comun.reintentar')}
                    </Button>
                  </span>
                )
              ) : jefatura.data.length ? (
                jefatura.data.map((j, i) => (
                  <span key={j.id}>
                    {i ? ', ' : ''}
                    <Persona correo={texto(j, 'member_user_email')} />
                  </span>
                ))
              ) : (
                <span className="text-sg-warning">{t('proyectos.sinJefatura')}</span>
              )}
            </span>
            <span>
              {t('p360.resumen.etapa')}: {opcion(proyecto, 'stage') || '—'}
            </span>
            <span>
              {t('p360.resumen.fase')}: {opcion(proyecto, 'exploration_phase') || '—'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {escribeEnElProyecto && can('engagement', 'CREATE') ? (
            <Button asChild size="sm">
              <Link to={`/projects/${encodeURIComponent(proyecto.id)}/engagements/new`}>{t('p360.resumen.registrarInteraccion')}</Link>
            </Button>
          ) : null}
          {proyecto.state === 'draft' && editaProyecto ? (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/projects/new?draft=${encodeURIComponent(proyecto.id)}`}>{t('p360.resumen.completar')}</Link>
            </Button>
          ) : null}
          <BotonesDeTransicion objeto="project" registro={proyecto} proyecto={proyecto.id} sinPrimaria={escribeEnElProyecto && can('engagement', 'CREATE')} />
        </div>
      </header>
      {/* P-03: las cinco cifras, al inicio y en una sola superficie (U-34). todas salen del tablero del proyecto: si falla, cada
          una lo dice en una línea y el aviso con «Reintentar» va una sola vez, en el tablero (D4, revisión de UX, etapa 7) */}
      <FranjaDeCifras
        titulo={t('p360.resumen.salud')}
        cifras={[
          // cada cifra lleva a su lista con el filtro puesto (design P8; revisión de UX, etapa 6)
          { titulo: t('p360.resumen.kpis.gruposVigentes'), lectura: stk01, a: `${base}/stakeholders?view=todos` },
          { titulo: t('p360.resumen.kpis.interacciones'), lectura: eng01, a: `${base}/engagements` },
          // pide acción: un compromiso vencido y un riesgo alto; las QCS abiertas son el trabajo corriente
          { titulo: t('p360.resumen.kpis.compromisos'), lectura: com03, a: `${base}/commitments?view=vencidos`, tono: 'aviso' },
          { titulo: t('p360.resumen.kpis.qcs'), lectura: grv02, a: `${base}/attention` },
          { titulo: t('p360.resumen.kpis.riesgos'), lectura: rsk01, a: `${base}/risks?level=alto`, tono: 'peligro' }
        ]}
      />
      <ResumenEjecutivo proyecto={proyecto} />
      <AccionesDeIa objeto="project" registro={proyecto} proyecto={proyecto.id} rotulo={texto(proyecto, 'name')} casos={['AI-07']} />
      <Atencion proyecto={proyecto} inactividad={parametro('inactivity_days')} revision={parametro('stakeholder_review_days')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo={t('p360.resumen.paisaje')} className="space-y-3">
          <div className="flex flex-wrap gap-6">
            <div className="space-y-1">
              <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('p360.resumen.matriz')}</h3>
              {stk03.isPending ? (
                <Cargando />
              ) : stk03.isError ? (
                <CifraFallida error={stk03.error} />
              ) : (
                <MiniMatriz
                  etiqueta={t('p360.resumen.matriz')}
                  noDisponible={stk03.data.available ? undefined : { motivo: stk03.data.unavailableReason }}
                  puntos={puntosDeMatriz(stk03.data)}
                  umbralInteres={parametro('interest_threshold')}
                  umbralPoder={parametro('power_threshold')}
                />
              )}
              {stk03.data?.available && stk03.data.denominator !== undefined && stk03.data.denominator !== null ? (
                <p className="text-sg-caption text-sg-text-muted">
                  {t('p360.resumen.sinEvaluar', { n: numeroPe((stk03.data.denominator ?? 0) - (stk03.data.numerator ?? 0)) })}
                </p>
              ) : null}
              <Link to={`/projects/${encodeURIComponent(proyecto.id)}/stakeholders/matrix`} className={ACCESO}>
                {t('p360.resumen.verMatriz')}
              </Link>
            </div>
            <div className="min-w-56 flex-1 space-y-1">
              <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('p360.resumen.posturas')}</h3>
              {stk02.isPending ? (
                <Cargando />
              ) : stk02.isError ? (
                <CifraFallida error={stk02.error} />
              ) : (
                <BarraDePosturas indicador={stk02.data} titulo={t('p360.resumen.posturas')} />
              )}
            </div>
          </div>
        </Seccion>
        <Seccion titulo={t('p360.resumen.reuniones')}>
          {eng02.isPending ? (
            <Cargando />
          ) : eng02.isError ? (
            <CifraFallida error={eng02.error} />
          ) : !eng02.data.available ? (
            <NoDisponible motivo={eng02.data.unavailableReason} />
          ) : !eng02.data.series?.length ? (
            <p className="text-sm text-sg-text-muted">{t('p360.resumen.sinReuniones')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {eng02.data.series.slice(-6).map((s) => {
                const meta = s.target ?? parametro('meetings_per_month_target')
                return (
                  <li key={s.period} className="flex items-center gap-2">
                    <span className="w-48">
                      {t('p360.resumen.reunionesMes', {
                        mes: periodoPe(s.period),
                        valor: s.value === null || s.value === undefined ? '—' : numeroPe(s.value),
                        meta: numeroPe(meta)
                      })}
                    </span>
                    <span className="h-2 flex-1 rounded-full bg-sg-surface-sunken" aria-hidden>
                      <span
                        className="block h-2 rounded-full bg-sg-primary"
                        style={{ width: `${Math.min(100, ((s.value ?? 0) / Math.max(1, meta)) * 100)}%` }}
                      />
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Seccion>
      </div>
      <TableroDelProyecto tablero={tablero} proyecto={proyecto.id} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo={t('p360.resumen.areas')}>
          {areas.isPending ? <Cargando /> : null}
          {areas.isError ? <FalloDeLectura error={areas.error} alReintentar={() => void areas.refetch()} /> : null}
          <ul className="space-y-1 text-sm">
            {(areas.data ?? [])
              .filter((a) => a.state === 'approved')
              .map((a) => (
                <li key={a.id}>
                  <EnlaceConRastro to={`/projects/${encodeURIComponent(proyecto.id)}/areas/${encodeURIComponent(a.id)}`} className={ENTRADA}>
                    {opcion(a, 'area_type')} · v{texto(a, 'version_number')}
                  </EnlaceConRastro>
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
          {avisoMapa ? (
            <p role="status" className="text-sm text-sg-text-muted">
              {t(`mapa.avisos.${avisoMapa}`)}
            </p>
          ) : null}
          <Link to={`/projects/${encodeURIComponent(proyecto.id)}/map`} className={ACCESO}>
            {t('p360.resumen.verMapa')}
          </Link>
        </Seccion>
        <Actividad proyecto={proyecto.id} />
      </div>
    </div>
  )
}

// "Atención requerida" en F2 (screens.md S08): actas por redactar de reuniones formales realizadas, grupos de interés sin
// contacto pasado inactivity_days (o sin ningún contacto) y evaluaciones más viejas que stakeholder_review_days. vencidos y
// bloqueados llegan en F3. las fechas son de calendario: los días se cuentan contra hoy en Lima, no contra la hora UTC.
// «Nada pide atención» solo se dice cuando las dos lecturas respondieron
function Atencion({ proyecto, inactividad, revision }: { proyecto: Registro; inactividad: number; revision: number }) {
  const { t } = useTranslation(NS)
  const interacciones = useTodos('engagement', { project: proyecto.id })
  const grupos = useTodos('stakeholder', { project: proyecto.id })
  const hoy = hoyEnLima()
  const base = `/projects/${encodeURIComponent(proyecto.id)}`
  const aGrupo = (g: Registro) => `${base}/stakeholders/${encodeURIComponent(g.id)}`
  // la más vieja primero: la que lleva más tiempo esperando su acta (la fecha realizada o, sin ella, la programada; sin ninguna, al final)
  const instanteDe = (e: Registro) => texto(e, 'held_at') || texto(e, 'scheduled_at') || '9999'
  const actas: EntradaPriorizada[] = (interacciones.data ?? [])
    .filter((e) => e.state === 'held' && TIPOS_FORMALES.includes(texto(e, 'engagement_type')))
    .sort((x, y) => instanteDe(x).localeCompare(instanteDe(y)))
    .map((e) => ({
      clave: e.id,
      titulo: texto(e, 'title'),
      a: `${base}/engagements/${encodeURIComponent(e.id)}`,
      motivo: t('p360.resumen.motivos.acta'),
      tono: 'aviso'
    }))
  // primero quien nunca tuvo contacto y luego quien lleva más días sin él
  const sinContacto: EntradaPriorizada[] = (grupos.data ?? [])
    // una cuenta que no lee last_contact_date (la clave no viene en el registro) no puede decir si hubo contacto
    .filter((g) => g.state !== 'retired' && 'last_contact_date' in g.attributes)
    .flatMap((g) => {
      const dias = diasEntre(atributo(g, 'last_contact_date'), hoy)
      return dias !== null && dias <= inactividad ? [] : [{ g, dias }]
    })
    .sort((x, y) => (y.dias ?? Infinity) - (x.dias ?? Infinity))
    .map(({ g, dias }) => ({
      clave: `c-${g.id}`,
      titulo: <NombreDeGrupo grupo={g} />,
      a: aGrupo(g),
      motivo: dias === null ? t('p360.resumen.motivos.nuncaContactado') : t('p360.resumen.motivos.sinContacto', { count: dias }),
      tono: dias === null ? 'peligro' : 'aviso'
    }))
  const evaluaciones: EntradaPriorizada[] = (grupos.data ?? [])
    .flatMap((g) => {
      const dias = g.state === 'assessed' ? (diasEntre(atributo(g, 'last_assessment_date'), hoy) ?? 0) : 0
      return dias > revision ? [{ g, dias }] : []
    })
    .sort((x, y) => y.dias - x.dias)
    .map(({ g, dias }) => ({
      clave: `e-${g.id}`,
      titulo: <NombreDeGrupo grupo={g} />,
      a: aGrupo(g),
      motivo: t('p360.resumen.motivos.evaluacion', { count: dias }),
      tono: 'aviso'
    }))
  // por tipo, con su conteo: las tres más urgentes y «Ver los N» hacia la lista filtrada, si la hay (hallazgo U-05, DD-13). las
  // actas por redactar y las evaluaciones viejas no tienen una vista propia en sus listas: dicen cuántas quedan, sin enlace
  const grupos_: { clave: string; entradas: EntradaPriorizada[]; dias: number; verTodos?: string }[] = [
    { clave: 'actas', entradas: actas, dias: 0 },
    { clave: 'sinContacto', entradas: sinContacto, dias: inactividad, verTodos: `${base}/stakeholders?view=sinContacto` },
    { clave: 'evaluaciones', entradas: evaluaciones, dias: revision }
  ]
  const hayAvisos = grupos_.some((g) => g.entradas.length > 0)
  const fuentes = [
    { clave: 'interacciones', consulta: interacciones },
    { clave: 'grupos', consulta: grupos }
  ]
  const cargando = fuentes.some((f) => f.consulta.isPending)
  const fallidas = fuentes.filter((f) => f.consulta.isError)
  return (
    <Seccion titulo={t('p360.resumen.atencion')} descripcion={t('p360.resumen.atencionAyuda')}>
      {hayAvisos ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {grupos_.map((g) => (
            <ListaPriorizada
              key={g.clave}
              titulo={t(`p360.resumen.grupos.${g.clave}`, { dias: g.dias })}
              total={g.entradas.length}
              entradas={g.entradas}
              verTodos={g.verTodos ? { a: g.verTodos } : undefined}
            />
          ))}
        </div>
      ) : null}
      {cargando ? <Cargando /> : null}
      {fallidas.map((f) => (
        <div key={f.clave} className="space-y-1 text-sm">
          <p className="font-medium">{t(`p360.resumen.fuentes.${f.clave}`)}</p>
          <FalloDeLectura error={f.consulta.error} alReintentar={() => void f.consulta.refetch()} />
        </div>
      ))}
      {!hayAvisos && !cargando && fallidas.length === 0 ? <p className="text-sm text-sg-text-muted">{t('p360.resumen.sinAtencion')}</p> : null}
    </Seccion>
  )
}

// el grupo de interés de un aviso, por su nombre: el motivo de la entrada dice qué le pasa
function NombreDeGrupo({ grupo }: { grupo: Registro }) {
  return <>{useNombreDelGrupo(grupo)}</>
}

function Actividad({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  return (
    <Seccion titulo={t('p360.resumen.actividad')}>
      <Historia objeto="project" id={proyecto} limite={10} vacio={t('p360.resumen.sinActividad')} />
    </Seccion>
  )
}

type Tono = 'aviso' | 'peligro'
interface CifraDeFranja {
  titulo: string
  lectura: LecturaDeIndicador
  a: string
  // el tono de la cifra cuando pide acción (un valor mayor que cero); en cero o sin valor, neutra
  tono?: Tono
}

const COLOR: Record<Tono, string> = { aviso: 'text-sg-warning', peligro: 'text-sg-danger' }

// la franja de cifras de P-03: una sola superficie con las cifras sin caja propia (nunca tarjetas dentro de tarjetas, U-34). una
// cifra que pide acción se tiñe y lo dice con un ícono y un texto, nunca solo con el color. una cifra de QCS que no cuenta las
// confidenciales lo dice con NotaDeConfidenciales, sin cuántas
function FranjaDeCifras({ titulo, cifras }: { titulo: string; cifras: CifraDeFranja[] }) {
  return (
    <section aria-label={titulo} className="grid gap-1 rounded-sg-lg border border-sg-border bg-sg-surface p-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <h2 className="sr-only">{titulo}</h2>
      {cifras.map((c) => (
        <Cifra key={c.titulo} {...c} />
      ))}
    </section>
  )
}

function Cifra({ titulo, lectura, a, tono }: CifraDeFranja) {
  const { t } = useTranslation(NS)
  const indicador = lectura.data
  let cuerpo
  if (lectura.isError) cuerpo = <CifraFallida error={lectura.error} />
  else if (!indicador) cuerpo = <Cargando compacto />
  else if (!indicador.available) cuerpo = <NoDisponible motivo={indicador.unavailableReason} />
  // sin valor en el periodo se dice: nunca un cero ni la unidad suelta
  else if (indicador.value === null || indicador.value === undefined) cuerpo = <p className="text-sm text-sg-text-muted">{t('comun.sinDatosEnElPeriodo')}</p>
  else {
    const pide = tono && indicador.value > 0 ? tono : undefined
    cuerpo = (
      <>
        <p className="flex items-center gap-1.5 text-sg-kpi font-semibold tabular-nums">
          <Link
            to={a}
            aria-label={`${titulo}: ${numeroPe(indicador.value)}`}
            className={cn('no-underline hover:underline focus-visible:underline', pide ? COLOR[pide] : 'text-sg-text')}
          >
            {numeroPe(indicador.value)}
          </Link>
          {pide ? (
            <>
              <AlertTriangle aria-hidden className={cn('size-4', COLOR[pide])} />
              <span className="sr-only">{t('p360.resumen.pideAccion')}</span>
            </>
          ) : null}
        </p>
        <p className="text-sg-caption text-sg-text-muted">
          {indicador.numerator !== undefined && indicador.numerator !== null && indicador.denominator
            ? `${numeroPe(indicador.numerator)} / ${numeroPe(indicador.denominator)} · `
            : ''}
          {indicador.unit ?? ''}
        </p>
        <NotaDeConfidenciales oculta={indicador.confidentialHidden} />
      </>
    )
  }
  return (
    <div role="group" aria-label={titulo} className="space-y-1 rounded-sg-md p-3">
      <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{titulo}</h3>
      {cuerpo}
    </div>
  )
}
