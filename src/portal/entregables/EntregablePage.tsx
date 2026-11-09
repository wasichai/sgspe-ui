import { ConfirmDialog } from '@wasichai/ui'
import { Check, Lock, Sigma, Sparkles, UserRound, X, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useParams, useSearchParams } from 'react-router'
import { unir } from '../componentes/clases'
import { EstadoChip, useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { Consulta, NoEsDeSusProyectos } from '../componentes/Estados'
import { Etiqueta } from '../componentes/Etiqueta'
import { DeLista } from '../componentes/LecturaConEstados'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { Seccion } from '../componentes/Seccion'
import { MarcaDeIa } from '../ia/MarcaDeIa'
import { opcion, rotuloDeOpcion } from '../datos/opciones'
import { atributo, texto, useRegistro, useTodos, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { seccionDelTipo, useEstadoDelBorrador, useTiposDeEntregable } from './contrato'
import { AccionesDelEntregable } from './Emitir'
import { EditorDeSeccion } from './EditorDeSeccion'
import { PanelDelBorrador } from './PanelDelBorrador'
import { SugerenciaDeSeccion, useBorradorPropuesto } from './SugerenciaDeSeccion'
import { cambioDespuesDelBorrador, NIVELES_DE_ENTREGABLE, ORIGEN_CALCULADO, ORIGEN_IA } from './tipos'
import { Versiones } from './Versiones'

// S50 · entregable por secciones (screens.md, deliverables.md §8; lienzo S12 de Civic Modern): revisar, aprobar y emitir sabiendo
// que se emite lo revisado. un panel fuerte con la cabecera, sus acciones y los pasos de WF-H, y debajo tres columnas: las
// secciones con su origen (calculada, humana, asistida por IA), la sección abierta con el bloque de IA y su editor, y lo que pide
// la versión EXTERNO con el borrador y la nota de lo emitido. la sección abierta viaja en ?seccion=<clave>; sin ella, la primera.
// una sección cambiada después de congelar el modelo bloquea el envío, la aprobación y la emisión (409 SECTIONS_CHANGED): la
// lista lo marca comparando su updatedAt con draft_generated_at. abierto desde los Reportes de un proyecto vive en
// /projects/:projectId/reports/deliverables/:deliverableId y «Volver» lleva a esos Reportes, con el proyecto todavía puesto
export function EntregablePage() {
  const { t } = useTranslation(NS)
  const { projectId, deliverableId = '' } = useParams()
  const entregable = useRegistro('deliverable', deliverableId)
  const reportes = projectId ? `/projects/${encodeURIComponent(projectId)}/reports` : '/reports'
  return (
    <ContenedorDePagina elemento="section">
      <Link to={reportes} className="text-sm text-sg-primary-text underline">
        {t('entregables.pagina.volver')}
      </Link>
      <Consulta consulta={entregable} noExiste={<NoEsDeSusProyectos />}>
        {(e) => <Entregable entregable={e} />}
      </Consulta>
    </ContenedorDePagina>
  )
}

// el camino de WF-H en cuatro pasos (lienzo S12): Borrador, En revisión (Observado vuelve a él), Aprobado y Emitido; anulado,
// un quinto al final. cada paso con el borde superior de 4 px y su número en un círculo (como Pasos, design-system.md §5.3), sin
// ser botones: dicen dónde está el entregable. el segundo lleva cuántas secciones van revisadas
const CAMINO = ['draft', 'in_review', 'approved', 'issued'] as const
const POSICION: Record<string, number> = { draft: 0, in_review: 1, observed: 1, approved: 2, issued: 3 }

function PasosDelEntregable({ estado, revisadas, total }: { estado: string | null | undefined; revisadas: number | null; total: number | null }) {
  const { t } = useTranslation(NS)
  const etiquetas = useEtiquetasDeEstado('deliverable')
  const anulado = estado === 'voided'
  const actual = anulado ? CAMINO.length : (POSICION[estado ?? ''] ?? 0)
  const pasos: { estado: string; etiqueta: string }[] = [
    ...CAMINO.map((e) => ({ estado: e, etiqueta: etiquetas[e === 'in_review' && estado === 'observed' ? 'observed' : e] ?? '' })),
    ...(anulado ? [{ estado: 'voided', etiqueta: etiquetas.voided ?? '' }] : [])
  ]
  return (
    <nav aria-label={t('entregables.pagina.camino')}>
      <ol className="grid gap-x-3 gap-y-2 sm:flex">
        {pasos.map((paso, i) => {
          const hecho = i < actual
          const esActual = i === actual
          const observado = esActual && estado === 'observed'
          return (
            <li
              key={paso.estado}
              aria-current={esActual ? 'step' : undefined}
              className={unir(
                'flex min-w-0 flex-1 items-center gap-2 border-t-4 pt-2 text-sm',
                hecho ? 'border-sg-progress' : esActual ? (observado ? 'border-sg-warning' : 'border-sg-primary') : 'border-sg-border'
              )}
            >
              <span
                aria-hidden
                className={unir(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold',
                  hecho
                    ? 'border-sg-progress bg-sg-progress text-sg-surface'
                    : esActual
                      ? 'border-sg-primary bg-sg-primary text-sg-on-primary'
                      : 'border-sg-border text-sg-text-secondary'
                )}
              >
                {hecho ? <Check strokeWidth={3} className="size-3.5" /> : i + 1}
              </span>
              <span className="sr-only">{t(`paginas.flujo.${hecho ? 'hecho' : esActual ? 'actual' : 'pendiente'}`)}: </span>
              <span
                className={unir('min-w-0', esActual ? 'font-extrabold text-sg-primary-text' : hecho ? 'font-semibold text-sg-text' : 'text-sg-text-secondary')}
              >
                <span>{paso.etiqueta}</span>
                {paso.estado === 'in_review' && revisadas !== null && total !== null ? (
                  <span className="font-semibold"> · {t('entregables.pagina.seccionesRevisadas', { n: numeroPe(revisadas), m: numeroPe(total) })}</span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// el origen de una sección con su ícono (lienzo S12): Σ calculada desde los datos, una persona, la chispa de IA en el color de IA
const ICONO_DE_ORIGEN: Record<string, LucideIcon> = { [ORIGEN_CALCULADO]: Sigma, [ORIGEN_IA]: Sparkles }
const iconoDeOrigen = (origen: string): LucideIcon => ICONO_DE_ORIGEN[origen] ?? UserRound

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
  const revisadas = secciones.data ? lista.filter((s) => atributo(s, 'reviewed') === true).length : null
  const corte = diaPe(texto(entregable, 'cutoff_date'))
  return (
    <div className="space-y-5">
      <Seccion variante="fuerte" etiqueta={texto(entregable, 'title')} className="space-y-0 p-0 sm:px-0">
        <div className="space-y-4 border-b border-sg-border p-4 sm:px-5">
          <EncabezadoDePagina
            ficha
            antetitulo={[texto(entregable, 'document_code'), rotuloDeOpcion(tipo), corte ? t('entregables.pagina.corte', { fecha: corte }) : null]
              .filter(Boolean)
              .join(' · ')}
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
                <span className="flex items-center gap-1.5" role="group" aria-label={t('entregables.lista.columnas.niveles')}>
                  {NIVELES_DE_ENTREGABLE.map((n) => (
                    <Etiqueta key={n}>{rotuloDeOpcion(n)}</Etiqueta>
                  ))}
                </span>
              </>
            }
            primaria={<AccionesDelEntregable entregable={entregable} />}
          />
          <PasosDelEntregable estado={entregable.state} revisadas={revisadas} total={secciones.data ? lista.length : null} />
        </div>
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <nav aria-label={t('entregables.secciones.titulo')} className="border-b border-sg-border lg:border-r lg:border-b-0">
            <DeLista consulta={secciones}>
              {(filas) => (
                <>
                  {/* cuántas van revisadas (tercera pasada de UX, 4.6) */}
                  <div className="flex items-baseline justify-between gap-2 border-b border-sg-border px-4 py-3">
                    <h2 className="text-sg-body-sm font-bold text-sg-text">{t('entregables.secciones.titulo')}</h2>
                    <p className="text-sg-caption text-sg-text-secondary">
                      {t('entregables.secciones.revisadas', { n: filas.filter((s) => atributo(s, 'reviewed') === true).length, m: filas.length })}
                    </p>
                  </div>
                  <ul>
                    {filas.map((s) => {
                      const clave = texto(s, 'section_key')
                      const origen = texto(s, 'content_origin')
                      const asistida = origen === ORIGEN_IA
                      const Icono = iconoDeOrigen(origen)
                      const elegida = s.id === actual?.id
                      const revisada = atributo(s, 'reviewed') === true
                      return (
                        <li key={s.id} className="border-b border-sg-border">
                          <button
                            type="button"
                            aria-current={elegida ? 'true' : undefined}
                            onClick={() => elegir(clave)}
                            className={unir(
                              'flex w-full items-start gap-2.5 border-l-4 px-3 py-2.5 text-left text-sm',
                              elegida ? 'border-sg-primary bg-sg-primary-soft' : 'border-transparent hover:bg-sg-surface-hover'
                            )}
                          >
                            <Icono aria-hidden className={unir('mt-0.5 size-4 shrink-0', asistida ? 'text-sg-ai' : 'text-sg-text-secondary')} />
                            <span className="min-w-0 flex-1 space-y-0.5">
                              <span className={unir('block text-sg-text', elegida ? 'font-bold' : 'font-medium')}>{texto(s, 'title')}</span>
                              <span className="flex flex-wrap gap-1 text-sg-caption">
                                <span className={asistida ? 'font-semibold text-sg-ai' : 'text-sg-text-secondary'}>{opcion(s, 'content_origin')}</span>
                                {seccionDelTipo(tipos.data, tipo, clave)?.assisted ? (
                                  <span className="text-sg-ai">· {t('entregables.secciones.conIa')}</span>
                                ) : null}
                                {revisada ? <span className="sr-only">· {t('entregables.secciones.revisada')}</span> : null}
                                {cambioDespuesDelBorrador(s, generadoEl) ? (
                                  <span className="text-sg-warning">· {t('entregables.secciones.cambiada')}</span>
                                ) : null}
                              </span>
                            </span>
                            {revisada ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-sg-success" /> : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <LeyendaDeOrigen />
                </>
              )}
            </DeLista>
          </nav>
          <div className="min-w-0 space-y-4 p-4 sm:p-5">
            {tipos.isError ? <p className="text-sg-caption text-sg-warning">{t('entregables.seccion.tiposConError')}</p> : null}
            {actual ? (
              <>
                <CabeceraDeSeccion entregable={entregable} seccion={actual} guia={seccionDelTipo(tipos.data, tipo, texto(actual, 'section_key'))?.guide} />
                <SugerenciaDeSeccion key={actual.id} entregable={entregable} seccion={actual} sucio={sucio} />
                <EditorDeSeccion key={`${vigente?.id}:${vigente?.updatedAt}`} entregable={entregable} seccion={actual} alCambiarSucio={setSucio} />
              </>
            ) : null}
          </div>
          <aside
            aria-label={t('entregables.externo.titulo')}
            className="space-y-4 border-t border-sg-border p-4 sm:px-5 lg:col-span-2 xl:col-span-1 xl:border-t-0 xl:border-l"
          >
            <ListaParaExterno entregable={entregable} secciones={lista} generadoEl={generadoEl} alElegirSeccion={elegir} />
            <div className="border-t border-sg-border pt-4">
              <PanelDelBorrador entregable={entregable} secciones={lista} alElegirSeccion={elegir} />
            </div>
            <p className="flex items-start gap-2 border-t border-sg-border pt-4 text-sg-caption text-sg-text-secondary">
              <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {t('entregables.externo.congelado')}
            </p>
          </aside>
        </div>
      </Seccion>
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

// qué quiere decir cada ícono de origen, al pie de la lista de secciones
function LeyendaDeOrigen() {
  const { t } = useTranslation(NS)
  const filas = [
    { origen: ORIGEN_CALCULADO, clave: 'calculada' },
    { origen: 'HUMANO', clave: 'humana' },
    { origen: ORIGEN_IA, clave: 'asistida' }
  ]
  return (
    <div className="space-y-1 px-4 py-3 text-sg-caption text-sg-text-secondary">
      <p className="font-semibold text-sg-text">{t('entregables.secciones.leyenda.titulo')}</p>
      <ul className="space-y-0.5">
        {filas.map(({ origen, clave }) => {
          const Icono = iconoDeOrigen(origen)
          return (
            <li key={origen} className={unir('flex items-center gap-1.5', origen === ORIGEN_IA && 'text-sg-ai')}>
              <Icono aria-hidden className="size-3.5 shrink-0" />
              {t(`entregables.secciones.leyenda.${clave}`)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// la cabecera de la sección abierta: su título (h2), su origen, si espera una sugerencia de IA y la guía de redacción del tipo
// (guide de GET /api/sgspe/deliverable-types)
function CabeceraDeSeccion({ entregable, seccion, guia }: { entregable: Registro; seccion: Registro; guia?: string }) {
  const { t } = useTranslation(NS)
  const { propuesto } = useBorradorPropuesto(entregable, seccion)
  const asistida = texto(seccion, 'content_origin') === ORIGEN_IA
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sg-h3 font-bold text-sg-text">{texto(seccion, 'title')}</h2>
        <span
          className={
            asistida
              ? 'inline-flex h-6 items-center rounded-sg-md border-[1.5px] border-dashed border-sg-ai-border bg-sg-ai-soft px-1.75 text-sg-caption font-bold text-sg-ai'
              : 'inline-flex h-6 items-center rounded-sg-md bg-sg-neutral-soft px-1.75 text-sg-caption font-semibold text-sg-neutral'
          }
        >
          {opcion(seccion, 'content_origin')}
        </span>
        {propuesto ? <MarcaDeIa clase="sugerencia" pendiente /> : null}
      </div>
      {guia ? (
        <div className="rounded-sg-md bg-sg-surface-sunken p-3 text-sm">
          <p className="text-sg-label font-medium">{t('entregables.seccion.guia')}</p>
          <p className="text-sg-text-secondary">{guia}</p>
        </div>
      ) : null}
    </div>
  )
}

// lo que pide la versión EXTERNO antes de emitirla, con lo que el portal sabe de verdad (lienzo S12): las secciones revisadas,
// las cambiadas después del borrador, el borrador listo y sus avisos (posibles datos personales, mapas). lo que solo una persona
// puede juzgar (la narrativa, las fotos, los mapas y los anexos) se confirma al emitir: aquí va como regla, sin marca
function ListaParaExterno({
  entregable,
  secciones,
  generadoEl,
  alElegirSeccion
}: {
  entregable: Registro
  secciones: Registro[]
  generadoEl: string | null
  alElegirSeccion: (clave: string) => void
}) {
  const { t } = useTranslation(NS)
  const borrador = useEstadoDelBorrador(entregable.id)
  const sinRevisar = secciones.filter((s) => atributo(s, 'reviewed') !== true)
  const cambiadas = generadoEl ? secciones.filter((s) => cambioDespuesDelBorrador(s, generadoEl)) : []
  const listo = borrador.data?.status === 'LISTO'
  const avisos = borrador.data?.warnings ?? []
  const datosPersonales = avisos.filter((a) => a.code === 'POSSIBLE_PERSONAL_DATA').length
  const mapasFallidos = avisos.some((a) => a.code === 'MAP_FAILED')
  const reglas = ['narrativa', 'fotos', 'mapas', 'anexos'] as const
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <h2 className="text-sg-body font-bold text-sg-text">{t('entregables.externo.titulo')}</h2>
        <ul className="space-y-2">
          <Comprobacion cumple={sinRevisar.length === 0}>
            {sinRevisar.length === 0
              ? t('entregables.externo.revisadas')
              : t('entregables.externo.sinRevisar', { count: sinRevisar.length, n: numeroPe(sinRevisar.length) })}
            {sinRevisar.length > 0 ? (
              <button
                type="button"
                className="block font-normal text-sg-primary-text underline"
                onClick={() => alElegirSeccion(texto(sinRevisar[0], 'section_key'))}
              >
                {t('entregables.externo.irALaPrimera')}
              </button>
            ) : null}
          </Comprobacion>
          {generadoEl ? (
            <Comprobacion cumple={cambiadas.length === 0}>
              {cambiadas.length === 0
                ? t('entregables.externo.sinCambios')
                : t('entregables.externo.cambiadas', { count: cambiadas.length, n: numeroPe(cambiadas.length) })}
            </Comprobacion>
          ) : null}
          {borrador.data ? (
            <Comprobacion cumple={listo}>{listo ? t('entregables.externo.borradorListo') : t('entregables.externo.sinBorradorListo')}</Comprobacion>
          ) : null}
          {listo ? (
            <>
              <Comprobacion cumple={datosPersonales === 0}>
                {datosPersonales === 0
                  ? t('entregables.externo.sinDatosPersonales')
                  : t('entregables.externo.datosPersonales', { count: datosPersonales, n: numeroPe(datosPersonales) })}
              </Comprobacion>
              <Comprobacion cumple={!mapasFallidos}>{mapasFallidos ? t('entregables.externo.mapaFallido') : t('entregables.externo.mapas')}</Comprobacion>
            </>
          ) : null}
        </ul>
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sg-body-sm font-bold text-sg-text">{t('entregables.externo.alEmitir')}</h3>
        <ul className="ml-4 list-disc space-y-1 text-sg-body-sm text-sg-text-secondary">
          {reglas.map((r) => (
            <li key={r}>{t(`entregables.emitir.lista.${r}`)}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// una comprobación con su marca (nunca solo el color): ✓ en success o ✕ en danger, y el texto dice qué pasa
function Comprobacion({ cumple, children }: { cumple: boolean; children: ReactNode }) {
  const { t } = useTranslation(NS)
  const Icono = cumple ? Check : X
  return (
    <li className="flex items-start gap-2">
      <Icono aria-hidden strokeWidth={2.5} className={unir('mt-0.5 size-4 shrink-0', cumple ? 'text-sg-success' : 'text-sg-danger')} />
      <span className={unir('min-w-0', !cumple && 'font-semibold text-sg-text')}>
        <span className="sr-only">{cumple ? t('entregables.externo.cumple') : t('entregables.externo.falta')}: </span>
        {children}
      </span>
    </li>
  )
}
