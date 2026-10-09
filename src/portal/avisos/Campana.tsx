import { useAuth } from '@wasichai/core'
import { Alert, cn } from '@wasichai/ui'
import { Bell } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import {
  CLASE_DE_TIPO,
  sinBandeja,
  sinLeer,
  useAccionDeAviso,
  useAvisos,
  useFlujoDeAvisos,
  useLeerTodos,
  useResumenDeAvisos,
  type Aviso
} from '../datos/avisos'
import { destinoDeAviso } from '../datos/fichas'
import { fechaYHoraPe, NS } from '../i18n'

// la campana de la barra superior (S04, ux-architecture.md §7.4): el contador de avisos sin leer, vivo por el flujo SSE de
// wasichai-notifications, y los cinco últimos; abrir uno lo marca como leído y lleva a su registro. sin el módulo (404) o para
// una cuenta de servicio (403) la campana no se dibuja
export function Campana() {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  useFlujoDeAvisos(user !== null)
  const resumen = useResumenDeAvisos(user !== null)
  const [abierta, setAbierta] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  const panel = useId()
  // Escape la cierra y devuelve el foco al botón; un clic fuera de la campana y su panel también la cierra
  useEffect(() => {
    if (!abierta) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierta(false)
        boton.current?.focus()
      }
    }
    const alPulsar = (e: PointerEvent) => {
      if (e.target instanceof Node && !contenedor.current?.contains(e.target)) setAbierta(false)
    }
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('pointerdown', alPulsar)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('pointerdown', alPulsar)
    }
  }, [abierta])
  if (resumen.isError && sinBandeja(resumen.error)) return null
  const n = sinLeer(resumen.data)
  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        aria-label={n > 0 ? t('avisos.campana', { n }) : t('avisos.campanaSinNuevos')}
        aria-expanded={abierta}
        // el panel solo existe abierto: cerrado, aria-controls apuntaría a un id que no está
        aria-controls={abierta ? panel : undefined}
        onClick={() => setAbierta(!abierta)}
        className="relative flex size-8 items-center justify-center rounded-sg-md text-sg-text-muted hover:bg-sg-surface-hover hover:text-sg-text"
      >
        <Bell aria-hidden className="size-4" />
        {n > 0 ? (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 min-w-4 rounded-full bg-sg-danger px-1 text-center text-sg-overline font-semibold text-sg-on-critical"
          >
            {n > 99 ? '99+' : n}
          </span>
        ) : null}
      </button>
      {abierta ? <PanelDeAvisos id={panel} alCerrar={() => setAbierta(false)} /> : null}
    </div>
  )
}

function PanelDeAvisos({ id, alCerrar }: { id: string; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const ultimos = useAvisos({ size: 5 })
  const leerTodos = useLeerTodos()
  const mensaje = useMensajeDeError()
  return (
    <div
      id={id}
      role="region"
      aria-label={t('avisos.ultimos')}
      className="absolute right-0 z-50 mt-2 w-80 space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 shadow-sg-md"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('avisos.ultimos')}</h2>
        <button
          type="button"
          className="text-sg-caption text-sg-primary-text underline"
          disabled={leerTodos.isPending}
          onClick={() => leerTodos.mutate(undefined)}
        >
          {t('avisos.leerTodos')}
        </button>
      </div>
      {leerTodos.isError ? <Alert tone="danger">{mensaje(leerTodos.error)}</Alert> : null}
      {ultimos.isPending ? (
        <Cargando compacto />
      ) : ultimos.isError && !ultimos.data ? (
        <FalloDeLectura error={ultimos.error} alReintentar={() => void ultimos.refetch()} />
      ) : ultimos.data.content.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('avisos.vacio')}</p>
      ) : (
        <ul className="space-y-1">
          {ultimos.data.content.map((a) => (
            <ElementoDeAviso key={a.id} aviso={a} alAbrir={alCerrar} />
          ))}
        </ul>
      )}
      <Link to="/notifications" onClick={alCerrar} className="block text-sm text-sg-primary-text underline">
        {t('avisos.verTodos')}
      </Link>
    </div>
  )
}

// un aviso de la campana: abrirlo lo marca como leído (sin esperar: si falla, la bandeja lo sigue mostrando sin leer) y lleva
// a su registro por /r/…
function ElementoDeAviso({ aviso, alAbrir }: { aviso: Aviso; alAbrir: () => void }) {
  const { t } = useTranslation(NS)
  const navegar = useNavigate()
  const accion = useAccionDeAviso()
  const destino = destinoDeAviso(aviso.link)
  const abrir = () => {
    if (!aviso.read) accion.mutate({ aviso, accion: 'read' })
    alAbrir()
    if (destino) navegar(destino)
  }
  return (
    <li>
      <button
        type="button"
        onClick={abrir}
        className={cn('w-full border-l-4 px-2 py-1 text-left text-sm hover:bg-sg-surface-hover', CLASE_DE_TIPO[aviso.kind])}
      >
        <span className={cn('block', !aviso.read && 'font-semibold')}>{aviso.title}</span>
        <span className="block text-sg-caption text-sg-text-muted">
          {t(`avisos.tipos.${aviso.kind}`)} · {fechaYHoraPe(new Date(aviso.publishAt))}
          {!aviso.read ? ` · ${t('avisos.sinLeer')}` : ''}
        </span>
      </button>
    </li>
  )
}
