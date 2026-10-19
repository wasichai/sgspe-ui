import { useAuth, useWasichaiConfig } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { ExternalLink, LayoutDashboard, LogOut, Mountain } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router'
import { Campana } from '../avisos/Campana'
import { SelectorDeProyecto } from '../contexto/SelectorDeProyecto'
import { BotonPreguntar, ProveedorDelAsistente } from '../ia/Asistente'
import { NS } from '../i18n'
import { LanguageMenu } from './LanguageMenu'
import { useArbol } from './navTree'
import { ThemeMenu } from './ThemeMenu'
import { useNombresDeRol } from '../proyectos/usuarios'
import { DialogoDeSesionVencida } from '../auth/DialogoDeSesionVencida'

// text-sm es el cuerpo de 14/20 de tokens.css: dentro de cn(), text-sg-body se confundiría con un color
const ENLACE = 'flex h-9 items-center gap-2.5 rounded-sg-md px-2.5 text-sm'
const REPOSO = 'text-sg-text-secondary hover:bg-sg-surface-hover hover:text-sg-text'
// por debajo de xl (1280 px) la navegación se contrae a 52 px: solo íconos, con la etiqueta para lectores y en title
const ROTULO = 'sr-only xl:not-sr-only xl:truncate'

// el shell del portal (docs/ux/ux-architecture.md §7.1): barra superior de 56 px con la marca, el botón Preguntar del
// asistente (S05, desde F7), la campana de avisos (S04, desde F3), el tema, la cuenta con sus roles y la salida; a la izquierda, la
// navegación principal con las secciones que se le ofrecen a la cuenta (useArbol), en su orden; a la derecha, el contenido.
// Administración es un enlace a /admin, fuera del portal. la búsqueda con ⌘K (S03) llega después
export function AppShell() {
  const { t } = useTranslation(NS)
  const { appName } = useWasichaiConfig()
  const { user, signOut } = useAuth()
  // el rol con su rótulo (GET /api/roles, solo para quien administra); su código crudo («COMMUNITY_RELATIONS_OFFICER») no se muestra
  const nombresDeRol = useNombresDeRol()
  const rotulosDeRol = (user?.roles ?? [])
    .map((r) => nombresDeRol.data?.find((x) => x.name === r)?.label)
    .filter(Boolean)
    .join(', ')
  const secciones = useArbol()
  return (
    <ProveedorDelAsistente>
      <div className="flex h-full flex-col bg-sg-bg text-sg-text">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sg-border bg-sg-surface px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-sg-primary-text">
            <Mountain aria-hidden className="size-5" />
            {appName}
          </Link>
          <span className="hidden truncate text-sg-body-sm text-sg-text-muted lg:inline">{t('app.lema')}</span>
          {/* el selector de proyecto ("Todos mis proyectos" o uno) lee y escribe el alcance de la URL (./context.ts); la
            búsqueda con ⌘K (S03) queda para después de F2 */}
          <SelectorDeProyecto />
          <div className="flex-1" />
          {/* el asistente no es una sección (ASM-073): su botón vive aquí y se dibuja si el servidor tiene la IA (F7) */}
          <BotonPreguntar />
          <Campana />
          <LanguageMenu />
          <ThemeMenu />
          <span className="hidden max-w-56 flex-col text-right leading-tight sm:flex" title={user?.email}>
            <span className="truncate text-sg-body-sm text-sg-text">{user?.displayName}</span>
            {rotulosDeRol ? <span className="truncate text-sg-caption text-sg-text-muted">{rotulosDeRol}</span> : null}
          </span>
          <button
            type="button"
            onClick={signOut}
            aria-label={t('shell.salir')}
            title={t('shell.salir')}
            className="flex size-8 items-center justify-center rounded-sg-md text-sg-text-muted hover:bg-sg-surface-hover hover:text-sg-text"
          >
            <LogOut className="size-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1">
          <nav aria-label={t('shell.secciones')} className="w-[52px] shrink-0 border-r border-sg-border bg-sg-surface p-1.5 xl:w-60 xl:p-3">
            <ul className="space-y-0.5">
              {secciones.map((seccion) => {
                const Icono = seccion.icon ?? LayoutDashboard
                const rotulo = t(`secciones.${seccion.clave}`)
                return (
                  <li key={seccion.clave}>
                    {seccion.external ? (
                      <a href={seccion.to} title={rotulo} className={cn(ENLACE, REPOSO)}>
                        <Icono aria-hidden className="size-4 shrink-0" />
                        <span className={ROTULO}>{rotulo}</span>
                        <ExternalLink aria-hidden className="ml-auto hidden size-3 xl:block" />
                      </a>
                    ) : (
                      <NavLink
                        to={seccion.to}
                        end={seccion.to === '/'}
                        title={rotulo}
                        className={({ isActive }) => cn(ENLACE, isActive ? 'bg-sg-primary-soft font-medium text-sg-primary-text' : REPOSO)}
                      >
                        <Icono aria-hidden className="size-4 shrink-0" />
                        <span className={ROTULO}>{rotulo}</span>
                      </NavLink>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>
          <main id="content" className="min-h-0 min-w-0 flex-1 overflow-auto px-4 py-5 md:px-6 2xl:px-8">
            <Outlet />
          </main>
        </div>
      </div>
      <DialogoDeSesionVencida />
    </ProveedorDelAsistente>
  )
}
