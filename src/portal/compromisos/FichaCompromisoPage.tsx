import { EnlaceConRastro } from '../contexto/Rastro'
import { rutaEnElMapa, VerEnElMapa } from '../componentes/VerEnElMapa'
import { useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { CabeceraDeFicha } from '../componentes/CabeceraDeFicha'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { PanelDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { useSumasDeConteos } from '../datos/conteos'
import { useEvidenciasDe, useNombreDeEvidencia } from '../documentos/api'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import type { UseQueryResult } from '@tanstack/react-query'
import { Alert, Button } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { CamposPlegables, type CampoDeFicha } from '../componentes/CamposPlegables'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, Restringido } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { montoPe } from '../componentes/Monto'
import { useMigaDelRegistro } from '../componentes/Migas'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { PestanasDeFicha } from '../componentes/PestanasDeFicha'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { atributo, texto, usePuedeEditar, useRegistro, useRegistros, useRelacionados, useTodos, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { PestanaDependencias, PestanaSeguimiento } from './PestanaSeguimiento'
import { Ejecutado, PestanaEntregas } from './PestanaEntregas'
import { PestanaReprogramaciones } from './PestanaReprogramaciones'
import { Verificacion } from './Verificacion'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'
import { Persona } from '../componentes/Persona'
import { CampoDeMotivo, useMotivo } from '../componentes/Motivo'

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
const CAMINO = ['draft', 'pending_approval', 'approved', 'in_progress', 'fulfilled', 'verified', 'closed']
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
  const motivo = useMotivo()
  const antesDeAprobar = ANTES_DE_APROBAR.includes(compromiso.state ?? '')
  const campos = editando === 'riesgo' ? ['delay_risk_reported', 'delay_risk_note'] : antesDeAprobar ? [...EDITABLES_SIEMPRE, 'due_date'] : EDITABLES_SIEMPRE
  const cerrar = () => {
    setEditando(null)
    motivo.limpiar()
  }
  // dónde se está: el código en las migas del proyecto (en lugar del enlace suelto a la lista); el título del documento lo pone
  // el encabezado. la anatomía de design-system.md §6.1 (revisión de UX, etapa 4): encabezado, camino del flujo, panel de
  // decisión, pestañas con conteo y trazabilidad
  useMigaDelRegistro(texto(compromiso, 'code') || texto(compromiso, 'title'))
  const siguiente = useSiguienteAccion('commitment', compromiso, COMPROBAR)
  const conteos = useSumasDeConteos([
    { clave: 'entregas', objeto: 'delivery', filtros: { commitment: compromiso.id } },
    { clave: 'reprogramaciones', objeto: 'commitment_reschedule', filtros: { commitment: compromiso.id } }
  ])
  const evidencias = useEvidenciasDe('commitment', compromiso.id)
  return (
    <article className="space-y-4">
      <CabeceraDeFicha
        antetitulo={[t('fichaCompromiso.titulo'), texto(compromiso, 'code'), opcion(compromiso, 'resource_type')].filter(Boolean).join(' · ')}
        titulo={texto(compromiso, 'title')}
        tituloDelDocumento={[texto(compromiso, 'code'), texto(compromiso, 'title')].filter(Boolean).join(' ')}
        chips={
          <>
            <SituacionDePlazo valor={atributo(compromiso, 'deadline_status')} />
            {texto(compromiso, 'due_date') ? (
              <span>
                <Dia valor={texto(compromiso, 'due_date')} />
              </span>
            ) : null}
            {/* sin monto, nada: un «—» suelto entre los chips no dice qué falta (rediseño de UX, 2026-10-20) */}
            {atributo(compromiso, 'amount') !== null && atributo(compromiso, 'amount') !== undefined ? (
              <span className="tabular-nums">{montoPe(atributo(compromiso, 'amount'), atributo(compromiso, 'currency'))}</span>
            ) : null}
          </>
        }
        objeto="commitment"
        registro={compromiso}
        proyecto={proyecto}
        comprobarAntes={COMPROBAR}
        falta={siguiente?.falta}
        faltaCampo={siguiente?.campo}
        secundarias={[
          ...(rutaEnElMapa('commitment', compromiso) ? [{ clave: 'mapa', nodo: <VerEnElMapa objeto="commitment" registro={compromiso} /> }] : []),
          ...(edita
            ? [
                {
                  clave: 'editar',
                  nodo: (
                    <Button size="sm" variant="secondary" onClick={() => setEditando('todo')}>
                      {t('fichaCompromiso.editar')}
                    </Button>
                  )
                },
                {
                  clave: 'riesgo',
                  nodo: (
                    <Button size="sm" variant="secondary" onClick={() => setEditando('riesgo')}>
                      {t('fichaCompromiso.riesgo')}
                    </Button>
                  )
                }
              ]
            : [])
        ]}
      />
      {atributo(compromiso, 'delay_risk_reported') === true ? <Alert tone="warning">{t('fichaCompromiso.riesgoInformado')}</Alert> : null}
      {/* el camino de WF-D sin la excepción (bloqueado): si el compromiso está bloqueado, se agrega igual al camino */}
      <PanelDeDecision
        camino={CAMINO}
        objeto="commitment"
        proyecto={proyecto}
        estado={compromiso.state}
        desde={texto(compromiso, 'state_changed_at') || null}
        por={texto(compromiso, 'state_changed_by') || null}
        siguiente={siguiente}
        responsable={texto(compromiso, 'owner_user_email')}
        vencimiento={texto(compromiso, 'due_date')}
        situacion={atributo(compromiso, 'deadline_status')}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PestanasDeFicha
          etiqueta={texto(compromiso, 'title')}
          pestanas={[
            { id: 'resumen', etiqueta: t('fichaCompromiso.pestanas.resumen'), render: () => <Resumen compromiso={compromiso} /> },
            {
              id: 'seguimiento',
              etiqueta: t('fichaCompromiso.pestanas.seguimiento'),
              render: () => <PestanaSeguimiento compromiso={compromiso} escribe={escribe} />
            },
            {
              id: 'entregas',
              etiqueta: t('fichaCompromiso.pestanas.entregas'),
              conteo: conteos.entregas,
              render: () => <PestanaEntregas compromiso={compromiso} escribe={escribe} />
            },
            {
              id: 'reprogramaciones',
              etiqueta: t('fichaCompromiso.pestanas.reprogramaciones'),
              conteo: conteos.reprogramaciones,
              render: () => <PestanaReprogramaciones compromiso={compromiso} escribe={escribe} />
            },
            {
              id: 'dependencias',
              etiqueta: t('fichaCompromiso.pestanas.dependencias'),
              render: () => <PestanaDependencias compromiso={compromiso} escribe={escribe} />
            },
            {
              id: 'evidencias',
              etiqueta: t('fichaCompromiso.pestanas.evidencias'),
              conteo: evidencias.data?.totalElements ?? null,
              render: () => <EvidenciasDelRegistro objeto="commitment" registro={compromiso} escribe={escribe} />
            },
            {
              id: 'actividad',
              etiqueta: t('fichaCompromiso.pestanas.actividad'),
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
        <CampoDeMotivo motivo={motivo} etiqueta={t('fichaCompromiso.motivo')} ayuda={t('fichaCompromiso.motivoAyuda')} />
        {editando ? (
          <FormularioDeRegistro
            key={editando}
            objeto="commitment"
            registro={compromiso}
            campos={campos}
            motivo={motivo.recortado}
            antesDeEnviar={motivo.exigir}
            alGuardar={cerrar}
            alCancelar={cerrar}
          />
        ) : null}
      </Drawer>
    </article>
  )
}

function Resumen({ compromiso }: { compromiso: Registro }) {
  const { t } = useTranslation(NS)
  const solicitantes = useRelacionados('commitment', compromiso.id, 'commitment_stakeholder')
  const proyecto = texto(compromiso, 'project')
  // un campo de opción se ve con su rótulo; el texto libre, como se escribió. lo que no tiene dato se pliega tras «Mostrar los N campos
  // sin dato» (CamposPlegables, tercera pasada de UX, 1.8): la ficha no es un muro de guiones
  const valor = (campo: string) => opcion(compromiso, campo) || null
  const dia = (campo: string) => (texto(compromiso, campo) ? diaPe(texto(compromiso, campo)) : null)
  const n = (campo: string) =>
    atributo(compromiso, campo) === null || atributo(compromiso, campo) === undefined ? null : numeroPe(Number(atributo(compromiso, campo)))
  const persona = (campo: string) => (texto(compromiso, campo) ? <Persona correo={texto(compromiso, campo)} /> : null)
  const beneficiarios = ['beneficiaries_count', 'beneficiaries_female_count', 'beneficiaries_male_count'].some((c) => n(c) !== null)
    ? t('fichaCompromiso.beneficiariosConteo', {
        total: n('beneficiaries_count') ?? '—',
        mujeres: n('beneficiaries_female_count') ?? '—',
        varones: n('beneficiaries_male_count') ?? '—'
      })
    : null
  const campo = (clave: string, valor: ReactNode): CampoDeFicha => ({ clave, termino: t(`fichaCompromiso.campos.${clave}`), valor })
  const campos: CampoDeFicha[] = [
    campo('description', valor('description')),
    campo('objective', valor('objective')),
    campo('resource_type', valor('resource_type')),
    campo('cantidad', n('quantity') === null ? null : `${n('quantity')} ${texto(compromiso, 'unit')}`.trim()),
    campo('execution_time', valor('execution_time')),
    campo('commitment_theme', valor('commitment_theme')),
    campo('formality', valor('formality')),
    campo('request_medium', valor('request_medium')),
    campo('agreed_date', dia('agreed_date')),
    campo('due_date', dia('due_date')),
    campo('priority', valor('priority')),
    campo('owner', persona('owner_user_email')),
    campo('verifier', persona('verifier_user_email')),
    campo('beneficiarios', beneficiarios),
    // un dato restringido no es un vacío: el candado se ve siempre
    campo('beneficiariosDetalle', 'beneficiaries_detail' in compromiso.attributes ? valor('beneficiaries_detail') : <Restringido />),
    ...(texto(compromiso, 'origin_justification') ? [campo('origin_justification', valor('origin_justification'))] : []),
    ...(texto(compromiso, 'fulfilled_date') ? [campo('fulfilled_date', dia('fulfilled_date'))] : []),
    ...(texto(compromiso, 'closed_date') ? [campo('closed_date', dia('closed_date'))] : [])
  ]
  return (
    <div className="space-y-4 pt-3 text-sm">
      <Ejecutado compromiso={compromiso} />
      <CamposPlegables campos={campos} />
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
                <EnlaceConRastro
                  to={`/projects/${encodeURIComponent(proyecto)}/stakeholders/${encodeURIComponent(g.id)}`}
                  className="text-sg-primary-text underline"
                >
                  <NombreDelGrupo grupo={g} />
                </EnlaceConRastro>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// el panel de trazabilidad (ux-architecture.md §8.1, revisión de UX, etapa 4): de dónde viene el compromiso (interacción,
// acuerdo y cláusula, candidato, queja de origen, riesgo que atiende), qué generó (tareas, entregas) y lo que lo sustenta (sus
// evidencias), con los grupos fijos de PanelDeTrazabilidad. una queja confidencial que quien mira no lee se dice «Registro
// reservado» (RegistroVinculado); una lectura que falló lo dice al pie
function Trazabilidad({ compromiso }: { compromiso: Registro }) {
  // una evidencia que lo sustenta se abre en la vista previa, sobre la ficha (revisión de UX, etapa 6)
  const previa = useRutaDeVistaPrevia()
  const { t } = useTranslation(NS)
  const proyecto = texto(compromiso, 'project')
  const interaccion = useRegistro('engagement', atributo<string>(compromiso, 'origin_engagement'))
  const acuerdo = useRegistro('agreement', atributo<string>(compromiso, 'agreement'))
  const clausula = useRegistro('agreement_clause', atributo<string>(compromiso, 'agreement_clause'))
  const candidatos = useRegistros('commitment_candidate', { created_commitment: compromiso.id, size: 5 })
  const tareas = useTodos('task', { commitment: compromiso.id })
  const entregas = useRegistros('delivery', { commitment: compromiso.id, size: 1 })
  const evidencias = useEvidenciasDe('commitment', compromiso.id)
  const nombreDeEvidencia = useNombreDeEvidencia()
  const candidato = candidatos.data?.content[0]
  const queja = atributo<string>(compromiso, 'origin_grievance')
  const riesgo = atributo<string>(compromiso, 'social_risk')
  const base = `/projects/${encodeURIComponent(proyecto)}`
  return (
    <PanelDeTrazabilidad
      deDondeViene={[
        {
          clave: 'interaccion',
          titulo: t('fichaCompromiso.trazabilidad.interaccion'),
          contenido: interaccion.data ? (
            <EnlaceDeRegistro titulo={texto(interaccion.data, 'title')} ruta={`${base}/engagements/${encodeURIComponent(interaccion.data.id)}`} />
          ) : null
        },
        {
          clave: 'acuerdo',
          titulo: t('fichaCompromiso.trazabilidad.acuerdo'),
          contenido: acuerdo.data ? (
            <>
              <EnlaceDeRegistro
                codigo={texto(acuerdo.data, 'code')}
                titulo={texto(acuerdo.data, 'title')}
                ruta={`${base}/agreements/${encodeURIComponent(acuerdo.data.id)}`}
              />
              {clausula.data ? <span> · {t('fichaCompromiso.trazabilidad.clausula', { numero: texto(clausula.data, 'clause_number') })}</span> : null}
            </>
          ) : null
        },
        { clave: 'candidato', titulo: t('fichaCompromiso.trazabilidad.candidato'), contenido: candidato ? texto(candidato, 'proposed_text') : null },
        { clave: 'queja', titulo: t('fichaCompromiso.trazabilidad.queja'), contenido: queja ? <RegistroVinculado objeto="grievance" id={queja} /> : null },
        { clave: 'riesgo', titulo: t('fichaCompromiso.trazabilidad.riesgo'), contenido: riesgo ? <RegistroVinculado objeto="social_risk" id={riesgo} /> : null }
      ]}
      vacios={{ deDondeViene: t('fichaCompromiso.trazabilidad.sinOrigen') }}
      queGenero={[
        {
          clave: 'tareas',
          titulo: t('fichaCompromiso.trazabilidad.tareas'),
          contenido: tareas.isPending ? (
            <Cargando compacto />
          ) : tareas.data && tareas.data.length > 0 ? (
            <ul>
              {tareas.data.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2">
                  <EnlaceDeRegistro titulo={texto(x, 'title')} ruta={`${base}/tasks?task=${encodeURIComponent(x.id)}`} />
                  <EstadoChip objeto="task" estado={x.state} />
                </li>
              ))}
            </ul>
          ) : tareas.data ? (
            <p className="text-sg-text-muted">{t('fichaCompromiso.trazabilidad.sinTareas')}</p>
          ) : null
        },
        {
          clave: 'entregas',
          titulo: t('fichaCompromiso.trazabilidad.entregasSinNumero'),
          contenido: entregas.data
            ? t('fichaCompromiso.trazabilidad.entregas', { n: numeroPe(entregas.data.totalElements ?? entregas.data.content.length) })
            : null
        }
      ]}
      loSustenta={[
        {
          clave: 'evidencias',
          titulo: t('fichaCompromiso.pestanas.evidencias'),
          contenido:
            evidencias.data && evidencias.data.content.length > 0 ? (
              <ul>
                {evidencias.data.content.map((e) => (
                  <li key={e.id}>
                    <EnlaceDeRegistro titulo={nombreDeEvidencia(e)} ruta={previa('evidence', e.id)} />
                  </li>
                ))}
              </ul>
            ) : null
        }
      ]}
      pie={
        <>
          <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.interaccion')} consulta={interaccion} />
          <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.acuerdo')} consulta={acuerdo} />
          <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.clausulaSinNumero')} consulta={clausula} />
          <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.candidato')} consulta={candidatos} />
          <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.tareas')} consulta={tareas} />
          <FalloDe etiqueta={t('fichaCompromiso.trazabilidad.entregasSinNumero')} consulta={entregas} />
          <FalloDe etiqueta={t('fichaCompromiso.pestanas.evidencias')} consulta={evidencias} />
        </>
      }
    />
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
