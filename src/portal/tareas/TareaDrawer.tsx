import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { atributo, texto, useActualizar, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'

// los orígenes de una tarea (task: exactamente uno, planes 3.1 y 4.1): los de F3 y, desde F4, las tres QCS, el riesgo y la alerta
// (AUT-02, AUT-09, AUT-11, JOB-01). una QCS confidencial que quien mira no lee se abre como «Registro reservado» (/r/…); los de F5
// llegan con sus objetos
export const ORIGENES: readonly string[] = [
  'commitment',
  'engagement',
  'agreement',
  'stakeholder',
  'grievance',
  'inquiry',
  'stakeholder_request',
  'social_risk',
  'early_warning'
]
export const origenDe = (tarea: Registro): { objeto: string; id: string } | null => {
  const objeto = ORIGENES.find((o) => atributo<string>(tarea, o))
  return objeto ? { objeto, id: String(atributo(tarea, objeto)) } : null
}

// el origen de una tarea con su tipo y su nombre («Interacción · Asamblea de agosto», revisión de UX, etapa 6): el registro se lee
// como quien mira, así que uno que no se lee (una QCS confidencial, otro proyecto) es «Registro reservado», sin enlace
export function OrigenDeTarea({ tarea }: { tarea: Registro }) {
  const { t } = useTranslation(NS)
  const origen = origenDe(tarea)
  if (!origen) return <>{t('tareas.sinOrigen')}</>
  return (
    <span>
      {t(`tareas.origenes.${origen.objeto}`)} · <RegistroVinculado objeto={origen.objeto} id={origen.id} />
    </span>
  )
}

// una tarea abierta desde la lista, el tablero o el calendario (?task=id): sus datos, su origen y las transiciones de WF-N
// del rol (cancelar pide motivo). «Tomar la tarea» asigna a quien mira una tarea sin asignar (las de escalamiento de JOB-01):
// es un cambio de assignee_user_id con If-Match, y un 412 (otra persona la tomó antes) ofrece «Recargar». el PUT reemplaza los
// campos escribibles con los leídos (atributosDeEscritura): generator_key, que solo escribe la plataforma, viaja tal como se
// leyó y no es un cambio (GENERATOR_KEY_PLATFORM_ONLY)
export function TareaDrawer({ tarea, alCerrar }: { tarea: Registro; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const proyecto = texto(tarea, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const tomar = useActualizar('task')
  const releer = useReleer()
  const origen = origenDe(tarea)
  const sinAsignar = !atributo(tarea, 'assignee_user_id')
  const abierta = !['done', 'cancelled'].includes(tarea.state ?? '')
  return (
    <Drawer titulo={texto(tarea, 'title')} abierto alCerrar={alCerrar}>
      <div className="flex flex-wrap items-center gap-2">
        <EstadoChip objeto="task" estado={tarea.state} />
        <SituacionDePlazo valor={atributo(tarea, 'deadline_status')} />
      </div>
      <dl className="space-y-1 text-sm">
        <div>
          <dt className="text-sg-text-muted">{t('tareas.ficha.descripcion')}</dt>
          <dd className="whitespace-pre-line">{texto(tarea, 'description') || '—'}</dd>
        </div>
        <div>
          <dt className="text-sg-text-muted">{t('tareas.ficha.asignada')}</dt>
          <dd>{texto(tarea, 'assignee_user_email') || t('tareas.ficha.sinAsignar')}</dd>
        </div>
        <div>
          <dt className="text-sg-text-muted">{t('tareas.ficha.vence')}</dt>
          <dd>
            <Dia valor={texto(tarea, 'due_date')} />
          </dd>
        </div>
        <div>
          <dt className="text-sg-text-muted">{t('tareas.ficha.prioridad')}</dt>
          <dd>{opcion(tarea, 'priority') || '—'}</dd>
        </div>
      </dl>
      {origen ? (
        <p className="text-sm">
          {t('tareas.origen')}: <OrigenDeTarea tarea={tarea} />
        </p>
      ) : null}
      {sinAsignar && abierta && escribe && can('task', 'UPDATE') && user ? (
        <Button
          size="sm"
          disabled={tomar.isPending}
          aria-busy={tomar.isPending}
          onClick={() => tomar.mutate({ registro: tarea, cambios: { assignee_user_id: user.id, assignee_user_email: user.email } })}
        >
          {tomar.isPending ? t('tareas.ficha.tomando') : t('tareas.ficha.tomar')}
        </Button>
      ) : null}
      {tomar.isSuccess ? (
        <p role="status" className="text-sm text-sg-success">
          {t('tareas.ficha.tomada')}
        </p>
      ) : null}
      {tomar.isError ? (
        <AvisoDeConflicto error={tomar.error} releer={() => releer(['records', 'task'], ['record', 'task', tarea.id])} alRecargar={() => tomar.reset()} />
      ) : null}
      <BotonesDeTransicion objeto="task" registro={tarea} proyecto={proyecto} />
    </Drawer>
  )
}
