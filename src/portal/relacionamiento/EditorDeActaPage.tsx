import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth, type ObjectDefinition } from '@wasichai/core'
import { Alert, Button, Textarea } from '@wasichai/ui'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useParams } from 'react-router'
import { AvisoDeConflicto } from '../componentes/AvisoDeConflicto'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, NoEsDeSusProyectos } from '../componentes/Estados'
import { esConflictoDeVersion, useMensajeDeError } from '../componentes/errores'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { usePedir } from '../datos/http'
import {
  atributo,
  guardarCambio,
  puedeEscribir,
  puedeLeer,
  texto,
  useActualizar,
  useDefinicion,
  useRegistro,
  useTodosConTope,
  type Registro
} from '../datos/registros'
import { BorradorDeActa } from '../ia/BorradorDeActa'
import { NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { ESTADOS_DE_ACTA_EDITABLE } from './fechas'
import { VistaMarkdown } from './markdown'

// S25 · editor de acta (screens.md §6, flujo 5): el acta con estructura, en Markdown sin HTML, con guardado automático
// (PUT de engagement.minutes con If-Match) y las transiciones de WF-C del acta (draft_minutes, submit_minutes,
// return_minutes y approve_minutes, las que el rol tenga). una devolución muestra su motivo arriba. mientras hay cambios
// sin guardar no se transiciona: el acta enviada es la guardada
const ESPERA = 1500

// lo que el vaciado al salir no pudo guardar: el texto y el error, a la espera de que se vuelva a esta acta
interface SalidaFallida {
  texto: string
  error: unknown
}
const claveDeSalidaFallida = (id: string) => ['acta-sin-guardar', id]

export function EditorDeActaPage() {
  const { engagementId = '' } = useParams()
  const interaccion = useRegistro('engagement', engagementId)
  const definicion = useDefinicion('engagement')
  // sin la definición no se sabe si la cuenta puede leer o escribir el acta: no se dibuja un editor a ciegas
  if (definicion.isError && !definicion.data) return <FalloDeLectura error={definicion.error} alReintentar={() => void definicion.refetch()} />
  if (definicion.isPending) return <Cargando />
  // un 404 es un registro que no existe o que no es de sus proyectos (alcance por proyecto, spec 4.4 §3.6): no se distingue
  return (
    <Consulta consulta={interaccion} noExiste={<NoEsDeSusProyectos />}>
      {(i) => <Editor key={i.id} interaccion={i} definicion={definicion.data} />}
    </Consulta>
  )
}

function Editor({ interaccion, definicion }: { interaccion: Registro; definicion: ObjectDefinition }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const cliente = useQueryClient()
  const actualizar = useActualizar('engagement')
  const mensaje = useMensajeDeError()
  const [texto_, setTexto] = useState(texto(interaccion, 'minutes'))
  const [guardado, setGuardado] = useState(texto(interaccion, 'minutes'))
  const [previa, setPrevia] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  // el GET trae como clave cada campo legible: sin la clave, el acta es restringida para la cuenta
  const leeActa = puedeLeer(definicion, 'minutes') && 'minutes' in interaccion.attributes
  const editable = leeActa && ESTADOS_DE_ACTA_EDITABLE.includes(interaccion.state ?? '') && can('engagement', 'UPDATE') && puedeEscribir(definicion, 'minutes')
  const sucio = texto_ !== guardado
  const conflicto = esConflictoDeVersion(actualizar.error)
  const secciones = t('relacionamiento.acta.secciones', { returnObjects: true }) as string[]
  const devolucion = useMotivoDeDevolucion(interaccion)
  const participantes = useTodosConTope('engagement_participant', { engagement: interaccion.id })
  const preguntas = useTodosConTope('engagement_question', { engagement: interaccion.id })
  const definicionDeParticipante = useDefinicion('engagement_participant')
  const proyecto = String(atributo(interaccion, 'project'))

  const pedir = usePedir()
  // otra persona cambió el acta: su versión, a la vista hasta que se elija (M1); mientras tanto no se guarda nada
  const [ajena, setAjena] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null)
  // lo que el vaciado al salir de esta misma acta no pudo guardar (la persona ya no estaba aquí para enterarse): el texto y el
  // error esperan en la caché de consultas, que sobrevive a la navegación, hasta que se recupere o se descarte
  const [pendiente, setPendiente] = useState(() => cliente.getQueryData<SalidaFallida>(claveDeSalidaFallida(interaccion.id)) ?? null)
  const olvidarPendiente = () => {
    cliente.removeQueries({ queryKey: claveDeSalidaFallida(interaccion.id) })
    setPendiente(null)
  }
  const guardar = () => actualizar.mutate({ registro: interaccion, cambios: { minutes: texto_ } }, { onSuccess: () => setGuardado(texto_) })
  // durante «Recargar» el error sigue (se quita al llegar la relectura), así que la pausa dura toda la relectura
  const pausaPorFallo = actualizar.isError || ajena !== null
  const enPausa = actualizar.isPending || pausaPorFallo
  // con texto sin guardar y el guardado en pausa por un fallo, un conflicto, una relectura o una versión ajena por elegir, salir
  // por un enlace del portal lo descartaría sin que la persona lo sepa: se confirma antes
  const bloqueo = useBlocker(sucio && pausaPorFallo)

  // lo último que hay en pantalla, para vaciarlo al salir: el desmontaje no ve el estado de su render
  const ultimo = useRef({ texto: texto_, guardado, interaccion, definicion, editable, enPausa })
  ultimo.current = { texto: texto_, guardado, interaccion, definicion, editable, enPausa }
  useEffect(
    () => () => {
      const u = ultimo.current
      if (u.texto === u.guardado || !u.editable || u.enPausa) return
      // salir (el enlace a la ficha, el menú, atrás) con lo tecleado en el último momento: se guarda sin esperar el plazo
      void guardarCambio(pedir, u.definicion, 'engagement', { registro: u.interaccion, cambios: { minutes: u.texto } })
        .then((releido) => {
          cliente.removeQueries({ queryKey: claveDeSalidaFallida(u.interaccion.id) })
          cliente.setQueryData(['record', 'engagement', u.interaccion.id], releido)
          for (const clave of ['records', 'history']) void cliente.invalidateQueries({ queryKey: [clave, 'engagement'] })
        })
        .catch((error: unknown) => {
          // no se calla: el texto y el error esperan a que la persona vuelva a esta acta (ver «pendiente»)
          cliente.setQueryDefaults(claveDeSalidaFallida(u.interaccion.id), { gcTime: Infinity })
          cliente.setQueryData<SalidaFallida>(claveDeSalidaFallida(u.interaccion.id), { texto: u.texto, error })
        })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  // cerrar la pestaña o recargar con cambios sin guardar pide confirmar
  useEffect(() => {
    if (!sucio) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sucio])

  // «Recargar» espera la relectura antes de reanudar el guardado, y si el acta de la otra persona difiere de lo que esta
  // pantalla leyó, la muestra para que se elija en lugar de pisarla
  // (BotonRecargar quita el aviso con actualizar.reset() solo cuando esto terminó, y dice si la relectura falló)
  const releerActa = async () => {
    const nuevo = await cliente.fetchQuery({
      queryKey: ['record', 'engagement', interaccion.id],
      queryFn: () => pedir<Registro>(`/objects/engagement/records/${interaccion.id}`),
      staleTime: 0
    })
    const delOtro = texto(nuevo, 'minutes')
    if (delOtro === texto_) setGuardado(delOtro)
    else if (delOtro !== guardado) setAjena(delOtro)
  }
  // la aceptación del borrador de la IA escribió minutes en el servidor (AI-02, decisión 21 del plan 7.3): se relee el acta con
  // su versión nueva y el editor queda con ese texto, sin un PUT propio
  const trasInsertarBorrador = async (insertado: string) => {
    let minutes = insertado
    try {
      const nuevo = await cliente.fetchQuery({
        queryKey: ['record', 'engagement', interaccion.id],
        queryFn: () => pedir<Registro>(`/objects/engagement/records/${interaccion.id}`),
        staleTime: 0
      })
      minutes = texto(nuevo, 'minutes') || insertado
    } catch {
      // la relectura falló: el texto es el aceptado; el próximo guardado dirá si la versión quedó vieja (412, «Recargar»)
    }
    setTexto(minutes)
    setGuardado(minutes)
  }
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto_)
      setCopiado('si')
    } catch {
      setCopiado('no')
    }
  }

  // guardado automático: un momento después de la última tecla, con la versión leída. un guardado fallido no se repite solo
  // (sería un bucle contra el mismo error): se reanuda al teclear de nuevo o con «Guardar el acta»; un 412 espera «Recargar»,
  // porque la versión leída ya no sirve
  useEffect(() => {
    if (!sucio || !editable || enPausa) return
    const espera = setTimeout(guardar, ESPERA)
    return () => clearTimeout(espera)
  }, [texto_, sucio, editable, enPausa, interaccion.updatedAt])

  const cambiar = (nuevo: string) => {
    setTexto(nuevo)
    if (actualizar.isError && !conflicto) actualizar.reset()
  }
  const insertar = (bloque: string) => {
    const posicion = area.current?.selectionStart ?? texto_.length
    cambiar(`${texto_.slice(0, posicion)}${bloque}${texto_.slice(posicion)}`)
  }
  const leeNombres = puedeLeer(definicionDeParticipante.data, 'participant_name')
  // lo que se inserta debe estar completo: una lista que no cargó, falló o se cortó en el tope daría un acta con asistentes de menos
  const completa = (lista: { isSuccess: boolean; truncado: boolean }) => lista.isSuccess && !lista.truncado
  const asistentesListos = completa(participantes) && definicionDeParticipante.isSuccess
  const preguntasListas = completa(preguntas)
  const listasFallidas = [participantes, preguntas].some((l) => l.isError || l.truncado) || definicionDeParticipante.isError
  const asistentes = () =>
    `\n## ${secciones[1]}\n${(participantes.data ?? [])
      .filter((p) => atributo(p, 'attended'))
      .map((p) => {
        const n = Number(atributo(p, 'represented_people_count') ?? 1)
        const quien =
          n > 1
            ? t('relacionamiento.ficha.grupoSinNombres', { n })
            : (leeNombres && texto(p, 'participant_name')) || texto(p, 'represented_group') || t('relacionamiento.ficha.participante')
        return `- ${quien}${texto(p, 'represented_group') && n === 1 ? ` (${texto(p, 'represented_group')})` : ''}`
      })
      .join('\n')}\n`
  const listaDePreguntas = () =>
    `\n## ${secciones[4]}\n${(preguntas.data ?? []).map((q) => `- ${texto(q, 'question_text')}${texto(q, 'answer') ? ` — ${texto(q, 'answer')}` : ''}`).join('\n')}\n`

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-sg-h2 font-semibold">{t('relacionamiento.acta.titulo')}</h1>
          <EstadoChip objeto="engagement" estado={interaccion.state} />
          <span role="status" className="text-sg-caption text-sg-text-muted">
            {actualizar.isPending ? t('relacionamiento.acta.guardando') : sucio ? t('relacionamiento.acta.sinGuardar') : t('relacionamiento.acta.guardado')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/projects/${encodeURIComponent(proyecto)}/engagements/${encodeURIComponent(interaccion.id)}`}
            className="text-sm text-sg-primary-text underline"
          >
            {texto(interaccion, 'title')}
          </Link>
          {leeActa ? (
            <Button variant="secondary" size="sm" onClick={() => setPrevia(!previa)}>
              {previa ? t('relacionamiento.acta.editar') : t('relacionamiento.acta.vistaPrevia')}
            </Button>
          ) : null}
          {sucio ? null : (
            <BotonesDeTransicion
              objeto="engagement"
              registro={interaccion}
              proyecto={proyecto}
              ocultar={[
                'close',
                'close_light',
                'cancel_planned',
                'cancel_scheduled',
                'cancel_postponed',
                'postpone',
                'reschedule',
                'schedule',
                'register_held',
                'register_held_unplanned'
              ]}
            />
          )}
        </div>
      </header>
      {devolucion.motivo ? <Alert tone="warning">{t('relacionamiento.acta.devuelta', { motivo: devolucion.motivo })}</Alert> : null}
      {devolucion.noLeido ? <Alert tone="notice">{t('relacionamiento.acta.motivoNoLeido')}</Alert> : null}
      {!leeActa ? <Alert tone="notice">{t('relacionamiento.acta.restringida')}</Alert> : null}
      {leeActa && !editable ? <Alert tone="notice">{t('relacionamiento.acta.soloLectura')}</Alert> : null}
      {leeActa && sucio && !editable ? (
        <Alert tone="warning">
          {t('relacionamiento.acta.yaNoEditable')}
          <Button variant="secondary" size="sm" className="ml-2" onClick={() => void copiar()}>
            {t('relacionamiento.acta.copiar')}
          </Button>
          {copiado === 'si' ? <span className="ml-2 text-sg-caption">{t('relacionamiento.acta.copiado')}</span> : null}
          {copiado === 'no' ? (
            <span role="alert" className="ml-2 text-sg-caption">
              {t('relacionamiento.acta.copiarFallo')}
            </span>
          ) : null}
        </Alert>
      ) : null}
      {bloqueo.state === 'blocked' ? (
        <Alert tone="warning">
          {t('relacionamiento.acta.salirSinGuardar')}
          <Button variant="secondary" size="sm" className="ml-2" onClick={() => void copiar()}>
            {t('relacionamiento.acta.copiar')}
          </Button>
          <Button variant="secondary" size="sm" className="ml-2" onClick={() => bloqueo.proceed()}>
            {t('relacionamiento.acta.salir')}
          </Button>
          <Button size="sm" className="ml-2" onClick={() => bloqueo.reset()}>
            {t('relacionamiento.acta.seguirEditando')}
          </Button>
          {copiado === 'si' ? <span className="ml-2 text-sg-caption">{t('relacionamiento.acta.copiado')}</span> : null}
          {copiado === 'no' ? (
            <span role="alert" className="ml-2 text-sg-caption">
              {t('relacionamiento.acta.copiarFallo')}
            </span>
          ) : null}
        </Alert>
      ) : null}
      {pendiente ? (
        <Alert tone="danger">
          {t('relacionamiento.acta.salidaFallida', { motivo: mensaje(pendiente.error) })}
          <Button
            variant="secondary"
            size="sm"
            className="ml-2"
            onClick={() => {
              cambiar(pendiente.texto)
              olvidarPendiente()
            }}
          >
            {t('relacionamiento.acta.recuperar')}
          </Button>
          <Button variant="secondary" size="sm" className="ml-2" onClick={olvidarPendiente}>
            {t('relacionamiento.acta.descartar')}
          </Button>
        </Alert>
      ) : null}
      {ajena !== null ? (
        <Alert tone="warning" title={t('relacionamiento.acta.otraPersona')}>
          <p>{t('relacionamiento.acta.otraVersion')}</p>
          <div className="my-2 max-h-64 overflow-y-auto rounded-sg-md border border-sg-border bg-sg-surface p-3">
            <VistaMarkdown texto={ajena} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // se descarta lo local a favor de lo que ya está guardado
                setTexto(ajena)
                setGuardado(ajena)
                setAjena(null)
              }}
            >
              {t('relacionamiento.acta.conservarAjena')}
            </Button>
            <Button size="sm" onClick={() => setAjena(null)}>
              {t('relacionamiento.acta.aplicarMia')}
            </Button>
          </div>
        </Alert>
      ) : null}
      {actualizar.isError ? (
        <AvisoDeConflicto error={actualizar.error} releer={releerActa} alRecargar={() => actualizar.reset()}>
          {conflicto ? null : (
            <Button variant="secondary" size="sm" className="ml-2" onClick={guardar}>
              {t('relacionamiento.acta.guardar')}
            </Button>
          )}
        </AvisoDeConflicto>
      ) : null}
      {leeActa ? (
        <div className="grid gap-4 lg:grid-cols-[200px_1fr_260px]">
          <nav aria-label={t('relacionamiento.acta.estructura')} className="space-y-1 text-sm">
            <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('relacionamiento.acta.estructura')}</h2>
            {secciones.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!editable}
                onClick={() => insertar(`\n## ${s}\n`)}
                className="block text-left text-sg-primary-text disabled:text-sg-text-muted"
              >
                {s}
              </button>
            ))}
          </nav>
          <div className="space-y-2">
            {previa ? (
              <VistaMarkdown texto={texto_} />
            ) : (
              <>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={!editable || !asistentesListos} onClick={() => insertar(asistentes())}>
                    {t('relacionamiento.acta.insertarAsistentes')}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!editable || !preguntasListas} onClick={() => insertar(listaDePreguntas())}>
                    {t('relacionamiento.acta.insertarPreguntas')}
                  </Button>
                </div>
                {editable && listasFallidas ? <p className="text-sg-caption text-sg-text-muted">{t('relacionamiento.acta.sinListas')}</p> : null}
                <label htmlFor="acta" className="sr-only">
                  {t('relacionamiento.acta.editor')}
                </label>
                <Textarea
                  id="acta"
                  ref={area}
                  readOnly={!editable}
                  className="min-h-[480px] font-sg-mono text-sg-body-sm"
                  value={texto_}
                  onChange={(e) => cambiar(e.target.value)}
                />
              </>
            )}
          </div>
          <aside className="space-y-2 text-sg-caption text-sg-text-muted">
            <BorradorDeActa
              interaccion={interaccion}
              actual={guardado}
              listo={editable && !sucio && !enPausa}
              alInsertado={(minutes) => void trasInsertarBorrador(minutes)}
            />
            <p>{t('relacionamiento.acta.proponerLlega')}</p>
            <p>{t('relacionamiento.acta.firmada')}</p>
          </aside>
        </div>
      ) : null}
    </section>
  )
}

