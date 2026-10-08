import { Alert, cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useParams } from 'react-router'
import { ErrorDeCarga } from '../componentes/Estados'
import { NS } from '../i18n'
import { BarraDeContexto } from './BarraDeContexto'
import { useMisAsignaciones, useProyecto } from './proyectos'
import { Rastro } from './Rastro'

// el ProjectLayout de screens.md §2: dentro de un proyecto, la barra de contexto y la sub-navegación de Project 360; por
// debajo de lg pasa a una fila desplazable. quien no está asignado lee en solo lectura (alcance A, design-system.md §6.5)
const PESTANAS = ['overview', 'map', 'stakeholders', 'engagements', 'settings', 'reports'] as const

export function ProyectoLayout() {
  const { t } = useTranslation(NS)
  const { projectId } = useParams()
  const proyecto = useProyecto(projectId)
  const asignaciones = useMisAsignaciones()
  const asignado = (asignaciones.data ?? []).some((a) => a.attributes.project === projectId)
  if (proyecto.isError) return <ErrorDeCarga error={proyecto.error} alReintentar={() => void proyecto.refetch()} />
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
      {asignaciones.isSuccess && !asignado ? <Alert tone="notice">{t('contexto.soloLectura')}</Alert> : null}
      <Outlet />
    </div>
  )
}

// si la cuenta puede escribir en el proyecto: tiene una asignación activa (ProjectScopeGuard decide; esto solo oculta)
export function useAsignadoAlProyecto(projectId: string | undefined): boolean {
  const asignaciones = useMisAsignaciones()
  return (asignaciones.data ?? []).some((a) => a.attributes.project === projectId)
}
