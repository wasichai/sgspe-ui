import { useAuth } from '@wasichai/core'
import { Alert, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { atributo, texto, useDefinicion, useRegistros } from '../datos/registros'
import { fechaPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'
import {
  ErrorYBotonDeExportar,
  FalloDeProyectos,
  NIVELES,
  SalidaFueraDeLaOrganizacion,
  SelectorDeNivel,
  SelectorDeProyecto,
  useExportacion,
  useProyectoElegido
} from './exportacion'
import { MatrizDeCompromisos } from './MatrizDeCompromisos'
import { RegistroDeAtencion } from './RegistroDeAtencion'
import { RegistroDeRiesgos } from './RegistroDeRiesgos'
import { OBJETOS_DE_QCS } from '../datos/atencion'
import { EntregablesDeReportes } from '../entregables/EntregablesDeReportes'
import { opcion } from '../datos/opciones'
import { Persona } from '../componentes/Persona'

// S49: desde F8 los entregables (EntregablesDeReportes); de F2 a F4 · reportes y exportaciones: el registro de grupos de interés, desde F3 la matriz de compromisos
// (MatrizDeCompromisos, con EXPORT sobre commitment) y desde F4 el registro de quejas, consultas y solicitudes (RegistroDeAtencion,
// con EXPORT sobre los tres objetos) y la matriz de riesgos (RegistroDeRiesgos, con EXPORT sobre social_risk), en XLSX (api.md §4.13) con el nivel de divulgación
// elegido; una salida fuera de la organización exige confirmar la lista de verificación (checklistConfirmed, RQ-REP-033).
// EXTERNO cita a las personas por cargo o por código GI- (un seudónimo, deliverables.md §9.1); PUBLICO marca «reservado»
// todo conteo menor que 5 y advierte no publicar dos salidas que difieran en pocas personas (ASM-088). con un solo proyecto
// sin asignación vigente, 403 NOT_ASSIGNED; pasarse del tope, 400 TOO_MANY_RECORDS; un catálogo vacío en PUBLICO, 409
// CATALOGUE_UNAVAILABLE con el campo.
// toda exportación queda en export_log (RQ-AUD-011). export_log es un objeto reservado: exportar pide EXPORT y CREATE
// sobre él, pero el registro de exportaciones solo se ofrece a quien lo lee (security.md §7.8: SOCIAL_MANAGER y AUDITOR);
// quien no lo lee exporta igual y no ve el historial
const EXPORTACIONES_A_LA_VISTA = 20

export function ReportesPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { scope } = useContextFilters()
  const verHistorial = can('export_log', 'READ')
  // export_log es un objeto reservado: quien no lo lee no pide su definición (los niveles tienen respaldo en NIVELES)
  const definicion = useDefinicion(verHistorial ? 'export_log' : undefined)
  const { proyecto, elegir } = useProyectoElegido()
  const historial = useRegistros(
    'export_log',
    { project: proyecto || undefined, sort: 'exported_at', dir: 'desc', size: EXPORTACIONES_A_LA_VISTA, count: false },
    verHistorial
  )
  const niveles = definicion.data?.fields.find((f) => f.name === 'disclosure_level')?.enumOptions ?? NIVELES
  const exportacion = useExportacion({
    ruta: '/sgspe/exports/stakeholder-register',
    filtros: () => ({ project: proyecto ? [proyecto] : [] }),
    nombre: 'registro-de-grupos-de-interes.xlsx'
  })
  // la matriz se monta por el proyecto de la URL: lo elegido en ella (la campaña, los estados, el nivel) no pasa a otro proyecto
  const delaUrl = scope.kind === 'project' ? scope.projectId : ''

  return (
    <section className="mx-auto max-w-[1100px] space-y-4">
      <h1 className="text-sg-h1 font-semibold">{t('reportes.titulo')}</h1>
      {can('deliverable', 'READ') ? <EntregablesDeReportes /> : null}
      <section aria-label={t('reportes.registroDeGrupos')} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
        <h2 className="text-sg-h3 font-semibold">{t('reportes.registroDeGrupos')}</h2>
        <p className="text-sm text-sg-text-secondary">{t('reportes.registroAyuda')}</p>
        {can('stakeholder', 'EXPORT') ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <SelectorDeProyecto
                proyecto={proyecto}
                alCambiar={(id) => {
                  elegir(id)
                  exportacion.reiniciar()
                }}
              />
              <SelectorDeNivel exportacion={exportacion} niveles={niveles} descripciones="reportes.niveles" />
            </div>
            <FalloDeProyectos />
            <SalidaFueraDeLaOrganizacion
              exportacion={exportacion}
              textos={{ externoAyuda: t('reportes.externoAyuda'), publicoAyuda: t('reportes.publicoAyuda'), checklist: t('reportes.checklist') }}
            />
            <ErrorYBotonDeExportar
              exportacion={exportacion}
              propios={() => ({ NOT_ASSIGNED: t('reportes.errores.NOT_ASSIGNED'), TOO_MANY_RECORDS: t('reportes.errores.TOO_MANY_RECORDS') })}
              etiqueta={t('reportes.exportar')}
            />
          </>
        ) : (
          <Alert tone="notice">{t('reportes.sinPermiso')}</Alert>
        )}
      </section>
      {can('commitment', 'EXPORT') ? <MatrizDeCompromisos key={`compromisos-${delaUrl}`} niveles={niveles} /> : null}
      {OBJETOS_DE_QCS.every((o) => can(o, 'EXPORT')) ? <RegistroDeAtencion key={`atencion-${delaUrl}`} niveles={niveles} /> : null}
      {can('social_risk', 'EXPORT') ? <RegistroDeRiesgos key={`riesgos-${delaUrl}`} niveles={niveles} /> : null}
      {verHistorial ? (
        <section aria-label={t('reportes.historial')} className="space-y-2">
          <h2 className="text-sg-h3 font-semibold">{t('reportes.historial')}</h2>
          <p className="text-sm text-sg-text-muted">{t('reportes.historialAyuda')}</p>
          {historial.isPending ? (
            <Cargando compacto />
          ) : historial.isError && !historial.data ? (
            <FalloDeLectura error={historial.error} alReintentar={() => void historial.refetch()} />
          ) : historial.data && historial.data.content.length === 0 ? (
            <Vacio titulo={t('reportes.historialVacio')} />
          ) : (
            <Table aria-label={t('reportes.historial')}>
              <thead>
                <tr>
                  {(['fecha', 'quien', 'objeto', 'nivel', 'filas'] as const).map((c) => (
                    <Th key={c} scope="col">
                      {t(`reportes.columnas.${c}`)}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(historial.data?.content ?? []).map((e) => (
                  <tr key={e.id}>
                    <Td className="text-sm">{atributo(e, 'exported_at') ? fechaPe(new Date(String(atributo(e, 'exported_at')))) : '—'}</Td>
                    <Td className="text-sm">
                      <Persona correo={texto(e, 'exporter_user_email')} />
                    </Td>
                    <Td className="text-sm">{texto(e, 'object_name')}</Td>
                    <Td className="text-sm">{opcion(e, 'disclosure_level')}</Td>
                    <Td className="text-sm tabular-nums">
                      {atributo(e, 'row_count') === null || atributo(e, 'row_count') === undefined ? '—' : numeroPe(Number(atributo(e, 'row_count')))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      ) : null}
    </section>
  )
}
