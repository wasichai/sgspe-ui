import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { VistasDelModulo } from '../componentes/VistasDelModulo'
import { Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { KpiCard, metaDelPeriodo, RejillaDeKpi } from '../componentes/KpiCard'
import { NotaDeConfidenciales } from '../componentes/NotaDeConfidenciales'
import { desglose, useTablero } from '../datos/indicadores'
import { NS, numeroPe } from '../i18n'
import {
  Barras,
  ConsultaDeTablero,
  diezYOtros,
  FiltrosDeTablero,
  HoraDeCalculo,
  indicadorDe,
  NotaAlPie,
  NotasDeIndicador,
  SerieConMeta,
  useFiltrosDeTablero,
  Zona
} from '../tableros/comunes'
import { rotuloDeFila } from '../datos/opciones'

// el tablero de relacionamiento (dashboards.md §5.4, RF-DSH-009), con GET /api/sgspe/dashboards/engagement: actividad por
// tipo (KPI-ENG-01), reuniones al mes frente a la meta (KPI-ENG-02), reuniones informativas en tabla (KPI-ENG-03: el
// porcentaje femenino y los asistentes del AIDS y del AIIS, que son conteos) con las inquietudes resueltas (KPI-ENG-05) y
// temas consultados, los 10 primeros más "Otros" (KPI-ENG-04). 400 TOO_MANY_RECORDS (más de 200 interacciones cuyos vínculos
// se leen, o más de 20 000 filas) deja el tablero en "acote los filtros". como S03, la hora de cálculo va bajo el título y las
// cifras (interacciones, reuniones con la meta del mes e inquietudes resueltas) arriba, en una rejilla
export function TableroRelacionamientoPage() {
  const { t } = useTranslation(NS)
  const filtros = useFiltrosDeTablero()
  const tablero = useTablero('engagement', filtros)
  return (
    <ContenedorDePagina elemento="section">
      <EncabezadoDePagina
        titulo={t('relacionamiento.tableroTitulo')}
        descripcion={tablero.data ? <HoraDeCalculo instante={tablero.data.computedAt} /> : undefined}
        vistas={<VistasDelModulo modulo="engagements" actual="tablero" />}
      />
      <FiltrosDeTablero alActualizar={() => void tablero.refetch()} />
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => {
          const ind = (code: string) => indicadorDe(datos.indicators, code)
          // una cifra que el servidor no devolvió dice «no disponible» en su celda, nunca cero
          const cifra = (code: string, zona: 'actividad' | 'reuniones' | 'resueltas') =>
            ind(code) ?? { code, label: t(`relacionamiento.zonas.${zona}`), available: false }
          const actividad = cifra('KPI-ENG-01', 'actividad')
          const reuniones = cifra('KPI-ENG-02', 'reuniones')
          const resueltas = cifra('KPI-ENG-05', 'resueltas')
          return (
            <div className="space-y-4">
              {/* las notas de la actividad y de las reuniones van en sus zonas, con su gráfico: aquí se dirían dos veces */}
              <RejillaDeKpi etiqueta={t('tableros.cifrasPrincipales')}>
                <KpiCard titulo={actividad.label} indicador={actividad} meta={metaDelPeriodo(actividad)} />
                <KpiCard titulo={reuniones.label} indicador={reuniones} meta={metaDelPeriodo(reuniones)} />
                {/* F4: una pregunta derivada a una QCS confidencial que la cuenta no lee no cuenta como absuelta, y la cifra lo dice */}
                <KpiCard
                  titulo={resueltas.label}
                  indicador={resueltas}
                  meta={metaDelPeriodo(resueltas)}
                  notas={
                    resueltas.available ? (
                      <>
                        <NotasDeIndicador indicador={resueltas} />
                        <NotaDeConfidenciales oculta={resueltas.confidentialHidden} />
                      </>
                    ) : null
                  }
                />
              </RejillaDeKpi>
              <div className="grid gap-4 lg:grid-cols-2">
                <Zona titulo={t('relacionamiento.zonas.actividad')} indicador={ind('KPI-ENG-01')}>
                  {(i) => <Barras titulo={t('relacionamiento.zonas.actividad')} filas={diezYOtros(desglose(i, 'engagement_type'), t('tableros.otros'))} />}
                </Zona>
                <Zona titulo={t('relacionamiento.zonas.reuniones')} indicador={ind('KPI-ENG-02')}>
                  {(i) => <SerieConMeta titulo={t('relacionamiento.zonas.reuniones')} serie={i.series ?? []} tipo="bar" />}
                </Zona>
                <Zona titulo={t('relacionamiento.zonas.informativas')} indicador={ind('KPI-ENG-03')}>
                  {(i) =>
                    desglose(i, 'engagement').length === 0 ? (
                      <p className="text-sm text-sg-text-muted">{t('tableros.sinDatos')}</p>
                    ) : (
                      <>
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
                                <Td>{rotuloDeFila(f)}</Td>
                                <Td className="tabular-nums">{typeof f.value === 'number' ? numeroPe(f.value) : '—'}</Td>
                                <Td className="tabular-nums">{typeof f.femalePercent === 'number' ? `${numeroPe(f.femalePercent)} %` : '—'}</Td>
                                <Td className="tabular-nums">{typeof f.directArea === 'number' ? numeroPe(f.directArea) : '—'}</Td>
                                <Td className="tabular-nums">{typeof f.indirectArea === 'number' ? numeroPe(f.indirectArea) : '—'}</Td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                        {/* un «—» va con su nota al pie (design-system.md §5.3 «Tablas») */}
                        {desglose(i, 'engagement').some((f) => [f.value, f.femalePercent, f.directArea, f.indirectArea].some((v) => typeof v !== 'number')) ? (
                          <NotaAlPie>{t('tableros.sinCifra')}</NotaAlPie>
                        ) : null}
                      </>
                    )
                  }
                </Zona>
                <Zona titulo={t('relacionamiento.zonas.temas')} indicador={ind('KPI-ENG-04')}>
                  {(i) => <Barras titulo={t('relacionamiento.zonas.temas')} filas={diezYOtros(desglose(i, 'topic'), t('tableros.otros'))} />}
                </Zona>
              </div>
            </div>
          )
        }}
      </ConsultaDeTablero>
    </ContenedorDePagina>
  )
}
