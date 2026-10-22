import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useAuth } from '@wasichai/core'
import { Button, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
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
import { Seccion } from '../componentes/Seccion'

// los entregables de S49 (screens.md): del proyecto de la barra superior o de todos los que la cuenta lee,
// los más recientes primero. el código lleva a S50: dentro de un proyecto, bajo el proyecto del entregable, para que «Volver» no
// salga del proyecto. «Nuevo entregable» pide un proyecto, CREATE sobre deliverable y la asignación
// vigente (useEscribeEnProyecto); «Plantillas» (S64) es de la administración (decisión 20 del plan)
export function EntregablesDeReportes() {
  const { t } = useTranslation(NS)
  const { isAdmin, can } = useAuth()
  const { proyecto } = useProyectoElegido()
  const entregables = useRegistros('deliverable', { project: proyecto || undefined, sort: 'updated_at', dir: 'desc', size: 50 })
  const escribe = useEscribeEnProyecto(proyecto || undefined)
  const [nuevo, setNuevo] = useState(false)
  const { scope } = useContextFilters()
  const crea = can('deliverable', 'CREATE')
  const titulo = t('entregables.lista.titulo')
  return (
    <Seccion
      titulo={titulo}
      className="space-y-3"
      acciones={
        isAdmin || can('deliverable', 'MANAGE_METADATA') || crea ? (
          <>
            {isAdmin || can('deliverable', 'MANAGE_METADATA') ? (
              <Link to="/reports/templates" className="text-sm text-sg-primary-text underline">
                {t('entregables.lista.plantillas')}
              </Link>
            ) : null}
            {crea ? (
              <Button size="sm" disabled={!proyecto || !escribe} onClick={() => setNuevo(true)}>
                {t('entregables.lista.nuevo')}
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      <p className="text-sm text-sg-text-secondary">{t('entregables.lista.ayuda')}</p>
      <AlcanceDeLaExportacion proyecto={proyecto} />
      <FalloDeProyectos />
      {crea && !proyecto ? <p className="text-sg-caption text-sg-text-muted">{t('entregables.lista.eligeProyecto')}</p> : null}
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
      {nuevo && proyecto ? <NuevoEntregable proyecto={proyecto} alCerrar={() => setNuevo(false)} /> : null}
    </Seccion>
  )
}
