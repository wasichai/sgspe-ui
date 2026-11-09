import { Button, cn, Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { FolderKanban, House, ListChecks, MapIcon, Plus, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation } from 'react-router'
import { BotonCrear } from '../componentes/BotonCrear'
import { Insignia } from '../componentes/Insignia'
import { NS } from '../i18n'
import { useAtajos } from '../pages/Atajos'
import { useInsignias } from './insignias'
import { useArbol, type ClaveDeSeccion } from './navTree'

// la barra inferior del teléfono (ux-architecture.md §7.1, design-system.md §5.2): por debajo de 640 px, cinco destinos iguales
// en 64 px, la misma para toda cuenta: Inicio · Proyectos · Registrar · Mapa · Tareas. un destino cuya sección la cuenta no
// tiene se dibuja deshabilitado con su motivo en el nombre, para que la barra no cambie de forma. «Registrar» abre las altas que
// la cuenta puede hacer, las mismas del bloque «Registrar» del inicio (useAtajos y BotonCrear, con sus permisos y la elección del
// proyecto); sin ninguna, queda deshabilitado con el motivo. los avisos van en la campana de la cabecera y el resto, en el menú
const DESTINO = 'relative flex flex-1 flex-col items-center justify-center gap-1 text-sg-caption font-semibold'
const ACTIVO = 'font-extrabold text-sg-primary-text before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-sg-primary'

export function BarraInferior() {
  const { t } = useTranslation(NS)
  const secciones = useArbol()
  const insignias = useInsignias()
  const id = useId()
  const tiene = (clave: ClaveDeSeccion) => secciones.some((s) => s.clave === clave)
  const destino = (clave: ClaveDeSeccion, ruta: string, Icono: LucideIcon, rotulo: string, extra?: { insignia?: number | null; fin?: boolean }) => {
    if (!tiene(clave))
      return (
        <button
          type="button"
          disabled
          aria-label={t('shell.sinAcceso', { destino: rotulo })}
          title={t('shell.sinAcceso', { destino: rotulo })}
          className={cn(DESTINO, 'text-sg-text-muted opacity-50')}
        >
          <Icono aria-hidden className="size-6" />
          {rotulo}
        </button>
      )
    const descripcion = extra?.insignia ? `${id}-${clave}` : undefined
    return (
      <NavLink
        to={ruta}
        end={extra?.fin}
        aria-describedby={descripcion}
        className={({ isActive }) => cn(DESTINO, isActive ? ACTIVO : 'text-sg-text-secondary')}
      >
        <Icono aria-hidden className="size-6" />
        {rotulo}
        {extra?.insignia ? (
          <Insignia
            n={extra.insignia}
            id={`${id}-${clave}`}
            descripcion={t('shell.insignias.tareas', { count: extra.insignia })}
            className="absolute top-1.5 left-1/2 ml-2"
          />
        ) : null}
      </NavLink>
    )
  }
  return (
    <nav aria-label={t('shell.accesos')} className="fixed inset-x-0 bottom-0 z-20 flex h-16 border-t-2 border-sg-border-strong bg-sg-surface sm:hidden">
      {destino('dashboard', '/', House, t('secciones.dashboard'), { fin: true })}
      {destino('projects', '/projects', FolderKanban, t('secciones.projects'))}
      <Registrar />
      {destino('territory', '/territory', MapIcon, t('shell.mapa'))}
      {destino('tasks', '/tasks', ListChecks, t('secciones.tasks'), { insignia: insignias.tareas })}
    </nav>
  )
}

function Registrar() {
  const { t } = useTranslation(NS)
  const { ofrecidos, sinDonde, proyecto } = useAtajos()
  const [abierto, setAbierto] = useState(false)
  const { pathname } = useLocation()
  // elegir un alta lleva a su pantalla: el panel se cierra al cambiar de ruta
  useEffect(() => setAbierto(false), [pathname])
  const nada = ofrecidos.length === 0 && !proyecto
  const motivo = sinDonde ? t('miDia.sinAsignacion.titulo') : t('shell.noRegistra')
  return (
    <>
      <button
        type="button"
        disabled={nada}
        aria-label={nada ? `${t('shell.registrar')}: ${motivo}` : undefined}
        title={nada ? motivo : undefined}
        onClick={() => setAbierto(true)}
        className={cn(DESTINO, nada ? 'text-sg-text-muted opacity-50' : 'text-sg-text-secondary')}
      >
        <span
          aria-hidden
          className={cn('flex size-10 items-center justify-center rounded-sg-md', nada ? 'bg-sg-surface-sunken' : 'bg-sg-primary text-sg-on-primary')}
        >
          <Plus className="size-6" />
        </span>
        {t('shell.registrar')}
      </button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="top-auto bottom-0 left-0 max-w-none translate-x-0 translate-y-0 space-y-4 rounded-none rounded-t-sg-md p-4">
          <DialogTitle className="text-sg-h3 font-semibold">{t('shell.queRegistrar')}</DialogTitle>
          {sinDonde ? (
            <DialogDescription>{t('miDia.sinAsignacion.texto')}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{t('shell.queRegistrar')}</DialogDescription>
          )}
          <div className="flex flex-col gap-2 [&>*]:w-full [&_a]:h-12 [&_a]:w-full [&_button]:h-12 [&_button]:w-full">
            {ofrecidos.map((a) => (
              <BotonCrear key={a.clave} objeto={a.objeto} etiqueta={t(`miDia.atajos.${a.clave}`)} resto={a.resto} />
            ))}
            {proyecto ? (
              <Button asChild variant="secondary">
                <Link to="/projects/new">
                  <Plus aria-hidden className="size-4" />
                  {t('miDia.atajos.proyecto')}
                </Link>
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
