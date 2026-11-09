import { useAuth, useWasichaiConfig } from '@wasichai/core'
import { Menu, Mountain } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Campana } from '../avisos/Campana'
import { BotonBuscar } from '../busqueda/BusquedaGlobal'
import { SelectorDeProyecto } from '../contexto/SelectorDeProyecto'
import { BotonPreguntar } from '../ia/Asistente'
import { NS } from '../i18n'
import { useNombresDeRol } from '../proyectos/usuarios'
import { useOrganizacion } from '../queries'
import { HojaDeAtajos } from './HojaDeAtajos'
import { MenuDePerfil } from './Perfil'

// la cabecera institucional de Civic Modern (ux-architecture.md §7.1, design-system.md §5.2): 64 px (52 en la densidad compacta)
// en --sg-header con la franja de marca de 4 px debajo; 60 px en tableta y 56 en el teléfono. de izquierda a derecha: el menú
// (por debajo de lg, abre el panel con la navegación), la marca con el lema desde 1536 px, la organización desde xl, la búsqueda
// ⌘K, el selector de alcance desde md, «Preguntar» si el servidor tiene la IA, la campana y la cuenta. el idioma, el tema, la
// densidad y la salida van en el menú de la cuenta (DD-09): nada de eso va suelto
export function Cabecera({ alMenu }: { alMenu: () => void }) {
  const { t } = useTranslation(NS)
  const { appName } = useWasichaiConfig()
  const { user } = useAuth()
  const organizacion = useOrganizacion()
  // el rol con su rótulo (GET /api/roles, solo para quien administra); su código crudo no se muestra
  const nombresDeRol = useNombresDeRol()
  const rotulosDeRol = (user?.roles ?? [])
    .map((r) => nombresDeRol.data?.find((x) => x.name === r)?.label)
    .filter(Boolean)
    .join(', ')
  return (
    <header className="box-content flex h-14 shrink-0 items-center gap-1 border-b-4 border-sg-stripe bg-sg-header px-1 text-sg-header-text sm:gap-2 sm:px-2 md:h-15 md:gap-3 md:px-4 lg:h-sg-masthead lg:gap-4 lg:px-8">
      <button
        type="button"
        onClick={alMenu}
        aria-label={t('shell.menu')}
        title={t('shell.menu')}
        className="flex size-12 shrink-0 items-center justify-center rounded-sg-md hover:bg-sg-header-2 md:size-11 lg:hidden"
      >
        <Menu aria-hidden className="size-6" />
      </button>
      <div className="flex min-w-0 shrink-0 flex-col justify-center">
        <Link to="/" className="flex items-center gap-2.5 rounded-sg-md">
          <span aria-hidden className="hidden size-9 shrink-0 items-center justify-center rounded-sg-md border-2 border-sg-header-text md:flex">
            <Mountain className="size-5" />
          </span>
          <span className="text-sg-h2 font-extrabold tracking-wide">{appName}</span>
        </Link>
        {/* el lema solo desde 1536 px (DD-24; el 2xl de SGSPE es 1440 px) */}
        <span className="hidden truncate pl-11.5 text-sg-body-sm text-sg-header-text/90 min-[96rem]:inline">{t('app.lema')}</span>
      </div>
      {/* la organización, como la lee el menú de la cuenta; sin dato no se inventa */}
      {organizacion.data?.name ? (
        <p className="hidden max-w-50 shrink-0 border-l border-sg-header-text/35 pl-4 text-sg-body-sm leading-tight font-semibold xl:line-clamp-2">
          <span className="sr-only">{t('shell.organizacion')}: </span>
          {organizacion.data.name}
        </p>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2 md:justify-start lg:gap-4">
        <BotonBuscar />
        <div className="hidden flex-1 md:block" />
        {/* el selector de alcance («Todos mis proyectos» o uno; en Territorio, el lente del mapa) lee y escribe la URL */}
        <SelectorDeProyecto />
        {/* el asistente no es una sección (ASM-073): su botón vive aquí y se dibuja si el servidor tiene la IA (F7) */}
        <BotonPreguntar />
        <Campana />
        <MenuDePerfil rotulosDeRol={rotulosDeRol} />
      </div>
      {/* «?» abre la hoja de atajos desde cualquier pantalla (tercera pasada de UX, 4.7) */}
      <HojaDeAtajos />
    </header>
  )
}
