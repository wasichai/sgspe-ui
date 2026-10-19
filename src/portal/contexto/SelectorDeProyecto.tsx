import { useAuth } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { atributo } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { useLeeTodosLosProyectos, useMisProyectos, useProyectos } from './proyectos'
import { rutaEquivalente } from './rutas'

// el selector de proyecto de la barra superior (ux-architecture.md §7.1): el alcance global o un proyecto. lista los proyectos
// que la cuenta lee, ya acotados por el servidor a sus asignaciones vigentes (alcance por proyecto, ADR-0029); los de la persona
// van primero. quien lee todos los proyectos (useLeeTodosLosProyectos, ADMIN incluido) ve el alcance global como «Todos los
// proyectos», y los demás como «Todos mis proyectos»; es el valor por defecto. sin proyectos que leer ni la acción, dice que no
// tiene asignaciones en lugar de un selector que solo lleva a listas vacías (spec 4.4 §3.12). elegir otro alcance monta la misma
// página con ese alcance (ASM-076). sin READ sobre project no se dibuja. en la barra superior se ve desde md; «siempre» es el del
// panel del menú, que en el teléfono es el único (D2 de la revisión de UX)
export function SelectorDeProyecto({ siempre = false }: { siempre?: boolean }) {
  const { can } = useAuth()
  return can('project', 'READ') ? <Selector siempre={siempre} /> : null
}

// el chip de la barra superior por debajo de md: dice el alcance actual y abre el panel del menú, donde está el selector
export function ChipDeProyecto({ alAbrir }: { alAbrir: () => void }) {
  const { can } = useAuth()
  return can('project', 'READ') ? <Chip alAbrir={alAbrir} /> : null
}

function Chip({ alAbrir }: { alAbrir: () => void }) {
  const { t } = useTranslation(NS)
  const { scope } = useContextFilters()
  // la lista que ya lee el selector: el chip no pide nada más
  const proyectos = useProyectos()
  const proyecto = scope.kind === 'project' ? proyectos.data?.find((p) => p.id === scope.projectId) : undefined
  const codigo = proyecto ? String(atributo(proyecto, 'code') ?? '') : ''
  const actual = scope.kind === 'project' ? codigo || scope.projectId : t('contexto.todos')
  return (
    <button
      type="button"
      onClick={alAbrir}
      aria-label={t('contexto.cambiarProyecto', { proyecto: actual })}
      className="max-w-24 shrink-0 truncate rounded-full border border-sg-border-strong px-2.5 py-0.5 text-sg-caption text-sg-text-secondary md:hidden"
    >
      {actual}
    </button>
  )
}

function Selector({ siempre }: { siempre: boolean }) {
  const { t } = useTranslation(NS)
  const { scope } = useContextFilters()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const proyectos = useProyectos()
  const mios = useMisProyectos()
  const leeTodo = useLeeTodosLosProyectos()
  const actual = scope.kind === 'project' ? scope.projectId : ''
  const lista = [...(proyectos.data ?? [])].sort((a, b) => Number(mios.has(b.id)) - Number(mios.has(a.id)))
  if (proyectos.isSuccess && lista.length === 0 && !leeTodo)
    return <p className={cn('max-w-64 text-sm text-sg-text-muted', siempre ? 'block' : 'hidden md:block')}>{t('contexto.sinProyectos')}</p>
  return (
    <label className={cn('items-center gap-2 text-sm', siempre ? 'flex' : 'hidden md:flex')}>
      <span className="sr-only">{t('contexto.proyecto')}</span>
      <select
        aria-label={t('contexto.proyecto')}
        value={actual}
        onChange={(e) => navegar(rutaEquivalente(pathname, e.target.value || null))}
        className="h-8 w-full max-w-64 rounded-sg-md border border-sg-border-strong bg-sg-surface px-2 text-sm"
      >
        <option value="">{leeTodo ? t('contexto.todosLosProyectos') : t('contexto.todos')}</option>
        {lista.map((p) => (
          <option key={p.id} value={p.id}>
            {String(atributo(p, 'code') ?? '')} · {String(atributo(p, 'name') ?? '')}
          </option>
        ))}
      </select>
    </label>
  )
}
