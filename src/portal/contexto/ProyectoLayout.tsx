import { useAuth } from '@wasichai/core'
import { Alert, cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useParams } from 'react-router'
import { ErrorDeCarga } from '../componentes/Estados'
import { NS } from '../i18n'
import { BarraDeContexto } from './BarraDeContexto'
import { useMisAsignaciones, useProyecto, vigenciaDeAsignacion } from './proyectos'
import { Rastro } from './Rastro'

// el ProjectLayout de screens.md §2: dentro de un proyecto, la barra de contexto y la sub-navegación de Project 360; por
// debajo de lg pasa a una fila desplazable. quien no está asignado lee en solo lectura (alcance A, design-system.md §6.5), salvo ADMIN, que no necesita asignación
const PESTANAS = ['overview', 'map', 'stakeholders', 'engagements', 'settings', 'reports'] as const

export function ProyectoLayout() {
  const { t } = useTranslation(NS)
  const { projectId } = useParams()
  const proyecto = useProyecto(projectId)
  const { isAdmin } = useAuth()
  const asignaciones = useMisAsignaciones()
  const asignado = useAsignadoAlProyecto(projectId)
  // solo sin datos: un refetch fallido (tras guardar o volver a la pestaña) no desmonta el Outlet ni pierde lo escrito
  if (proyecto.isError && !proyecto.data)
    return (
      <div className="mx-auto max-w-[1440px] space-y-3">
        <ErrorDeCarga error={proyecto.error} alReintentar={() => void proyecto.refetch()} />
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
        {PESTANAS.map((p) => (
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
      {asignaciones.isSuccess && !asignado && !isAdmin ? <Alert tone="notice">{t('contexto.soloLectura')}</Alert> : null}
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
