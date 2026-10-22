import { VistaPrevia } from '../componentes/VistaPrevia'
import { Rastro } from '../contexto/Rastro'
import { useAuth, useWasichaiConfig } from '@wasichai/core'
import { Dialog, DialogContent, DialogTitle, cn } from '@wasichai/ui'
import { Bell, ExternalLink, House, LayoutDashboard, ListChecks, LogOut, Menu, Mountain, MoreHorizontal } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Campana } from '../avisos/Campana'
import { ChipDeProyecto, SelectorDeProyecto } from '../contexto/SelectorDeProyecto'
import { BotonPreguntar, ProveedorDelAsistente } from '../ia/Asistente'
import { BotonBuscar } from '../busqueda/BusquedaGlobal'
import { NS } from '../i18n'
import { LanguageMenu } from './LanguageMenu'
import { useArbol } from './navTree'
import { seccionDeRuta } from './seccionActual'
import { useInsignias } from './insignias'
import { DatosDeLaCuenta, MenuDePerfil } from './Perfil'
import { Insignia } from '../componentes/Insignia'
import { useTituloDeDocumento } from '../componentes/Pagina'
import { ThemeMenu } from './ThemeMenu'
import { useNombresDeRol } from '../proyectos/usuarios'
import { DialogoDeSesionVencida } from '../auth/DialogoDeSesionVencida'

// text-sm es el cuerpo de 14/20 de tokens.css: dentro de cn(), text-sg-body se confundiría con un color
const ENLACE = 'flex h-9 items-center gap-2.5 rounded-sg-md px-2.5 text-sm'
const REPOSO = 'text-sg-text-secondary hover:bg-sg-surface-hover hover:text-sg-text'
// por debajo de xl (1280 px) la navegación se contrae a 52 px: solo íconos, con la etiqueta para lectores y en title
const ROTULO = 'sr-only xl:not-sr-only xl:truncate'
// en el panel del menú (tableta y teléfono) las etiquetas se ven siempre
const ROTULO_VISIBLE = 'truncate'

