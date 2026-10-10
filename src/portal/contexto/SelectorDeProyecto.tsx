import { useAuth } from '@wasichai/core'
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
// página con ese alcance (ASM-076). sin READ sobre project no se dibuja
export function SelectorDeProyecto() {
  const { can } = useAuth()
  return can('project', 'READ') ? <Selector /> : null
}

function Selector() {
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
    return <p className="hidden max-w-64 text-sm text-sg-text-muted md:block">{t('contexto.sinProyectos')}</p>
  return (
    <label className="hidden items-center gap-2 text-sm md:flex">
      <span className="sr-only">{t('contexto.proyecto')}</span>
      <select
        aria-label={t('contexto.proyecto')}
        value={actual}
        onChange={(e) => navegar(rutaEquivalente(pathname, e.target.value || null))}
        className="h-8 max-w-64 rounded-sg-md border border-sg-border-strong bg-sg-surface px-2 text-sm"
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
