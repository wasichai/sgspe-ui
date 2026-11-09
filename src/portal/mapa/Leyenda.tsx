import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { colorCss } from './colores'
import { estiloDeCapa } from './paleta'

// la leyenda de las capas encendidas con la paleta compartida (RQ-GIS-014, spec F6 §3.7): el mismo color y el mismo trazo que
// la tesela WMS y el mapa de informe. el color es el de la capa: un hex de la paleta compartida o un token del mapa (estilos.ts)
export function Leyenda({ ids }: { ids: readonly string[] }) {
  const { t } = useTranslation(NS)
  if (ids.length === 0) return null
  return (
    <section aria-label={t('sig.leyenda')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('sig.leyenda')}</h2>
      <ul className="space-y-1">
        {ids.map((id) => (
          <li key={id} className="flex items-center gap-2">
            <MuestraDeCapa id={id} />
            <span>{t(`mapa.capasNombre.${id}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// la muestra de una capa con la paleta compartida: el color, el trazo (continuo o discontinuo) y el relleno de la tesela. la usa
// también el panel de capas de S12, que une capas y leyenda (DD-11)
export function MuestraDeCapa({ id }: { id: string }) {
  const estilo = estiloDeCapa(id)
  const relleno = estilo.colorDeRelleno ?? estilo.color
  // el relleno va en su propia capa con la opacidad de la tesela: el color puede ser un token (var()) y no admite sufijo alfa
  return (
    <span
      aria-hidden
      data-color={estilo.color}
      className="relative inline-block size-3.5 shrink-0 overflow-hidden rounded-sg-sm"
      style={{ border: `2px ${estilo.trazo ? 'dashed' : 'solid'} ${colorCss(estilo.color)}` }}
    >
      {estilo.fillOpacity > 0 ? <span className="absolute inset-0" style={{ backgroundColor: colorCss(relleno), opacity: estilo.fillOpacity }} /> : null}
    </span>
  )
}
