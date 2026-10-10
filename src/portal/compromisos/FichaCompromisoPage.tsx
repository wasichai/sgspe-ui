import type { UseQueryResult } from '@tanstack/react-query'
import { Alert, Button, Tabs, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, Restringido } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { montoPe } from '../componentes/Monto'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { Rastro } from '../contexto/Rastro'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { atributo, texto, usePuedeEditar, useRegistro, useRegistros, useRelacionados, useTodos, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { PestanaDependencias, PestanaSeguimiento } from './PestanaSeguimiento'
import { Ejecutado, PestanaEntregas } from './PestanaEntregas'
import { PestanaReprogramaciones } from './PestanaReprogramaciones'
import { Verificacion } from './Verificacion'

// S29 · ficha de compromiso (screens.md §7, flujos 9 a 11): la anatomía de design-system.md §6.1 con las transiciones de WF-D del
// rol (las de envío, aprobación, cumplimiento, verificación y cierre se comprueban antes con transition-checks), las pestañas
// Resumen, Acciones e hitos, Entregas, Reprogramaciones, Dependencias, Evidencias y Actividad, la verificación cuando está
// cumplido (S32) y la trazabilidad: de dónde viene (interacción, cláusula, candidato) y qué generó (tareas, entregas). desde
// la aprobación la fecha de vencimiento no se edita: solo se reprograma (DUE_DATE_RESCHEDULE_ONLY). toda escritura lleva motivo
const EDITABLES_SIEMPRE = [
  'title',
  'description',
  'objective',
  'resource_type',
  'quantity',
  'unit',
  'execution_time',
  'commitment_theme',
  'formality',
  'request_medium',
  'agreed_date',
  'amount',
  'currency',
  'priority',
  'owner_user_id',
  'owner_user_email',
  'verifier_user_id',
  'verifier_user_email',
  'beneficiaries_count',
  'beneficiaries_female_count',
  'beneficiaries_male_count',
  'beneficiaries_detail',
  'origin_justification'
]
const ANTES_DE_APROBAR = ['draft', 'pending_approval']
const COMPROBAR = ['submit', 'approve', 'approve_senior', 'approve_direct', 'register_fulfillment', 'verify', 'close']

export function FichaCompromisoPage() {
  const { t } = useTranslation(NS)
  const { projectId = '', commitmentId = '' } = useParams()
  const compromiso = useRegistro('commitment', commitmentId)
  // un compromiso que no existe (404) lo dice con su texto y lleva a la lista, sin un «Reintentar» que no sirve
  const noExiste = (
    <div className="space-y-3">
      <Alert tone="warning">{t('fichaCompromiso.noExiste')}</Alert>
      <Link to={`/projects/${encodeURIComponent(projectId)}/commitments`} className="text-sm text-sg-primary-text underline">
        {t('fichaCompromiso.volver')}
      </Link>
    </div>
  )
  // la ficha se monta de nuevo por compromiso (P63): pasar a otro ya leído no arrastra el drawer, el motivo ni la pestaña
  return (
    <Consulta consulta={compromiso} noExiste={noExiste}>
      {(c) => <Ficha key={c.id} compromiso={c} />}
    </Consulta>
  )
}

function Ficha({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(compromiso, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const edita = usePuedeEditar('commitment') && escribe
  const [editando, setEditando] = useState<'todo' | 'riesgo' | null>(null)
  const [motivo, setMotivo] = useState('')
  const antesDeAprobar = ANTES_DE_APROBAR.includes(compromiso.state ?? '')
  const campos = editando === 'riesgo' ? ['delay_risk_reported', 'delay_risk_note'] : antesDeAprobar ? [...EDITABLES_SIEMPRE, 'due_date'] : EDITABLES_SIEMPRE
  const cerrar = () => {
    setEditando(null)
    setMotivo('')
  }
  return (
    <article className="space-y-4">
      <Rastro />
      <Link to={`/projects/${encodeURIComponent(proyecto)}/commitments`} className="text-sm text-sg-primary-text underline">
        {t('fichaCompromiso.volver')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sg-overline font-semibold uppercase text-sg-text-muted">
            {texto(compromiso, 'code')} · {texto(compromiso, 'resource_type') || '—'}
          </p>
          <h1 className="text-sg-h1 font-semibold">{texto(compromiso, 'title')}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <EstadoChip objeto="commitment" estado={compromiso.state} />
            <SituacionDePlazo valor={atributo(compromiso, 'deadline_status')} />
            {texto(compromiso, 'due_date') ? <span>{diaPe(texto(compromiso, 'due_date'))}</span> : null}
            <span className="tabular-nums">{montoPe(atributo(compromiso, 'amount'), atributo(compromiso, 'currency'))}</span>
          </div>
          {atributo(compromiso, 'delay_risk_reported') === true ? <Alert tone="warning">{t('fichaCompromiso.riesgoInformado')}</Alert> : null}
        </div>
        <div className="space-y-2">
          {edita ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditando('todo')}>
                {t('fichaCompromiso.editar')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditando('riesgo')}>
                {t('fichaCompromiso.riesgo')}
              </Button>
            </div>
          ) : null}
          <BotonesDeTransicion objeto="commitment" registro={compromiso} proyecto={proyecto} comprobarAntes={COMPROBAR} />
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Tabs
          label={texto(compromiso, 'title')}
          tabs={[
            { id: 'resumen', label: t('fichaCompromiso.pestanas.resumen'), render: () => <Resumen compromiso={compromiso} /> },
            {
              id: 'seguimiento',
              label: t('fichaCompromiso.pestanas.seguimiento'),
              render: () => <PestanaSeguimiento compromiso={compromiso} escribe={escribe} />
            },
            { id: 'entregas', label: t('fichaCompromiso.pestanas.entregas'), render: () => <PestanaEntregas compromiso={compromiso} escribe={escribe} /> },
            {
              id: 'reprogramaciones',
              label: t('fichaCompromiso.pestanas.reprogramaciones'),
              render: () => <PestanaReprogramaciones compromiso={compromiso} escribe={escribe} />
            },
            {
              id: 'dependencias',
              label: t('fichaCompromiso.pestanas.dependencias'),
              render: () => <PestanaDependencias compromiso={compromiso} escribe={escribe} />
            },
            {
              id: 'evidencias',
              label: t('fichaCompromiso.pestanas.evidencias'),
              render: () => <EvidenciasDelRegistro objeto="commitment" registro={compromiso} escribe={escribe} />
            },
            {
              id: 'actividad',
              label: t('fichaCompromiso.pestanas.actividad'),
              render: () => (
                <div className="pt-3">
                  <Historia objeto="commitment" id={compromiso.id} vacio={t('fichaCompromiso.sinActividad')} />
                </div>
              )
            }
          ]}
        />
        <div className="space-y-4">
          {compromiso.state === 'fulfilled' ? <Verificacion compromiso={compromiso} /> : null}
          <Trazabilidad compromiso={compromiso} />
        </div>
      </div>
      <Drawer
        titulo={editando === 'riesgo' ? t('fichaCompromiso.riesgoTitulo') : t('fichaCompromiso.editarTitulo')}
        descripcion={antesDeAprobar || editando === 'riesgo' ? undefined : t('fichaCompromiso.fechaSoloReprogramando')}
        abierto={editando !== null}
        alCerrar={cerrar}
      >
        <Campo etiqueta={t('fichaCompromiso.motivo')} ayuda={t('fichaCompromiso.motivoAyuda')}>
          {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
        </Campo>
        {editando ? (
          <FormularioDeRegistro
            key={editando}
            objeto="commitment"
            registro={compromiso}
            campos={campos}
            motivo={motivo.trim() || undefined}
            alGuardar={cerrar}
            alCancelar={cerrar}
          />
        ) : null}
      </Drawer>
    </article>
  )
}

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sg-caption text-sg-text-muted">{termino}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Resumen({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const solicitantes = useRelacionados('commitment', compromiso.id, 'commitment_stakeholder')
  const proyecto = texto(compromiso, 'project')
  const valor = (campo: string) => texto(compromiso, campo) || '—'
  const dia = (campo: string) => (texto(compromiso, campo) ? diaPe(texto(compromiso, campo)) : '—')
  const n = (campo: string) =>
    atributo(compromiso, campo) === null || atributo(compromiso, campo) === undefined ? '—' : numeroPe(Number(atributo(compromiso, campo)))
  return (
    <div className="space-y-4 pt-3 text-sm">
      <Ejecutado compromiso={compromiso} />
      <dl className="grid gap-3 sm:grid-cols-2">
        <Dato termino={t('fichaCompromiso.campos.description')}>{valor('description')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.objective')}>{valor('objective')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.resource_type')}>{valor('resource_type')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.cantidad')}>
          {n('quantity')} {texto(compromiso, 'unit')}
        </Dato>
        <Dato termino={t('fichaCompromiso.campos.execution_time')}>{valor('execution_time')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.commitment_theme')}>{valor('commitment_theme')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.formality')}>{valor('formality')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.request_medium')}>{valor('request_medium')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.agreed_date')}>{dia('agreed_date')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.due_date')}>{dia('due_date')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.priority')}>{valor('priority')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.owner')}>{valor('owner_user_email')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.verifier')}>{valor('verifier_user_email')}</Dato>
        <Dato termino={t('fichaCompromiso.campos.beneficiarios')}>
          {t('fichaCompromiso.beneficiariosConteo', {
            total: n('beneficiaries_count'),
            mujeres: n('beneficiaries_female_count'),
            varones: n('beneficiaries_male_count')
          })}
        </Dato>
        <Dato termino={t('fichaCompromiso.campos.beneficiariosDetalle')}>
          {'beneficiaries_detail' in compromiso.attributes ? valor('beneficiaries_detail') : <Restringido />}
        </Dato>
        {texto(compromiso, 'origin_justification') ? (
          <Dato termino={t('fichaCompromiso.campos.origin_justification')}>{valor('origin_justification')}</Dato>
        ) : null}
        {texto(compromiso, 'fulfilled_date') ? <Dato termino={t('fichaCompromiso.campos.fulfilled_date')}>{dia('fulfilled_date')}</Dato> : null}
        {texto(compromiso, 'closed_date') ? <Dato termino={t('fichaCompromiso.campos.closed_date')}>{dia('closed_date')}</Dato> : null}
      </dl>
      <section aria-label={t('fichaCompromiso.solicitantes')} className="space-y-1">
        <h2 className="font-semibold">{t('fichaCompromiso.solicitantes')}</h2>
        {solicitantes.isPending ? (
          <Cargando compacto />
        ) : solicitantes.isError && !solicitantes.data ? (
          <FalloDeLectura error={solicitantes.error} alReintentar={() => void solicitantes.refetch()} />
        ) : solicitantes.data.content.length === 0 ? (
          <p className="text-sg-warning">{t('fichaCompromiso.sinSolicitantes')}</p>
        ) : (
          <ul>
            {solicitantes.data.content.map((g) => (
              <li key={g.id}>
                <Link to={`/projects/${encodeURIComponent(proyecto)}/stakeholders/${encodeURIComponent(g.id)}`} className="text-sg-primary-text underline">
                  <NombreDelGrupo grupo={g} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// el panel de trazabilidad (ux-architecture.md §8): de dónde viene el compromiso y qué generó, sin salir del proyecto
function Trazabilidad({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(compromiso, 'project')
  const interaccion = useRegistro('engagement', atributo<string>(compromiso, 'origin_engagement'))
  const acuerdo = useRegistro('agreement', atributo<string>(compromiso, 'agreement'))
  const clausula = useRegistro('agreement_clause', atributo<string>(compromiso, 'agreement_clause'))
  const candidatos = useRegistros('commitment_candidate', { created_commitment: compromiso.id, size: 5 })
  const tareas = useTodos('task', { commitment: compromiso.id })
  const entregas = useRegistros('delivery', { commitment: compromiso.id, size: 1 })
  const candidato = candidatos.data?.content[0]
  // desde F4 un compromiso nace también de una queja (origin_grievance) o atiende un riesgo (social_risk): una queja confidencial que
  // quien mira no lee se dice «Registro reservado» (RegistroVinculado)
  const queja = atributo<string>(compromiso, 'origin_grievance')
  const riesgo = atributo<string>(compromiso, 'social_risk')
  const sinOrigen = !atributo(compromiso, 'origin_engagement') && !atributo(compromiso, 'agreement') && !queja && candidatos.isSuccess && !candidato
  return (
    <aside className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <section aria-label={t('fichaCompromiso.trazabilidad.deDondeViene')} className="space-y-1">
        <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('fichaCompromiso.trazabilidad.deDondeViene')}</h2>
        {interaccion.data ? (
          <p>
            {t('fichaCompromiso.trazabilidad.interaccion')}:{' '}
            <Link
              to={`/projects/${encodeURIComponent(proyecto)}/engagements/${encodeURIComponent(interaccion.data.id)}`}
              className="text-sg-primary-text underline"
            >
              {texto(interaccion.data, 'title')}
            </Link>
          </p>
        ) : null}
        {acuerdo.data ? (
          <p>
            {t('fichaCompromiso.trazabilidad.acuerdo')}:{' '}
            <Link to={`/projects/${encodeURIComponent(proyecto)}/agreements/${encodeURIComponent(acuerdo.data.id)}`} className="text-sg-primary-text underline">
              {texto(acuerdo.data, 'code')} · {texto(acuerdo.data, 'title')}
            </Link>
            {clausula.data ? ` · ${t('fichaCompromiso.trazabilidad.clausula', { numero: texto(clausula.data, 'clause_number') })}` : ''}
          </p>
        ) : null}
        {candidato ? (
          <p>
            {t('fichaCompromiso.trazabilidad.candidato')}: {texto(candidato, 'proposed_text')}
          </p>
        ) : null}
        {queja ? (
          <p>
            {t('fichaCompromiso.trazabilidad.queja')}: <RegistroVinculado objeto="grievance" id={queja} />
          </p>
        ) : null}
        {riesgo ? (
          <p>
            {t('fichaCompromiso.trazabilidad.riesgo')}: <RegistroVinculado objeto="social_risk" id={riesgo} />
          </p>
        ) : null}
        <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.interaccion')} consulta={interaccion} />
        <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.acuerdo')} consulta={acuerdo} />
        <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.clausulaSinNumero')} consulta={clausula} />
        <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.candidato')} consulta={candidatos} />
        {sinOrigen ? <p className="text-sg-text-muted">{t('fichaCompromiso.trazabilidad.sinOrigen')}</p> : null}
      </section>
      <section aria-label={t('fichaCompromiso.trazabilidad.queGenero')} className="space-y-1">
        <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('fichaCompromiso.trazabilidad.queGenero')}</h2>
        <h3 className="font-medium">{t('fichaCompromiso.trazabilidad.tareas')}</h3>
        {tareas.isPending ? (
          <Cargando compacto />
        ) : tareas.isError && !tareas.data ? (
          <FalloDeLectura error={tareas.error} alReintentar={() => void tareas.refetch()} />
        ) : tareas.data.length === 0 ? (
          <p className="text-sg-text-muted">{t('fichaCompromiso.trazabilidad.sinTareas')}</p>
        ) : (
          <ul>
            {tareas.data.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2">
                <Link to={`/projects/${encodeURIComponent(proyecto)}/tasks?task=${encodeURIComponent(x.id)}`} className="text-sg-primary-text underline">
                  {texto(x, 'title')}
                </Link>
                <EstadoChip objeto="task" estado={x.state} />
              </li>
            ))}
          </ul>
        )}
        {entregas.data ? (
          <p>{t('fichaCompromiso.trazabilidad.entregas', { n: numeroPe(entregas.data.totalElements ?? entregas.data.content.length) })}</p>
        ) : null}
        <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.entregasSinNumero')} consulta={entregas} />
      </section>
    </aside>
  )
}

// una lectura de la trazabilidad que falló lo dice junto a lo que no se pudo leer: una línea que falta sin explicación haría
// creer que no hay origen o que no se generó nada
function FalloDe({ etiqueta, consulta }: { etiqueta: string; consulta: UseQueryResult<unknown> }) {
  if (!consulta.isError || consulta.data !== undefined) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span>{etiqueta}:</span>
      <FalloDeLectura error={consulta.error} alReintentar={() => void consulta.refetch()} />
    </div>
  )
}
