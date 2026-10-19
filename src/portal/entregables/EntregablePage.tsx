import { EncabezadoDePagina } from '../componentes/Pagina'
import { ConfirmDialog } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useParams, useSearchParams } from 'react-router'
import { EstadoChip, useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Consulta, NoEsDeSusProyectos } from '../componentes/Estados'
import { DeLista } from '../componentes/LecturaConEstados'
import { texto, useRegistro, useTodos, type Registro } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { seccionDelTipo, useTiposDeEntregable } from './contrato'
import { AccionesDelEntregable } from './Emitir'
import { EditorDeSeccion } from './EditorDeSeccion'
import { PanelDelBorrador } from './PanelDelBorrador'
import { SugerenciaDeSeccion } from './SugerenciaDeSeccion'
import { Versiones } from './Versiones'
import { cambioDespuesDelBorrador, ESTADOS_DE_WF_H, NIVELES_DE_ENTREGABLE, ORIGEN_IA } from './tipos'
import { opcion, rotuloDeOpcion } from '../datos/opciones'

// S50 · entregable por secciones (screens.md, deliverables.md §8): revisar, aprobar y emitir sabiendo que se emite lo revisado.
// la sección abierta viaja en ?seccion=<clave>; sin ella, la primera. una sección cambiada después de congelar el modelo bloquea
// el envío, la aprobación y la emisión (409 SECTIONS_CHANGED): la lista lo marca comparando su updatedAt con draft_generated_at.
// abierto desde los Reportes de un proyecto vive en /projects/:projectId/reports/deliverables/:deliverableId y «Volver» lleva a
// esos Reportes, con el proyecto todavía puesto
export function EntregablePage() {
  const { t } = useTranslation(NS)
  const { projectId, deliverableId = '' } = useParams()
  const entregable = useRegistro('deliverable', deliverableId)
  const reportes = projectId ? `/projects/${encodeURIComponent(projectId)}/reports` : '/reports'
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <Link to={reportes} className="text-sm text-sg-primary-text underline">
        {t('entregables.pagina.volver')}
      </Link>
      <Consulta consulta={entregable} noExiste={<NoEsDeSusProyectos />}>
        {(e) => <Entregable entregable={e} />}
      </Consulta>
    </section>
  )
}

