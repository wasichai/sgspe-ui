import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el panel de trazabilidad de design-system.md §6.1 y ux-architecture.md §8.1: tres grupos fijos y en este orden, «De dónde
// viene» (el origen), «Qué generó» (las consecuencias) y «Lo sustenta» (las evidencias y documentos que lo respaldan). cada
// ficha declara las secciones de cada grupo; una sección sin contenido no se dibuja y un grupo sin ninguna lo dice. en el
// teléfono va bajo el contenido de la ficha (el orden del DOM; la ficha lo pone a la derecha desde lg). su forma es la de
// design-system.md §5.3: tres columnas iguales en una caja de 1 px con separadores de 1 px cuando el panel es ancho, y en una
// ficha estrecha (la columna de la derecha, el teléfono) una fila por grupo, con el título en 150 px y el resto: se mide el
// panel (consulta de contenedor), no la ventana
export interface SeccionDeTrazabilidad {
  clave: string
  titulo: string
  // los vínculos ya armados (RegistroVinculado, EnlaceDeRegistro); null, undefined o false si no hay
  contenido: ReactNode
}

type Grupo = 'deDondeViene' | 'queGenero' | 'loSustenta'
const GRUPOS: Grupo[] = ['deDondeViene', 'queGenero', 'loSustenta']

const hay = (contenido: ReactNode) => contenido !== null && contenido !== undefined && contenido !== false && contenido !== ''

export function PanelDeTrazabilidad({
  vacios,
  pie,
  ...grupos
}: Partial<Record<Grupo, SeccionDeTrazabilidad[]>> & { vacios?: Partial<Record<Grupo, string>>; pie?: ReactNode }) {
  const { t } = useTranslation(NS)
  return (
    <aside aria-label={t('paginas.trazabilidad.titulo')} className="@container space-y-2 text-sm">
      {/* los separadores de 1 px son el borde derecho e inferior de cada celda; la caja recorta los del borde (margen de -1 px) */}
      <div data-rejilla-de-trazabilidad className="grid overflow-hidden rounded-sg-md border border-sg-border bg-sg-surface @2xl:grid-cols-3">
        {GRUPOS.map((grupo) => {
          const secciones = (grupos[grupo] ?? []).filter((s) => hay(s.contenido))
          const titulo = t(`paginas.trazabilidad.${grupo}`)
          return (
            <section
              key={grupo}
              aria-label={titulo}
              className="-mr-px -mb-px grid min-w-0 grid-cols-[150px_minmax(0,1fr)] gap-x-4 gap-y-1 border-r border-b border-sg-border px-3.5 py-2.5 @2xl:flex @2xl:flex-col"
            >
              <h2 className="text-sm font-bold text-sg-text">{titulo}</h2>
              <div className="min-w-0 space-y-2">
                {secciones.length === 0 ? (
                  <p className="text-sg-text-muted">{vacios?.[grupo] ?? t('paginas.trazabilidad.nada')}</p>
                ) : (
                  secciones.map((s) => (
                    <div key={s.clave} className="space-y-0.5">
                      <h3 className="text-sg-caption text-sg-text-secondary">{s.titulo}</h3>
                      <div>{s.contenido}</div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>
      {pie}
    </aside>
  )
}
