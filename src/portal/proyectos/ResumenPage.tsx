import { EnlaceConRastro } from '../contexto/Rastro'
import { useAuth } from '@wasichai/core'
import { cn, Table, Td } from '@wasichai/ui'
import { ChevronDown, Table2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { useNombreDelGrupo } from '../componentes/NombreDeActor'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { Historia } from '../componentes/Historia'
import { Cargando, Consulta, NoDisponible } from '../componentes/Estados'
import { CifraFallida, KpiCard, RejillaDeKpi } from '../componentes/KpiCard'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { ContenedorDePagina } from '../componentes/Pagina'
import { CELDA } from '../componentes/TablaPriorizada'
import { useProyecto } from '../contexto/proyectos'
import { diasEntre, hoyEnLima } from '../datos/fechas'
import { desglose, type Indicador } from '../datos/indicadores'
import { opcion } from '../datos/opciones'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { BarraDePosturas } from '../graficos/BarraDePosturas'
import { NS, numeroPe, periodoPe } from '../i18n'
import { AccionesDeIa } from '../ia/AccionesDeIa'
import { ResumenEjecutivo } from '../ia/ResumenEjecutivo'
import { useCapas } from '../mapa/api'
import { avisoDelMapa } from '../mapa/avisos'
import { capa, dibujoDe } from '../mapa/capas'
import { Mapa } from '../mapa/Mapa'
import { EtiquetaDeTerritorio } from './EtiquetaDeTerritorio'
import { vigente, PARAMETROS_F2 } from './parametros'
import { TableroDelProyecto, useIndicadoresDelProyecto, type LecturaDeIndicador } from './TableroDelProyecto'

// S08 · Project 360, resumen (screens.md §3) con la forma de S05 de Civic Modern (design-system.md §6.7). la banda del proyecto
// (antetítulo, h1 con su estado, jefatura, etapa, fase, campaña y acciones) la dibuja ProyectoLayout a todo el ancho
// (CabeceraDelProyecto). aquí, las cinco cifras en una RejillaDeKpi y dos columnas: a la izquierda «Qué requiere atención» (una
// fila por tipo con su número grande y su acción), el resumen de IA y la actividad reciente; a la derecha el paisaje de grupos
// (la postura apilada y los cuatro cuadrantes interés × poder), las reuniones del mes frente a la meta y las áreas de influencia
// con su estado y el mini mapa. debajo, el tablero project (TableroDelProyecto), sin repetir ninguna cifra de la rejilla (DD-42:
// una sola fuente por cifra). desde F8 todo sale de una sola llamada al tablero project. una consulta que carga, falla o no se
// puede leer lo dice; nunca se lee como «sin datos», como «sin nada que atender» ni como un 0
// P-03 y DD-13: sin subrayado en las listas ni en los accesos sueltos; el subrayado queda para los enlaces dentro de un texto
const ACCESO = 'inline-flex items-center gap-1.5 text-sg-body-sm font-semibold text-sg-primary-text no-underline hover:underline focus-visible:underline'
const TIPOS_FORMALES = ['REUNION', 'REUNION INFORMATIVA', 'TALLER', 'ASAMBLEA', 'MESA DE DIALOGO']

export function ResumenPage() {
  const { projectId = '' } = useParams()
  const proyecto = useProyecto(projectId)
  return <Consulta consulta={proyecto}>{(p) => <Resumen proyecto={p} />}</Consulta>
}

function Resumen({ proyecto }: { proyecto: Registro }) {
  // desde F8, una sola llamada al tablero project (decisión 6 del plan 8.3)
  const { tablero, de } = useIndicadoresDelProyecto(proyecto.id)
  const base = `/projects/${encodeURIComponent(proyecto.id)}`
  const parametro = (campo: string) =>
    vigente(
      proyecto.attributes,
      PARAMETROS_F2.find((p) => p.campo === campo)!
    ) as number

  return (
    <ContenedorDePagina>
      <CifrasDelProyecto
        base={base}
        grupos={de('KPI-STK-01')}
        interacciones={de('KPI-ENG-01')}
        reuniones={de('KPI-ENG-02')}
        vencidos={de('KPI-COM-03')}
        qcs={de('KPI-GRV-02')}
        qcsVencidas={de('KPI-GRV-06')}
        riesgos={de('KPI-RSK-01')}
      />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <Atencion proyecto={proyecto} inactividad={parametro('inactivity_days')} revision={parametro('stakeholder_review_days')} />
          <ResumenEjecutivo proyecto={proyecto} />
          <AccionesDeIa objeto="project" registro={proyecto} proyecto={proyecto.id} rotulo={texto(proyecto, 'name')} casos={['AI-07']} />
          <Actividad proyecto={proyecto.id} />
        </div>
        <div className="min-w-0 space-y-5">
          <Paisaje
            base={base}
            posturas={de('KPI-STK-02')}
            matriz={de('KPI-STK-03')}
            umbralInteres={parametro('interest_threshold')}
            umbralPoder={parametro('power_threshold')}
          />
          <Reuniones base={base} lectura={de('KPI-ENG-02')} metaDelProyecto={parametro('meetings_per_month_target')} />
          <Areas proyecto={proyecto.id} />
        </div>
      </div>
      <TableroDelProyecto tablero={tablero} proyecto={proyecto.id} />
    </ContenedorDePagina>
  )
}

// las cinco cifras de S05 en una sola caja (RejillaDeKpi), al inicio: cada una lleva a su lista con el filtro puesto (design P8;
// revisión de UX, etapa 6). solo se tiñen en danger las que piden acción (un vencido, un riesgo alto) cuando pasan de cero, y lo
// dicen también en texto a los lectores de pantalla; el rótulo ya dice que es lo vencido. junto a las interacciones va la única
// meta que hay, la de reuniones del mes (KPI-ENG-02); junto a las QCS abiertas, las vencidas (KPI-GRV-06). la nota de
// confidenciales va al pie de la cifra, nunca dentro de ella
function CifrasDelProyecto({
  base,
  grupos,
  interacciones,
  reuniones,
  vencidos,
  qcs,
  qcsVencidas,
  riesgos
}: {
  base: string
  grupos: LecturaDeIndicador
  interacciones: LecturaDeIndicador
  reuniones: LecturaDeIndicador
  vencidos: LecturaDeIndicador
  qcs: LecturaDeIndicador
  qcsVencidas: LecturaDeIndicador
  riesgos: LecturaDeIndicador
}) {
  const { t } = useTranslation(NS)
  const titulo = t('p360.resumen.salud')
  const pide = (lectura: LecturaDeIndicador) => (lectura.data?.available && (lectura.data.value ?? 0) > 0 ? ('danger' as const) : undefined)
  const aviso = (lectura: LecturaDeIndicador) => (pide(lectura) ? <span className="sr-only">{t('p360.resumen.pideAccion')}</span> : null)
  // sin detalle, KpiCard pone la unidad bajo la cifra («grupos de interés»): el rótulo ya la dice
  const sinUnidad = () => null
  const meta = reuniones.data?.available && reuniones.data.denominator ? reuniones.data : null
  const vencidas = qcsVencidas.data?.available && (qcsVencidas.data.value ?? 0) > 0 ? (qcsVencidas.data.value as number) : null
  const de = (lectura: LecturaDeIndicador) => ({ indicador: lectura.data, error: lectura.isError ? lectura.error : undefined, cargando: lectura.isPending })
  return (
    <section aria-label={titulo}>
      <h2 className="sr-only">{titulo}</h2>
      <RejillaDeKpi>
        <KpiCard titulo={t('p360.resumen.kpis.gruposVigentes')} {...de(grupos)} a={`${base}/stakeholders?view=todos`} detalle={sinUnidad} />
        <KpiCard
          titulo={t('p360.resumen.kpis.interacciones')}
          {...de(interacciones)}
          a={`${base}/engagements`}
          // un porcentaje dice su base («3 de 10»); una cuenta, la meta de reuniones del mes si la hay
          detalle={(i) =>
            i.unit === '%'
              ? i.numerator != null && i.denominator
                ? t('comun.nDeN', { n: numeroPe(i.numerator), total: numeroPe(i.denominator) })
                : null
              : meta
                ? t('p360.resumen.reunionesFrenteAMeta', { n: numeroPe(meta.numerator ?? meta.value ?? 0), meta: numeroPe(meta.denominator as number) })
                : null
          }
        />
        <KpiCard
          titulo={t('p360.resumen.kpis.compromisos')}
          {...de(vencidos)}
          a={`${base}/commitments?view=vencidos`}
          tono={pide(vencidos)}
          detalle={sinUnidad}
          notas={aviso(vencidos)}
        />
        <KpiCard
          titulo={t('p360.resumen.kpis.qcs')}
          {...de(qcs)}
          a={`${base}/attention`}
          detalle={() => (vencidas ? <span className="font-bold text-sg-danger">{t('p360.resumen.qcsVencidas', { count: vencidas })}</span> : null)}
          notas={<NotaDeConfidenciales oculta={qcs.data?.confidentialHidden === true || qcsVencidas.data?.confidentialHidden === true} />}
        />
        <KpiCard
          titulo={t('p360.resumen.kpis.riesgos')}
          {...de(riesgos)}
          a={`${base}/risks?level=alto`}
          tono={pide(riesgos)}
          detalle={sinUnidad}
          notas={aviso(riesgos)}
        />
      </RejillaDeKpi>
    </section>
  )
}

// un panel de S05 (.panel y .panel-h del lienzo): la cabecera con su título en h2 y, a la derecha, su acceso; el cuerpo va a
// todo el ancho del panel (las filas de «Qué requiere atención», la tabla de las áreas)
function Panel({ titulo, nombre, acciones, children }: { titulo: ReactNode; nombre?: string; acciones?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={nombre ? undefined : id} aria-label={nombre} className="rounded-sg-md border border-sg-border bg-sg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-sg-border px-5 py-3.5">
        <h2 id={id} className="text-sg-h3 text-sg-text">
          {titulo}
        </h2>
        {acciones ? <div className="ml-auto flex flex-wrap items-center gap-3">{acciones}</div> : null}
      </div>
      {children}
    </section>
  )
}

interface EntradaDeAtencion {
  clave: string
  titulo: ReactNode
  a: string
  motivo: string
}

// «Atención requerida» en F2 (screens.md S08): actas por redactar de reuniones formales realizadas, grupos de interés sin
// contacto pasado inactivity_days (o sin ningún contacto) y evaluaciones más viejas que stakeholder_review_days. las fechas son
// de calendario: los días se cuentan contra hoy en Lima, no contra la hora UTC. en S05 cada tipo es una fila con su número grande
// a la izquierda y su acción a la derecha, sin muro de enlaces ni bordes de color: la acción despliega cuáles son, lo más urgente
// primero, y «Ver los N» lleva a la lista filtrada si la hay. «Nada pide atención» solo se dice cuando las dos lecturas respondieron
function Atencion({ proyecto, inactividad, revision }: { proyecto: Registro; inactividad: number; revision: number }) {
  const { t } = useTranslation(NS)
  const interacciones = useTodos('engagement', { project: proyecto.id })
  const grupos = useTodos('stakeholder', { project: proyecto.id })
  const hoy = hoyEnLima()
  const base = `/projects/${encodeURIComponent(proyecto.id)}`
  const aGrupo = (g: Registro) => `${base}/stakeholders/${encodeURIComponent(g.id)}`
  // la más vieja primero: la que lleva más tiempo esperando su acta (la fecha realizada o, sin ella, la programada; sin ninguna, al final)
  const instanteDe = (e: Registro) => texto(e, 'held_at') || texto(e, 'scheduled_at') || '9999'
  const actas: EntradaDeAtencion[] = (interacciones.data ?? [])
    .filter((e) => e.state === 'held' && TIPOS_FORMALES.includes(texto(e, 'engagement_type')))
    .sort((x, y) => instanteDe(x).localeCompare(instanteDe(y)))
    .map((e) => ({ clave: e.id, titulo: texto(e, 'title'), a: `${base}/engagements/${encodeURIComponent(e.id)}`, motivo: t('p360.resumen.motivos.acta') }))
  // primero quien nunca tuvo contacto y luego quien lleva más días sin él
  const sinContacto: EntradaDeAtencion[] = (grupos.data ?? [])
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
      motivo: dias === null ? t('p360.resumen.motivos.nuncaContactado') : t('p360.resumen.motivos.sinContacto', { count: dias })
    }))
  const evaluaciones: EntradaDeAtencion[] = (grupos.data ?? [])
    .flatMap((g) => {
      const dias = g.state === 'assessed' ? (diasEntre(atributo(g, 'last_assessment_date'), hoy) ?? 0) : 0
      return dias > revision ? [{ g, dias }] : []
    })
    .sort((x, y) => y.dias - x.dias)
    .map(({ g, dias }) => ({
      clave: `e-${g.id}`,
      titulo: <NombreDeGrupo grupo={g} />,
      a: aGrupo(g),
      motivo: t('p360.resumen.motivos.evaluacion', { count: dias })
    }))
  // las actas por redactar y las evaluaciones viejas no tienen una vista propia en sus listas: se despliegan aquí, sin «Ver los N»
  const tipos: { clave: string; entradas: EntradaDeAtencion[]; dias: number; verTodos?: string }[] = [
    { clave: 'actas', entradas: actas, dias: 0 },
    { clave: 'sinContacto', entradas: sinContacto, dias: inactividad, verTodos: `${base}/stakeholders?view=sinContacto` },
    { clave: 'evaluaciones', entradas: evaluaciones, dias: revision }
  ]
  const conAvisos = tipos.filter((g) => g.entradas.length > 0)
  const fuentes = [
    { clave: 'interacciones', consulta: interacciones },
    { clave: 'grupos', consulta: grupos }
  ]
  const cargando = fuentes.some((f) => f.consulta.isPending)
  const fallidas = fuentes.filter((f) => f.consulta.isError)
  const nada = conAvisos.length === 0 && !cargando && fallidas.length === 0
  return (
    <Panel titulo={t('p360.resumen.atencion')}>
      {conAvisos.map((g) => (
        <FilaDeAtencion
          key={g.clave}
          titulo={t(`p360.resumen.grupos.${g.clave}`, { dias: g.dias })}
          accion={t(`p360.resumen.acciones.${g.clave}`)}
          entradas={g.entradas}
          verTodos={g.verTodos}
        />
      ))}
      {cargando || fallidas.length > 0 || nada ? (
        <div className="space-y-2 px-5 py-3">
          {cargando ? <Cargando /> : null}
          {fallidas.map((f) => (
            <div key={f.clave} className="space-y-1 text-sm">
              <p className="font-medium">{t(`p360.resumen.fuentes.${f.clave}`)}</p>
              <FalloDeLectura error={f.consulta.error} alReintentar={() => void f.consulta.refetch()} />
            </div>
          ))}
          {nada ? <p className="text-sm text-sg-text-muted">{t('p360.resumen.sinAtencion')}</p> : null}
        </div>
      ) : null}
    </Panel>
  )
}

