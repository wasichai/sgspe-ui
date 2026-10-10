import { useAuth } from '@wasichai/core'
import { Alert, cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useParams } from 'react-router'
import { ErrorDeCarga, esIlegible, NoEsDeSusProyectos } from '../componentes/Estados'
import { NS } from '../i18n'
import { LEE_ACUERDOS } from '../shell/leeAcuerdos'
import { estadoDe, guardaDe, useOferta, type ClaveDeSeccion, type Par } from '../shell/navTree'
import { BarraDeContexto } from './BarraDeContexto'
import { useMisAsignaciones, useProyecto, vigenciaDeAsignacion } from './proyectos'
import { Rastro } from './Rastro'

// el ProjectLayout de screens.md §2: dentro de un proyecto, la barra de contexto y la sub-navegación de Project 360; por
// debajo de lg pasa a una fila desplazable. con el alcance por proyecto (ADR-0029) solo llega aquí sin asignación quien lee
// todos los proyectos (READ_ALL_PROJECTS): lee en solo lectura (design-system.md §6.5), salvo ADMIN, que no necesita asignación.
// un proyecto que responde 404 no existe o no es de sus proyectos, sin distinguir (spec 4.4 §3.6)
const PESTANAS = [
  'overview',
  'map',
  'stakeholders',
  'engagements',
  'commitments',
  'agreements',
  'attention',
  'risks',
  'documents',
  'tasks',
  'settings',
  'reports'
] as const
// las pestañas de otra sección se ofrecen con los permisos de esa sección, como el árbol y su guarda (GuardaDeSeccion): el PAD
// no ve «Grupos de interés» ni «Relacionamiento» para llegar al aviso de que no puede abrirlas. Acuerdos vive bajo Compromisos
// pero se ofrece con READ sobre agreement, como sus rutas (rutasEnProyecto.ts y pantallas.ts)
const SECCION_DE_PESTANA: Partial<Record<(typeof PESTANAS)[number], ClaveDeSeccion>> = {
  stakeholders: 'stakeholders',
  engagements: 'engagements',
  commitments: 'commitments',
  agreements: 'commitments',
  attention: 'attention',
  risks: 'risks',
  documents: 'documents',
  tasks: 'tasks',
  reports: 'reports'
}
const PERMISOS_DE_PESTANA: Partial<Record<(typeof PESTANAS)[number], Par[][]>> = { agreements: LEE_ACUERDOS }

export function ProyectoLayout() {
  const { t } = useTranslation(NS)
  const { projectId } = useParams()
  const proyecto = useProyecto(projectId)
  const asignaciones = useMisAsignaciones()
  const escribe = useEscribeEnProyecto(projectId)
  const oferta = useOferta()
  const pestanas = PESTANAS.filter((p) => {
    const clave = SECCION_DE_PESTANA[p]
    return !clave || estadoDe(guardaDe(clave, PERMISOS_DE_PESTANA[p]), oferta) === 'disponible'
  })
  // solo sin datos: un refetch fallido (tras guardar o volver a la pestaña) no desmonta el Outlet ni pierde lo escrito
  if (proyecto.isError && !proyecto.data)
    return (
      <div className="mx-auto max-w-[1440px] space-y-3">
        {esIlegible(proyecto.error) ? <NoEsDeSusProyectos /> : <ErrorDeCarga error={proyecto.error} alReintentar={() => void proyecto.refetch()} />}
        <Link to="/projects" className="inline-block text-sm font-medium text-sg-primary-text">
          {t('contexto.irAProyectos')}
        </Link>
      </div>
    )
  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <BarraDeContexto />
      <Rastro />
      <nav aria-label={t('contexto.subnav')} className="flex gap-1 overflow-x-auto border-b border-sg-border">
        {pestanas.map((p) => (
          <NavLink
            key={p}
            to={`/projects/${encodeURIComponent(projectId ?? '')}/${p}`}
            className={({ isActive }) =>
              cn(
                'whitespace-nowrap border-b-2 px-3 py-2 text-sm',
                isActive ? 'border-sg-primary font-medium text-sg-primary-text' : 'border-transparent text-sg-text-secondary'
              )
            }
          >
            {t(`contexto.pestanas.${p}`)}
          </NavLink>
        ))}
      </nav>
      {asignaciones.isSuccess && !escribe ? <Alert tone="notice">{t('contexto.soloLectura')}</Alert> : null}
      <Outlet />
    </div>
  )
}

// si la cuenta puede escribir en el proyecto: tiene una asignación vigente, activa y dentro de sus fechas (ProjectScopeGuard
// decide; esto solo oculta lo que el servidor rechazaría)
export function useAsignadoAlProyecto(projectId: string | undefined): boolean {
  const asignaciones = useMisAsignaciones()
  return (asignaciones.data ?? []).some((a) => a.attributes.project === projectId && vigenciaDeAsignacion(a) === 'vigente')
}

// si la cuenta escribe en el proyecto como lo decide ProjectScopeGuard: ADMIN sin asignación (P38) y los demás con una asignación
// vigente. es la guarda de UI de toda escritura con alcance de proyecto, junto con can(objeto, acción). las escrituras de
// project_assignment están exentas (security.md §9.2, ítem 5: así se forman los equipos) y dependen solo de can(...)
export function useEscribeEnProyecto(projectId: string | undefined): boolean {
  const { isAdmin } = useAuth()
  const asignado = useAsignadoAlProyecto(projectId)
  return isAdmin || asignado
}
