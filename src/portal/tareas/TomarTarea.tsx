import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { useMensajeDeError } from '../componentes/errores'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { atributo, texto, useActualizar, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// «Tomar» una tarea sin abrirla (tercera pasada de UX, 3.2): el mismo cambio de assignee_user_id con If-Match que el cajón de la
// tarea (TareaDrawer). se ofrece a quien escribe tareas en su proyecto y solo si sigue sin asignar; si otra persona la tomó
// antes, el 412 se dice en la línea y la lista se relee
export function TomarTarea({ tarea, alTomar }: { tarea: Registro; alTomar?: (tarea: Registro) => void }) {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const escribe = useEscribeEnProyecto(texto(tarea, 'project') || undefined)
  const tomar = useActualizar('task')
  const mensaje = useMensajeDeError()
  const abierta = !['done', 'cancelled'].includes(tarea.state ?? '')
  if (!user || !abierta || atributo(tarea, 'assignee_user_id') || !escribe || !can('task', 'UPDATE')) return null
  return (
    <div className="space-y-1 text-right">
      <Button
        size="sm"
        variant="secondary"
        aria-label={t('tareas.tomarEnLinea', { titulo: texto(tarea, 'title') })}
        disabled={tomar.isPending}
        aria-busy={tomar.isPending}
        onClick={() =>
          tomar.mutate({ registro: tarea, cambios: { assignee_user_id: user.id, assignee_user_email: user.email } }, { onSuccess: () => alTomar?.(tarea) })
        }
      >
        {tomar.isPending ? t('tareas.ficha.tomando') : t('tareas.tomar')}
      </Button>
      {tomar.isError ? (
        <p role="alert" className="text-sg-caption text-sg-danger">
          {mensaje(tomar.error)}
        </p>
      ) : null}
    </div>
  )
}
