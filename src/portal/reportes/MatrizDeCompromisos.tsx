import { ApiError } from '@wasichai/core'
import { useWorkflow } from '../datos/flujos'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo } from '../componentes/Campo'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { texto, useTodos } from '../datos/registros'
import { NS } from '../i18n'
import {
  ErrorYBotonDeExportar,
  FalloDeProyectos,
  SalidaFueraDeLaOrganizacion,
  SelectorDeNivel,
  AlcanceDeLaExportacion,
  useExportacion,
  useProyectoElegido
} from './exportacion'
import { Seccion } from '../componentes/Seccion'

// S49 en F3 · la matriz de compromisos (POST /api/sgspe/exports/commitment-matrix, api.md §4.13; deliverables.md §10): el
// proyecto (o «todos mis proyectos»), la campaña, los estados de WF-D y el nivel de divulgación, con la lista de verificación
// para una salida fuera de la organización (RQ-REP-033). queda en export_log como las demás exportaciones. los textos de cada
// nivel son los de la matriz (reportes.matriz.niveles), no los del registro de grupos de interés. ReportesPage la monta con
// key por el proyecto de la URL: nada de lo elegido para un proyecto pasa a otro
export function MatrizDeCompromisos({ niveles }: { niveles: string[] }) {
  const { t } = useTranslation(NS)
  const flujo = useWorkflow('commitment')
  const { proyecto } = useProyectoElegido()
  const campanas = useTodos('exploration_campaign', { project: proyecto || undefined }, proyecto !== '')
  // la campaña vale solo para el proyecto en que se eligió
  const [elegida, setElegida] = useState<{ valor: string; proyecto: string } | null>(null)
  const campana = elegida && elegida.proyecto === proyecto ? elegida.valor : ''
  const [estados, setEstados] = useState<Set<string>>(new Set())
  const exportacion = useExportacion({
    ruta: '/sgspe/exports/commitment-matrix',
    filtros: () => ({ project: proyecto ? [proyecto] : [], ...(campana ? { explorationCampaign: campana } : {}), state: [...estados] }),
    nombre: 'matriz-de-compromisos.xlsx'
  })
  const etiquetas = (flujo.data?.definition.states ?? []).map((s) => [s.name, s.label] as const)
  // INVALID_FILTER culpa a los estados solo si es sobre filters.state; sobre otro filtro dice el texto común
  const propios = (error: unknown) => ({
    NOT_ASSIGNED: t('reportes.errores.NOT_ASSIGNED'),
    TOO_MANY_RECORDS: t('reportes.matriz.errores.TOO_MANY_RECORDS'),
    ...(error instanceof ApiError && error.violations.some((v) => v.message === 'INVALID_FILTER' && v.field === 'filters.state')
      ? { INVALID_FILTER: t('reportes.matriz.errores.INVALID_FILTER') }
      : {})
  })
  return (
    <Seccion titulo={t('reportes.matriz.titulo')} className="space-y-3">
      <p className="text-sm text-sg-text-secondary">{t('reportes.matriz.ayuda')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <AlcanceDeLaExportacion proyecto={proyecto} />
        {proyecto ? (
          <Campo etiqueta={t('reportes.matriz.campana')}>
            {(p) => (
              <select
                {...p}
                className="h-9 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface px-2.5 text-sm"
                value={campana}
                onChange={(e) => {
                  setElegida({ valor: e.target.value, proyecto })
                  exportacion.reiniciar()
                }}
              >
                <option value="">{campanas.isPending ? t('reportes.matriz.campanasCargando') : t('reportes.matriz.todas')}</option>
                {(campanas.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {texto(c, 'name')}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        ) : null}
        <SelectorDeNivel exportacion={exportacion} niveles={niveles} descripciones="reportes.matriz.niveles" />
      </div>
      <FalloDeProyectos />
      {campanas.isError && !campanas.data ? <FalloDeLectura error={campanas.error} alReintentar={() => void campanas.refetch()} /> : null}
      <fieldset className="space-y-1 text-sm">
        <legend className="font-medium">{t('reportes.matriz.estados')}</legend>
        <p className="text-sg-caption text-sg-text-muted">{t('reportes.matriz.estadosAyuda')}</p>
        <p className="text-sg-caption text-sg-text-muted">{t('reportes.matriz.plazo')}</p>
        {flujo.isPending ? (
          <Cargando compacto etiqueta={t('reportes.matriz.estadosCargando')} />
        ) : flujo.isError && !flujo.data ? (
          <FalloDeLectura error={flujo.error} alReintentar={() => void flujo.refetch()} />
        ) : (
          <div className="flex flex-wrap gap-3">
            {etiquetas.map(([estado, etiqueta]) => (
              <label key={estado} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={estados.has(estado)}
                  onChange={(e) => {
                    const siguiente = new Set(estados)
                    if (e.target.checked) siguiente.add(estado)
                    else siguiente.delete(estado)
                    setEstados(siguiente)
                    exportacion.reiniciar()
                  }}
                />
                {etiqueta}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <SalidaFueraDeLaOrganizacion
        exportacion={exportacion}
        textos={{ externoAyuda: t('reportes.matriz.externoAyuda'), publicoAyuda: t('reportes.matriz.publicoAyuda'), checklist: t('reportes.matriz.checklist') }}
      />
      <ErrorYBotonDeExportar exportacion={exportacion} propios={propios} etiqueta={t('reportes.matriz.exportar')} />
    </Seccion>
  )
}
