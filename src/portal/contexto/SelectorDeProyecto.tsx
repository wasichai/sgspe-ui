import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { atributo } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { useMisProyectos, useProyectos } from './proyectos'
import { rutaEquivalente } from './rutas'

// el selector de proyecto de la barra superior (ux-architecture.md §7.1): "Todos mis proyectos" o uno. los de la persona
// van primero. elegir otro alcance monta la misma página con ese alcance (ASM-076). sin READ sobre project no se dibuja
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
  const actual = scope.kind === 'project' ? scope.projectId : ''
  const lista = [...(proyectos.data ?? [])].sort((a, b) => Number(mios.has(b.id)) - Number(mios.has(a.id)))
  return (
    <label className="hidden items-center gap-2 text-sm md:flex">
      <span className="sr-only">{t('contexto.proyecto')}</span>
      <select
        aria-label={t('contexto.proyecto')}
        value={actual}
        onChange={(e) => navegar(rutaEquivalente(pathname, e.target.value || null))}
        className="h-8 max-w-64 rounded-sg-md border border-sg-border-strong bg-sg-surface px-2 text-sm"
      >
        <option value="">{t('contexto.todos')}</option>
        {lista.map((p) => (
          <option key={p.id} value={p.id}>
            {String(atributo(p, 'code') ?? '')} · {String(atributo(p, 'name') ?? '')}
          </option>
        ))}
      </select>
    </label>
  )
}
