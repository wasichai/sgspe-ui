import { useMigaDelRegistro } from '../componentes/Migas'
import { CabeceraDeFicha } from '../componentes/CabeceraDeFicha'
import { CamposPlegables } from '../componentes/CamposPlegables'
import { Seccion } from '../componentes/Seccion'
import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { Cargando, Consulta, NoDisponible, Restringido, NoEsDeSusProyectos } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { useActorDelGrupo, useNombreDelGrupo } from '../componentes/NombreDeActor'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useSiguientePaso } from '../contexto/Rastro'
import { hoyEnLima } from '../datos/fechas'
import {
  atributo,
  puedeEscribir,
  puedeLeer,
  texto,
  useDefinicion,
  usePuedeEditar,
  useRegistro,
  useRelacionados,
  useTodos,
  type Registro
} from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import type { Advertencia } from './api'
import { Advertencias } from './Advertencias'
import { EvaluacionDrawer } from './EvaluacionDrawer'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'
import { useRegistrosPorId } from '../territorio/comunes'
import { Persona } from '../componentes/Persona'

// S17 · ficha de grupo de interés (screens.md §5): para decidir cómo relacionarse, su peso, su postura (restringida), su
// historia de evaluaciones hasta la línea base y lo que generó. la postura y la confianza del grupo de interés son las
// vigentes: el último valor informado, aunque la última evaluación no las traiga (ASM-087). "Nueva evaluación" abre S20 en
// ?drawer=assessment y solo se ofrece a quien puede escribir la postura de una evaluación (GAP-024)
const CAMPOS_DEL_PERFIL = [
  'stakeholder_type',
  'stakeholder_scope',
  'inclusion_reason',
  'interview_status',
  'relationship_status',
  'owner_user_id',
  'owner_user_email',
  'profile_summary',
  'locality',
  'area_of_influence'
] as const

// el día de Lima de una marca de tiempo (una interacción de las 22:00 de Lima es del día siguiente en UTC)
const diaEnLima = (marca: string): string => {
  const instante = new Date(marca)
  return Number.isNaN(instante.getTime()) ? '' : hoyEnLima(instante)
}

// un índice de la evaluación: sin valor, «—», nunca NaN (D5 de la revisión de UX)
const indice = (valor: unknown): string =>
  valor === null || valor === undefined || valor === '' || Number.isNaN(Number(valor)) ? '—' : numeroPe(Number(valor))

export function FichaGrupoPage() {
  const { stakeholderId = '' } = useParams()
  const grupo = useRegistro('stakeholder', stakeholderId)
  // un 404 es un registro que no existe o que no es de sus proyectos (alcance por proyecto, spec 4.4 §3.6): no se distingue
  return (
    <Consulta consulta={grupo} noExiste={<NoEsDeSusProyectos />}>
      {(g) => <Ficha grupo={g} />}
    </Consulta>
  )
}

