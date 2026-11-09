import { useAuth } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { Check, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { EstadoChip } from '../componentes/EstadoChip'
import { Vacio } from '../componentes/Estados'
import { Etiqueta } from '../componentes/Etiqueta'
import { DeLista } from '../componentes/LecturaConEstados'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { TablaPriorizada, type ColumnaPriorizada } from '../componentes/TablaPriorizada'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyectos } from '../contexto/proyectos'
import { rotuloDeOpcion } from '../datos/opciones'
import { texto, useConteo, useRegistros, type Registro } from '../datos/registros'
import { diaPe, diaYHoraCortaPe, fechaYHoraPe, NS, numeroPe } from '../i18n'
import { AlcanceDeLaExportacion, FalloDeProyectos, useProyectoElegido } from '../reportes/exportacion'
import { useContextFilters } from '../shell/context'
import { NuevoEntregable } from './NuevoEntregable'
import { NIVELES_DE_ENTREGABLE, rutaDeEntregable, T1, T2 } from './tipos'

// los entregables de S49 (screens.md; lienzo S12 de Civic Modern): del proyecto de la barra superior o de todos los que la cuenta
// lee, los más recientes primero, en una tabla compacta con el tipo y los niveles como etiquetas, el estado del borrador (LISTO,
// EN PROCESO, FALLIDO con su causa) y la revisión de sus secciones («N de M»). el título lleva a S50: dentro de un proyecto, bajo
// el proyecto del entregable, para que «Volver» no salga del proyecto. «Nuevo entregable» pide CREATE sobre deliverable y la
// asignación vigente (useEscribeEnProyecto): dentro de un proyecto crea en él y, con el alcance global, pide el proyecto como
// toda alta (BotonCrear); «Plantillas» (S64) es de la administración (decisión 20 del plan)

// la abreviatura de cada tipo (deliverables.md §3: T1 es el diagnóstico social, T2 el informe de campo y avance)
const ABREVIATURA: Record<string, string> = { [T1]: 'T1', [T2]: 'T2' }

// mientras se revisa, cuántas secciones van revisadas; emitido o anulado, la revisión emitida
const EN_CURSO = ['draft', 'in_review', 'observed', 'approved']

// la causa de un borrador FALLIDO: el primer código de draft_warnings (uno por línea, «<código>» o «<código> <sección>»)
export const causaDelFallo = (entregable: Registro): string | null => texto(entregable, 'draft_warnings').trim().split(/\s+/)[0] || null

