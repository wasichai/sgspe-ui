import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import type { EstadoDeCapa } from '../mapa/api'
import { ControlDeCapas } from '../mapa/ControlDeCapas'

// el panel de capas de S09 y S12 (design-system.md §5.3 «Mapa», DD-11): capas y leyenda en un solo panel, todas las capas en sus
// cuatro grupos (Referencia, Proyecto, Tenencia, Gestión), cada una con su casilla, su muestra de la paleta, su nombre y su código.
// el orden no cambia al encender o apagar una capa: el foco no salta
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
  return (
    <section id={id} aria-label={t('mapa.capas')} className={className}>
      <ControlDeCapas
        etiqueta={t('mapa.paneles.porGrupo')}
        ids={ids}
        encendidas={encendidas}
        estados={estados}
        alCambiar={alCambiar}
        gestion={gestion}
        conLeyenda
        className="space-y-3"
      />
    </section>
  )
}
