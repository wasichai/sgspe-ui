import { Dialog, DialogContent, DialogTitle, cn } from '@wasichai/ui'
import { LayoutDashboard, LogOut } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import { DialogoDeSesionVencida } from '../auth/DialogoDeSesionVencida'
import { useCerrarSesion } from '../auth/cerrarSesion'
import { Insignia } from '../componentes/Insignia'
import { ProveedorDeMigas } from '../componentes/Migas'
import { MARGENES_DE_RESPALDO, useTituloDeDocumento } from '../componentes/Pagina'
import { VistaPrevia } from '../componentes/VistaPrevia'
import { BarraDeContexto } from '../contexto/BarraDeContexto'
import { SelectorDeProyecto } from '../contexto/SelectorDeProyecto'
import { ProveedorDelAsistente } from '../ia/Asistente'
import { NS } from '../i18n'
import { BarraInferior } from './BarraInferior'
import { Cabecera } from './Cabecera'
import { LanguageMenu } from './LanguageMenu'
import { NavegacionPrincipal, useNombreEnLaBarra } from './NavegacionPrincipal'
import { BLOQUES, useArbol } from './navTree'
import { DatosDeLaCuenta } from './Perfil'
import { SelectorDeDensidad } from './densidad'
import { useInsignias } from './insignias'
import { useLugarDeLaPagina } from './lugarDeLaPagina'
import { seccionDeRuta } from './seccionActual'
import { ThemeMenu } from './ThemeMenu'