// el shell del portal (docs/ux/ux-architecture.md §7.1): barra superior de 56 px con la marca, el botón Preguntar del
// asistente (S05, desde F7), la campana de avisos (S04, desde F3), el tema, la cuenta con sus roles y la salida; a la izquierda, la
// navegación principal con las secciones que se le ofrecen a la cuenta (useArbol), en su orden; a la derecha, el contenido.
// Administración es S53, que enlaza la consola de /admin. la búsqueda con ⌘K (S03) llega después
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
  const [menuAbierto, setMenuAbierto] = useState(false)
  // el panel del menú se cierra al cambiar de ruta: al elegir una sección o un proyecto en su selector
  const { pathname } = useLocation()
  useEffect(() => setMenuAbierto(false), [pathname])
  return (
    <ProveedorDelAsistente>
      <TituloDeSeccion />
      <div className="flex h-full flex-col bg-sg-bg text-sg-text">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-sg-border bg-sg-surface px-4">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-label={t('shell.menu')}
            title={t('shell.menu')}
            className="-ml-1 flex size-8 items-center justify-center rounded-sg-md text-sg-text-secondary hover:bg-sg-surface-hover md:hidden"
          >
            <Menu aria-hidden className="size-5" />
          </button>
          <Link to="/" className="flex items-center gap-2 font-semibold text-sg-primary-text">
            <Mountain aria-hidden className="size-5" />
            {appName}
          </Link>
          <span className="hidden truncate text-sg-body-sm text-sg-text-muted lg:inline">{t('app.lema')}</span>
          {/* el selector de proyecto ("Todos mis proyectos" o uno) lee y escribe el alcance de la URL (./context.ts); la
            búsqueda con ⌘K (S03) queda para después de F2 */}
          <SelectorDeProyecto />
          <ChipDeProyecto alAbrir={() => setMenuAbierto(true)} />
          <div className="flex-1" />
          {/* el asistente no es una sección (ASM-073): su botón vive aquí y se dibuja si el servidor tiene la IA (F7) */}
          <BotonBuscar />
          <BotonPreguntar />
          <Campana />
          <span className="hidden items-center gap-3 sm:flex">
            <LanguageMenu />
            <ThemeMenu />
          </span>
          <MenuDePerfil rotulosDeRol={rotulosDeRol} />
          <button
            type="button"
            onClick={signOut}
            aria-label={t('shell.salir')}
            title={t('shell.salir')}
            className="hidden size-8 items-center justify-center rounded-sg-md text-sg-text-muted hover:bg-sg-surface-hover hover:text-sg-text sm:flex"
          >
            <LogOut className="size-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1">
          <nav aria-label={t('shell.secciones')} className="hidden w-[52px] shrink-0 border-r border-sg-border bg-sg-surface p-1.5 md:block xl:w-60 xl:p-3">
            <ListaDeSecciones rotulo={ROTULO} />
          </nav>
          <main
            id="content"
            className="min-h-0 min-w-0 flex-1 overflow-auto px-4 pt-5 pb-20 has-[[data-barra-de-acciones]]:max-sm:pb-36 sm:pb-5 md:px-6 2xl:px-8"
          >
            {/* el rastro, en un solo lugar para todas las pantallas (revisión de UX, etapa 6): aparece al seguir un enlace */}
            <div className="mx-auto max-w-[1440px] empty:hidden [&:has(nav)]:mb-3">
              <Rastro />
            </div>
            <Outlet />
            <VistaPrevia />
          </main>
        </div>
      </div>
      <BarraInferior alMas={() => setMenuAbierto(true)} />
      <Dialog open={menuAbierto} onOpenChange={setMenuAbierto}>
        <DialogContent
          aria-describedby={undefined}
          className="left-0 top-0 flex h-full max-w-xs translate-x-0 translate-y-0 flex-col gap-4 rounded-none rounded-r-sg-xl p-4"
        >
          <DialogTitle className="text-sg-h3 font-semibold">{t('shell.menu')}</DialogTitle>
          <DatosDeLaCuenta />
          <SelectorDeProyecto siempre />
          <nav aria-label={t('shell.seccionesDelMenu')} className="min-h-0 flex-1 overflow-y-auto">
            <ListaDeSecciones rotulo={ROTULO_VISIBLE} alElegir={() => setMenuAbierto(false)} />
          </nav>
          <div className="flex items-center gap-3 border-t border-sg-border pt-3">
            <LanguageMenu />
            <ThemeMenu />
            <button type="button" onClick={signOut} className="ml-auto flex items-center gap-1 text-sm text-sg-text-secondary">
              <LogOut aria-hidden className="size-4" />
              {t('shell.salir')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <DialogoDeSesionVencida />
    </ProveedorDelAsistente>
  )
}

// el título del documento con la sección de la ruta (D7): la capa más baja; el proyecto y la pantalla lo precisan
function TituloDeSeccion() {
  const { t } = useTranslation(NS)
  const { pathname } = useLocation()
  const clave = seccionDeRuta(pathname)
  useTituloDeDocumento(clave ? t(`secciones.${clave}`) : pathname === '/notifications' ? t('avisos.titulo') : '', 0)
  return null
}

