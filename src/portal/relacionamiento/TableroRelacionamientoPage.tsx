import { Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { KpiCard } from '../componentes/KpiCard'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { desglose, useTablero } from '../datos/indicadores'
import { NS, numeroPe } from '../i18n'
import { Barras, ConsultaDeTablero, diezYOtros, FiltrosDeTablero, indicadorDe, SerieConMeta, useFiltrosDeTablero, Zona } from '../tableros/comunes'

// el tablero de relacionamiento (dashboards.md §5.4, RF-DSH-009), con GET /api/sgspe/dashboards/engagement: actividad por
// tipo (KPI-ENG-01), reuniones al mes frente a la meta (KPI-ENG-02), reuniones informativas en tabla (KPI-ENG-03: el
// porcentaje femenino y los asistentes del AIDS y del AIIS, que son conteos) con las inquietudes resueltas (KPI-ENG-05) y
// temas consultados, los 10 primeros más "Otros" (KPI-ENG-04). 400 TOO_MANY_RECORDS (más de 200 interacciones cuyos vínculos
// se leen, o más de 20 000 filas) deja el tablero en "acote los filtros"
export function TableroRelacionamientoPage() {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosDeTablero()
  const tablero = useTablero('engagement', filtros)
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <h1 className="text-sg-h1 font-semibold">{t('relacionamiento.tableroTitulo')}</h1>
      <FiltrosDeTablero calculado={tablero.data?.computedAt} alActualizar={() => void tablero.refetch()} />
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => {
          const ind = (code: string) => indicadorDe(datos.indicators, code)
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              <Zona titulo={t('relacionamiento.zonas.actividad')} indicador={ind('KPI-ENG-01')}>
                {(i) => (
                  <div className="space-y-2">
                    <KpiCard titulo={i.label} indicador={i} />
                    <Barras titulo={t('relacionamiento.zonas.actividad')} filas={diezYOtros(desglose(i, 'engagement_type'), t('tableros.otros'))} />
                  </div>
                )}
              </Zona>
              <Zona titulo={t('relacionamiento.zonas.reuniones')} indicador={ind('KPI-ENG-02')}>
                {(i) => <SerieConMeta titulo={t('relacionamiento.zonas.reuniones')} serie={i.series ?? []} tipo="bar" />}
              </Zona>
              <Zona titulo={t('relacionamiento.zonas.informativas')} indicador={ind('KPI-ENG-03')}>
                {(i) =>
                  desglose(i, 'engagement').length === 0 ? (
                    <p className="text-sm text-sg-text-muted">{t('tableros.sinDatos')}</p>
                  ) : (
                    <Table aria-label={t('relacionamiento.zonas.informativas')}>
                      <thead>
                        <tr>
                          {(['reunion', 'total', 'femenino', 'aids', 'aiis'] as const).map((c) => (
                            <Th key={c} scope="col">
                              {t(`relacionamiento.columnasInformativas.${c}`)}
                            </Th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {desglose(i, 'engagement').map((f) => (
                          <tr key={f.key}>
                            <Td>{f.label ?? f.key}</Td>
                            <Td className="tabular-nums">{typeof f.value === 'number' ? numeroPe(f.value) : '—'}</Td>
                            <Td className="tabular-nums">{typeof f.femalePercent === 'number' ? `${numeroPe(f.femalePercent)} %` : '—'}</Td>
                            <Td className="tabular-nums">{typeof f.directArea === 'number' ? numeroPe(f.directArea) : '—'}</Td>
                            <Td className="tabular-nums">{typeof f.indirectArea === 'number' ? numeroPe(f.indirectArea) : '—'}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )
                }
              </Zona>
              <Zona titulo={t('relacionamiento.zonas.resueltas')} indicador={ind('KPI-ENG-05')}>
                {/* F4: una pregunta derivada a una QCS confidencial que la cuenta no lee no cuenta como absuelta, y la cifra lo dice */}
                {(i) => <KpiCard titulo={i.label} indicador={i} notas={<NotaDeConfidenciales oculta={i.confidentialHidden} />} />}
              </Zona>
              <Zona titulo={t('relacionamiento.zonas.temas')} indicador={ind('KPI-ENG-04')}>
                {(i) => <Barras titulo={t('relacionamiento.zonas.temas')} filas={diezYOtros(desglose(i, 'topic'), t('tableros.otros'))} />}
              </Zona>
            </div>
          )
        }}
      </ConsultaDeTablero>
    </section>
  )
}