function Ficha({ grupo }: { grupo: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = String(atributo(grupo, 'project'))
  const escribeEnElProyecto = useEscribeEnProyecto(proyecto)
  const nombre = useNombreDelGrupo(grupo)
  const actor = useActorDelGrupo(grupo)
  const definicion = useDefinicion('stakeholder')
  // el agente de campo tiene "u" sobre stakeholder: vincula su captura, pero no edita el perfil
  const puedeEditar = usePuedeEditar('stakeholder')
  const editaPerfil = escribeEnElProyecto && puedeEditar
  const definicionDeEvaluacion = useDefinicion('stakeholder_assessment')
  // el historial exige READ sobre stakeholder_assessment: sin él no se pide y la sección dice que no está disponible
  const leeEvaluaciones = can('stakeholder_assessment', 'READ')
  const evaluaciones = useTodos('stakeholder_assessment', { stakeholder: grupo.id, sort: 'assessment_date', dir: 'desc' }, leeEvaluaciones)
  const [busqueda, fijar] = useSearchParams()
  const [advertencias, setAdvertencias] = useState<Advertencia[]>([])
  const [editando, setEditando] = useState(false)
  const paso = useSiguientePaso()
  const ultima = evaluaciones.data?.[0]
  const leePostura = puedeLeer(definicion.data, 'stance')
  const leePosturaDeEvaluacion = puedeLeer(definicionDeEvaluacion.data, 'stance')
  // el grupo de interés está evaluado si pasó por la evaluación o si ya tiene grupo de influencia (como la lista, S16)
  const evaluado = grupo.state === 'assessed' || Boolean(atributo(grupo, 'influence_group'))
  const puedeEvaluar = escribeEnElProyecto && can('stakeholder_assessment', 'CREATE') && puedeEscribir(definicionDeEvaluacion.data, 'stance')
  // un grupo retirado no se ofrece a evaluar; el drawer abierto sigue a la vista (con su aviso) si el servidor lo retiró mientras tanto
  const evalua = puedeEvaluar && grupo.state !== 'retired'
  const drawer = (abrir: boolean) => {
    const siguiente = new URLSearchParams(busqueda)
    if (abrir) siguiente.set('drawer', 'assessment')
    else siguiente.delete('drawer')
    fijar(siguiente)
  }

  // el nombre del grupo en las migas del proyecto (revisión de UX, etapa 4)
  useMigaDelRegistro(nombre)
  return (
    <article className="space-y-4">
      <CabeceraDeFicha
        antetitulo={[t('grupos.ficha.tipo'), opcion(grupo, 'stakeholder_type')].filter(Boolean).join(' · ')}
        titulo={nombre}
        chips={
          actor.id ? (
            <Link
              to={`/actors/${encodeURIComponent(actor.id)}?project=${encodeURIComponent(proyecto)}`}
              state={paso(nombre)}
              className="text-sg-primary-text underline"
            >
              {t('grupos.ficha.actor')}
            </Link>
          ) : undefined
        }
        objeto="stakeholder"
        registro={grupo}
        proyecto={proyecto}
        primariaPropia={
          escribeEnElProyecto && can('engagement', 'CREATE') ? (
            <Button asChild size="sm">
              <Link to={`/projects/${encodeURIComponent(proyecto)}/engagements/new?stakeholders=${encodeURIComponent(grupo.id)}`}>
                {t('grupos.ficha.registrar')}
              </Link>
            </Button>
          ) : undefined
        }
        secundarias={
          evalua
            ? [
                {
                  clave: 'evaluar',
                  nodo: (
                    <Button size="sm" variant="secondary" onClick={() => drawer(true)}>
                      {t('grupos.ficha.evaluar')}
                    </Button>
                  )
                }
              ]
            : []
        }
      />
      <Advertencias advertencias={advertencias} />
      {/* S17 no tiene panel de decisión: «Para decidir» hace sus veces y es el único lugar del estado (U-25) */}
      <section aria-label={t('grupos.ficha.paraDecidir')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Tarjeta titulo={t('grupos.ficha.estado')}>
          <EstadoChip objeto="stakeholder" estado={grupo.state} />
        </Tarjeta>
        <Tarjeta titulo={t('grupos.ficha.influencia')}>
          {evaluado ? (
            <>
              <p className="font-semibold">{opcion(grupo, 'influence_group')}</p>
              <p className="text-sg-caption">
                {t('grupos.ficha.indices', {
                  interes: indice(atributo(grupo, 'interest_index')),
                  poder: indice(atributo(grupo, 'power_index'))
                })}
              </p>
            </>
          ) : (
            <p className="text-sm text-sg-text-muted">{t('grupos.ficha.sinEvaluar')}</p>
          )}
        </Tarjeta>
        <Tarjeta titulo={t('grupos.ficha.postura')} ayuda={t('grupos.ficha.vigenteAyuda')}>
          {definicion.isPending ? (
            <Cargando compacto />
          ) : definicion.isError && !definicion.data ? (
            <FalloDeLectura error={definicion.error} alReintentar={() => void definicion.refetch()} />
          ) : leePostura ? (
            <>
              <p className="font-semibold">{opcion(grupo, 'stance') || '—'}</p>
              {ultima && atributo(ultima, 'stance_changed') ? <p className="text-sg-caption text-sg-warning">{t('grupos.ficha.cambio')}</p> : null}
            </>
          ) : (
            <Restringido />
          )}
        </Tarjeta>
        <Tarjeta titulo={t('grupos.ficha.confianza')} ayuda={t('grupos.ficha.vigenteAyuda')}>
          <p className="font-semibold">
            {atributo(grupo, 'trust_score') === null || atributo(grupo, 'trust_score') === undefined
              ? '—'
              : t('grupos.ficha.confianzaValor', { n: Number(atributo(grupo, 'trust_score')) })}
          </p>
        </Tarjeta>
        <Tarjeta titulo={t('grupos.ficha.pendientes')}>
          <Pendientes grupo={grupo} />
        </Tarjeta>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {ultima && definicionDeEvaluacion.data ? (
            <section
              aria-label={t('grupos.ficha.preocupaciones')}
              className="grid gap-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm sm:grid-cols-2"
            >
              {(['concerns', 'expectations'] as const).map((c) => (
                <div key={c}>
                  <h3 className="font-medium">{t(c === 'concerns' ? 'grupos.ficha.preocupaciones' : 'grupos.ficha.expectativas')}</h3>
                  {puedeLeer(definicionDeEvaluacion.data, c) ? <p>{texto(ultima, c) || '—'}</p> : <Restringido />}
                </div>
              ))}
            </section>
          ) : null}
          <section aria-label={t('grupos.ficha.evaluaciones')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
            <h2 className="font-medium">{t('grupos.ficha.evaluaciones')}</h2>
            {!leeEvaluaciones ? <NoDisponible motivo="OBJECT_NOT_READABLE" /> : null}
            {leeEvaluaciones && evaluaciones.isPending ? <Cargando compacto /> : null}
            {leeEvaluaciones && evaluaciones.isError && !evaluaciones.data ? (
              <FalloDeLectura error={evaluaciones.error} alReintentar={() => void evaluaciones.refetch()} />
            ) : null}
            {evaluaciones.data?.length === 0 ? <p className="text-sm text-sg-text-muted">{t('grupos.ficha.sinEvaluar')}</p> : null}
            <ol className="space-y-2 text-sm">
              {(evaluaciones.data ?? []).map((e, i, todas) => (
                <li key={e.id} className="border-l-2 border-sg-border pl-3">
                  <p className="font-medium">
                    {diaPe(texto(e, 'assessment_date'))} · {opcion(e, 'basis')}
                    {i === todas.length - 1 ? <span className="ml-1 text-sg-caption text-sg-text-muted">({t('grupos.ficha.lineaBase')})</span> : null}
                  </p>
                  <p>
                    {opcion(e, 'influence_group')} ·{' '}
                    {t('grupos.ficha.indices', {
                      interes: indice(atributo(e, 'interest_index')),
                      poder: indice(atributo(e, 'power_index'))
                    })}
                    {atributo(e, 'group_overridden') ? <span className="ml-1 text-sg-caption">({t('grupos.ficha.ajustado')})</span> : null}
                  </p>
                  {definicionDeEvaluacion.data ? (
                    leePosturaDeEvaluacion ? (
                      <p className="text-sg-text-secondary">{opcion(e, 'stance') || '—'}</p>
                    ) : (
                      <Restringido />
                    )
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
          <Seccion
            titulo={t('grupos.ficha.perfil')}
            acciones={
              editaPerfil ? (
                <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                  {t('grupos.ficha.editarPerfil')}
                </Button>
              ) : undefined
            }
          >
            <CamposPlegables
              campos={[
                { clave: 'inclusion_reason', termino: t('grupos.ficha.campos.inclusion_reason'), valor: texto(grupo, 'inclusion_reason'), ancho: true },
                { clave: 'profile_summary', termino: t('grupos.ficha.campos.profile_summary'), valor: texto(grupo, 'profile_summary'), ancho: true },
                { clave: 'stakeholder_scope', termino: t('grupos.ficha.campos.stakeholder_scope'), valor: opcion(grupo, 'stakeholder_scope') },
                {
                  clave: 'owner',
                  termino: t('grupos.ficha.campos.owner'),
                  valor: texto(grupo, 'owner_user_email') ? <Persona correo={texto(grupo, 'owner_user_email')} /> : null
                },
                { clave: 'interview_status', termino: t('grupos.ficha.campos.interview_status'), valor: opcion(grupo, 'interview_status') },
                { clave: 'relationship_status', termino: t('grupos.ficha.campos.relationship_status'), valor: opcion(grupo, 'relationship_status') },
                { clave: 'information_priority', termino: t('grupos.ficha.campos.information_priority'), valor: opcion(grupo, 'information_priority') },
                {
                  clave: 'last_contact_date',
                  termino: t('grupos.ficha.campos.last_contact_date'),
                  valor: texto(grupo, 'last_contact_date') ? <Dia valor={texto(grupo, 'last_contact_date')} /> : null
                }
              ]}
            />
          </Seccion>
        </div>
        <Trazabilidad grupo={grupo} />
      </div>
      <EvaluacionDrawer
        grupo={grupo}
        anterior={ultima}
        abierto={busqueda.get('drawer') === 'assessment' && puedeEvaluar}
        alCerrar={() => drawer(false)}
        alGuardar={(r) => {
          setAdvertencias(r.warnings)
          drawer(false)
        }}
      />
      <Drawer titulo={t('grupos.ficha.editarPerfil')} abierto={editando} alCerrar={() => setEditando(false)}>
        <FormularioDeRegistro
          objeto="stakeholder"
          registro={grupo}
          campos={CAMPOS_DEL_PERFIL}
          alGuardar={() => setEditando(false)}
          alCancelar={() => setEditando(false)}
        />
      </Drawer>
    </article>
  )
}

function Tarjeta({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted" title={ayuda}>
        {titulo}
      </h3>
      {children}
    </div>
  )
}

// los compromisos que el grupo de interés pidió (commitment_stakeholder); sin permiso sobre commitment no se piden
function useCompromisosDelGrupo(grupo: Registro) {
  const { can } = useAuth()
  return useRelacionados('stakeholder', can('commitment', 'READ') ? grupo.id : undefined, 'commitment_stakeholder')
}

const COMPROMISO_ABIERTO = new Set(['pending_approval', 'approved', 'in_progress', 'blocked'])
const QCS_TERMINADA = new Set(['closed', 'rejected', 'withdrawn'])

// lo que el grupo de interés tiene abierto: sus compromisos y sus QCS (quejas, consultas y solicitudes con su stakeholder). lo
// que la cuenta no lee no se cuenta ni se dice como cero
function Pendientes({ grupo }: { grupo: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const compromisos = useCompromisosDelGrupo(grupo)
  // la lectura por relación no trae el estado del workflow: cada compromiso se relee con el suyo
  const conEstado = useRegistrosPorId(
    'commitment',
    (compromisos.data?.content ?? []).map((c) => c.id)
  )
  const quejas = useTodos('grievance', { stakeholder: grupo.id }, can('grievance', 'READ'))
  const consultas = useTodos('inquiry', { stakeholder: grupo.id }, can('inquiry', 'READ'))
  const solicitudes = useTodos('stakeholder_request', { stakeholder: grupo.id }, can('stakeholder_request', 'READ'))
  const leeCompromisos = can('commitment', 'READ')
  const deQcs = [
    { lee: can('grievance', 'READ'), consulta: quejas },
    { lee: can('inquiry', 'READ'), consulta: consultas },
    { lee: can('stakeholder_request', 'READ'), consulta: solicitudes }
  ].filter((q) => q.lee)
  if (!leeCompromisos && deQcs.length === 0) return <NoDisponible />
  const qcsCargando = deQcs.some((q) => q.consulta.isPending)
  const qcsFallo = deQcs.some((q) => q.consulta.isError)
  const qcsAbiertas = deQcs.reduce((n, q) => n + (q.consulta.data ?? []).filter((r) => !QCS_TERMINADA.has(r.state ?? '')).length, 0)
  // cada cifra lleva a su lista con el grupo puesto como filtro (design P8; revisión de UX, etapa 6)
  const base = `/projects/${encodeURIComponent(String(atributo(grupo, 'project')))}`
  const cifra = (ruta: string, texto: string) => (
    <Link to={ruta} className="text-sg-primary-text underline">
      {texto}
    </Link>
  )
  return (
    <ul className="space-y-1 text-sm">
      {leeCompromisos ? (
        <li>
          {compromisos.isPending || conEstado.pendiente ? (
            <Cargando compacto />
          ) : compromisos.isError || conEstado.error ? (
            t('comun.errorDeCarga')
          ) : (
            cifra(
              `${base}/commitments?stakeholder=${encodeURIComponent(grupo.id)}`,
              t('grupos.ficha.compromisosAbiertos', { count: conEstado.registros.filter((c) => COMPROMISO_ABIERTO.has(c.state ?? '')).length })
            )
          )}
        </li>
      ) : null}
      {deQcs.length > 0 ? (
        <li>
          {qcsCargando ? (
            <Cargando compacto />
          ) : qcsFallo ? (
            t('comun.errorDeCarga')
          ) : (
            cifra(`${base}/attention?stakeholder=${encodeURIComponent(grupo.id)}`, t('grupos.ficha.qcsAbiertas', { count: qcsAbiertas }))
          )}
        </li>
      ) : null}
    </ul>
  )
}

// "Qué generó" (ux-architecture.md §8.2): las interacciones del grupo de interés (engagement_stakeholder) y los compromisos que
// pidió (commitment_stakeholder)
function Trazabilidad({ grupo }: { grupo: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const interacciones = useRelacionados('stakeholder', grupo.id, 'engagement_stakeholder')
  const paso = useSiguientePaso()
  const compromisos = useCompromisosDelGrupo(grupo)
  const proyecto = String(atributo(grupo, 'project'))
  const dia = (e: Registro) => diaEnLima(texto(e, 'held_at') || texto(e, 'scheduled_at'))
  return (
    <aside aria-label={t('grupos.ficha.trazabilidad')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('grupos.ficha.trazabilidad')}</h2>
      <h3 className="font-medium">{t('grupos.ficha.interacciones')}</h3>
      {interacciones.isPending ? <Cargando compacto /> : null}
      {interacciones.isError && !interacciones.data ? <FalloDeLectura error={interacciones.error} alReintentar={() => void interacciones.refetch()} /> : null}
      {interacciones.data?.content.length === 0 ? <p className="text-sg-text-muted">{t('grupos.ficha.sinInteracciones')}</p> : null}
      <ul>
        {(interacciones.data?.content ?? []).map((e) => (
          <li key={e.id}>
            <Link
              to={`/projects/${encodeURIComponent(proyecto)}/engagements/${encodeURIComponent(e.id)}`}
              state={paso()}
              className="text-sg-primary-text underline"
            >
              {texto(e, 'title')}
            </Link>
            {dia(e) ? (
              <>
                {' · '}
                <Dia valor={dia(e)} />
              </>
            ) : null}
          </li>
        ))}
      </ul>
      {can('commitment', 'READ') ? (
        <>
          <h3 className="font-medium">{t('grupos.ficha.compromisos')}</h3>
          {compromisos.isPending ? <Cargando compacto /> : null}
          {compromisos.isError && !compromisos.data ? <FalloDeLectura error={compromisos.error} alReintentar={() => void compromisos.refetch()} /> : null}
          {compromisos.data?.content.length === 0 ? <p className="text-sg-text-muted">{t('grupos.ficha.sinCompromisos')}</p> : null}
          <ul>
            {(compromisos.data?.content ?? []).map((c) => (
              <li key={c.id}>
                <Link
                  to={`/projects/${encodeURIComponent(proyecto)}/commitments/${encodeURIComponent(c.id)}`}
                  state={paso()}
                  className="text-sg-primary-text underline"
                >
                  {[texto(c, 'code'), texto(c, 'title')].filter(Boolean).join(' · ')}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  )
}
