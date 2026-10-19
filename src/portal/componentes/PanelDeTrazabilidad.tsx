import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el panel de trazabilidad de design-system.md §6.1 y ux-architecture.md §8.1: tres grupos fijos y en este orden, «De dónde
// viene» (el origen), «Qué generó» (las consecuencias) y «Lo sustenta» (las evidencias y documentos que lo respaldan). cada
// ficha declara las secciones de cada grupo; una sección sin contenido no se dibuja y un grupo sin ninguna lo dice. en el
// teléfono va bajo el contenido de la ficha (el orden del DOM; la ficha lo pone a la derecha desde lg)
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
    <aside aria-label={t('paginas.trazabilidad.titulo')} className="space-y-4 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      {GRUPOS.map((grupo) => {
        const secciones = (grupos[grupo] ?? []).filter((s) => hay(s.contenido))
        const titulo = t(`paginas.trazabilidad.${grupo}`)
        return (
          <section key={grupo} aria-label={titulo} className="space-y-2">
            <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{titulo}</h2>
            {secciones.length === 0 ? (
              <p className="text-sg-text-muted">{vacios?.[grupo] ?? t('paginas.trazabilidad.nada')}</p>
            ) : (
              secciones.map((s) => (
                <div key={s.clave} className="space-y-0.5">
                  <h3 className="text-sg-caption text-sg-text-muted">{s.titulo}</h3>
                  <div>{s.contenido}</div>
                </div>
              ))
            )}
          </section>
        )
      })}
      {pie}
    </aside>
  )
}
