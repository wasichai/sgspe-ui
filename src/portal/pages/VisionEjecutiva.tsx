import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { KpiCard } from '../componentes/KpiCard'
import { Seccion } from '../componentes/Seccion'
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
    <Seccion
      titulo={titulo}
      descripcion={t('tableros.calculado', { fecha: fechaPe(new Date(tablero.data.computedAt)) })}
      acciones={
        <Link to="/dashboards/executive" className="text-sg-body-sm font-medium text-sg-primary-text no-underline hover:underline focus-visible:underline">
          {t('miDia.vision.ver')}
        </Link>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {legibles.map((indicador) => (
          <KpiCard key={indicador.code} titulo={indicador.label} indicador={indicador} />
        ))}
      </div>
    </Seccion>
  )
}
