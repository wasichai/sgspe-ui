import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { KpiCard } from '../componentes/KpiCard'
import { useTablero, type Indicador, type Tablero } from '../datos/indicadores'
import { NS } from '../i18n'
import { BeneficiariosPorPrograma, Consolidado, ProgramasPorAnio } from '../inversion/TableroInversionPage'
import { MapaDeCalor } from '../riesgos/TableroRiesgosPage'
import { ConsultaDeTablero, indicadorDe, Zona } from '../tableros/comunes'

// S08 desde F8 (screens.md, dashboards.md §5.2): el tablero project en una sola llamada (api.md §4.11), repartido entre las
// zonas del resumen. de(code) da la lectura de un indicador con la forma que el resumen ya usaba para cada consulta (cargando,
// error o el indicador): un indicador que falta en la respuesta sale no disponible, nunca vacío
export type LecturaDeIndicador =
  | { isPending: true; isError: false; data: undefined; error: null; refetch: () => Promise<unknown> }
  | { isPending: false; isError: true; data: undefined; error: unknown; refetch: () => Promise<unknown> }
  | { isPending: false; isError: false; data: Indicador; error: null; refetch: () => Promise<unknown> }

export function useIndicadoresDelProyecto(proyecto: string) {
  const tablero = useTablero('project', { project: [proyecto] })
  const refetch = () => tablero.refetch()
  const de = (code: string): LecturaDeIndicador => {
    if (tablero.data) {
      const data = indicadorDe(tablero.data.indicators, code) ?? { code, label: code, available: false }
      return { isPending: false, isError: false, data, error: null, refetch }
    }
    if (tablero.isError) return { isPending: false, isError: true, data: undefined, error: tablero.error, refetch }
    return { isPending: true, isError: false, data: undefined, error: null, refetch }
  }
  return { tablero, de }
}

const noDisponible = (code: string): Indicador => ({ code, label: code, available: false })

function Grupo({ titulo, enlace, rotulo, children }: { titulo: string; enlace: string; rotulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h3 className="text-sg-h3 font-semibold">{titulo}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      <Link to={enlace} className="text-sg-caption text-sg-primary-text underline">
        {rotulo}
      </Link>
    </section>
  )
}

export function TableroDelProyecto({ tablero, proyecto }: { tablero: UseQueryResult<Tablero>; proyecto: string }) {
  const { t } = useTranslation(NS)
  const base = `/projects/${encodeURIComponent(proyecto)}`
  const titulo = t('tablerosF8.proyecto.titulo')
  return (
    <section aria-label={titulo} className="space-y-3">
      <h2 className="text-sg-h2 font-semibold">{titulo}</h2>
      <ConsultaDeTablero consulta={tablero}>
        {(datos) => {
          const ind = (code: string) => indicadorDe(datos.indicators, code) ?? noDisponible(code)
          const tarjetas = (codigos: string[]) => codigos.map((c) => <KpiCard key={c} titulo={ind(c).label} indicador={ind(c)} />)
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              <Grupo titulo={t('tablerosF8.proyecto.compromisos')} enlace={`${base}/commitments/dashboard`} rotulo={t('tablerosF8.proyecto.verCompromisos')}>
                {tarjetas(['KPI-COM-02', 'KPI-COM-04', 'KPI-COM-06'])}
              </Grupo>
              <Grupo titulo={t('tablerosF8.proyecto.qcs')} enlace={`${base}/attention/dashboard`} rotulo={t('tablerosF8.proyecto.verQcs')}>
                {tarjetas(['KPI-GRV-01', 'KPI-GRV-06'])}
              </Grupo>
              <Zona titulo={t('tablerosF8.proyecto.mapaDeCalor')} indicador={ind('KPI-RSK-02')}>
                {(i) => (
                  <>
                    <MapaDeCalor indicador={i} />
                    <Link to={`${base}/risks/dashboard`} className="text-sg-caption text-sg-primary-text underline">
                      {t('tablerosF8.proyecto.verRiesgos')}
                    </Link>
                  </>
                )}
              </Zona>
              <Zona titulo={t('tablerosF8.proyecto.programas')} indicador={ind('KPI-INV-02')}>
                {(i) => <ProgramasPorAnio indicador={i} />}
              </Zona>
              <Zona titulo={t('tablerosF8.proyecto.inversion')} indicador={ind('KPI-INV-03')}>
                {(i) => <Consolidado indicador={i} />}
              </Zona>
              <Zona titulo={t('tablerosF8.proyecto.beneficiarios')} indicador={ind('KPI-INV-04')}>
                {(i) => (
                  <>
                    <BeneficiariosPorPrograma indicador={i} />
                    <Link to={`${base}/programs/dashboard`} className="text-sg-caption text-sg-primary-text underline">
                      {t('tablerosF8.proyecto.verInversion')}
                    </Link>
                  </>
                )}
              </Zona>
            </div>
          )
        }}
      </ConsultaDeTablero>
    </section>
  )
}
