import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { EstadoChip, useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Consulta, NoEsDeSusProyectos } from '../componentes/Estados'
import { DeLista } from '../componentes/LecturaConEstados'
import { texto, useRegistro, useTodos, type Registro } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { seccionDelTipo, useTiposDeEntregable } from './contrato'
import { EditorDeSeccion } from './EditorDeSeccion'
import { SugerenciaDeSeccion } from './SugerenciaDeSeccion'
import { cambioDespuesDelBorrador, ESTADOS_DE_WF_H, NIVELES_DE_ENTREGABLE, ORIGEN_IA } from './tipos'

// S50 · entregable por secciones (screens.md, deliverables.md §8): revisar, aprobar y emitir sabiendo que se emite lo revisado.
// la sección abierta viaja en ?seccion=<clave>; sin ella, la primera. una sección cambiada después de congelar el modelo bloquea
// el envío, la aprobación y la emisión (409 SECTIONS_CHANGED): la lista lo marca comparando su updatedAt con draft_generated_at
export function EntregablePage() {
  const { t } = useTranslation(NS)
  const { deliverableId = '' } = useParams()
  const entregable = useRegistro('deliverable', deliverableId)
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <Link to="/reports" className="text-sm text-sg-primary-text underline">
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
  const elegir = (clave: string) => {
    const siguiente = new URLSearchParams(busqueda)
    siguiente.set('seccion', clave)
    fijar(siguiente, { replace: true })
  }
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-sg-h1 font-semibold">{texto(entregable, 'title')}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-sg-text-secondary">
          <span className="font-sg-mono">{texto(entregable, 'document_code')}</span>
          <span>{tipo}</span>
          <EstadoChip objeto="deliverable" estado={entregable.state} />
          <span>
            {t('entregables.pagina.periodo', {
              desde: diaPe(texto(entregable, 'period_start_date')) || '—',
              hasta: diaPe(texto(entregable, 'period_end_date')) || '—'
            })}
          </span>
          <span>{t('entregables.pagina.niveles', { niveles: NIVELES_DE_ENTREGABLE.join(', ') })}</span>
        </div>
      </header>
      <CaminoDeEstados estado={entregable.state} />
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-3">
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
                            <span className={asistida ? 'text-sg-ai' : 'text-sg-text-muted'}>{texto(s, 'content_origin')}</span>
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
            <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
              <EditorDeSeccion
                key={`${actual.id}:${actual.updatedAt}`}
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
    </div>
  )
}
