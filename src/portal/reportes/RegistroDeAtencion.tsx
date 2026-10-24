import { ApiError, useAuth } from '@wasichai/core'
import { useWorkflow } from '../datos/flujos'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo, SelectNativo } from '../componentes/Campo'
import { AtajosDePeriodo } from '../componentes/AtajosDePeriodo'
import { CampoFecha } from '../componentes/CampoFecha'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { LEE_CONFIDENCIALES, OBJETOS_DE_QCS } from '../datos/atencion'
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

// S49 en F4 · el registro de quejas, consultas y solicitudes (POST /api/sgspe/exports/attention-register, api.md §4.13;
// deliverables.md §10): el proyecto (o «todos mis proyectos»), el periodo de recepción en fechas de Lima, los tipos, los estados
// de los tres workflows, el canal, la categoría y si se suman los originales reclasificados, con el nivel de divulgación y la lista
// de verificación de una salida fuera de la organización (RQ-REP-033). ReportesPage lo ofrece solo con EXPORT sobre los tres
// objetos y lo monta con key por el proyecto de la URL. INTERNO lleva las confidenciales que quien exporta lee; EXTERNO ninguna;
// PUBLICO cuenta lo que quien exporta lee, y la pantalla dice antes si eso incluye todas las confidenciales
const ARCHIVO = 'registro-de-qcs.xlsx'

