import { ChevronDown, ChevronRight } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import type { EstadoDeCapa } from '../mapa/api'
import { ControlDeCapas } from '../mapa/ControlDeCapas'

// el panel de capas de S12 (DD-11, U-10): capas y leyenda en un solo panel. arriba, las capas en el mapa con la muestra de la
// paleta (su leyenda) y su estado; el resto, plegado tras «Todas las capas». lo de arriba se fija al abrir el panel: encender o
// apagar una capa no la cambia de lista mientras el panel sigue abierto, así el foco no salta; al volver a abrirlo, sube
export function PanelDeCapas({
  id,
  ids,
  encendidas,
  estados,
  alCambiar,
  gestion,
  className
}: {
  id: string
  ids: readonly string[]
  encendidas: ReadonlySet<string>
  estados: EstadoDeCapa[]
  alCambiar: (id: string, encendida: boolean) => void
  gestion?: ReactNode
  className?: string
}) {
  const { t } = useTranslation(NS)
  const [arriba] = useState(() => new Set(ids.filter((c) => encendidas.has(c))))
  const [todas, setTodas] = useState(false)
  const idDeTodas = useId()
  const enElMapa = ids.filter((c) => arriba.has(c))
  const resto = ids.filter((c) => !arriba.has(c))
  return (
    <section id={id} aria-label={t('mapa.capas')} className={className}>
      {enElMapa.length > 0 ? (
        <ControlDeCapas
          etiqueta={t('mapa.paneles.enElMapa')}
          ids={enElMapa}
          encendidas={encendidas}
          estados={estados}
          alCambiar={alCambiar}
          conLeyenda
          className="space-y-3"
        />
      ) : (
        <p className="text-sg-caption text-sg-text-muted">{t('mapa.paneles.ningunaEncendida')}</p>
      )}
      <button
        type="button"
        aria-expanded={todas}
        aria-controls={todas ? idDeTodas : undefined}
        onClick={() => setTodas(!todas)}
        className="mt-3 flex items-center gap-1 text-sg-body-sm font-medium text-sg-primary-text"
      >
        {todas ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
        {t('mapa.paneles.todas', { n: resto.length })}
      </button>
      {todas ? (
        <div id={idDeTodas} className="mt-2">
          <ControlDeCapas
            etiqueta={t('mapa.paneles.otras')}
            ids={resto}
            encendidas={encendidas}
            estados={estados}
            alCambiar={alCambiar}
            gestion={gestion}
            conLeyenda
            className="space-y-3"
          />
        </div>
      ) : null}
    </section>
  )
}