function CaminoDeEstados({ estado }: { estado: string | null | undefined }) {
  const { t } = useTranslation(NS)
  const etiquetas = useEtiquetasDeEstado('deliverable')
  return (
    <nav aria-label={t('entregables.pagina.camino')}>
      <ol className="flex flex-wrap gap-2 text-sm">
        {ESTADOS_DE_WF_H.map((e) => (
          <li
            key={e}
            aria-current={e === estado ? 'step' : undefined}
            className={e === estado ? 'rounded-sg-md bg-sg-primary-soft px-2 py-1 font-medium text-sg-primary-text' : 'px-2 py-1 text-sg-text-muted'}
          >
            {etiquetas[e] ?? e}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Entregable({ entregable }: { entregable: Registro }) {
  const { t } = useTranslation(NS)
  const secciones = useTodos('deliverable_section', { deliverable: entregable.id, sort: 'sort_order', dir: 'asc' })
  // la marca de IA y la guía de cada sección las da el backend (decisión 1 del plan)
  const tipos = useTiposDeEntregable()
  const [busqueda, fijar] = useSearchParams()
  const [sucio, setSucio] = useState(false)
  const tipo = texto(entregable, 'deliverable_type')
  const generadoEl = texto(entregable, 'draft_generated_at') || null
  const lista = secciones.data ?? []
  const actual = lista.find((s) => texto(s, 'section_key') === busqueda.get('seccion')) ?? lista[0]
  // la versión con la que se abrió el editor: otra sección, o la misma releída sin cambios sin guardar, lo vuelve a montar;
  // con cambios, una relectura de la lista no lo toca y el guardado dice 412 con «Recargar» (revisión final, importante 1)
  const [abierta, setAbierta] = useState<{ id: string; updatedAt: string | null } | null>(null)
  const vigente =
    actual && (abierta?.id !== actual.id || (!sucio && abierta.updatedAt !== actual.updatedAt)) ? { id: actual.id, updatedAt: actual.updatedAt } : abierta
  if (vigente !== abierta) setAbierta(vigente)
  const [pendiente, setPendiente] = useState<string | null>(null)
  const abrirSeccion = (clave: string) => {
    const siguiente = new URLSearchParams(busqueda)
    siguiente.set('seccion', clave)
    fijar(siguiente, { replace: true })
  }
  // con cambios sin guardar, cambiar de sección pide confirmación: sin ella se perdería lo escrito
  const elegir = (clave: string) => {
    if (sucio && actual && clave !== texto(actual, 'section_key')) setPendiente(clave)
    else abrirSeccion(clave)
  }
  const descartar = () => {
    if (pendiente === null) return
    setPendiente(null)
    setSucio(false)
    abrirSeccion(pendiente)
  }
  // salir de S50 con cambios sin guardar (por «Volver», la barra lateral o el historial) también pide confirmación. cambiar de
  // sección solo cambia ?seccion= y lo confirma la pregunta de arriba
  const salida = useBlocker(({ currentLocation, nextLocation }) => sucio && currentLocation.pathname !== nextLocation.pathname)
  return (
    <div className="space-y-4">
      <EncabezadoDePagina
        ficha
        antetitulo={[texto(entregable, 'document_code'), rotuloDeOpcion(tipo)].filter(Boolean).join(' · ')}
        titulo={texto(entregable, 'title')}
        chips={
          <>
            <EstadoChip objeto="deliverable" estado={entregable.state} />
            <span className="text-sg-text-secondary">
              {t('entregables.pagina.periodo', {
                desde: diaPe(texto(entregable, 'period_start_date')) || '—',
                hasta: diaPe(texto(entregable, 'period_end_date')) || '—'
              })}
            </span>
            <span className="text-sg-text-secondary">{t('entregables.pagina.niveles', { niveles: NIVELES_DE_ENTREGABLE.map(rotuloDeOpcion).join(', ') })}</span>
          </>
        }
      />
      <CaminoDeEstados estado={entregable.state} />
      <AccionesDelEntregable entregable={entregable} />
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <PanelDelBorrador entregable={entregable} secciones={lista} />
          {tipos.isError ? <p className="text-sg-caption text-sg-warning">{t('entregables.seccion.tiposConError')}</p> : null}
          <nav aria-label={t('entregables.secciones.titulo')} className="space-y-1">
            <DeLista consulta={secciones}>
              {(filas) => (
                <ul className="space-y-1">
                  {filas.map((s) => {
                    const clave = texto(s, 'section_key')
                    const asistida = texto(s, 'content_origin') === ORIGEN_IA
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-current={s.id === actual?.id ? 'true' : undefined}
                          onClick={() => elegir(clave)}
                          className={`w-full space-y-1 rounded-sg-md px-2.5 py-2 text-left text-sm ${s.id === actual?.id ? 'bg-sg-primary-soft' : 'hover:bg-sg-surface-hover'}`}
                        >
                          <span className="block font-medium">{texto(s, 'title')}</span>
                          <span className="flex flex-wrap gap-1 text-sg-caption">
                            <span className={asistida ? 'text-sg-ai' : 'text-sg-text-muted'}>{opcion(s, 'content_origin')}</span>
                            {seccionDelTipo(tipos.data, tipo, clave)?.assisted ? (
                              <span className="text-sg-ai">· {t('entregables.secciones.conIa')}</span>
                            ) : null}
                            {cambioDespuesDelBorrador(s, generadoEl) ? <span className="text-sg-warning">· {t('entregables.secciones.cambiada')}</span> : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </DeLista>
          </nav>
        </aside>
        <div className="space-y-4">
          {actual ? (
            <div className="grid gap-4 xl:grid-cols-[2fr_minmax(0,1fr)]">
              <EditorDeSeccion
                key={`${vigente?.id}:${vigente?.updatedAt}`}
                entregable={entregable}
                seccion={actual}
                guia={seccionDelTipo(tipos.data, tipo, texto(actual, 'section_key'))?.guide}
                alCambiarSucio={setSucio}
              />
              <SugerenciaDeSeccion key={actual.id} entregable={entregable} seccion={actual} sucio={sucio} />
            </div>
          ) : null}
        </div>
      </div>
      <Versiones entregable={entregable} />
      {pendiente !== null ? (
        <ConfirmDialog
          title={t('entregables.seccion.sinGuardar.titulo')}
          description={t('entregables.seccion.sinGuardar.ayuda')}
          cancelLabel={t('entregables.seccion.sinGuardar.cancelar')}
          confirmLabel={t('entregables.seccion.sinGuardar.descartar')}
          variant="danger"
          onConfirm={descartar}
          onCancel={() => setPendiente(null)}
        />
      ) : null}
      {salida.state === 'blocked' ? (
        <ConfirmDialog
          title={t('entregables.seccion.sinGuardar.titulo')}
          description={t('entregables.seccion.sinGuardar.salir')}
          cancelLabel={t('entregables.seccion.sinGuardar.cancelar')}
          confirmLabel={t('entregables.seccion.sinGuardar.descartar')}
          variant="danger"
          onConfirm={() => salida.proceed?.()}
          onCancel={() => salida.reset?.()}
        />
      ) : null}
    </div>
  )
}
