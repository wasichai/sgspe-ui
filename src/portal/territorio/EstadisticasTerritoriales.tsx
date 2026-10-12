import { Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { useTablero, type FilaDeDesglose, type Indicador } from '../datos/indicadores'
import { diaPe, fechaPe, NS, numeroPe } from '../i18n'
import { ConsultaDeTablero, indicadorDe, Zona } from '../tableros/comunes'

// las estadísticas del tablero territorial (dashboards.md §5.9, spec F6 §3.2): KPI-TER-02 a 04 en una llamada con el proyecto y el
// periodo del mapa. cada desglose es una tabla (la cifra con su categoría); un indicador que la cuenta no lee dice «No disponible».
// KPI-TER-02 a 04 no aplican el periodo: el servidor lo declara en ignoredFilters y la zona lo dice (Zona → NotasDeIndicador)
const CODIGOS = ['KPI-TER-02', 'KPI-TER-03', 'KPI-TER-04'] as const

export function EstadisticasTerritoriales({ proyecto, periodo }: { proyecto: string; periodo: { periodStart?: string; periodEnd?: string } }) {
  const { t } = useTranslation(NS)
  const tablero = useTablero('territory', {
    project: [proyecto],
    ...(periodo.periodStart ? { periodStart: periodo.periodStart } : {}),
    ...(periodo.periodEnd ? { periodEnd: periodo.periodEnd } : {})
  })
  const desde = periodo.periodStart ? diaPe(periodo.periodStart) : null
  const hasta = periodo.periodEnd ? diaPe(periodo.periodEnd) : null
  return (
    <section aria-label={t('tableroTerritorial.estadisticas')} className="space-y-3">
      <h2 className="text-sg-h2 font-semibold">{t('tableroTerritorial.estadisticas')}</h2>
      {desde || hasta ? (
        <p className="text-sg-caption text-sg-text-muted">
          {t('tableroTerritorial.periodo', {
            rango:
              desde && hasta
                ? t('tableroTerritorial.rangoCompleto', { desde, hasta })
                : desde
                  ? t('tableroTerritorial.periodoDesde', { desde })
                  : t('tableroTerritorial.periodoHasta', { hasta })
          })}
        </p>
      ) : null}
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => (
          <>
            {datos.computedAt ? (
              <p className="text-sg-caption text-sg-text-muted">{t('tableroTerritorial.calculado', { fecha: fechaPe(new Date(datos.computedAt)) })}</p>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-3">
              {CODIGOS.map((code) => (
                <Zona key={code} titulo={t(`tableroTerritorial.zonas.${code}`)} indicador={indicadorDe(datos.indicators, code)}>
                  {(i) => <Tiles indicador={i} />}
                </Zona>
              ))}
            </div>
          </>
        )}
      </ConsultaDeTablero>
    </section>
  )
}

function Tiles({ indicador }: { indicador: Indicador }) {
  const { t } = useTranslation(NS)
  const unidad = indicador.unit ? ` ${indicador.unit}` : ''
  // la categoría tal como se dice: el área por su tipo y versión (nunca el id de la clave), el tipo de miembro por su texto, la
  // tenencia y los demás ENUM por su valor guardado, como en el resto del portal (ASM-025), y los marcadores del servidor SIN DATO
  // y SIN TENENCIA como etiquetas
  const rotulo = (por: string, f: FilaDeDesglose): string => {
    if (por === 'area') return `${String(f.areaType ?? '—')} · v${String(f.versionNumber ?? '—')}`
    if (f.label) return f.label
    if (f.key === 'SIN DATO') return t('tableroTerritorial.sinDato')
    if (f.key === 'SIN TENENCIA') return t('tableroTerritorial.sinTenencia')
    if (por === 'memberType') return t(`tableroTerritorial.tiposDeMiembro.${f.key}`, { defaultValue: f.key })
    return f.key
  }
  return (
    <div className="space-y-2">
      <p className="text-sg-kpi font-semibold tabular-nums">
        {indicador.value === null || indicador.value === undefined ? t('tableroTerritorial.sinCifra') : `${numeroPe(indicador.value)}${unidad}`}
      </p>
      {(indicador.breakdowns ?? []).map((d) => {
        const titulo = t(`tableroTerritorial.desgloses.${d.by}`, { defaultValue: t('tableroTerritorial.desgloseGenerico') })
        // un desglose sin filas lo dice: una tabla con solo su cabecera no distingue la falta de datos de un fallo
        if (d.rows.length === 0)
          return (
            <div key={d.by}>
              <p className="text-sg-caption text-sg-text-muted">{titulo}</p>
              <p className="text-sm text-sg-text-muted">{t('tableroTerritorial.sinDatos')}</p>
            </div>
          )
        return (
          <Table key={d.by} aria-label={titulo}>
            <caption className="text-left text-sg-caption text-sg-text-muted">{titulo}</caption>
            <thead>
              <tr>
                <Th scope="col">{t('tableroTerritorial.categoria')}</Th>
                <Th scope="col">{t('tableroTerritorial.valor')}</Th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((f) => (
                <tr key={f.key}>
                  <Td>{rotulo(d.by, f)}</Td>
                  <Td className="tabular-nums">{f.value === null ? t('tableroTerritorial.sinCifra') : numeroPe(f.value)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )
      })}
    </div>
  )
}
