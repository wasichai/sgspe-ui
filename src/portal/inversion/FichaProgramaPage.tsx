import { useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useMigaDelRegistro } from '../componentes/Migas'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { PanelDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { PestanasDeFicha, type PestanaDeFicha } from '../componentes/PestanasDeFicha'
import { useEvidenciasDe, useNombreDeEvidencia } from '../documentos/api'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, NoEsDeSusProyectos } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { montoPe } from '../componentes/Monto'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyecto } from '../contexto/proyectos'
import { atributo, texto, usePuedeEditar, useRegistro, useTodos, type Registro } from '../datos/registros'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { diaPe, NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { Beneficiarios, IniciativasEHitos } from './HijosDelPrograma'
import { Indicadores } from './Indicadores'
import { Presupuestos } from './Presupuestos'

// S43 · ficha de programa (screens.md §10, WF-G, spec F5 §3.6): encabezado con estado, socio y convenio de sinergia; las
// transiciones del rol (devolver, suspender y cancelar piden motivo; enviar, aprobar y planificar se comprueban antes: G1 a G4);
// con socio y la política de sinergia activa, el aviso de G3 mientras se decide; «Editar» (sin motivo: el programa no es
// requiresReason); el presupuesto por año y moneda, evidencias, actividad y las tareas del programa. los datos del programa tienen
// un solo dueño (elección 15): quien no los escribe los ve en solo lectura. un 404 no dice si no existe o no es de sus proyectos
const EDITABLES = ['name', 'description', 'topic', 'partner_organization', 'agreement', 'start_date', 'end_date', 'currency']
// el camino de WF-G sin sus excepciones (suspender, cancelar); un estado fuera de él se agrega
const CAMINO = ['draft', 'pending_approval', 'planned', 'executing', 'monitoring', 'evaluation', 'closed']
const COMPROBAR = ['submit', 'approve', 'plan_direct']
const TERMINADOS = ['closed', 'cancelled']
const DECIDIENDO = ['draft', 'pending_approval']

export function FichaProgramaPage() {
  const { t } = useTranslation(NS)
  const { projectId = '', programId = '' } = useParams()
  const programa = useRegistro('social_program', programId)
  const noExiste = (
    <div className="space-y-3">
      <NoEsDeSusProyectos />
      <Link to={`/projects/${encodeURIComponent(projectId)}/programs`} className="text-sm text-sg-primary-text underline">
        {t('fichaPrograma.volver')}
      </Link>
    </div>
  )
  return (
    <Consulta consulta={programa} noExiste={noExiste}>
      {(p) => <Ficha key={p.id} programa={p} />}
    </Consulta>
  )
}

function Ficha({ programa }: { programa: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(programa, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const puedeEditar = usePuedeEditar('social_program')
  const edita = puedeEditar && escribe && !TERMINADOS.includes(programa.state ?? '')
  const delProyecto = useProyecto(proyecto)
  const [editando, setEditando] = useState(false)
  // G3: con socio y la política activa (vacía vale activada), aprobar o planificar exige un acuerdo vigente con el socio como parte
  const avisaSinergia =
    texto(programa, 'partner_organization') !== '' &&
    delProyecto.data !== undefined &&
    atributo(delProyecto.data, 'policy_synergy_requires_agreement') !== false &&
    DECIDIENDO.includes(programa.state ?? '')
  // la anatomía de design-system.md §6.1 (revisión de UX, etapa 4): migas con el código, encabezado, camino del flujo, panel de
  // decisión con el fin del programa como vencimiento, pestañas con conteo y trazabilidad en tres grupos
  useMigaDelRegistro(texto(programa, 'code') || texto(programa, 'name'))
  const siguiente = useSiguienteAccion('social_program', programa, COMPROBAR)
  const evidencias = useEvidenciasDe('social_program', programa.id)
  const pestanas: PestanaDeFicha[] = [
    { id: 'resumen', etiqueta: t('fichaPrograma.pestanas.resumen'), render: () => <Resumen programa={programa} /> },
    { id: 'presupuesto', etiqueta: t('fichaPrograma.pestanas.presupuesto'), render: () => <Presupuestos programa={programa} /> },
    { id: 'indicadores', etiqueta: t('fichaPrograma.pestanas.indicadores'), render: () => <Indicadores programa={programa} escribe={escribe} /> },
    { id: 'iniciativas', etiqueta: t('fichaPrograma.pestanas.iniciativas'), render: () => <IniciativasEHitos programa={programa} /> },
    { id: 'beneficiarios', etiqueta: t('fichaPrograma.pestanas.beneficiarios'), render: () => <Beneficiarios programa={programa} /> },
    {
      id: 'evidencias',
      etiqueta: t('fichaPrograma.pestanas.evidencias'),
      render: () => <EvidenciasDelRegistro objeto="social_program" registro={programa} escribe={escribe} />
    },
    {
      id: 'actividad',
      etiqueta: t('fichaPrograma.pestanas.actividad'),
      render: () => (
        <div className="pt-3">
          <Historia objeto="social_program" id={programa.id} vacio={t('fichaPrograma.sinActividad')} />
        </div>
      )
    }
  ]
  return (
    <article className="space-y-4">
      <EncabezadoDePagina
        ficha
        antetitulo={[t('fichaPrograma.tipo'), texto(programa, 'code')].filter(Boolean).join(' · ')}
        titulo={texto(programa, 'name')}
        primaria={<BotonesDeTransicion objeto="social_program" registro={programa} proyecto={proyecto} comprobarAntes={COMPROBAR} />}
        secundarias={
          edita ? (
            <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
              {t('fichaPrograma.editar')}
            </Button>
          ) : undefined
        }
      />
      <PanelDeDecision
        camino={CAMINO}
        objeto="social_program"
        proyecto={proyecto}
        estado={programa.state}
        desde={texto(programa, 'state_changed_at') || null}
        por={texto(programa, 'state_changed_by') || null}
        siguiente={siguiente}
        responsable={texto(programa, 'owner_user_email') || null}
        vencimiento={texto(programa, 'end_date') || null}
      />
      {avisaSinergia ? <Alert tone="notice">{t('fichaPrograma.sinergia')}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PestanasDeFicha etiqueta={texto(programa, 'name')} pestanas={pestanas} />
        <Trazabilidad programa={programa} evidencias={evidencias.data?.content ?? []} />
      </div>
      <Drawer titulo={t('fichaPrograma.editarTitulo')} abierto={editando} alCerrar={() => setEditando(false)}>
        {editando ? (
          <FormularioDeRegistro
            objeto="social_program"
            registro={programa}
            campos={EDITABLES}
            alGuardar={() => setEditando(false)}
            alCancelar={() => setEditando(false)}
          />
        ) : null}
      </Drawer>
    </article>
  )
}

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sg-caption text-sg-text-muted">{termino}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  )
}

function Resumen({ programa }: { programa: Registro }) {
  const { t } = useTranslation(NS)
  const moneda = texto(programa, 'currency')
  const dia = (campo: string) => (texto(programa, campo) ? diaPe(texto(programa, campo)) : '—')
  return (
    <div className="space-y-3 pt-3 text-sm">
      <p className="font-medium tabular-nums">
        {moneda
          ? t('fichaPrograma.presupuesto.totalDelPrograma', { monto: montoPe(atributo(programa, 'total_budget'), moneda) })
          : t('fichaPrograma.presupuesto.sinMoneda')}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Dato termino={t('fichaPrograma.campos.descripcion')}>{texto(programa, 'description') || '—'}</Dato>
        </div>
        <Dato termino={t('fichaPrograma.campos.inicio')}>{dia('start_date')}</Dato>
        <Dato termino={t('fichaPrograma.campos.fin')}>{dia('end_date')}</Dato>
        <Dato termino={t('fichaPrograma.campos.tema')}>
          {texto(programa, 'topic') ? <RegistroVinculado objeto="topic" id={texto(programa, 'topic')} /> : '—'}
        </Dato>
        <Dato termino={t('fichaPrograma.campos.moneda')}>{moneda || '—'}</Dato>
      </dl>
    </div>
  )
}

// la trazabilidad con los grupos fijos (revisión de UX, etapa 4): de dónde viene (el convenio y el socio), qué generó (sus aportes y
// las tareas que nacen de él, task.social_program, spec F5 §3.1) y lo que lo sustenta (sus evidencias)
function Trazabilidad({ programa, evidencias }: { programa: Registro; evidencias: Registro[] }) {
  // una evidencia que lo sustenta se abre en la vista previa, sobre la ficha (revisión de UX, etapa 6)
  const previa = useRutaDeVistaPrevia()
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const leeTareas = can('task', 'READ')
  const tareas = useTodos('task', { social_program: programa.id }, leeTareas)
  const proyecto = texto(programa, 'project')
  const nombreDeEvidencia = useNombreDeEvidencia()
  return (
    <PanelDeTrazabilidad
      deDondeViene={[
        {
          clave: 'convenio',
          titulo: t('fichaPrograma.convenio'),
          contenido: texto(programa, 'agreement') ? <RegistroVinculado objeto="agreement" id={texto(programa, 'agreement')} /> : null
        },
        {
          clave: 'socio',
          titulo: t('fichaPrograma.socio'),
          contenido: texto(programa, 'partner_organization') ? <RegistroVinculado objeto="organization" id={texto(programa, 'partner_organization')} /> : null
        }
      ]}
      queGenero={[
        {
          clave: 'tareas',
          titulo: t('fichaPrograma.trazabilidad.tareas'),
          contenido: !leeTareas ? null : tareas.isPending ? (
            <Cargando compacto />
          ) : tareas.isError && !tareas.data ? (
            <FalloDeLectura error={tareas.error} alReintentar={() => void tareas.refetch()} />
          ) : tareas.data.length === 0 ? (
            <p className="text-sg-text-muted">{t('fichaPrograma.trazabilidad.sinTareas')}</p>
          ) : (
            <ul>
              {tareas.data.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2">
                  <EnlaceDeRegistro titulo={texto(x, 'title')} ruta={`/projects/${encodeURIComponent(proyecto)}/tasks?task=${encodeURIComponent(x.id)}`} />
                  <EstadoChip objeto="task" estado={x.state} />
                </li>
              ))}
            </ul>
          )
        }
      ]}
      loSustenta={[
        {
          clave: 'evidencias',
          titulo: t('fichaPrograma.pestanas.evidencias'),
          contenido: evidencias.length ? (
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
