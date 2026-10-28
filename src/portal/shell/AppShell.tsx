import { VistaPrevia } from '../componentes/VistaPrevia'
import { Rastro } from '../contexto/Rastro'
import { useAuth, useWasichaiConfig } from '@wasichai/core'
import { Dialog, DialogContent, DialogTitle, cn } from '@wasichai/ui'
import { Bell, ExternalLink, House, LayoutDashboard, ListChecks, LogOut, Menu, Mountain, MoreHorizontal, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Campana } from '../avisos/Campana'
import { ChipDeProyecto, SelectorDeProyecto } from '../contexto/SelectorDeProyecto'
import { BotonPreguntar, ProveedorDelAsistente } from '../ia/Asistente'
import { BotonBuscar } from '../busqueda/BusquedaGlobal'
import { NS } from '../i18n'
import { LanguageMenu } from './LanguageMenu'
import { BLOQUES, useArbol } from './navTree'
import { seccionDeRuta } from './seccionActual'
import { useInsignias } from './insignias'
import { DatosDeLaCuenta, MenuDePerfil } from './Perfil'
import { HojaDeAtajos } from './HojaDeAtajos'
import { Insignia } from '../componentes/Insignia'
import { useTituloDeDocumento } from '../componentes/Pagina'
import { ThemeMenu } from './ThemeMenu'
import { useNombresDeRol } from '../proyectos/usuarios'
import { DialogoDeSesionVencida } from '../auth/DialogoDeSesionVencida'
import { useCerrarSesion } from '../auth/cerrarSesion'
import { useLugarDeLaPagina } from './lugarDeLaPagina'

// text-sm es el cuerpo de 14/20 de tokens.css: dentro de cn(), text-sg-body se confundiría con un color
const ENLACE = 'flex h-9 items-center gap-2.5 rounded-sg-md px-2.5 text-sm'
const REPOSO = 'text-sg-text-secondary hover:bg-sg-surface-hover hover:text-sg-text'
const TITULO_DE_BLOQUE = 'px-2.5 pb-1 text-sg-overline font-semibold tracking-wide text-sg-text-muted uppercase'

// cómo se dibuja la lista de secciones (DD-10): la barra lateral expandida desde lg (1024 px; por debajo, 52 px con solo los
// íconos), la barra lateral contraída por la persona (solo íconos a todo ancho) o el panel del menú (tableta y teléfono), con
// las etiquetas siempre a la vista. contraída, la etiqueta queda para lectores y en title, y una línea separa los bloques
type Modo = 'lateral' | 'contraida' | 'panel'
const ESTILOS: Record<Modo, { rotulo: string; titulo: string; bloque: string; insignia: string; externo: string }> = {
  lateral: {
    rotulo: 'sr-only lg:not-sr-only lg:truncate',
    titulo: `sr-only lg:not-sr-only lg:block ${TITULO_DE_BLOQUE}`,
    bloque: 'mt-2 border-t border-sg-border pt-2 lg:mt-4 lg:border-t-0 lg:pt-0',
    insignia: 'absolute top-0.5 right-0.5 lg:static lg:ml-auto',
    externo: 'ml-auto hidden size-3 lg:block'
  },
  contraida: {
    rotulo: 'sr-only',
    titulo: 'sr-only',
    bloque: 'mt-2 border-t border-sg-border pt-2',
    insignia: 'absolute top-0.5 right-0.5',
    externo: 'hidden'
  },
  panel: { rotulo: 'truncate', titulo: `block ${TITULO_DE_BLOQUE}`, bloque: 'mt-4', insignia: 'ml-auto', externo: 'ml-auto size-3' }
}

// «Contraer» la barra lateral se recuerda en este navegador (DD-10). el almacenamiento puede faltar (ventana privada, datos
// bloqueados): sin él, la barra queda expandida
const CLAVE_CONTRAIDA = 'sgspe.navegacion'
function leerContraida(): boolean {
  try {
    return localStorage.getItem(CLAVE_CONTRAIDA) === 'contraida'
  } catch {
    return false
  }
}
function useContraida(): [boolean, () => void] {
  const [contraida, setContraida] = useState(leerContraida)
  const alternar = () =>
    setContraida((antes) => {
      try {
        if (antes) localStorage.removeItem(CLAVE_CONTRAIDA)
        else localStorage.setItem(CLAVE_CONTRAIDA, 'contraida')
      } catch {
        // sin almacenamiento, vale para esta visita
      }
      return !antes
    })
  return [contraida, alternar]
}