// una fila de «Qué requiere atención» (S05, filas de 52 px): la cifra en 22 px 800 a la izquierda, el tipo y su acción, que
// despliega cuáles son: tres a la vista y el resto a pedido o, si hay una lista filtrada, «Ver los N» hacia ella
const VISIBLES = 3
function FilaDeAtencion({ titulo, accion, entradas, verTodos }: { titulo: string; accion: string; entradas: EntradaDeAtencion[]; verTodos?: string }) {
  const { t } = useTranslation(NS)
  const id = useId()
  const [abierta, setAbierta] = useState(false)
  const [todas, setTodas] = useState(false)
  const n = entradas.length
  const visibles = todas ? entradas : entradas.slice(0, VISIBLES)
  return (
    <section aria-labelledby={`${id}-titulo`} className="border-b border-sg-border-subtle last:border-b-0">
      <div className="grid min-h-13 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2">
        <span aria-hidden className="text-right text-sg-kpi-sm text-sg-text tabular-nums">
          {numeroPe(n)}
        </span>
        <h3 id={`${id}-titulo`} className="text-sg-body font-normal text-sg-text">
          {titulo}
          <span className="sr-only">: {numeroPe(n)}</span>
        </h3>
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={`${id}-lista`}
          onClick={() => setAbierta((a) => !a)}
          className="inline-flex min-h-8 items-center gap-1 text-sg-body-sm font-bold text-sg-primary-text underline underline-offset-2"
        >
          {accion}
          <ChevronDown aria-hidden className={cn('size-4', abierta && 'rotate-180')} />
        </button>
      </div>
      <div id={`${id}-lista`} hidden={!abierta} className="space-y-2 pr-5 pb-3 pl-19">
        {abierta ? (
          <>
            <ul className="space-y-1.5">
              {visibles.map((e) => (
                <li key={e.clave}>
                  <EnlaceConRastro
                    to={e.a}
                    className="text-sg-body font-semibold text-sg-text no-underline hover:text-sg-primary-text hover:underline focus-visible:underline"
                  >
                    {e.titulo}
                  </EnlaceConRastro>
                  <p className="text-sg-caption text-sg-text-secondary">{e.motivo}</p>
                </li>
              ))}
            </ul>
            {n > VISIBLES ? (
              verTodos ? (
                <Link to={verTodos} className={ACCESO}>
                  {t('comun.verTodos', { count: n })}
                </Link>
              ) : (
                <button type="button" aria-expanded={todas} onClick={() => setTodas((x) => !x)} className={ACCESO}>
                  {todas ? t('comun.listaPriorizada.mostrarMenos') : t('comun.listaPriorizada.mostrarMas', { count: n - VISIBLES })}
                </button>
              )
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}

// el grupo de interés de un aviso, por su nombre: el motivo de la entrada dice qué le pasa
function NombreDeGrupo({ grupo }: { grupo: Registro }) {
  return <>{useNombreDelGrupo(grupo)}</>
}

function Actividad({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  return (
    <Panel titulo={t('p360.resumen.actividad')}>
      <div className="px-5 py-1">
        <Historia objeto="project" id={proyecto} limite={10} vacio={t('p360.resumen.sinActividad')} enColumnas />
      </div>
    </Panel>
  )
}

// un indicador del tablero: cargando, su fallo en una línea (el aviso único con «Reintentar» va en el tablero) o «No disponible»
// con su motivo; con datos, lo que pinta quien llama
function ConIndicador({ lectura, children }: { lectura: LecturaDeIndicador; children: (i: Indicador) => ReactNode }) {
  if (lectura.isPending) return <Cargando />
  if (lectura.isError) return <CifraFallida error={lectura.error} />
  if (!lectura.data.available) return <NoDisponible motivo={lectura.data.unavailableReason} />
  return <>{children(lectura.data)}</>
}

// el paisaje de S05: la postura apilada con sus cifras (KPI-STK-02) y los cuatro cuadrantes interés × poder con cuántos grupos hay
// en cada uno (KPI-STK-03), en el lugar que les da la matriz (S19): arriba lo de mucho poder. el grupo de cada punto es el que dice
// el servidor (influence_group, que puede estar ajustado a mano) o, sin él, el que sale de los umbrales que el servidor aplicó (un
// índice es alto desde su umbral, como InfluenceClassifier) y, si no llegan, de los del proyecto. la postura siempre se dibuja:
// sin permiso sobre stance (security.md §7.9) dice «No disponible» y por qué
const CUADRANTES = ['POLITICO', 'ESTRATEGICO', 'VULNERABLE', 'PARA MONITOREO'] as const
function Paisaje({
  base,
  posturas,
  matriz,
  umbralInteres,
  umbralPoder
}: {
  base: string
  posturas: LecturaDeIndicador
  matriz: LecturaDeIndicador
  umbralInteres: number
  umbralPoder: number
}) {
  const { t } = useTranslation(NS)
  const total = (i: Indicador) => (i.breakdowns?.find((d) => d.by === 'stance')?.rows ?? []).reduce((s, f) => s + (f.value ?? 0), 0)
  return (
    <Panel
      titulo={t('p360.resumen.paisaje')}
      acciones={
        <Link to={`${base}/stakeholders/matrix`} className={ACCESO}>
          <Table2 aria-hidden className="size-4" />
          {t('p360.resumen.verMatriz')}
        </Link>
      }
    >
      <div className="space-y-4 px-5 py-4">
        <div className="space-y-2">
          <h3 className="text-sg-body-sm font-semibold text-sg-text-secondary">
            {posturas.data?.available ? t('p360.resumen.posturasConTotal', { n: numeroPe(total(posturas.data)) }) : t('p360.resumen.posturas')}
          </h3>
          <ConIndicador lectura={posturas}>{(i) => <BarraDePosturas indicador={i} titulo={t('p360.resumen.posturas')} />}</ConIndicador>
        </div>
        <div className="space-y-1">
          <h3 className="sr-only">{t('p360.resumen.matriz')}</h3>
          <ConIndicador lectura={matriz}>{(i) => <Cuadrantes indicador={i} umbralInteres={umbralInteres} umbralPoder={umbralPoder} />}</ConIndicador>
        </div>
      </div>
    </Panel>
  )
}

function Cuadrantes({ indicador, umbralInteres, umbralPoder }: { indicador: Indicador; umbralInteres: number; umbralPoder: number }) {
  const { t } = useTranslation(NS)
  const umbral = (clave: string, delProyecto: number) => {
    const v = desglose(indicador, 'thresholds').find((f) => f.key === clave)?.value
    return typeof v === 'number' ? v : delProyecto
  }
  const interes = umbral('interest', umbralInteres)
  const poder = umbral('power', umbralPoder)
  const conteo: Record<string, number> = Object.fromEntries(CUADRANTES.map((c) => [c, 0]))
  for (const f of desglose(indicador, 'stakeholder')) {
    const dado = typeof f.influence_group === 'string' && f.influence_group in conteo ? f.influence_group : null
    if (dado) conteo[dado] += 1
    else if (typeof f.interest === 'number' && typeof f.power === 'number') {
      const altoInteres = f.interest >= interes
      const altoPoder = f.power >= poder
      conteo[altoInteres && altoPoder ? 'ESTRATEGICO' : altoPoder ? 'POLITICO' : altoInteres ? 'PARA MONITOREO' : 'VULNERABLE'] += 1
    }
  }
  const sinEvaluar = indicador.denominator != null ? indicador.denominator - (indicador.numerator ?? 0) : null
  return (
    <>
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
        <span aria-hidden className="rotate-180 text-center text-sg-caption text-sg-text-muted [writing-mode:vertical-rl]">
          {t('p360.resumen.ejePoder')}
        </span>
        <div className="space-y-1">
          <dl aria-label={t('p360.resumen.matriz')} className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-sg-md border border-sg-border bg-sg-border">
            {CUADRANTES.map((c) => (
              <div key={c} className="flex flex-col bg-sg-surface px-3 py-2.5">
                <dt className="text-sg-body-sm text-sg-text-secondary">{t(`grupos.matriz.cuadrantes.${c}`)}</dt>
                <dd className="text-sg-kpi-sm text-sg-text tabular-nums">{numeroPe(conteo[c])}</dd>
              </div>
            ))}
          </dl>
          <p aria-hidden className="text-center text-sg-caption text-sg-text-muted">
            {t('p360.resumen.ejeInteres')}
          </p>
        </div>
      </div>
      {sinEvaluar !== null ? <p className="text-sg-caption text-sg-text-muted">{t('p360.resumen.sinEvaluar', { n: numeroPe(sinEvaluar) })}</p> : null}
    </>
  )
}

// las reuniones de los últimos seis meses frente a su meta (KPI-ENG-02; S05): barras con su valor encima y la meta de cada mes
// como una línea discontinua (anotación directa, sin leyenda). un mes sin cifra dice «—», nunca 0. la lista de los meses en texto
// es la alternativa para lectores de pantalla
function Reuniones({ base, lectura, metaDelProyecto }: { base: string; lectura: LecturaDeIndicador; metaDelProyecto: number }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  return (
    <Panel
      titulo={t('p360.resumen.reuniones')}
      acciones={
        can('engagement', 'READ') ? (
          <Link to={`${base}/engagements/dashboard`} className={ACCESO}>
            <Table2 aria-hidden className="size-4" />
            {t('p360.resumen.verDatos')}
          </Link>
        ) : undefined
      }
    >
      <div className="px-5 py-4">
        <ConIndicador lectura={lectura}>
          {(i) =>
            !i.series?.length ? (
              <p className="text-sm text-sg-text-muted">{t('p360.resumen.sinReuniones')}</p>
            ) : (
              <BarrasFrenteAMeta meses={i.series.slice(-6).map((s) => ({ periodo: s.period, valor: s.value ?? null, meta: s.target ?? metaDelProyecto }))} />
            )
          }
        </ConIndicador>
      </div>
    </Panel>
  )
}

function BarrasFrenteAMeta({ meses }: { meses: { periodo: string; valor: number | null; meta: number }[] }) {
  const { t } = useTranslation(NS)
  const tope = Math.max(1, ...meses.map((m) => Math.max(m.valor ?? 0, m.meta)))
  // el alto en el área de las barras, con un respiro arriba para el valor
  const alto = (v: number) => `${(v / tope) * 85}%`
  const metaUnica = new Set(meses.map((m) => m.meta)).size === 1 ? meses[0].meta : null
  const mesCorto = (p: string) => periodoPe(p).replace(/\s*\d{4}$/, '')
  return (
    <figure className="space-y-1">
      <ul className="sr-only">
        {meses.map((m) => (
          <li key={m.periodo}>
            {t('p360.resumen.reunionesMes', { mes: periodoPe(m.periodo), valor: m.valor === null ? '—' : numeroPe(m.valor), meta: numeroPe(m.meta) })}
          </li>
        ))}
      </ul>
      {metaUnica !== null ? (
        <p aria-hidden className="text-right text-sg-caption font-bold text-sg-text">
          {t('p360.resumen.meta', { meta: numeroPe(metaUnica) })}
        </p>
      ) : null}
      <div aria-hidden className="flex h-32 items-end gap-3 border-b border-sg-border-strong">
        {meses.map((m) => (
          <div key={m.periodo} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="text-sg-caption font-bold text-sg-text tabular-nums">{m.valor === null ? '—' : numeroPe(m.valor)}</span>
            <span className="block w-full max-w-10 rounded-t-sg-xs bg-sg-data-1" style={{ height: alto(m.valor ?? 0) }} />
            <span className="absolute inset-x-0 border-t-2 border-dashed border-sg-text" style={{ bottom: alto(m.meta) }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-3">
        {meses.map((m, n) => (
          <span
            key={m.periodo}
            className={cn('min-w-0 flex-1 text-center text-sg-caption text-sg-text-secondary', n === meses.length - 1 && 'font-bold text-sg-text')}
          >
            {mesCorto(m.periodo)}
          </span>
        ))}
      </div>
    </figure>
  )
}

// las áreas de influencia del proyecto (S05): una tabla compacta con cada área en borrador o aprobada (la reemplazada ya no
// cuenta) y su estado, la etiqueta de territorio y «Abrir el mapa»; debajo, el mini mapa con el área de interés y las de
// influencia, cada capa con su estilo (mapa/estilos.ts y la paleta, no todas en primary). el mapa en blanco dice si está
// bloqueado, falló o no tiene geometrías
const ESTADOS_DE_AREA = ['draft', 'approved']
function Areas({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  const areas = useTodos('area_of_influence', { project: proyecto })
  const capas = useCapas(['LYR-09', 'LYR-13'], { project: proyecto })
  const avisoMapa = avisoDelMapa(capas, false)
  const base = `/projects/${encodeURIComponent(proyecto)}`
  const vigentes = (areas.data ?? []).filter((a) => ESTADOS_DE_AREA.includes(a.state ?? ''))
  return (
    <Panel
      nombre={t('p360.resumen.areas')}
      titulo={
        <span className="inline-flex flex-wrap items-center gap-3">
          {t('p360.resumen.areas')}
          <EtiquetaDeTerritorio />
        </span>
      }
      acciones={
        <Link to={`${base}/map`} className={ACCESO}>
          {t('p360.resumen.abrirMapa')}
        </Link>
      }
    >
      {areas.isPending ? (
        <div className="px-5 py-3">
          <Cargando />
        </div>
      ) : null}
      {areas.isError ? (
        <div className="px-5 py-3">
          <FalloDeLectura error={areas.error} alReintentar={() => void areas.refetch()} />
        </div>
      ) : null}
      {vigentes.length > 0 ? (
        <Table aria-label={t('p360.resumen.areas')}>
          <tbody>
            {vigentes.map((a) => (
              <tr key={a.id}>
                <Td className={cn(CELDA, 'w-full')}>
                  <EnlaceConRastro
                    to={`${base}/areas/${encodeURIComponent(a.id)}`}
                    className="font-semibold text-sg-text no-underline hover:text-sg-primary-text hover:underline focus-visible:underline"
                  >
                    {opcion(a, 'area_type')} · v{texto(a, 'version_number')}
                  </EnlaceConRastro>
                </Td>
                <Td className={cn(CELDA, 'text-right')}>
                  <EstadoChip objeto="area_of_influence" estado={a.state} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : areas.isSuccess ? (
        <p className="px-5 py-3 text-sm text-sg-text-muted">{t('p360.resumen.sinAreas')}</p>
      ) : null}
      <div className="space-y-2 border-t border-sg-border p-3">
        <Mapa
          etiqueta={t('mapa.mapaDelProyecto')}
          className="relative h-48 w-full overflow-hidden rounded-sg-md border border-sg-border"
          capas={capas
            .filter((c) => c.datos)
            .map((c) => ({ id: c.id, datos: c.datos!, color: capa(c.id)!.color, ...dibujoDe(c.id), seleccionable: false, miembros: capa(c.id)?.miembros }))}
        />
        {avisoMapa ? (
          <p role="status" className="text-sm text-sg-text-muted">
            {t(`mapa.avisos.${avisoMapa}`)}
          </p>
        ) : null}
      </div>
    </Panel>
  )
}
