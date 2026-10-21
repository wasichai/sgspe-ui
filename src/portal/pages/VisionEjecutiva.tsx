import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { KpiCard } from '../componentes/KpiCard'
import { useCatalogoDeIndicadores, useTablero } from '../datos/indicadores'
import { fechaPe, NS } from '../i18n'
import { CODIGOS_DE_LAS_TILES, type TableroEjecutivo } from '../tableros/contratoF8'
import { useFiltrosDeTablero } from '../tableros/comunes'

// la visión ejecutiva del inicio (rediseño de UX, DD-01): las cifras de la revisión ejecutiva (S51) que la cuenta lee, con su
// fecha de cálculo y el enlace a la revisión completa. solo se pide el tablero si el catálogo del tenant lo ofrece, y una cifra
// que la cuenta no lee no se muestra: sin ninguna, el bloque no se dibuja (el inicio nunca es un tablero de «No disponible»)
export function VisionEjecutiva() {
  const { t } = useTranslation(NS)
  const catalogo = useCatalogoDeIndicadores()
  const ofrecido = (catalogo.data ?? []).some((i) => i.dashboard === 'executive' && i.available)
  if (!ofrecido) return null
  return <CifrasEjecutivas titulo={t('miDia.vision.titulo')} />
}

function CifrasEjecutivas({ titulo }: { titulo: string }) {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosDeTablero()
  const tablero = useTablero<TableroEjecutivo>('executive', filtros)
  const legibles = CODIGOS_DE_LAS_TILES.flatMap((code) => tablero.data?.indicators.find((i) => i.code === code && i.available) ?? [])
  if (!tablero.data || legibles.length === 0) return null
  return (
    <section aria-labelledby="inicio-vision" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="space-y-1">
          <h2 id="inicio-vision" className="text-sg-h2 font-semibold text-sg-text">
            {titulo}
          </h2>
          <p className="text-sg-caption text-sg-text-muted">{t('tableros.calculado', { fecha: fechaPe(new Date(tablero.data.computedAt)) })}</p>
        </div>
        <Link to="/dashboards/executive" className="text-sm font-medium text-sg-primary-text">
          {t('miDia.vision.ver')}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {legibles.map((indicador) => (
          <KpiCard key={indicador.code} titulo={indicador.label} indicador={indicador} />
        ))}
      </div>
    </section>
  )
}
