import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { estiloDeCapa } from './paleta'

// la leyenda de las capas encendidas con la paleta compartida (RQ-GIS-014, spec F6 §3.7): el mismo color y el mismo trazo que
// la tesela WMS y el mapa de informe. el color de la paleta es la excepción a los tokens: es el de la capa, no de la interfaz
export function Leyenda({ ids }: { ids: readonly string[] }) {
  const { t } = useTranslation(NS)
  if (ids.length === 0) return null
  return (
    <section aria-label={t('sig.leyenda')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('sig.leyenda')}</h2>
      <ul className="space-y-1">
        {ids.map((id) => {
          const estilo = estiloDeCapa(id)
          const relleno = estilo.colorDeRelleno ?? estilo.color
          return (
            <li key={id} className="flex items-center gap-2">
              <span
                aria-hidden
                data-color={estilo.color}
                className="inline-block size-3.5 shrink-0 rounded-sg-sm"
                style={{
                  border: `2px ${estilo.trazo ? 'dashed' : 'solid'} ${estilo.color}`,
                  backgroundColor:
                    estilo.fillOpacity > 0
                      ? `${relleno}${Math.round(estilo.fillOpacity * 255)
                          .toString(16)
                          .padStart(2, '0')}`
                      : 'transparent'
                }}
              />
              <span>{t(`mapa.capasNombre.${id}`)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
