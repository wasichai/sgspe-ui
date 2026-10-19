import { useAuth } from '@wasichai/core'
import { Alert, Button, Tabs } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta } from '../componentes/Estados'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { RegistroVinculado, useRotuloDeRegistro } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { esGrave } from '../datos/atencion'
import { rutaDeFicha, rutaParaAbrir } from '../datos/fichas'
import { atributo, texto, usePuedeEditar, useRegistro, useTodos, type Registro } from '../datos/registros'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { AccionesDeIa } from '../ia/AccionesDeIa'
import { diaPe, NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { AvisoDeConfidencial, Dato, DatosDelCaso, DeDondeViene, EditarQcs, MarcasDeQcs, PlazoQueCorre } from './comunesDeFicha'
import { DialogoDeReclasificacion, useOfreceReclasificar } from './DialogoDeReclasificacion'
import { opcion } from '../datos/opciones'

// S36 · ficha de queja (screens.md §8, WF-E1, flujos 12 y 13): llevar la queja de la recepción al cierre con sus plazos, su evidencia
// y su decisión a la vista. las transiciones del rol (motivo siempre: grievance es requiresReason) se comprueban antes con
// transition-checks: atender pide categoría y severidad; resolver, resolución y respuesta; cerrar, la respuesta comunicada; con la
// política activa, «Resolver» de una ALTA o CRITICA sale bloqueada con SENIOR_APPROVAL_REQUIRED y la resuelve quien aprueba
// (resolve_high_severity, decisión 8). la reclasificación es su comando; el cargo firmado se sube como evidencia FORMULARIO (ASM-098);
// «Crear compromiso desde esta queja» abre S30 con origin_grievance. un 404 puede ser una queja confidencial que la cuenta no lee: el
// texto no dice cuál de las dos cosas es
const COMPROBAR = [
  'investigate',
  'start_action',
  'start_action_after_investigation',
  'resolve',
  'resolve_high_severity',
  'reopen',
  'close_resolved',
  'close',
  'reject_received',
  'reject_acknowledged',
  'reject_in_assessment'
]
const EDITABLES = [
  'category',
  'severity',
  'priority',
  'description',
  'owner_user_id',
  'owner_user_email',
  'response',
  'responded_at',
  'resolution',
  'complainant_conformity_given',
  'stakeholder',
  'locality',
  'community',
  'topic',
  'social_risk',
  'incident',
  'duplicate_of'
]

export function FichaQuejaPage() {
  const { t } = useTranslation(NS)
  const { projectId = '', grievanceId = '' } = useParams()
  const queja = useRegistro('grievance', grievanceId)
  const noExiste = (
    <div className="space-y-3">
      <Alert tone="warning">{t('fichaQueja.noExiste')}</Alert>
      <Link to={`/projects/${encodeURIComponent(projectId)}/attention`} className="text-sm text-sg-primary-text underline">
        {t('fichaQueja.volver')}
      </Link>
    </div>
  )
  return (
    <Consulta consulta={queja} noExiste={noExiste}>
      {(q) => <Ficha key={q.id} queja={q} />}
    </Consulta>
  )
}

function Ficha({ queja }: { queja: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = texto(queja, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const edita = usePuedeEditar('grievance') && escribe
  const reclasifica = useOfreceReclasificar('grievance', queja) && escribe
  const delProyecto = useRegistro('project', proyecto)
  const [editando, setEditando] = useState(false)
  const [reclasificando, setReclasificando] = useState(false)
  // policy_high_severity_requires_approver vale verdadero si el proyecto no lo fijó (ProjectParameters, plan 4.2a)
  const politica = atributo(delProyecto.data, 'policy_high_severity_requires_approver') !== false
  const grave = esGrave(queja) && politica && queja.state === 'in_action'
  const base = `/projects/${encodeURIComponent(proyecto)}`
  return (
    <article className="space-y-4">
      <Link to={`${base}/attention`} className="text-sm text-sg-primary-text underline">
        {t('fichaQueja.volver')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sg-overline font-semibold uppercase text-sg-text-muted">
            {[opcion(queja, 'channel'), opcion(queja, 'category')].filter(Boolean).join(' · ') || '—'}
          </p>
          <h1 className="text-sg-h1 font-semibold">{t('fichaQueja.titulo', { codigo: texto(queja, 'code') })}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <EstadoChip objeto="grievance" estado={queja.state} />
            {opcion(queja, 'severity') ? <span>{t('fichaQueja.severidad', { valor: opcion(queja, 'severity') })}</span> : null}
            <PlazoQueCorre objeto="grievance" qcs={queja} />
            <MarcasDeQcs qcs={queja} />
          </div>
          {texto(queja, 'owner_user_email') ? (
            <p className="text-sm text-sg-text-secondary">
              {t('fichaQueja.campos.owner')}: {texto(queja, 'owner_user_email')}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {edita ? (
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                {t('fichaQueja.comun.editar')}
              </Button>
            ) : null}
            {reclasifica ? (
              <Button size="sm" variant="secondary" onClick={() => setReclasificando(true)}>
                {t('piezas.reclasificar.boton')}
              </Button>
            ) : null}
            {escribe && can('commitment', 'CREATE') ? (
              <Link
                to={`${base}/commitments/new?origin_grievance=${encodeURIComponent(queja.id)}`}
                className="rounded-sg-md border border-sg-border-strong px-3 py-1 text-sm font-medium text-sg-text"
              >
                {t('fichaQueja.crearCompromiso')}
              </Link>
            ) : null}
          </div>
          <BotonesDeTransicion objeto="grievance" registro={queja} proyecto={proyecto} comprobarAntes={COMPROBAR} />
        </div>
      </header>
      <AvisoDeConfidencial qcs={queja} />
      {grave ? <Alert tone="notice">{t('fichaQueja.grave', { severidad: opcion(queja, 'severity') })}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Tabs
          label={t('fichaQueja.titulo', { codigo: texto(queja, 'code') })}
          tabs={[
            {
              id: 'resumen',
              label: t('fichaQueja.pestanas.resumen'),
              render: () => (
                <DatosDelCaso qcs={queja}>
                  <Dato termino={t('fichaQueja.campos.severity')}>{opcion(queja, 'severity') || '—'}</Dato>
                  <div className="sm:col-span-2">
                    <Dato termino={t('fichaQueja.campos.resolution')}>{texto(queja, 'resolution') || '—'}</Dato>
                  </div>
                  <Dato termino={t('fichaQueja.campos.resolved_date')}>{texto(queja, 'resolved_date') ? diaPe(texto(queja, 'resolved_date')) : '—'}</Dato>
                  <Dato termino={t('fichaQueja.campos.complainant_conformity_given')}>
                    {atributo(queja, 'complainant_conformity_given') === true ? t('comun.si') : t('comun.no')}
                  </Dato>
                </DatosDelCaso>
              )
            },
            {
              id: 'evidencias',
              label: t('fichaQueja.pestanas.evidencias'),
              render: () => (
                <div className="space-y-2 pt-3">
                  <p className="text-sg-caption text-sg-text-muted">{t('fichaQueja.cargoAyuda')}</p>
                  <EvidenciasDelRegistro
                    objeto="grievance"
                    registro={queja}
                    escribe={escribe}
                    tipoInicial="FORMULARIO"
                    clasificacionInicial="DATOS PERSONALES"
                    textoSubir={t('fichaQueja.subirCargo')}
                  />
                </div>
              )
            },
            {
              id: 'actividad',
              label: t('fichaQueja.pestanas.actividad'),
              render: () => (
                <div className="pt-3">
                  <Historia objeto="grievance" id={queja.id} vacio={t('fichaQueja.sinActividad')} />
                </div>
              )
            }
          ]}
        />
        <aside className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
          <AccionesDeIa objeto="grievance" registro={queja} proyecto={proyecto} rotulo={texto(queja, 'code')} casos={['AI-08']} />
          <DeDondeViene objeto="grievance" qcs={queja} />
          <QueGenero queja={queja} />
        </aside>
      </div>
      <EditarQcs objeto="grievance" qcs={queja} campos={EDITABLES} abierto={editando} alCerrar={() => setEditando(false)} marcaConfidencial />
      {reclasificando ? <DialogoDeReclasificacion objeto="grievance" registro={queja} alCerrar={() => setReclasificando(false)} /> : null}
    </article>
  )
}

// qué alimenta la queja (el riesgo y el incidente vinculados, la queja de la que es duplicado) y los compromisos que nacen de ella
function QueGenero({ queja }: { queja: Registro }) {
  const { t } = useTranslation(NS)
  const compromisos = useTodos('commitment', { origin_grievance: queja.id })
  const rotulo = useRotuloDeRegistro()
  const rutaDelCompromiso = (c: Registro) => rutaDeFicha('commitment', c) ?? rutaParaAbrir('commitment', c.id)
  const vinculos = (
    [
      ['social_risk', 'social_risk', 'riesgo'],
      ['incident', 'incident', 'incidente'],
      ['duplicate_of', 'grievance', 'duplicadaDe']
    ] as const
  ).filter(([campo]) => atributo(queja, campo))
  return (
    <section aria-label={t('fichaQueja.comun.queGenero')} className="space-y-1">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('fichaQueja.comun.queGenero')}</h2>
      {vinculos.map(([campo, objeto, etiqueta]) => (
        <div key={campo}>
          {t(`fichaQueja.comun.${etiqueta}`)}: <RegistroVinculado objeto={objeto} id={atributo<string>(queja, campo)} />
        </div>
      ))}
      <h3 className="font-medium">{t('fichaQueja.comun.compromisos')}</h3>
      {compromisos.isPending ? (
        <Cargando compacto />
      ) : compromisos.isError && !compromisos.data ? (
        <FalloDeLectura error={compromisos.error} alReintentar={() => void compromisos.refetch()} />
      ) : compromisos.data.length === 0 ? (
        <p className="text-sg-text-muted">{vinculos.length === 0 ? t('fichaQueja.comun.sinNada') : '—'}</p>
      ) : (
        <ul>
          {compromisos.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <Link to={rutaDelCompromiso(c)} className="text-sg-primary-text underline">
                {rotulo(c)}
              </Link>
              <EstadoChip objeto="commitment" estado={c.state} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