// el shell del portal con la identidad Civic Modern (ux-architecture.md §7.1, design-system.md §5.2, ADR-0032): la cabecera
// institucional (Cabecera), la navegación principal horizontal desde lg (NavegacionPrincipal), la banda de contexto con las
// migas, el rastro y el sello de alcance (BarraDeContexto) y el contenido. por debajo de lg, el menú de la cabecera abre el panel
// con la cuenta, el selector de proyecto, las secciones en sus bloques y las preferencias; por debajo de sm, la barra inferior
// de cinco destinos (BarraInferior). las fichas declaran su registro para las migas (ProveedorDeMigas)
export function AppShell() {
  const { t } = useTranslation(NS)
  const cerrarSesion = useCerrarSesion()
  const [menuAbierto, setMenuAbierto] = useState(false)
  // el panel del menú se cierra al cambiar de ruta: al elegir una sección o un proyecto en su selector
  const { pathname } = useLocation()
  useEffect(() => setMenuAbierto(false), [pathname])
  // volver a una lista la deja donde estaba; avanzar a otra página lleva el foco a su título (tercera pasada de UX, 3.6)
  const principal = useRef<HTMLElement>(null)
  useLugarDeLaPagina(principal)
  return (
    <ProveedorDelAsistente>
      <ProveedorDeMigas>
        <TituloDeSeccion />
        {/* el primer tabulador: saltar la cabecera y la navegación (WCAG 2.4.1) */}
        <a
          href="#content"
          onClick={(e) => {
            e.preventDefault()
            principal.current?.focus()
          }}
          className="sr-only z-50 rounded-sg-md bg-sg-surface-raised px-3 py-2 text-sm font-medium text-sg-primary-text shadow-sg-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t('shell.saltar')}
        </a>
        <div className="flex h-full flex-col bg-sg-bg text-sg-text">
          <Cabecera alMenu={() => setMenuAbierto(true)} />
          <NavegacionPrincipal className="hidden lg:block" />
          <BarraDeContexto />
          {/* los márgenes de la página (16, 24 y 32 px) y el ancho de 1440 los da cada pantalla con ContenedorDePagina; aquí quedan
              solo como respaldo de las que aún no lo usan. abajo, el lugar de la barra inferior de 64 px del teléfono y, en una
              ficha, el de su barra fija de acciones */}
          <main
            id="content"
            ref={principal}
            tabIndex={-1}
            className={cn('min-h-0 min-w-0 flex-1 overflow-auto pb-24 has-[[data-barra-de-acciones]]:max-sm:pb-40 sm:pb-6', MARGENES_DE_RESPALDO)}
          >
            <Outlet />
            <VistaPrevia />
          </main>
        </div>
        <BarraInferior />
        <Dialog open={menuAbierto} onOpenChange={setMenuAbierto}>
          <DialogContent
            aria-describedby={undefined}
            // el Escape de un combobox abierto (el selector de proyecto) cierra su lista, no el panel
            onEscapeKeyDown={(e) => {
              if (e.target instanceof Element && e.target.getAttribute('aria-expanded') === 'true') e.preventDefault()
            }}
            className="top-0 left-0 flex h-full max-w-xs translate-x-0 translate-y-0 flex-col gap-4 rounded-none p-4"
          >
            <DialogTitle className="text-sg-h3 font-semibold">{t('shell.menu')}</DialogTitle>
            <DatosDeLaCuenta />
            <SelectorDeProyecto siempre />
            <nav aria-label={t('shell.seccionesDelMenu')} className="min-h-0 flex-1 overflow-y-auto">
              <ListaDeSecciones alElegir={() => setMenuAbierto(false)} />
            </nav>
            <div className="flex flex-wrap items-center gap-3 border-t border-sg-border pt-3">
              <div className="flex w-full items-center gap-3">
                <span aria-hidden className="text-sm text-sg-text-muted">
                  {t('shell.densidad.titulo')}
                </span>
                <SelectorDeDensidad />
              </div>
              <LanguageMenu />
              <ThemeMenu />
              <button type="button" onClick={cerrarSesion} className="ml-auto flex min-h-11 items-center gap-1 text-sm text-sg-text-secondary">
                <LogOut aria-hidden className="size-4" />
                {t('shell.salir')}
              </button>
            </div>
          </DialogContent>
        </Dialog>
        <DialogoDeSesionVencida />
      </ProveedorDeMigas>
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

// las secciones que se le ofrecen a la cuenta (useArbol), en su orden y en sus bloques (BLOQUES), en el panel del menú de tableta y
// teléfono (elegir una cierra el panel). cada bloque con título es una lista nombrada por él; un bloque sin secciones para la
// cuenta no se dibuja. la sección marcada es la de la ruta (seccionDeRuta): dentro de un proyecto, la del módulo abierto. QCS se
// dice «Quejas y solicitudes» (DD-10) y su nombre completo queda en title
function ListaDeSecciones({ alElegir }: { alElegir: () => void }) {
  const { t } = useTranslation(NS)
  const secciones = useArbol()
  const actual = seccionDeRuta(useLocation().pathname)
  const insignias = useInsignias()
  const nombreDe = useNombreEnLaBarra()
  const id = useId()
  const bloques = BLOQUES.map((bloque) => ({ ...bloque, secciones: secciones.filter((s) => bloque.secciones.includes(s.clave)) })).filter(
    (bloque) => bloque.secciones.length > 0
  )
  return (
    <div className="space-y-4">
      {bloques.map((bloque) => {
        const idTitulo = bloque.clave ? `${id}-${bloque.clave}` : undefined
        return (
          <div key={bloque.clave ?? bloque.secciones[0].clave}>
            {bloque.clave ? (
              <p id={idTitulo} className="px-3 pb-1 text-sg-overline tracking-wide text-sg-text-secondary uppercase">
                {t(`shell.bloques.${bloque.clave}`)}
              </p>
            ) : null}
            <ul aria-labelledby={idTitulo}>
              {bloque.secciones.map((seccion) => {
                const Icono = seccion.icon ?? LayoutDashboard
                const { nombre, completo } = nombreDe(seccion)
                const marcada = seccion.clave === actual
                const pendientes = seccion.clave === 'tasks' ? insignias.tareas : null
                const idDeEsta = `${id}-${seccion.clave}-insignia`
                return (
                  <li key={seccion.clave}>
                    <Link
                      to={seccion.to}
                      title={nombre === completo ? undefined : completo}
                      aria-current={marcada ? 'page' : undefined}
                      aria-describedby={pendientes ? idDeEsta : undefined}
                      onClick={alElegir}
                      className={cn(
                        'flex min-h-11 items-center gap-3 border-l-4 px-3 text-sg-body',
                        marcada
                          ? 'border-sg-primary bg-sg-primary-soft font-bold text-sg-primary-text'
                          : 'border-transparent text-sg-text hover:bg-sg-surface-hover'
                      )}
                    >
                      <Icono aria-hidden className="size-5 shrink-0" />
                      <span className="truncate">{nombre}</span>
                      <Insignia n={pendientes} id={idDeEsta} descripcion={t('shell.insignias.tareas', { count: pendientes ?? 0 })} className="ml-auto" />
                    </Link>
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
