import { cn } from '@wasichai/ui'
import { ChevronRight } from 'lucide-react'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { useRegistro } from '../datos/registros'
import { nombreDeProyecto } from '../contexto/proyectos'
import { NS } from '../i18n'
import { scopeFromPath } from '../shell/context'
import { NAV_TREE } from '../shell/navTree'
import { seccionDeRuta } from '../shell/seccionActual'

// las migas de ux-architecture.md §8.1: dónde vive el registro (Proyectos / PRJ-01 · Pukaqaqa / Compromisos / COM-2026-031),
// derivadas de la ruta. no cambian con el recorrido: eso es el rastro (contexto/Rastro.tsx). el último paso es la página actual
export interface Miga {
  etiqueta: string
  ruta?: string
  // lo que va al lado del paso, fuera de su enlace: el estado del proyecto en el paso del proyecto
  adorno?: ReactNode
}

export function Migas({ pasos }: { pasos: Miga[] }) {
  const { t } = useTranslation(NS)
  if (pasos.length === 0) return null
  return (
    // en la banda de contexto (design-system.md §5.2): 14 px en text-secondary, los enlaces subrayados en primary-text y el paso
    // actual en 600
    <nav aria-label={t('paginas.migas')} className="min-w-0 text-sm text-sg-text-secondary">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {pasos.map((paso, i) => {
          const ultimo = i === pasos.length - 1
          return (
            // en el teléfono, solo los dos últimos pasos: el resto no cabe junto al sello de alcance
            <li key={`${paso.etiqueta}-${i}`} className={cn('flex min-w-0 items-center gap-1.5', i < pasos.length - 2 && 'max-md:hidden')}>
              {i > 0 ? <ChevronRight aria-hidden className={cn('size-3.5 shrink-0 text-sg-text-muted', i === pasos.length - 2 && 'max-md:hidden')} /> : null}
              {ultimo || !paso.ruta ? (
                <span data-miga aria-current={ultimo ? 'page' : undefined} className={ultimo ? 'truncate font-semibold text-sg-text' : 'truncate'}>
                  {paso.etiqueta}
                </span>
              ) : (
                <Link data-miga to={paso.ruta} className="truncate text-sg-primary-text underline underline-offset-2 hover:decoration-2">
                  {paso.etiqueta}
                </Link>
              )}
              {paso.adorno}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// el registro abierto lo declara su ficha (useMigaDelRegistro) y lo dibujan las migas de la banda de contexto del shell, que no
// lo conoce (useRegistroDeLasMigas)
const ContextoDeMigas = createContext<((etiqueta: string | null) => void) | null>(null)
const ContextoDelRegistro = createContext<string | null>(null)

export function ProveedorDeMigas({ children }: { children: ReactNode }) {
  const [registro, setRegistro] = useState<string | null>(null)
  return (
    <ContextoDeMigas.Provider value={setRegistro}>
      <ContextoDelRegistro.Provider value={registro}>{children}</ContextoDelRegistro.Provider>
    </ContextoDeMigas.Provider>
  )
}

export const useRegistroDeLasMigas = (): string | null => useContext(ContextoDelRegistro)

export function useMigaDelRegistro(etiqueta: string | null | undefined) {
  const fijar = useContext(ContextoDeMigas)
  useEffect(() => {
    fijar?.(etiqueta || null)
    return () => fijar?.(null)
  }, [fijar, etiqueta])
}

// las fichas que no viven bajo el segmento de su pestaña: una queja vive en /grievances/:id y su pestaña es la de QCS
const PESTANA_DE_SEGMENTO: Partial<Record<string, string>> = {
  grievances: 'attention',
  inquiries: 'attention',
  requests: 'attention',
  contributions: 'programs',
  'field-visits': 'engagements',
  incidents: 'risks',
  areas: 'map'
}

// la pestaña de un segmento de ruta: la suya si la ficha vive fuera de él, si no el segmento mismo
export function pestanaDeSegmento(segmento: string): string {
  return PESTANA_DE_SEGMENTO[segmento] ?? segmento
}

// las de una pantalla dentro de un proyecto: Inicio, Proyectos, el proyecto, su pestaña y el registro abierto. la pestaña es el
// segmento de la ruta tras el proyecto, o la que se diga cuando la ruta no la nombra (la ficha de una queja vive en
// /grievances/:id y su pestaña es attention). sin registro, la pestaña es la página actual. el estado del proyecto va en el
// sello de alcance de la banda de contexto, junto a su código (contexto/BarraDeContexto.tsx), no en las migas
export function MigasDelProyecto({ pestana, registro }: { pestana?: string; registro?: string }) {
  const { t } = useTranslation(NS)
  // el proyecto de la ruta: las migas viven en la banda del shell, fuera de la ruta del proyecto (useParams no lo ve)
  const { pathname } = useLocation()
  const alcance = scopeFromPath(pathname)
  const projectId = alcance.kind === 'project' ? alcance.projectId : ''
  const proyecto = useRegistro('project', projectId || undefined)
  const segmento = pathname.split('/')[3] ?? 'overview'
  const p = pestana ?? pestanaDeSegmento(segmento)
  const base = `/projects/${encodeURIComponent(projectId)}`
  const pasos: Miga[] = [
    { etiqueta: t('secciones.dashboard'), ruta: '/' },
    { etiqueta: t('secciones.projects'), ruta: '/projects' },
    { etiqueta: proyecto.data ? nombreDeProyecto(proyecto.data) : projectId, ruta: `${base}/overview` }
  ]
  // el resumen es el proyecto mismo: las migas terminan en él
  if (p !== 'overview' || registro) pasos.push({ etiqueta: t(`contexto.pestanas.${p}`, { defaultValue: '' }) || p, ruta: `${base}/${p}` })
  return <Migas pasos={registro ? [...pasos, { etiqueta: registro }] : pasos} />
}

// las de una pantalla fuera de un proyecto, derivadas de la ruta: Inicio, la sección (seccionDeRuta) y, más adentro de ella, el
// registro que la ficha declara (useMigaDelRegistro). en el inicio, solo «Inicio». el título de la página no se repite aquí:
// ya es el h1 que está debajo
export function MigasGlobales({ registro }: { registro?: string }) {
  const { t } = useTranslation(NS)
  const { pathname } = useLocation()
  const inicio: Miga = { etiqueta: t('secciones.dashboard'), ruta: '/' }
  if (pathname === '/') return <Migas pasos={[{ etiqueta: inicio.etiqueta }]} />
  const clave = seccionDeRuta(pathname)
  const seccion = clave && clave !== 'dashboard' ? NAV_TREE.find((s) => s.clave === clave) : undefined
  const pasos: Miga[] = [inicio]
  if (seccion) pasos.push({ etiqueta: t(`secciones.${seccion.clave}`), ruta: seccion.to })
  if (registro && registro !== pasos.at(-1)?.etiqueta) pasos.push({ etiqueta: registro })
  return <Migas pasos={pasos} />
}
