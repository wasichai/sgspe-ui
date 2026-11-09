import { useAuth } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { FolderKanban, MapPin, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useSearchParams } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { MigasDelProyecto, MigasGlobales, useRegistroDeLasMigas } from '../componentes/Migas'
import { atributo, useRegistro } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { usePestanasDelProyecto } from './ProyectoLayout'
import { useLeeTodosLosProyectos, useProyecto, useProyectos } from './proyectos'
import { Rastro } from './Rastro'
import { esTerritorio, useProyectoDeLaBarra } from './SelectorDeProyecto'
import { OBJETO_DE_TERRITORIO } from './rutas'

// la banda de contexto de Civic Modern (ux-architecture.md §7.1 y §8.1, design-system.md §5.2): la única capa de orientación,
// bajo la navegación principal. a la izquierda, el rastro como «‹ Volver a …» (Rastro) y las migas estructurales (dónde vive lo
// que se ve: MigasDelProyecto dentro de un proyecto, MigasGlobales fuera); a la derecha, el contexto: el sello de alcance
// («Alcance: Todos mis proyectos (N)», «Proyecto · CÓDIGO» con el estado del proyecto o, en Territorio, «Territorio · …» con
// la banda en territory-soft) y el chip de territorio de la URL (?territory=), que se quita sin cambiar de pantalla
export function BarraDeContexto() {
  const { scope, territory } = useContextFilters()
  const { pathname } = useLocation()
  const registro = useRegistroDeLasMigas() ?? undefined
  const territorial = esTerritorio(pathname) || territory !== null
  // en el resumen del proyecto la banda crece (design-system.md §5.2, S05): sigue en la banda del proyecto (CabeceraDelProyecto),
  // en surface y sin su borde, y el sello del proyecto no se repite, porque la banda dice el código y el estado
  const enElResumen = esResumenDelProyecto(pathname) && !territorial
  return (
    <div
      className={cn(
        'flex min-h-11 shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 md:px-6 lg:px-8',
        territorial ? 'border-b-2 border-sg-territory-border bg-sg-territory-soft' : enElResumen ? 'bg-sg-surface' : 'border-b border-sg-border bg-sg-bg'
      )}
    >
      <Rastro />
      <div className="min-w-0 flex-1">{scope.kind === 'project' ? <MigasEnElProyecto registro={registro} /> : <MigasGlobales registro={registro} />}</div>
      {enElResumen ? null : <Contexto />}
    </div>
  )
}

// /projects/:projectId/overview (o la raíz del proyecto, que lleva ahí)
export const esResumenDelProyecto = (pathname: string): boolean =>
  /^\/projects\/[^/]+(\/overview)?\/?$/.test(pathname) && !/^\/projects\/new\/?$/.test(pathname)

// en Acuerdos se marca Compromisos, como en la navegación local: las migas dicen la misma pestaña
function MigasEnElProyecto({ registro }: { registro?: string }) {
  const { marcada } = usePestanasDelProyecto()
  return <MigasDelProyecto pestana={marcada} registro={registro} />
}

const SELLO = 'inline-flex min-h-7 items-center gap-1.5 rounded-sg-md border px-2.5 text-sg-body-sm font-semibold whitespace-nowrap'

function Contexto() {
  const { t } = useTranslation(NS)
  const { scope, territory } = useContextFilters()
  const { pathname } = useLocation()
  const [busqueda, fijar] = useSearchParams()
  const lugar = useRegistro(territory ? OBJETO_DE_TERRITORIO[territory.kind] : 'locality', territory?.id)
  const nombreDelLugar = lugar.data ? String(atributo(lugar.data, 'name') ?? atributo(lugar.data, 'area_type') ?? territory?.id) : (territory?.id ?? '')
  return (
    <div role="group" aria-label={t('contexto.contexto')} className="flex flex-wrap items-center gap-2">
      {esTerritorio(pathname) ? <SelloDeTerritorio /> : scope.kind === 'project' ? <SelloDeProyecto projectId={scope.projectId} /> : <SelloGlobal />}
      {territory ? (
        <span className={cn(SELLO, 'border-sg-territory-border bg-sg-territory-soft text-sg-territory')}>
          <MapPin aria-hidden className="size-4 shrink-0" />
          {t('contexto.territorio', { nombre: `${t(`contexto.tipos.${territory.kind}`)} ${nombreDelLugar}` })}
          {/* un objetivo de 24 px como mínimo (WCAG 2.5.8) */}
          <button
            type="button"
            className="-mr-1.5 inline-flex size-6 items-center justify-center rounded-sg-sm hover:bg-sg-surface-hover"
            aria-label={t('contexto.quitarTerritorio')}
            onClick={() => {
              const siguiente = new URLSearchParams(busqueda)
              siguiente.delete('territory')
              fijar(siguiente)
            }}
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      ) : null}
    </div>
  )
}

// «Alcance: Todos mis proyectos (N)»: los proyectos que la cuenta lee, ya acotados por el servidor (ADR-0029). quien lee todos
// los proyectos ve «Todos los proyectos». sin READ sobre project no hay alcance que decir
function SelloGlobal() {
  const { can } = useAuth()
  return can('project', 'READ') ? <AlcanceGlobal /> : null
}

function AlcanceGlobal() {
  const { t } = useTranslation(NS)
  const leeTodo = useLeeTodosLosProyectos()
  const proyectos = useProyectos()
  const alcance = leeTodo ? t('contexto.todosLosProyectos') : t('contexto.todos')
  const n = proyectos.data?.length
  return (
    <span className={cn(SELLO, 'border-sg-border-strong bg-sg-surface text-sg-text')}>
      <FolderKanban aria-hidden className="size-4 shrink-0" />
      {n === undefined ? t('contexto.alcanceSinConteo', { alcance }) : t('contexto.alcanceGlobal', { alcance, n })}
    </span>
  )
}

// «Proyecto · CÓDIGO» con el estado del proyecto al lado (DD-30: el estado va junto al proyecto, nunca tras el último paso de
// las migas, donde se leía como el del registro abierto)
function SelloDeProyecto({ projectId }: { projectId: string }) {
  const { t } = useTranslation(NS)
  const proyecto = useProyecto(projectId)
  const codigo = (proyecto.data ? String(atributo(proyecto.data, 'code') ?? '') : '') || projectId
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={cn(SELLO, 'border-sg-primary bg-sg-primary-soft text-sg-primary-text')}>
        <FolderKanban aria-hidden className="size-4 shrink-0" />
        {t('contexto.selloProyecto', { codigo })}
      </span>
      {proyecto.data?.state ? (
        <span className="inline-flex items-center gap-1">
          <span className="sr-only">{t('contexto.estadoDelProyecto')}</span>
          <EstadoChip objeto="project" estado={proyecto.data.state} />
        </span>
      ) : null}
    </span>
  )
}

// en Territorio, el lente del mapa: «Territorio · CÓDIGO» con el proyecto de ?project= o «Territorio · Todo el territorio»
function SelloDeTerritorio() {
  const { t } = useTranslation(NS)
  const elegido = useProyectoDeLaBarra()
  const proyecto = useProyecto(elegido || undefined)
  const lugar = elegido ? (proyecto.data ? String(atributo(proyecto.data, 'code') ?? '') : '') || elegido : t('sig.todosLosLugares')
  return (
    <span className={cn(SELLO, 'border-sg-territory-border bg-sg-territory-soft text-sg-territory')}>
      <MapPin aria-hidden className="size-4 shrink-0" />
      {t('contexto.selloTerritorio', { lugar })}
    </span>
  )
}