// el shell del portal (docs/ux/ux-architecture.md §7.1): barra superior de 56 px con seis controles (DD-09): la marca, el selector
// de proyecto, Buscar, el botón Preguntar del asistente (S05, desde F7), la campana de avisos (S04, desde F3) y la cuenta con
// sus roles, cuyo menú trae el idioma, el tema y la salida; a la izquierda, la
// navegación principal con las secciones que se le ofrecen a la cuenta (useArbol), en su orden; a la derecha, el contenido.
// Administración es S53, que enlaza la consola de /admin. la búsqueda con ⌘K (S03) llega después
export function AppShell() {
  const { t } = useTranslation(NS)
  const { appName } = useWasichaiConfig()
  const { user } = useAuth()
  const cerrarSesion = useCerrarSesion()
  // el rol con su rótulo (GET /api/roles, solo para quien administra); su código crudo («COMMUNITY_RELATIONS_OFFICER») no se muestra
  const nombresDeRol = useNombresDeRol()
  const rotulosDeRol = (user?.roles ?? [])
    .map((r) => nombresDeRol.data?.find((x) => x.name === r)?.label)
    .filter(Boolean)
    .join(', ')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [contraida, alternarContraida] = useContraida()
  // el panel del menú se cierra al cambiar de ruta: al elegir una sección o un proyecto en su selector
  const { pathname } = useLocation()
  useEffect(() => setMenuAbierto(false), [pathname])
  // volver a una lista la deja donde estaba; avanzar a otra página lleva el foco a su título (tercera pasada de UX, 3.6)
  const principal = useRef<HTMLElement>(null)
  useLugarDeLaPagina(principal)
  return (
    <ProveedorDelAsistente>
      <TituloDeSeccion />
      {/* el primer tabulador: saltar la barra y las secciones (WCAG 2.4.1) */}
      <a
        href="#content"
        onClick={(e) => {
          e.preventDefault()
          principal.current?.focus()
        }}
        className="sr-only z-50 rounded-sg-md bg-sg-surface-raised px-3 py-2 text-sm font-medium text-sg-primary-text shadow-sg-md focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t('shell.saltar')}
      </a>
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
          {/* el lema solo desde 1536 px (DD-09; el 2xl de SGSPE es 1440 px): por debajo, la barra no da para él y los seis controles */}
          <span className="hidden truncate text-sg-body-sm text-sg-text-muted min-[96rem]:inline">{t('app.lema')}</span>
          {/* el selector de proyecto ("Todos mis proyectos" o uno) lee y escribe el alcance de la URL (./context.ts) */}
          <SelectorDeProyecto />
          <ChipDeProyecto alAbrir={() => setMenuAbierto(true)} />
          <div className="flex-1" />
          {/* el asistente no es una sección (ASM-073): su botón vive aquí y se dibuja si el servidor tiene la IA (F7) */}
          <BotonBuscar />
          <BotonPreguntar />
          <Campana />
          {/* el idioma, el tema y la salida van en el menú de la cuenta (DD-09, ux-architecture.md §7.1): nada de eso va suelto */}
          <MenuDePerfil rotulosDeRol={rotulosDeRol} />
          {/* «?» abre la hoja de atajos desde cualquier pantalla (tercera pasada de UX, 4.7) */}
          <HojaDeAtajos />
        </header>
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label={t('shell.secciones')}
            className={cn('hidden w-[52px] shrink-0 overflow-y-auto border-r border-sg-border bg-sg-surface p-1.5 md:block', !contraida && 'lg:w-60 lg:p-3')}
          >
            <ListaDeSecciones modo={contraida ? 'contraida' : 'lateral'} />
            {/* «Contraer» solo desde lg: por debajo, la barra ya muestra solo los íconos */}
            <button
              type="button"
              onClick={alternarContraida}
              aria-label={contraida ? t('shell.expandir') : undefined}
              title={contraida ? t('shell.expandir') : undefined}
              className={cn(ENLACE, REPOSO, 'mt-4 hidden w-full lg:flex')}
            >
              {contraida ? <PanelLeftOpen aria-hidden className="size-4 shrink-0" /> : <PanelLeftClose aria-hidden className="size-4 shrink-0" />}
              {contraida ? null : <span className="truncate">{t('shell.contraer')}</span>}
            </button>
          </nav>
          <main
            id="content"
            ref={principal}
            tabIndex={-1}
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
          // el Escape de un combobox abierto (el selector de proyecto) cierra su lista, no el panel
          onEscapeKeyDown={(e) => {
            if (e.target instanceof Element && e.target.getAttribute('aria-expanded') === 'true') e.preventDefault()
          }}
          className="left-0 top-0 flex h-full max-w-xs translate-x-0 translate-y-0 flex-col gap-4 rounded-none rounded-r-sg-xl p-4"
        >
          <DialogTitle className="text-sg-h3 font-semibold">{t('shell.menu')}</DialogTitle>
          <DatosDeLaCuenta />
          <SelectorDeProyecto siempre />
          <nav aria-label={t('shell.seccionesDelMenu')} className="min-h-0 flex-1 overflow-y-auto">
            <ListaDeSecciones modo="panel" alElegir={() => setMenuAbierto(false)} />
          </nav>
          <div className="flex items-center gap-3 border-t border-sg-border pt-3">
            <LanguageMenu />
            <ThemeMenu />
            <button type="button" onClick={cerrarSesion} className="ml-auto flex items-center gap-1 text-sm text-sg-text-secondary">
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

// las secciones que se le ofrecen a la cuenta (useArbol), en su orden y en sus bloques (BLOQUES): en la barra lateral y en el
// panel del menú (elegir una cierra el panel). cada bloque con título es una lista nombrada por él; un bloque sin secciones
// para la cuenta no se dibuja. la sección marcada es la de la ruta (seccionDeRuta): dentro de un proyecto, la del módulo
// abierto. en la barra, QCS se dice «Quejas y solicitudes» (seccionesEnLaBarra, DD-10) y su nombre completo queda en title
function ListaDeSecciones({ modo, alElegir }: { modo: Modo; alElegir?: () => void }) {
  const { t } = useTranslation(NS)
  const secciones = useArbol()
  const actual = seccionDeRuta(useLocation().pathname)
  const insignias = useInsignias()
  const id = useId()
  const estilo = ESTILOS[modo]
  const bloques = BLOQUES.map((bloque) => ({ ...bloque, secciones: secciones.filter((s) => bloque.secciones.includes(s.clave)) })).filter(
    (bloque) => bloque.secciones.length > 0
  )
  return (
    <div>
      {bloques.map((bloque, i) => {
        const idTitulo = bloque.clave ? `${id}-${bloque.clave}` : undefined
        return (
          <div key={bloque.clave ?? bloque.secciones[0].clave} className={i > 0 ? estilo.bloque : undefined}>
            {bloque.clave ? (
              <p id={idTitulo} className={estilo.titulo}>
                {t(`shell.bloques.${bloque.clave}`)}
              </p>
            ) : null}
            <ul aria-labelledby={idTitulo} className="space-y-0.5">
              {bloque.secciones.map((seccion) => {
                const Icono = seccion.icon ?? LayoutDashboard
                const nombre = t(`secciones.${seccion.clave}`)
                const enLaBarra = t(`seccionesEnLaBarra.${seccion.clave}`, { defaultValue: '' }) || nombre
                const marcada = seccion.clave === actual
                const pendientes = seccion.clave === 'tasks' ? insignias.tareas : null
                const idDeEsta = `${id}-${seccion.clave}-insignia`
                return (
                  <li key={seccion.clave}>
                    {seccion.external ? (
                      <a href={seccion.to} title={nombre} onClick={alElegir} className={cn(ENLACE, REPOSO)}>
                        <Icono aria-hidden className="size-4 shrink-0" />
                        <span className={estilo.rotulo}>{nombre}</span>
                        <ExternalLink aria-hidden className={estilo.externo} />
                      </a>
                    ) : (
                      <Link
                        to={seccion.to}
                        title={nombre}
                        aria-current={marcada ? 'page' : undefined}
                        aria-describedby={pendientes ? idDeEsta : undefined}
                        onClick={alElegir}
                        className={cn(ENLACE, 'relative', marcada ? 'bg-sg-primary-soft font-medium text-sg-primary-text' : REPOSO)}
                      >
                        <Icono aria-hidden className="size-4 shrink-0" />
                        <span className={estilo.rotulo}>{enLaBarra}</span>
                        <Insignia
                          n={pendientes}
                          id={idDeEsta}
                          descripcion={t('shell.insignias.tareas', { count: pendientes ?? 0 })}
                          className={estilo.insignia}
                        />
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
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
