import { Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Cargando } from '../componentes/Estados'
import { NS } from '../i18n'
import { useUbicar, type Lugar } from './consultas'

// los lugares que contienen un punto (GET /api/sgspe/territory/locate, caso 16 de gis.md §5.3; decisión 20 del plan 6.3): la unidad
// administrativa, la localidad y la comunidad se proponen y la persona las confirma; la unidad se muestra como contexto (los
// formularios guardan la localidad y la comunidad). la localidad solo se propone por su límite (H6): sin límite no hay propuesta,
// y se dice sin tratarlo como error. un error no bloquea: los lugares se eligen en la lista
export function LugaresDelPunto({
  punto,
  alUsar
}: {
  punto: [number, number] | null
  alUsar: (lugares: { locality: Lugar | null; community: Lugar | null }) => void
}) {
  const { t } = useTranslation(NS)
  const ubicados = useUbicar(punto)
  if (!punto) return null
  const datos = ubicados.data
  const noDisponible = (objeto: string) => datos?.unavailable.includes(objeto) ?? false
  const celda = (objeto: string, lugar: Lugar | null | undefined, detalle?: string | null) => {
    if (noDisponible(objeto)) return <span className="text-sg-text-muted">{t('ubicar.noDisponibleLugar')}</span>
    if (!lugar) return <span>{t('ubicar.ninguno')}</span>
    return (
      <>
        <span>{lugar.name ?? t('ubicar.ninguno')}</span>
        {detalle ? <span className="ml-1 text-sg-caption text-sg-text-muted">({detalle})</span> : null}
      </>
    )
  }
  return (
    <section aria-label={t('ubicar.titulo')} className="space-y-2 rounded-sg-md border border-sg-border p-3 text-sm">
      <h3 className="font-medium">{t('ubicar.titulo')}</h3>
      {ubicados.isPending ? <Cargando compacto /> : null}
      {ubicados.isError ? <p className="text-sg-text-muted">{t('ubicar.noDisponible')}</p> : null}
      {datos ? (
        datos.locality || datos.community || datos.administrativeUnit || datos.unavailable.length > 0 ? (
          <>
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1">
              <dt className="text-sg-text-muted">{t('ubicar.unidad')}</dt>
              <dd>{celda('administrative_unit', datos.administrativeUnit, datos.administrativeUnit?.level)}</dd>
              <dt className="text-sg-text-muted">{t('ubicar.localidad')}</dt>
              <dd>{celda('locality', datos.locality, datos.locality?.localityType)}</dd>
              <dt className="text-sg-text-muted">{t('ubicar.comunidad')}</dt>
              <dd>{celda('community', datos.community)}</dd>
            </dl>
            {!datos.locality && !noDisponible('locality') ? <p className="text-sg-caption text-sg-text-muted">{t('ubicar.sinLimite')}</p> : null}
            {datos.locality || datos.community ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => alUsar({ locality: datos.locality, community: datos.community })}>
                {t('ubicar.usar')}
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sg-text-muted">{t('ubicar.sinLugares')}</p>
            <p className="text-sg-caption text-sg-text-muted">{t('ubicar.sinLimite')}</p>
          </>
        )
      ) : null}
    </section>
  )
}
