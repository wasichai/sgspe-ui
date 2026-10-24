import { VerEnElMapa } from '../componentes/VerEnElMapa'
import { useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { CaminoDelFlujo } from '../componentes/CaminoDelFlujo'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useMigaDelRegistro } from '../componentes/Migas'
import { EncabezadoDePagina, ITEM_DE_MENU } from '../componentes/Pagina'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { PanelDeTrazabilidad, type SeccionDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { PestanasDeFicha } from '../componentes/PestanasDeFicha'
import { plazoQueCorre } from '../datos/atencion'
import { useEvidenciasDe, useNombreDeEvidencia } from '../documentos/api'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
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
import { NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { AvisoDeConfidencial, Dato, DatosDelCaso, EditarQcs, MarcasDeQcs, PlazoQueCorre, useOrigenDeQcs } from './comunesDeFicha'
import { DialogoDeReclasificacion, useOfreceReclasificar } from './DialogoDeReclasificacion'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'

// S36 · ficha de queja (screens.md §8, WF-E1, flujos 12 y 13): llevar la queja de la recepción al cierre con sus plazos, su evidencia
// y su decisión a la vista. las transiciones del rol (motivo siempre: grievance es requiresReason) se comprueban antes con
// transition-checks: atender pide categoría y severidad; resolver, resolución y respuesta; cerrar, la respuesta comunicada; con la
// política activa, «Resolver» de una ALTA o CRITICA sale bloqueada con SENIOR_APPROVAL_REQUIRED y la resuelve quien aprueba
// (resolve_high_severity, decisión 8). la reclasificación es su comando; el cargo firmado se sube como evidencia FORMULARIO (ASM-098);
// «Crear compromiso desde esta queja» abre S30 con origin_grievance. un 404 puede ser una queja confidencial que la cuenta no lee: el
// texto no dice cuál de las dos cosas es
const CAMINO = ['received', 'acknowledged', 'in_assessment', 'in_action', 'resolved', 'verified', 'closed']
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
  // la anatomía de design-system.md §6.1 (revisión de UX, etapa 4): migas (con el código), encabezado, camino del flujo, panel
  // de decisión, pestañas con conteo y trazabilidad en tres grupos
  useMigaDelRegistro(texto(queja, 'code'))
  const siguiente = useSiguienteAccion('grievance', queja, COMPROBAR)
  const evidencias = useEvidenciasDe('grievance', queja.id)
  const origen = useOrigenDeQcs('grievance', queja)
  const plazo = plazoQueCorre('grievance', queja)
  return (
    <article className="space-y-4">
      <EncabezadoDePagina
        ficha
        antetitulo={[t('comun.qcs.grievance'), texto(queja, 'code'), opcion(queja, 'channel'), opcion(queja, 'category')].filter(Boolean).join(' · ')}
        titulo={t('fichaQueja.titulo', { codigo: texto(queja, 'code') })}
        chips={
          <>
            <EstadoChip objeto="grievance" estado={queja.state} />
            {opcion(queja, 'severity') ? <span>{t('fichaQueja.severidad', { valor: opcion(queja, 'severity') })}</span> : null}
            <PlazoQueCorre objeto="grievance" qcs={queja} />
            <MarcasDeQcs qcs={queja} />
          </>
        }
        primaria={
          <BotonesDeTransicion
            agrupadas
            objeto="grievance"
            registro={queja}
            proyecto={proyecto}
            comprobarAntes={COMPROBAR}
            mas={
              reclasifica || (escribe && can('commitment', 'CREATE')) ? (
                <>
                  {reclasifica ? (
                    <button type="button" className={ITEM_DE_MENU} onClick={() => setReclasificando(true)}>
                      {t('piezas.reclasificar.boton')}
                    </button>
                  ) : null}
                  {escribe && can('commitment', 'CREATE') ? (
                    <Link className={ITEM_DE_MENU} to={`${base}/commitments/new?origin_grievance=${encodeURIComponent(queja.id)}`}>
                      {t('fichaQueja.crearCompromiso')}
                    </Link>
                  ) : null}
                </>
              ) : undefined
            }
          />
        }
        secundarias={
          <>
            <VerEnElMapa objeto="grievance" registro={queja} />
            {edita ? (
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                {t('fichaQueja.comun.editar')}
              </Button>
            ) : null}
          </>
        }
      />
      <AvisoDeConfidencial qcs={queja} />
      {grave ? <Alert tone="notice">{t('fichaQueja.grave', { severidad: opcion(queja, 'severity') })}</Alert> : null}
      <CaminoDelFlujo objeto="grievance" estado={queja.state} camino={CAMINO} />
      <PanelDeDecision
        objeto="grievance"
        estado={queja.state}
        desde={texto(queja, 'state_changed_at') || null}
        por={texto(queja, 'state_changed_by') || null}
        siguiente={siguiente}
        responsable={texto(queja, 'owner_user_email')}
        vencimiento={plazo?.fecha ?? null}
        situacion={atributo(queja, 'deadline_status')}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PestanasDeFicha
          etiqueta={t('fichaQueja.titulo', { codigo: texto(queja, 'code') })}
          pestanas={[
            {
              id: 'resumen',
              etiqueta: t('fichaQueja.pestanas.resumen'),
              render: () => (
                <DatosDelCaso qcs={queja}>
                  <Dato termino={t('fichaQueja.campos.severity')}>{opcion(queja, 'severity') || '—'}</Dato>
                  <div className="sm:col-span-2">
                    <Dato termino={t('fichaQueja.campos.resolution')}>{texto(queja, 'resolution') || '—'}</Dato>
                  </div>
                  <Dato termino={t('fichaQueja.campos.resolved_date')}>
                    <Dia valor={texto(queja, 'resolved_date')} />
                  </Dato>
                  <Dato termino={t('fichaQueja.campos.complainant_conformity_given')}>
                    {atributo(queja, 'complainant_conformity_given') === true ? t('comun.si') : t('comun.no')}
                  </Dato>
                </DatosDelCaso>
              )
            },
            {
              id: 'evidencias',
              etiqueta: t('fichaQueja.pestanas.evidencias'),
              conteo: evidencias.data?.totalElements ?? null,
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
              etiqueta: t('fichaQueja.pestanas.actividad'),
              render: () => (
                <div className="pt-3">
                  <Historia objeto="grievance" id={queja.id} vacio={t('fichaQueja.sinActividad')} />
                </div>
              )
            }
          ]}
        />
        <div className="space-y-4">
          <AccionesDeIa objeto="grievance" registro={queja} proyecto={proyecto} rotulo={texto(queja, 'code')} casos={['AI-08']} />
          <Trazabilidad queja={queja} origen={origen} evidencias={evidencias.data?.content ?? []} />
        </div>
      </div>
      <EditarQcs objeto="grievance" qcs={queja} campos={EDITABLES} abierto={editando} alCerrar={() => setEditando(false)} marcaConfidencial />
      {reclasificando ? <DialogoDeReclasificacion objeto="grievance" registro={queja} alCerrar={() => setReclasificando(false)} /> : null}
    </article>
  )
}

// la trazabilidad de la queja con los grupos fijos (revisión de UX, etapa 4): de dónde viene (useOrigenDeQcs), qué generó o
// alimenta (el riesgo y el incidente vinculados, la queja de la que es duplicado, los compromisos que nacen de ella) y lo que
// la sustenta (sus evidencias)
function Trazabilidad({ queja, origen, evidencias }: { queja: Registro; origen: SeccionDeTrazabilidad[]; evidencias: Registro[] }) {
  // una evidencia que lo sustenta se abre en la vista previa, sobre la ficha (revisión de UX, etapa 6)
  const previa = useRutaDeVistaPrevia()
  const { t } = useTranslation(NS)
  const compromisos = useTodos('commitment', { origin_grievance: queja.id })
  const rotulo = useRotuloDeRegistro()
  const nombreDeEvidencia = useNombreDeEvidencia()
  const rutaDelCompromiso = (c: Registro) => rutaDeFicha('commitment', c) ?? rutaParaAbrir('commitment', c.id)
  const vinculos = (
    [
      ['social_risk', 'social_risk', 'riesgo'],
      ['incident', 'incident', 'incidente'],
      ['duplicate_of', 'grievance', 'duplicadaDe']
    ] as const
  ).map(([campo, objeto, etiqueta]) => ({
    clave: campo,
    titulo: t(`fichaQueja.comun.${etiqueta}`),
    contenido: atributo(queja, campo) ? <RegistroVinculado objeto={objeto} id={atributo<string>(queja, campo)} /> : null
  }))
  return (
    <PanelDeTrazabilidad
      deDondeViene={origen}
      vacios={{ deDondeViene: t('fichaQueja.comun.sinOrigen') }}
      queGenero={[
        ...vinculos,
        {
          clave: 'compromisos',
          titulo: t('fichaQueja.comun.compromisos'),
          contenido: compromisos.isPending ? (
            <Cargando compacto />
          ) : compromisos.isError && !compromisos.data ? (
            <FalloDeLectura error={compromisos.error} alReintentar={() => void compromisos.refetch()} />
          ) : compromisos.data.length > 0 ? (
            <ul>
              {compromisos.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <EnlaceDeRegistro titulo={rotulo(c)} ruta={rutaDelCompromiso(c)} />
                  <EstadoChip objeto="commitment" estado={c.state} />
                </li>
              ))}
            </ul>
          ) : null
        }
      ]}
      loSustenta={[
        {
          clave: 'evidencias',
          titulo: t('fichaQueja.pestanas.evidencias'),
          contenido:
            evidencias.length > 0 ? (
              <ul>
                {evidencias.map((e) => (
                  <li key={e.id}>
                    <EnlaceDeRegistro titulo={nombreDeEvidencia(e)} ruta={previa('evidence', e.id)} />
                  </li>
                ))}
              </ul>
            ) : null
        }
      ]}
    />
  )
}