export function EntregablesDeReportes() {
  const { t } = useTranslation(NS)
  const { isAdmin, can } = useAuth()
  const { proyecto } = useProyectoElegido()
  const entregables = useRegistros('deliverable', { project: proyecto || undefined, sort: 'updated_at', dir: 'desc', size: 50 })
  const escribe = useEscribeEnProyecto(proyecto || undefined)
  // el proyecto del alta: el de la barra o el que se eligió en el diálogo de BotonCrear
  const [nuevo, setNuevo] = useState<string | null>(null)
  const { scope } = useContextFilters()
  const enProyecto = scope.kind === 'project'
  // con el alcance global, la columna del proyecto (su código y su nombre)
  const proyectos = useProyectos()
  const navegar = useNavigate()
  const crea = can('deliverable', 'CREATE')
  const plantillas = isAdmin || can('deliverable', 'MANAGE_METADATA')
  const titulo = t('entregables.lista.titulo')
  const rutaDe = (e: Registro) => rutaDeEntregable(e.id, enProyecto ? texto(e, 'project') : null)
  const columnas: ColumnaPriorizada[] = [
    { id: 'entregable', encabezado: t('entregables.lista.columnas.entregable'), prioridad: 'esencial', titulo: true },
    { id: 'tipo', encabezado: t('entregables.lista.columnas.tipo'), prioridad: 'esencial' },
    ...(enProyecto ? [] : [{ id: 'proyecto', encabezado: t('entregables.lista.columnas.proyecto'), prioridad: 'secundaria' as const }]),
    { id: 'corte', encabezado: t('entregables.lista.columnas.corte'), prioridad: 'esencial' },
    { id: 'estado', encabezado: t('entregables.lista.columnas.estado'), prioridad: 'esencial' },
    { id: 'borrador', encabezado: t('entregables.lista.columnas.borrador'), prioridad: 'esencial' },
    { id: 'revision', encabezado: t('entregables.lista.columnas.revision'), prioridad: 'secundaria' },
    { id: 'niveles', encabezado: t('entregables.lista.columnas.niveles'), prioridad: 'secundaria' }
  ]
  const celda = (e: Registro, columna: string) => {
    switch (columna) {
      case 'entregable':
        // el código en mono arriba y el título como enlace a su página (revisión de UX, etapa 7)
        return <EnlaceDeRegistro codigo={texto(e, 'document_code')} titulo={texto(e, 'title') || texto(e, 'document_code')} ruta={rutaDe(e)} desde={titulo} />
      case 'tipo': {
        const tipo = texto(e, 'deliverable_type')
        return ABREVIATURA[tipo] ? (
          <Etiqueta mono nombre={rotuloDeOpcion(tipo)}>
            {ABREVIATURA[tipo]}
          </Etiqueta>
        ) : (
          rotuloDeOpcion(tipo) || '—'
        )
      }
      case 'proyecto':
        return <ProyectoEnLista proyecto={proyectos.data?.find((p) => p.id === texto(e, 'project'))} />
      case 'corte':
        return <span className="tabular-nums">{diaPe(texto(e, 'cutoff_date') || texto(e, 'period_end_date')) || '—'}</span>
      case 'estado':
        return <EstadoChip objeto="deliverable" estado={e.state} />
      case 'borrador':
        return <BorradorEnLista entregable={e} />
      case 'revision':
        return EN_CURSO.includes(e.state ?? '') ? <RevisionDeSecciones entregable={e.id} /> : texto(e, 'current_revision') || '—'
      case 'niveles':
        return (
          <span className="flex gap-1.5">
            {NIVELES_DE_ENTREGABLE.map((n) => (
              <Etiqueta key={n}>{rotuloDeOpcion(n)}</Etiqueta>
            ))}
          </span>
        )
    }
    return null
  }
  return (
    <section aria-label={titulo} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sg-body-sm text-sg-text-secondary">{t('entregables.lista.ayuda')}</p>
          <AlcanceDeLaExportacion proyecto={proyecto} />
        </div>
        {plantillas || crea ? (
          <div className="flex flex-wrap items-center gap-3">
            {plantillas ? (
              <Link to="/reports/templates" className="text-sm text-sg-primary-text underline">
                {t('entregables.lista.plantillas')}
              </Link>
            ) : null}
            <BotonCrear objeto="deliverable" etiqueta={t('entregables.lista.nuevo')} alElegir={setNuevo} />
          </div>
        ) : null}
      </div>
      <FalloDeProyectos />
      {crea && proyecto && !escribe ? <p className="text-sg-caption text-sg-text-muted">{t('entregables.lista.sinAsignacion')}</p> : null}
      <DeLista consulta={entregables}>
        {(pagina) =>
          pagina.content.length === 0 ? (
            <Vacio titulo={t('entregables.lista.vacio')}>{t('entregables.lista.comoEmpezar')}</Vacio>
          ) : (
            <TablaPriorizada
              etiqueta={titulo}
              columnas={columnas}
              filas={pagina.content}
              clave={(e) => e.id}
              celda={celda}
              alAbrir={(e) => navegar(rutaDe(e))}
              total={pagina.totalElements}
            />
          )
        }
      </DeLista>
      {nuevo ? <NuevoEntregable proyecto={nuevo} alCerrar={() => setNuevo(null)} /> : null}
    </section>
  )
}

// el borrador en la lista: LISTO con su hora, EN COLA o EN PROCESO, FALLIDO en danger con su causa; sin borrador, «—»
function BorradorEnLista({ entregable }: { entregable: Registro }) {
  const { t } = useTranslation(NS)
  const estado = texto(entregable, 'draft_generation_status')
  if (!estado || estado === 'SIN GENERAR') return <span className="text-sg-text-muted">—</span>
  const generado = texto(entregable, 'draft_generated_at')
  const causa = estado === 'FALLIDO' ? causaDelFallo(entregable) : null
  const Icono = estado === 'LISTO' ? Check : estado === 'FALLIDO' ? X : RefreshCw
  return (
    <span className={cn('inline-flex items-center gap-1.5', estado === 'FALLIDO' && 'text-sg-danger')}>
      <Icono aria-hidden className={cn('size-4 shrink-0', estado === 'LISTO' && 'text-sg-success')} />
      <span className="font-bold uppercase">{rotuloDeOpcion(estado)}</span>
      {estado === 'LISTO' && generado ? (
        <time dateTime={generado} title={fechaYHoraPe(new Date(generado))} className="text-sg-caption text-sg-text-secondary">
          · {diaYHoraCortaPe(new Date(generado))}
        </time>
      ) : null}
      {estado === 'FALLIDO' ? (
        <span className="text-sg-caption">· {t(`entregables.lista.causas.${causa ?? 'otra'}`, { defaultValue: t('entregables.lista.causas.otra') })}</span>
      ) : null}
    </span>
  )
}

// «Revisadas: N de M»: dos conteos de las secciones (sin traerlas), mientras el entregable se revisa
function RevisionDeSecciones({ entregable }: { entregable: string }) {
  const { t } = useTranslation(NS)
  const total = useConteo('deliverable_section', { deliverable: entregable })
  const revisadas = useConteo('deliverable_section', { deliverable: entregable, reviewed: true })
  if (total === null || revisadas === null) return <span className="text-sg-text-muted">…</span>
  return <span className="tabular-nums">{t('entregables.secciones.revisadas', { n: numeroPe(revisadas), m: numeroPe(total) })}</span>
}
