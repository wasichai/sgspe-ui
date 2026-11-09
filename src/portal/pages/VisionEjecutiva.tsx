import { Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Seccion } from '../componentes/Seccion'
import { useCatalogoDeIndicadores, useTablero } from '../datos/indicadores'
import { NS } from '../i18n'
import { itemsDeAtencion, ORDEN_DE_ATENCION } from '../tableros/atencionEjecutiva'
import { HoraDeCalculo, useFiltrosDeTablero } from '../tableros/comunes'
import type { TableroEjecutivo } from '../tableros/contratoF8'
import { ListaDeLoCritico } from '../tableros/LoCritico'

// lo ejecutivo del inicio (S02; rediseño de UX, DD-01): «Qué es crítico y dónde se atiende», la misma lista de la revisión
// ejecutiva (S51) con su hora de cálculo, y «Ver la revisión ejecutiva» en el encabezado. solo se pide el tablero si el catálogo
// del tenant lo ofrece, y la lista sale de las cifras de atención que la cuenta lee: sin ninguna, el bloque no se dibuja (el
// inicio nunca es un tablero de «No disponible»)
function useOfreceLaRevision(): boolean {
  const catalogo = useCatalogoDeIndicadores()
  return (catalogo.data ?? []).some((i) => i.dashboard === 'executive' && i.available)
}

// «Ver la revisión ejecutiva», secundaria en el encabezado del inicio, a quien el catálogo se la ofrece
export function EnlaceARevisionEjecutiva() {
  const { t } = useTranslation(NS)
  if (!useOfreceLaRevision()) return null
  return (
    <Button asChild variant="secondary">
      <Link to="/dashboards/executive">{t('miDia.vision.ver')}</Link>
    </Button>
  )
}

export function VisionEjecutiva() {
  if (!useOfreceLaRevision()) return null
  return <LoCriticoDelInicio />
}

function LoCriticoDelInicio() {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosDeTablero()
  const tablero = useTablero<TableroEjecutivo>('executive', filtros)
  const datos = tablero.data
  const legible = (ORDEN_DE_ATENCION as readonly string[]).some((code) => datos?.indicators.some((i) => i.code === code && i.available))
  if (!datos || !legible) return null
  const items = itemsDeAtencion(datos)
  return (
    <Seccion titulo={t('tablerosF8.ejecutivo.critico')} acciones={<HoraDeCalculo instante={datos.computedAt} />}>
      {items.length === 0 ? <p className="text-sg-body-sm text-sg-text-muted">{t('tablerosF8.ejecutivo.sinAtencion')}</p> : <ListaDeLoCritico items={items} />}
    </Seccion>
  )
}
