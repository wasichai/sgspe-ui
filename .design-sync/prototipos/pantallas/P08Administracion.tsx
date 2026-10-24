// P-08 · administración: el puente S53 (portal y consola), con los cuidados de fuente de verdad, y el equipo del proyecto
// con lo destructivo en el menú de la fila (U-08, U-37, flujo F-G)
import { Alert, Button, Table, Td, Th } from '../../kit/index'
import { ExternalLink, MoreHorizontal } from 'lucide-react'
import { useL } from '../idioma'
import { Marco } from '../marco'
import { Seccion } from '../piezas'

export function P08() {
  const l = useL()
  const enlace = (t: string, d: string, externo?: boolean) => (
    <li key={t}>
      <a className="flex items-start justify-between gap-3 rounded-sg-md p-2 hover:bg-sg-surface-hover">
        <span>
          <span className="block text-sg-body font-medium">{t}</span>
          <span className="block text-sg-body-sm text-sg-text-secondary">{d}</span>
        </span>
        {externo ? <ExternalLink aria-hidden className="mt-1 size-4 shrink-0 text-sg-text-muted" /> : null}
      </a>
    </li>
  )
  return (
    <Marco activa="admin" persona="Administración (demo)">
      <h1 className="text-sg-h1 font-semibold">{l('Administración', 'Administration')}</h1>
      <p className="mb-4 text-sg-body text-sg-text-secondary">
        {l(
          'Organización Demo · lo que se configura en el portal y lo que vive en la consola.',
          'Demo organisation · what is set up in the portal and what lives in the console.'
        )}
      </p>
      <div className="grid gap-4 xl:grid-cols-3">
        <Seccion titulo={l('En el portal', 'In the portal')}>
          <ul className="space-y-1">
            {enlace(l('Equipos de proyecto', 'Project teams'), l('Quién trabaja en cada proyecto y desde cuándo', 'Who works on each project and since when'))}
            {enlace(
              l('Parámetros y políticas', 'Parameters and policies'),
              l('Umbrales, plazos y metas por proyecto', 'Thresholds, deadlines and targets per project')
            )}
            {enlace(
              l('Plantillas de entregables', 'Deliverable templates'),
              l('Word de la organización para T1 y T2', 'Organisation Word templates for T1 and T2')
            )}
            {enlace(l('Mapa base', 'Base map'), l('Sin configurar: el mapa se ve sin fondo', 'Not set up: maps show no background'))}
          </ul>
        </Seccion>
        <Seccion titulo={l('En la consola', 'In the console')}>
          <ul className="space-y-1">
            {enlace(l('Usuarios', 'Users'), l('Altas, bajas y roles', 'Accounts and roles'), true)}
            {enlace(l('Roles y permisos', 'Roles and permissions'), l('Qué puede hacer cada perfil', 'What each profile can do'), true)}
            {enlace(l('Auditoría', 'Audit'), l('Quién cambió qué y cuándo', 'Who changed what and when'), true)}
          </ul>
        </Seccion>
        <Seccion titulo={l('Cuidados', 'Take care')}>
          <Alert tone="warning" title={l('El modelo vive en el repositorio', 'The model lives in the repository')}>
            {l(
              'Objetos, flujos y roles se cambian en model/ y se aplican con su script. Lo que se edite en la consola se pierde en la próxima subida de fase.',
              'Objects, workflows and roles are changed in model/ and applied with its script. Console edits are lost on the next phase upgrade.'
            )}
          </Alert>
        </Seccion>
      </div>
      <Seccion
        className="mt-4"
        titulo={l('Equipo · Proyecto Wayra Ejemplo', 'Team · Proyecto Wayra Ejemplo')}
        descripcion={l('10 personas con asignación vigente', '10 people with a current assignment')}
        acciones={<Button size="sm">{l('Asignar persona', 'Assign person')}</Button>}
      >
        <Table>
          <thead>
            <tr>
              <Th>{l('Persona', 'Person')}</Th>
              <Th>{l('Rol en el proyecto', 'Project role')}</Th>
              <Th>{l('Desde', 'Since')}</Th>
              <Th>
                <span className="sr-only">{l('Acciones', 'Actions')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Gestión social (demo)', l('Gerente social', 'Social manager')],
              ['Relaciones comunitarias (demo)', l('Relacionista comunitario', 'Community relations officer')],
              ['Agente de campo (demo)', l('Agente de campo', 'Field agent')],
              ['Atención de QCS (demo)', l('Gestor de quejas, consultas y solicitudes', 'Grievance manager')]
            ].map(([p, r], i) => (
              <tr key={p}>
                <Td className="font-medium">{p}</Td>
                <Td className="text-sg-text-secondary">{r}</Td>
                <Td className="tabular-nums text-sg-text-secondary">01/09/2026</Td>
                <Td className="w-12 text-right">
                  <div className="relative inline-block">
                    <Button size="icon" variant="ghost" aria-label={l(`Acciones de ${p}`, `Actions for ${p}`)}>
                      <MoreHorizontal aria-hidden className="size-4" />
                    </Button>
                    {i === 1 ? (
                      <div className="absolute right-0 top-9 z-10 w-64 rounded-sg-md border border-sg-border bg-sg-surface-raised py-1 text-left shadow-sg-md">
                        <button type="button" className="block w-full px-3 py-2 text-sg-body-sm hover:bg-sg-surface-hover">
                          {l('Cambiar el periodo', 'Change the period')}
                        </button>
                        <button type="button" className="block w-full px-3 py-2 text-sg-body-sm text-sg-danger hover:bg-sg-surface-hover">
                          {l('Terminar la asignación…', 'End the assignment…')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Seccion>
    </Marco>
  )
}
