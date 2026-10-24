import { createContext, useContext, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { useRegistro } from '../datos/registros'
import { nombreDeProyecto } from '../contexto/proyectos'
import { NS } from '../i18n'

// las migas de ux-architecture.md §8.1: dónde vive el registro (Proyectos / PRJ-01 · Pukaqaqa / Compromisos / COM-2026-031),
// derivadas de la ruta. no cambian con el recorrido: eso es el rastro (contexto/Rastro.tsx). el último paso es la página actual
export interface Miga {
  etiqueta: string
  ruta?: string
}

export function Migas({ pasos }: { pasos: Miga[] }) {
  const { t } = useTranslation(NS)
  if (pasos.length === 0) return null
  return (
    <nav aria-label={t('paginas.migas')} className="text-sg-caption text-sg-text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {pasos.map((paso, i) => {
          const ultimo = i === pasos.length - 1
          return (
            <li key={`${paso.etiqueta}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 ? <span aria-hidden>/</span> : null}
              {ultimo || !paso.ruta ? (
                <span aria-current={ultimo ? 'page' : undefined} className={ultimo ? 'truncate font-medium text-sg-text-secondary' : 'truncate'}>
                  {paso.etiqueta}
                </span>
              ) : (
                <Link to={paso.ruta} className="truncate hover:text-sg-text hover:underline">
                  {paso.etiqueta}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// el registro abierto lo declara su ficha (useMigaDelRegistro) y lo dibujan las migas de ProyectoLayout, que no lo conoce
const ContextoDeMigas = createContext<((etiqueta: string | null) => void) | null>(null)
export const ProveedorDeMigas = ContextoDeMigas.Provider

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

// las de una pantalla dentro de un proyecto: la pestaña es el segmento de la ruta tras el proyecto, o la que se diga cuando
// la ruta no la nombra (la ficha de una queja vive en /grievances/:id y su pestaña es attention). sin registro, la pestaña
// es la página actual
export function MigasDelProyecto({ pestana, registro }: { pestana?: string; registro?: string }) {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const { pathname } = useLocation()
  const proyecto = useRegistro('project', projectId || undefined)
  const segmento = pathname.split('/')[3] ?? 'overview'
  const p = pestana ?? pestanaDeSegmento(segmento)
  const base = `/projects/${encodeURIComponent(projectId)}`
  const pasos: Miga[] = [
    { etiqueta: t('secciones.projects'), ruta: '/projects' },
    { etiqueta: proyecto.data ? nombreDeProyecto(proyecto.data) : projectId, ruta: `${base}/overview` }
  ]
  // el resumen es el proyecto mismo: las migas terminan en él
  if (p !== 'overview' || registro) pasos.push({ etiqueta: t(`contexto.pestanas.${p}`, { defaultValue: '' }) || p, ruta: `${base}/${p}` })
  return <Migas pasos={registro ? [...pasos, { etiqueta: registro }] : pasos} />
}
