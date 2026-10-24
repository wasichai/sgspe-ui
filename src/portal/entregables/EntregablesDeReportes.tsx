import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useAuth } from '@wasichai/core'
import { Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BotonCrear } from '../componentes/BotonCrear'
import { EstadoChip } from '../componentes/EstadoChip'
import { Vacio } from '../componentes/Estados'
import { DeLista } from '../componentes/LecturaConEstados'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { texto, useRegistros } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { AlcanceDeLaExportacion, FalloDeProyectos, useProyectoElegido } from '../reportes/exportacion'
import { useContextFilters } from '../shell/context'
import { NuevoEntregable } from './NuevoEntregable'
import { NIVELES_DE_ENTREGABLE, rutaDeEntregable } from './tipos'
import { opcion, rotuloDeOpcion } from '../datos/opciones'

// los entregables de S49 (screens.md): del proyecto de la barra superior o de todos los que la cuenta lee,
// los más recientes primero. el código lleva a S50: dentro de un proyecto, bajo el proyecto del entregable, para que «Volver» no
// salga del proyecto. «Nuevo entregable» pide CREATE sobre deliverable y la asignación vigente (useEscribeEnProyecto): dentro de
// un proyecto crea en él y, con el alcance global, pide el proyecto como toda alta (BotonCrear; rediseño de UX, 2026-10-20: antes
// salía deshabilitado y mandaba al selector); «Plantillas» (S64) es de la administración (decisión 20 del plan)
export function EntregablesDeReportes() {
  const { t } = useTranslation(NS)
  const { isAdmin, can } = useAuth()
  const { proyecto } = useProyectoElegido()
  const entregables = useRegistros('deliverable', { project: proyecto || undefined, sort: 'updated_at', dir: 'desc', size: 50 })
  const escribe = useEscribeEnProyecto(proyecto || undefined)
  // el proyecto del alta: el de la barra o el que se eligió en el diálogo de BotonCrear
  const [nuevo, setNuevo] = useState<string | null>(null)
  const { scope } = useContextFilters()
  const crea = can('deliverable', 'CREATE')
  const titulo = t('entregables.lista.titulo')
  return (
    <section aria-label={titulo} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin || can('deliverable', 'MANAGE_METADATA') ? (
            <Link to="/reports/templates" className="text-sm text-sg-primary-text underline">
              {t('entregables.lista.plantillas')}
            </Link>
          ) : null}
          <BotonCrear objeto="deliverable" etiqueta={t('entregables.lista.nuevo')} alElegir={setNuevo} />
        </div>
      </div>
      <p className="text-sm text-sg-text-secondary">{t('entregables.lista.ayuda')}</p>
      <AlcanceDeLaExportacion proyecto={proyecto} />
      <FalloDeProyectos />
      {crea && proyecto && !escribe ? <p className="text-sg-caption text-sg-text-muted">{t('entregables.lista.sinAsignacion')}</p> : null}
      <DeLista consulta={entregables}>
        {(pagina) =>
          pagina.content.length === 0 ? (
            <Vacio titulo={t('entregables.lista.vacio')} />
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label={titulo}>
                <thead>
                  <tr>
                    {(['entregable', 'tipo', 'corte', 'estado', 'borrador', 'revision', 'niveles'] as const).map((c) => (
                      <Th key={c} scope="col">
                        {t(`entregables.lista.columnas.${c}`)}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagina.content.map((e) => (
                    <tr key={e.id}>
                      {/* el código en gris y el título como enlace a su página (revisión de UX, etapa 7) */}
                      <Td className="text-sm">
                        <EnlaceDeRegistro
                          codigo={texto(e, 'document_code')}
                          titulo={texto(e, 'title') || texto(e, 'document_code')}
                          ruta={rutaDeEntregable(e.id, scope.kind === 'project' ? texto(e, 'project') : null)}
                        />
                      </Td>
                      <Td className="text-sm">{opcion(e, 'deliverable_type')}</Td>
                      <Td className="text-sm">{diaPe(texto(e, 'cutoff_date') || texto(e, 'period_end_date')) || '—'}</Td>
                      <Td className="text-sm">
                        <EstadoChip objeto="deliverable" estado={e.state} />
                      </Td>
                      <Td className="text-sm">{opcion(e, 'draft_generation_status') || '—'}</Td>
                      <Td className="text-sm">{texto(e, 'current_revision') || texto(e, 'draft_revision') || '—'}</Td>
                      <Td className="text-sm">{NIVELES_DE_ENTREGABLE.map(rotuloDeOpcion).join(', ')}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )
        }
      </DeLista>
      {nuevo ? <NuevoEntregable proyecto={nuevo} alCerrar={() => setNuevo(null)} /> : null}
    </section>
  )
}
