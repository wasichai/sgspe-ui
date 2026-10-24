import { ApiError } from '@wasichai/core'
import { useWorkflow } from '../datos/flujos'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { campoDe, useDefinicion } from '../datos/registros'
import { NS } from '../i18n'
import {
  CasillasDeFiltro,
  ErrorYBotonDeExportar,
  FalloDeProyectos,
  SalidaFueraDeLaOrganizacion,
  SelectorDeNivel,
  AlcanceDeLaExportacion,
  useExportacion,
  useProyectoElegido
} from './exportacion'
import { Seccion } from '../componentes/Seccion'

// S49 en F4 · la matriz de riesgos (POST /api/sgspe/exports/risk-register, api.md §4.13; deliverables.md §10): el proyecto, los
// estados de WF-F, las categorías, los niveles de riesgo y si se suman los cerrados, con el nivel de divulgación y la lista de
// verificación de una salida fuera de la organización. ReportesPage la ofrece con EXPORT sobre social_risk y la monta con key por
// el proyecto de la URL. PUBLICO nunca cuenta los cerrados (decisión 11 del plan 4.2b), y la pantalla lo dice junto a la casilla
const ARCHIVO = 'matriz-de-riesgos.xlsx'
// los valores de risk_level (§10 del análisis), como se guardan
const NIVELES_DE_RIESGO = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO']

export function RegistroDeRiesgos({ niveles }: { niveles: string[] }) {
  const { t } = useTranslation(NS)
  const { proyecto } = useProyectoElegido()
  const definicion = useDefinicion('social_risk')
  const flujo = useWorkflow('social_risk')
  const [estados, setEstados] = useState<Set<string>>(new Set())
  const [categorias, setCategorias] = useState<Set<string>>(new Set())
  const [nivelesDeRiesgo, setNivelesDeRiesgo] = useState<Set<string>>(new Set())
  const [cerrados, setCerrados] = useState(false)
  const exportacion = useExportacion({
    ruta: '/sgspe/exports/risk-register',
    filtros: () => ({
      project: proyecto ? [proyecto] : [],
      state: [...estados],
      category: [...categorias],
      riskLevel: NIVELES_DE_RIESGO.filter((n) => nivelesDeRiesgo.has(n)),
      includeClosed: cerrados
    }),
    nombre: ARCHIVO
  })
  const cambiar =
    <T,>(fijar: (valor: T) => void) =>
    (valor: T) => {
      fijar(valor)
      exportacion.reiniciar()
    }
  const propios = (error: unknown) => ({
    NOT_ASSIGNED: t('reportes.errores.NOT_ASSIGNED'),
    TOO_MANY_RECORDS: t('reportes.riesgos.errores.TOO_MANY_RECORDS'),
    ...(error instanceof ApiError && error.violations.some((v) => v.message === 'INVALID_FILTER' && v.field !== 'filters.project')
      ? { INVALID_FILTER: t('reportes.riesgos.errores.INVALID_FILTER') }
      : {})
  })
  return (
    <Seccion titulo={t('reportes.riesgos.titulo')} className="space-y-3">
      <p className="text-sm text-sg-text-secondary">{t('reportes.riesgos.ayuda')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <AlcanceDeLaExportacion proyecto={proyecto} />
        <SelectorDeNivel exportacion={exportacion} niveles={niveles} descripciones="reportes.riesgos.niveles" />
      </div>
      <FalloDeProyectos />
      {flujo.isPending ? (
        <Cargando compacto etiqueta={t('reportes.riesgos.estadosCargando')} />
      ) : flujo.isError && !flujo.data ? (
        <FalloDeLectura error={flujo.error} alReintentar={() => void flujo.refetch()} />
      ) : (
        <CasillasDeFiltro
          leyenda={t('reportes.riesgos.estados')}
          ayuda={t('reportes.riesgos.estadosAyuda')}
          opciones={(flujo.data?.definition.states ?? []).map((s) => ({ valor: s.name, etiqueta: s.label }))}
          elegidas={estados}
          alCambiar={cambiar(setEstados)}
        />
      )}
      {definicion.isError && !definicion.data ? (
        <FalloDeLectura error={definicion.error} alReintentar={() => void definicion.refetch()} />
      ) : (
        <CasillasDeFiltro
          leyenda={t('reportes.riesgos.categorias')}
          ayuda={t('reportes.riesgos.categoriasAyuda')}
          opciones={(campoDe(definicion.data, 'category')?.enumOptions ?? []).map((c) => ({ valor: c, etiqueta: c }))}
          elegidas={categorias}
          alCambiar={cambiar(setCategorias)}
        />
      )}
      <CasillasDeFiltro
        leyenda={t('reportes.riesgos.nivelesDeRiesgo')}
        ayuda={t('reportes.riesgos.nivelesAyuda')}
        opciones={NIVELES_DE_RIESGO.map((n) => ({ valor: n, etiqueta: n }))}
        elegidas={nivelesDeRiesgo}
        alCambiar={cambiar(setNivelesDeRiesgo)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cerrados} onChange={(e) => cambiar(setCerrados)(e.target.checked)} />
        {t('reportes.riesgos.cerrados')}
      </label>
      <SalidaFueraDeLaOrganizacion
        exportacion={exportacion}
        textos={{
          externoAyuda: t('reportes.riesgos.externoAyuda'),
          publicoAyuda: t('reportes.riesgos.publicoAyuda'),
          checklist: t('reportes.riesgos.checklist')
        }}
      />
      <ErrorYBotonDeExportar exportacion={exportacion} propios={propios} etiqueta={t('reportes.riesgos.exportar')} />
    </Seccion>
  )
}
