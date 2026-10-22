import { Alert } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Cargando, esIlegible, NoDisponible } from '../componentes/Estados'
import { NS, numeroPe } from '../i18n'
import { useResumenDelArea } from '../territorio/consultas'
import { Seccion } from '../componentes/Seccion'

// el resumen del área de S10 (spec F6 §3.1 caso 15, KPI-TER-02 a 04 del área): la superficie plana, las localidades por tipo y
// los componentes sobre tierras comunales o privadas. una cifra que el servidor no da (permiso o dato que falta) es
// «No disponible», nunca cero; con available false se avisa además que el resumen está incompleto
export function ResumenDelArea({ area }: { area: string }) {
  const { t } = useTranslation(NS)
  const consulta = useResumenDelArea(area)
  const cifra = (v: number | null | undefined, sufijo = '') => (v === null || v === undefined ? <NoDisponible /> : `${numeroPe(v)}${sufijo}`)
  // un 404 es un backend o un tenant sin F6: la pantalla sigue como en F2, sin resumen
  if (consulta.isError && esIlegible(consulta.error)) return null
  return (
    <Seccion titulo={t('sugerencias.resumen.titulo')} className="text-sm">
      {consulta.isPending && consulta.fetchStatus !== 'idle' ? <Cargando /> : null}
      {consulta.isError ? <p className="text-sg-text-muted">{t('sugerencias.resumen.sinResumen')}</p> : null}
      {consulta.data ? (
        <>
          {consulta.data.available === false ? <Alert tone="notice">{t('sugerencias.resumen.incompleto')}</Alert> : null}
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
            <dt className="text-sg-text-muted">{t('sugerencias.resumen.superficie')}</dt>
            <dd>{cifra(consulta.data.areaHa, ' ha')}</dd>
            <dt className="text-sg-text-muted">{t('sugerencias.resumen.localidades')}</dt>
            <dd>
              {consulta.data.localitiesByType === null ? (
                <NoDisponible />
              ) : consulta.data.localitiesByType.length === 0 ? (
                t('fichaTerritorial.ninguna')
              ) : (
                <ul>
                  {consulta.data.localitiesByType.map((l) => (
                    <li key={l.localityType}>{`${l.localityType === 'SIN DATO' ? t('sig.sinDato') : l.localityType}: ${numeroPe(l.count)}`}</li>
                  ))}
                </ul>
              )}
            </dd>
            <dt className="text-sg-text-muted">{t('sugerencias.resumen.comunal')}</dt>
            <dd>{cifra(consulta.data.componentsOnCommunalLand)}</dd>
            <dt className="text-sg-text-muted">{t('sugerencias.resumen.privada')}</dt>
            <dd>{cifra(consulta.data.componentsOnPrivateLand)}</dd>
          </dl>
        </>
      ) : null}
    </Seccion>
  )
}