// las secciones que se le ofrecen a la cuenta (useArbol), en su orden: en la barra lateral (rótulo solo desde xl) y en el
// panel del menú (rótulo siempre, y elegir una cierra el panel)
// la sección marcada es la de la ruta (seccionDeRuta): dentro de un proyecto, la del módulo abierto. un nombre largo se ve
// corto («QCS») y el completo queda en aria-label y en title
function ListaDeSecciones({ rotulo, alElegir }: { rotulo: string; alElegir?: () => void }) {
  const { t } = useTranslation(NS)
  const secciones = useArbol()
  const actual = seccionDeRuta(useLocation().pathname)
  const insignias = useInsignias()
  const idInsignia = useId()
  return (
    <ul className="space-y-0.5">
      {secciones.map((seccion) => {
        const Icono = seccion.icon ?? LayoutDashboard
        const nombre = t(`secciones.${seccion.clave}`)
        const corto = t(`seccionesCortas.${seccion.clave}`, { defaultValue: '' })
        const marcada = seccion.clave === actual
        const pendientes = seccion.clave === 'tasks' ? insignias.tareas : null
        const idDeEsta = `${idInsignia}-${seccion.clave}`
        return (
          <li key={seccion.clave}>
            {seccion.external ? (
              <a href={seccion.to} title={nombre} onClick={alElegir} className={cn(ENLACE, REPOSO)}>
                <Icono aria-hidden className="size-4 shrink-0" />
                <span className={rotulo}>{nombre}</span>
                <ExternalLink aria-hidden className="ml-auto hidden size-3 xl:block" />
              </a>
            ) : (
              <Link
                to={seccion.to}
                title={nombre}
                aria-label={corto ? nombre : undefined}
                aria-current={marcada ? 'page' : undefined}
                aria-describedby={pendientes ? idDeEsta : undefined}
                onClick={alElegir}
                className={cn(ENLACE, 'relative', marcada ? 'bg-sg-primary-soft font-medium text-sg-primary-text' : REPOSO)}
              >
                <Icono aria-hidden className="size-4 shrink-0" />
                <span className={rotulo}>{corto || nombre}</span>
                <Insignia
                  n={pendientes}
                  id={idDeEsta}
                  descripcion={t('shell.insignias.tareas', { count: pendientes ?? 0 })}
                  className={rotulo === ROTULO ? 'absolute top-0.5 right-0.5 xl:static xl:ml-auto' : 'ml-auto'}
                />
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// la barra inferior del teléfono (ux-architecture.md §7.1): cuatro destinos con objetivos de 48 px; Tareas solo si la cuenta
// tiene la sección, y Más abre el panel del menú con el resto
function BarraInferior({ alMas }: { alMas: () => void }) {
  const { t } = useTranslation(NS)
  const conTareas = useArbol().some((s) => s.clave === 'tasks')
  const insignias = useInsignias()
  const id = useId()
  const destino = 'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-sg-caption'
  const estilo = ({ isActive }: { isActive: boolean }) => cn(destino, isActive ? 'text-sg-primary-text' : 'text-sg-text-secondary')
  return (
    <nav aria-label={t('shell.accesos')} className="fixed inset-x-0 bottom-0 z-20 flex border-t border-sg-border bg-sg-surface sm:hidden">
      <NavLink to="/" end className={estilo}>
        <House aria-hidden className="size-5" />
        {t('secciones.dashboard')}
      </NavLink>
      {conTareas ? (
        <NavLink to="/tasks" aria-describedby={insignias.tareas ? `${id}-tareas` : undefined} className={(e) => cn(estilo(e), 'relative')}>
          <ListChecks aria-hidden className="size-5" />
          {t('secciones.tasks')}
          <Insignia
            n={insignias.tareas}
            id={`${id}-tareas`}
            descripcion={t('shell.insignias.tareas', { count: insignias.tareas ?? 0 })}
            className="absolute top-1 left-1/2 ml-2"
          />
        </NavLink>
      ) : null}
      <NavLink to="/notifications" aria-describedby={insignias.avisos ? `${id}-avisos` : undefined} className={(e) => cn(estilo(e), 'relative')}>
        <Bell aria-hidden className="size-5" />
        {t('avisos.titulo')}
        <Insignia
          n={insignias.avisos}
          id={`${id}-avisos`}
          descripcion={t('shell.insignias.avisos', { count: insignias.avisos ?? 0 })}
          className="absolute top-1 left-1/2 ml-2"
        />
      </NavLink>
      <button type="button" onClick={alMas} className={cn(destino, 'text-sg-text-secondary')}>
        <MoreHorizontal aria-hidden className="size-5" />
        {t('shell.mas')}
      </button>
    </nav>
  )
}
