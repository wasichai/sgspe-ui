import { useAuth } from '@wasichai/core'
import { Alert, Button, Tabs } from '@wasichai/ui'
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
import { Presupuestos } from './Presupuestos'

// S43 · ficha de programa (screens.md §10, WF-G, spec F5 §3.6): encabezado con estado, socio y convenio de sinergia; las
// transiciones del rol (devolver, suspender y cancelar piden motivo; enviar, aprobar y planificar se comprueban antes: G1 a G4);
// con socio y la política de sinergia activa, el aviso de G3 mientras se decide; «Editar» (sin motivo: el programa no es
// requiresReason); el presupuesto por año y moneda, evidencias, actividad y las tareas del programa. los datos del programa tienen
// un solo dueño (elección 15): quien no los escribe los ve en solo lectura. un 404 no dice si no existe o no es de sus proyectos
const EDITABLES = ['name', 'description', 'topic', 'partner_organization', 'agreement', 'start_date', 'end_date', 'currency']
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
  const pestanas: { id: string; label: string; render: () => ReactNode }[] = [
    { id: 'resumen', label: t('fichaPrograma.pestanas.resumen'), render: () => <Resumen programa={programa} /> },
    { id: 'presupuesto', label: t('fichaPrograma.pestanas.presupuesto'), render: () => <Presupuestos programa={programa} /> },
    {
      id: 'evidencias',
      label: t('fichaPrograma.pestanas.evidencias'),
      render: () => <EvidenciasDelRegistro objeto="social_program" registro={programa} escribe={escribe} />
    },
    {
      id: 'actividad',
      label: t('fichaPrograma.pestanas.actividad'),
      render: () => (
        <div className="pt-3">
          <Historia objeto="social_program" id={programa.id} vacio={t('fichaPrograma.sinActividad')} />
        </div>
      )
    }
  ]
  return (
    <article className="space-y-4">
      <Link to={`/projects/${encodeURIComponent(proyecto)}/programs`} className="text-sm text-sg-primary-text underline">
        {t('fichaPrograma.volver')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sg-overline font-semibold uppercase text-sg-text-muted">{texto(programa, 'code')}</p>
          <h1 className="text-sg-h1 font-semibold">{texto(programa, 'name')}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <EstadoChip objeto="social_program" estado={programa.state} />
            <span>
              {t('fichaPrograma.socio')}:{' '}
              {texto(programa, 'partner_organization') ? (
                <RegistroVinculado objeto="organization" id={texto(programa, 'partner_organization')} />
              ) : (
                t('fichaPrograma.sinSocio')
              )}
            </span>
            <span>
              {t('fichaPrograma.convenio')}:{' '}
              {texto(programa, 'agreement') ? <RegistroVinculado objeto="agreement" id={texto(programa, 'agreement')} /> : t('fichaPrograma.sinConvenio')}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          {edita ? (
            <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
              {t('fichaPrograma.editar')}
            </Button>
          ) : null}
          <BotonesDeTransicion objeto="social_program" registro={programa} proyecto={proyecto} comprobarAntes={COMPROBAR} />
        </div>
      </header>
      {avisaSinergia ? <Alert tone="notice">{t('fichaPrograma.sinergia')}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Tabs label={texto(programa, 'name')} tabs={pestanas} />
        <aside className="space-y-4">
          <Trazabilidad programa={programa} />
        </aside>
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

// las tareas que nacen del programa (task.social_program, spec F5 §3.1), con su enlace a «Mis tareas» del proyecto
function Trazabilidad({ programa }: { programa: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const leeTareas = can('task', 'READ')
  const tareas = useTodos('task', { social_program: programa.id }, leeTareas)
  const proyecto = texto(programa, 'project')
  return (
    <section aria-label={t('fichaPrograma.trazabilidad.titulo')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('fichaPrograma.trazabilidad.titulo')}</h2>
      {leeTareas ? (
        <>
          <h3 className="font-medium">{t('fichaPrograma.trazabilidad.tareas')}</h3>
          {tareas.isPending ? (
            <Cargando compacto />
          ) : tareas.isError && !tareas.data ? (
            <FalloDeLectura error={tareas.error} alReintentar={() => void tareas.refetch()} />
          ) : tareas.data.length === 0 ? (
            <p className="text-sg-text-muted">{t('fichaPrograma.trazabilidad.sinTareas')}</p>
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
        </>
      ) : null}
    </section>
  )
}
