// los estados de sistema (docs/ux/redesign/05 §Estados): cada uno dice qué pasó y qué hacer, sin códigos del servidor
import { AvisoDeConflicto, Alert, Button, Cargando, ErrorDeCarga, NoDisponible, Reservado, Restringido, Vacio } from '../../kit/index'
import { useL } from '../idioma'
import { Marco } from '../marco'
import { EstadoSinAcceso, Seccion } from '../piezas'

export function PEstados() {
  const l = useL()
  return (
    <Marco activa="compromisos" proyecto="DEMO-T1 · Proyecto Wayra Ejemplo" persona="Agente de campo (demo)">
      <h1 className="mb-4 text-sg-h1 font-semibold">{l('Estados del sistema', 'System states')}</h1>
      <div className="grid gap-4 xl:grid-cols-2">
        <Seccion titulo={l('Sin acceso', 'No access')}>
          <EstadoSinAcceso
            titulo={l('Su cuenta no puede abrir Compromisos', 'Your account cannot open Commitments')}
            porque={l('Su rol en este proyecto no incluye leer compromisos.', 'Your role in this project does not include reading commitments.')}
            pedir={l(
              'Si lo necesita, pídalo a la jefatura del proyecto (Jefatura del proyecto, demo).',
              'If you need it, ask the project lead (Jefatura del proyecto, demo).'
            )}
            volver={l('Volver al resumen del proyecto', 'Back to project overview')}
          />
        </Seccion>
        <Seccion titulo={l('Vacío con acción', 'Empty, with an action')}>
          <Vacio titulo={l('Aún no hay riesgos en este proyecto', 'No risks in this project yet')}>
            <p>{l('Identifíquelos para evaluarlos y seguir sus mitigaciones.', 'Identify them to assess them and track mitigations.')}</p>
            <div className="mt-3">
              <Button>{l('Identificar riesgo', 'Identify a risk')}</Button>
            </div>
          </Vacio>
        </Seccion>
        <Seccion titulo={l('Error de carga', 'Load error')}>
          <ErrorDeCarga error={new TypeError('Failed to fetch')} alReintentar={() => {}} />
        </Seccion>
        <Seccion titulo={l('Conflicto de edición', 'Edit conflict')}>
          <AvisoDeConflicto
            error={null}
            texto={l(
              'Otra persona cambió este compromiso mientras lo editaba. Recargue para ver la versión actual; lo que escribió se conserva.',
              'Someone else changed this commitment while you were editing. Reload to see the current version; your text is kept.'
            )}
            releer={async () => {}}
            alRecargar={() => {}}
          />
          <div className="mt-2">
            <Button size="sm" variant="secondary">
              {l('Recargar', 'Reload')}
            </Button>
          </div>
        </Seccion>
        <Seccion titulo={l('Reservado, restringido y no disponible', 'Reserved, restricted and unavailable')}>
          <dl className="grid grid-cols-[11rem_1fr] gap-x-4 gap-y-3 text-sg-body-sm">
            <dt className="text-sg-text-secondary">{l('Queja vinculada', 'Linked grievance')}</dt>
            <dd>
              <Reservado />
            </dd>
            <dt className="text-sg-text-secondary">{l('Quien la plantea', 'Raised by')}</dt>
            <dd>
              <Restringido />
            </dd>
            <dt className="text-sg-text-secondary">{l('Inversión del año', 'Investment this year')}</dt>
            <dd>
              <NoDisponible />
            </dd>
          </dl>
        </Seccion>
        <Seccion titulo={l('Cargando y éxito', 'Loading and success')}>
          <Cargando compacto />
          <Alert tone="success" title={l('Entrega registrada', 'Delivery logged')} className="mt-3">
            {l(
              'El compromiso pasa a revisión de conformidad. Siguiente: verificar la entrega.',
              'The commitment moves to sign-off review. Next: verify the delivery.'
            )}
          </Alert>
        </Seccion>
      </div>
    </Marco>
  )
}
