import { useAuth } from '@wasichai/core'
import { Keyboard, LogOut } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { useNombresDeRol } from '../proyectos/usuarios'
import { useCuenta, useOrganizacion } from '../queries'
import { LanguageMenu } from './LanguageMenu'
import { ThemeMenu } from './ThemeMenu'
import { SelectorDeDensidad } from './densidad'
import { abrirHojaDeAtajos } from './HojaDeAtajos'
import { useCerrarSesion } from '../auth/cerrarSesion'

// la cuenta de quien usa el portal (revisión de UX, etapa 2): pasó del inicio al menú del perfil de la barra superior. usuario,
// organización y roles por su rótulo, que solo lee quien administra (/api/roles); sin él, cuántos son, nunca su código técnico.
// lo que no se pudo leer se dice; nunca se inventa
export function DatosDeLaCuenta() {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  const cuenta = useCuenta()
  const organizacion = useOrganizacion()
  const nombresDeRol = useNombresDeRol()
  const rolesDe = (roles: string[]) => {
    const rotulos = roles.map((r) => nombresDeRol.data?.find((x) => x.name === r)?.label).filter(Boolean)
    return rotulos.length === roles.length ? rotulos.join(', ') : t('inicio.rolesAsignados', { count: roles.length })
  }
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      <dt className="text-sg-text-muted">{t('inicio.usuario')}</dt>
      <dd className="break-words">{user ? `${user.displayName} (${user.email})` : ''}</dd>
      <dt className="text-sg-text-muted">{t('inicio.organizacion')}</dt>
      <dd>{organizacion.isPending ? t('inicio.cargando') : organizacion.isError ? t('inicio.sinOrganizacion') : organizacion.data.name}</dd>
      <dt className="text-sg-text-muted">{t('inicio.roles')}</dt>
      <dd>
        {cuenta.isPending
          ? t('inicio.cargando')
          : cuenta.isError
            ? t('inicio.sinCuenta')
            : cuenta.data.roles.length
              ? rolesDe(cuenta.data.roles)
              : t('inicio.sinRoles')}
      </dd>
    </dl>
  )
}

// las iniciales del avatar: las de las dos primeras palabras del nombre
export const iniciales = (nombre: string): string =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase('es'))
    .join('')

// el avatar de la cuenta (el nombre y los rótulos de los roles, en title); abre la cuenta con el idioma, el tema, la densidad y la salida (DD-09: nada de
// eso va suelto en la barra). Escape o un clic fuera lo cierran; el Escape que ya atendió el menú de tema (preventDefault) solo
// cierra ese menú
export function MenuDePerfil({ rotulosDeRol }: { rotulosDeRol: string }) {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  const cerrarSesion = useCerrarSesion()
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  return (
    <div
      ref={raiz}
      className="relative"
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return
        setAbierto(false)
        boton.current?.focus()
      }}
    >
      {/* el avatar de 36 px con las iniciales (design-system.md §5.2); el nombre y los roles por su rótulo, en title y en el menú */}
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        aria-label={t('inicio.cuenta')}
        title={[user?.displayName, rotulosDeRol].filter(Boolean).join(' · ') || user?.email}
        onClick={() => setAbierto((a) => !a)}
        className="flex size-12 items-center justify-center rounded-full md:size-10"
      >
        <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-sg-surface text-sg-body-sm font-extrabold text-sg-primary-text">
          {iniciales(user?.displayName ?? user?.email ?? '')}
        </span>
      </button>
      {abierto ? (
        <div
          id={id}
          role="group"
          aria-label={t('inicio.cuenta')}
          className="absolute top-full right-0 z-30 mt-1 w-80 max-w-[calc(100vw-1rem)] rounded-sg-md border-2 border-sg-border-strong bg-sg-surface-raised p-4 text-left text-sg-text shadow-sg-overlay"
        >
          <DatosDeLaCuenta />
          {/* las preferencias: cada control ya tiene su nombre accesible, el rótulo visible es para la vista */}
          <div className="mt-3 space-y-2 border-t border-sg-border pt-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span aria-hidden className="text-sg-text-muted">
                {t('shell.idioma')}
              </span>
              <LanguageMenu />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span aria-hidden className="text-sg-text-muted">
                {t('shell.tema')}
              </span>
              <ThemeMenu />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span aria-hidden className="text-sg-text-muted">
                {t('shell.densidad.titulo')}
              </span>
              <SelectorDeDensidad />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAbierto(false)
              abrirHojaDeAtajos()
            }}
            className="mt-3 flex h-9 w-full items-center gap-2 rounded-sg-md border-t border-sg-border px-2 pt-1 text-sm text-sg-text-secondary hover:bg-sg-surface-hover hover:text-sg-text"
          >
            <Keyboard aria-hidden className="size-4" />
            <span className="flex-1 text-left">{t('atajos.abrir')}</span>
            <kbd aria-hidden className="rounded-sg-xs border border-sg-border px-1 font-sg-mono text-sg-caption">
              ?
            </kbd>
          </button>
          <button
            type="button"
            onClick={cerrarSesion}
            className="mt-3 flex h-9 w-full items-center gap-2 rounded-sg-md border-t border-sg-border px-2 pt-1 text-sm text-sg-text-secondary hover:bg-sg-surface-hover hover:text-sg-text"
          >
            <LogOut aria-hidden className="size-4" />
            {t('shell.salir')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