// cada autoguardado es un PUT y agrega una entrada a la historia, así que la devolución puede quedar lejos: se pide el máximo que
// admite la API (limit hasta 500, coerceIn(1, 500))
const LIMITE_DE_HISTORIA = 500

// el motivo de la última devolución del acta (return_minutes), leído de la historia del registro: el cambio de estado
// minutes_in_review → minutes_drafted más reciente. si la historia no se pudo leer, o llegó llena (500) sin la devolución y
// podría estar más atrás, se dice (noLeido) en lugar de callar; una historia completa sin devolución es un borrador nuevo
function useMotivoDeDevolucion(interaccion: Registro): { motivo: string | null; noLeido: boolean } {
  const pedir = usePedir()
  const enBorrador = interaccion.state === 'minutes_drafted'
  const historia = useQuery({
    queryKey: ['history', 'engagement', interaccion.id, LIMITE_DE_HISTORIA],
    queryFn: () =>
      pedir<{ occurredAt: string; reason: string | null; changes?: { field?: string; before: unknown; after: unknown }[] }[]>(
        `/objects/engagement/records/${interaccion.id}/history?limit=${LIMITE_DE_HISTORIA}`
      ),
    enabled: enBorrador
  })
  if (!enBorrador) return { motivo: null, noLeido: false }
  const devoluciones = (historia.data ?? [])
    .filter((e) => e.changes?.some((c) => c.before === 'minutes_in_review' && c.after === 'minutes_drafted'))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const sinAlcance = historia.data !== undefined && historia.data.length >= LIMITE_DE_HISTORIA && devoluciones.length === 0
  return { motivo: devoluciones[0]?.reason ?? null, noLeido: (historia.isError && !historia.data) || sinAlcance }
}