export function RegistroDeAtencion({ niveles }: { niveles: string[] }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { proyecto } = useProyectoElegido()
  const definicion = useDefinicion('grievance')
  const flujos = [useWorkflow('grievance'), useWorkflow('inquiry'), useWorkflow('stakeholder_request')]
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [tipos, setTipos] = useState<Set<string>>(new Set())
  // la casilla es «tipo:estado»; el filtro manda cada estado una vez (received existe en los tres)
  const [estados, setEstados] = useState<Set<string>>(new Set())
  const [canal, setCanal] = useState('')
  const [categoria, setCategoria] = useState('')
  const [reclasificadas, setReclasificadas] = useState(false)
  const exportacion = useExportacion({
    ruta: '/sgspe/exports/attention-register',
    filtros: () => ({
      project: proyecto ? [proyecto] : [],
      ...(desde ? { periodStart: desde } : {}),
      ...(hasta ? { periodEnd: hasta } : {}),
      type: OBJETOS_DE_QCS.filter((o) => tipos.has(o)),
      state: [...new Set([...estados].map((e) => e.split(':')[1]))],
      ...(canal ? { channel: canal } : {}),
      ...(categoria ? { category: categoria } : {}),
      includeReclassified: reclasificadas
    }),
    nombre: ARCHIVO
  })
  // un filtro nuevo no arrastra el error del pedido anterior
  const cambiar =
    <T,>(fijar: (valor: T) => void) =>
    (valor: T) => {
      fijar(valor)
      exportacion.reiniciar()
    }
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const leeTodas = OBJETOS_DE_QCS.every((o) => can(o, LEE_CONFIDENCIALES))
  // INVALID_FILTER dice a qué filtro culpa: los estados, el periodo o, sobre otro, el texto común
  const propios = (error: unknown) => {
    const campo = error instanceof ApiError ? error.violations.find((v) => v.message === 'INVALID_FILTER')?.field : undefined
    return {
      NOT_ASSIGNED: t('reportes.errores.NOT_ASSIGNED'),
      TOO_MANY_RECORDS: t('reportes.atencion.errores.TOO_MANY_RECORDS'),
      ...(campo === 'filters.state' ? { INVALID_FILTER: t('reportes.atencion.errores.INVALID_FILTER_ESTADOS') } : {}),
      ...(campo === 'filters.periodStart' || campo === 'filters.periodEnd' ? { INVALID_FILTER: t('reportes.atencion.errores.INVALID_FILTER_PERIODO') } : {})
    }
  }
  const flujoCargando = flujos.some((f) => f.isPending)
  const flujoFallido = flujos.find((f) => f.isError && !f.data)
  const casillasDeEstado = OBJETOS_DE_QCS.flatMap((o, i) =>
    (flujos[i].data?.definition.states ?? []).map((s) => ({ valor: `${o}:${s.name}`, etiqueta: `${t(`comun.qcs.${o}`)} · ${s.label}` }))
  )
  return (
    <Seccion titulo={t('reportes.atencion.titulo')} className="space-y-3">
      <p className="text-sm text-sg-text-secondary">{t('reportes.atencion.ayuda')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <AlcanceDeLaExportacion proyecto={proyecto} />
        <SelectorDeNivel exportacion={exportacion} niveles={niveles} descripciones="reportes.atencion.niveles" />
        <div className="space-y-1">
          <CampoFecha
            etiqueta={t('reportes.atencion.desde')}
            valor={desde || null}
            ayuda={t('reportes.atencion.periodoAyuda')}
            alCambiar={(v) => cambiar(setDesde)(v ?? '')}
          />
        </div>
        <CampoFecha etiqueta={t('reportes.atencion.hasta')} valor={hasta || null} alCambiar={(v) => cambiar(setHasta)(v ?? '')} />
        <div className="md:col-span-2">
          <AtajosDePeriodo
            desde={desde}
            hasta={hasta}
            alElegir={(periodo) => {
              cambiar(setDesde)(periodo.desde)
              cambiar(setHasta)(periodo.hasta)
            }}
          />
        </div>
        <Campo etiqueta={t('reportes.atencion.canal')}>
          {(p) => (
            <SelectNativo
              {...p}
              vacio={false}
              value={canal}
              onChange={(e) => cambiar(setCanal)(e.target.value)}
              opciones={[{ valor: '', etiqueta: t('reportes.atencion.todos') }, ...opciones('channel')]}
            />
          )}
        </Campo>
        <Campo etiqueta={t('reportes.atencion.categoria')}>
          {(p) => (
            <SelectNativo
              {...p}
              vacio={false}
              value={categoria}
              onChange={(e) => cambiar(setCategoria)(e.target.value)}
              opciones={[{ valor: '', etiqueta: t('reportes.atencion.todas') }, ...opciones('category')]}
            />
          )}
        </Campo>
      </div>
      <FalloDeProyectos />
      {definicion.isError && !definicion.data ? <FalloDeLectura error={definicion.error} alReintentar={() => void definicion.refetch()} /> : null}
      <CasillasDeFiltro
        leyenda={t('reportes.atencion.tipos')}
        ayuda={t('reportes.atencion.tiposAyuda')}
        opciones={OBJETOS_DE_QCS.map((o) => ({ valor: o, etiqueta: t(`comun.qcs.plural.${o}`) }))}
        elegidas={tipos}
        alCambiar={cambiar(setTipos)}
      />
      {flujoCargando ? (
        <Cargando compacto etiqueta={t('reportes.atencion.estadosCargando')} />
      ) : flujoFallido ? (
        <FalloDeLectura error={flujoFallido.error} alReintentar={() => flujos.forEach((f) => void f.refetch())} />
      ) : (
        <CasillasDeFiltro
          leyenda={t('reportes.atencion.estados')}
          ayuda={t('reportes.atencion.estadosAyuda')}
          opciones={casillasDeEstado}
          elegidas={estados}
          alCambiar={cambiar(setEstados)}
        />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={reclasificadas} onChange={(e) => cambiar(setReclasificadas)(e.target.checked)} />
        {t('reportes.atencion.reclasificadas')}
      </label>
      <SalidaFueraDeLaOrganizacion
        exportacion={exportacion}
        textos={{
          externoAyuda: t('reportes.atencion.externoAyuda'),
          publicoAyuda: t('reportes.atencion.publicoAyuda'),
          checklist: t('reportes.atencion.checklist')
        }}
      />
      {exportacion.nivel === 'PUBLICO' ? (
        <p role="note" className="text-sg-caption text-sg-text-muted">
          {leeTodas ? t('reportes.atencion.publicoConConfidenciales') : t('reportes.atencion.publicoSinConfidenciales')}
        </p>
      ) : null}
      <ErrorYBotonDeExportar exportacion={exportacion} propios={propios} etiqueta={t('reportes.atencion.exportar')} />
    </Seccion>
  )
}
