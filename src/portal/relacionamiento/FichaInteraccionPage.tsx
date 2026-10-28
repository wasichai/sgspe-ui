import { EnlaceConRastro, useSiguientePaso } from '../contexto/Rastro'
import { rutaEnElMapa, VerEnElMapa } from '../componentes/VerEnElMapa'
import { useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useMigaDelRegistro } from '../componentes/Migas'
import { CabeceraDeFicha } from '../componentes/CabeceraDeFicha'
import { CamposPlegables } from '../componentes/CamposPlegables'
import { Seccion } from '../componentes/Seccion'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { PanelDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { PestanasDeFicha } from '../componentes/PestanasDeFicha'
import { useRotuloDeRegistro } from '../componentes/RegistroVinculado'
import { rutaDeFicha } from '../datos/fichas'
import { useEvidenciasDe, useNombreDeEvidencia } from '../documentos/api'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Button, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, Restringido, ThConExplicacion, NoEsDeSusProyectos } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { AcuerdosDeLaInteraccion } from '../acuerdos/AcuerdosDeLaInteraccion'
import { DialogoDeDerivacion, QcsDeLaPregunta } from '../atencion/Derivacion'
import { OBJETOS_DE_QCS } from '../datos/atencion'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { DocumentosEmitidos } from '../documentos/DocumentosEmitidos'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { AccionesDeIa, casosDeInteraccion } from '../ia/AccionesDeIa'
import {
  atributo,
  puedeEscribir,
  puedeLeer,
  texto,
  useActualizar,
  useDefinicion,
  useRegistro,
  useRelacionados,
  useTodos,
  useTodosConTope,
  type Registro
} from '../datos/registros'
import { fechaPe, fechaYHoraPe, NS, numeroPe } from '../i18n'
import { Barras } from '../tableros/comunes'
import { ESTADOS_DE_ACTA_EDITABLE } from './fechas'
import { VistaMarkdown } from './markdown'
import { opcion } from '../datos/opciones'

// S23 · ficha de interacción (screens.md §6, flujo 5): qué pasó, con quién, qué se preguntó y qué se acordó. la siguiente
// transición de WF-C es la acción primaria; "Cerrar" sale deshabilitado con la razón mientras haya preguntas sin respuesta
// ni derivación (RN-ENG-005, transition-checks). los conteos de asistentes los calcula el servidor y nunca se teclean
const CAMPOS_DEL_PARTICIPANTE = [
  'participant_name',
  'represented_group',
  'sex',
  'participant_scope',
  'represented_people_count',
  'attended',
  'stakeholder'
] as const

// lo que una escritura sobre los participantes o las preguntas mueve en la interacción: sus conteos derivados y las reglas de
// sus transiciones (PENDING_QUESTIONS), que ya no valen lo que dijeron
function useRefrescarInteraccion(id: string) {
  const cliente = useQueryClient()
  return () => {
    for (const clave of ['record', 'transitions', 'transition-check', 'history']) void cliente.invalidateQueries({ queryKey: [clave, 'engagement', id] })
  }
}

export function FichaInteraccionPage() {
  const { engagementId = '' } = useParams()
  const interaccion = useRegistro('engagement', engagementId)
  // un 404 es un registro que no existe o que no es de sus proyectos (alcance por proyecto, spec 4.4 §3.6): no se distingue
  return (
    <Consulta consulta={interaccion} noExiste={<NoEsDeSusProyectos />}>
      {(i) => <Ficha interaccion={i} />}
    </Consulta>
  )
}

// el camino de WF-B sin sus excepciones (posponer, cancelar, cerrar sin acta); un estado de excepción se agrega
const CAMINO = ['planned', 'scheduled', 'held', 'minutes_drafted', 'minutes_in_review', 'minutes_approved', 'closed']
const COMPROBAR = ['close', 'close_light']

function Ficha({ interaccion }: { interaccion: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = String(atributo(interaccion, 'project'))
  const convocante = useRegistro('stakeholder', atributo<string>(interaccion, 'convener'))
  const instante = atributo<string>(interaccion, 'held_at') ?? atributo<string>(interaccion, 'scheduled_at')
  const escribe = useEscribeEnProyecto(proyecto)
  // la anatomía de design-system.md §6.1 (revisión de UX, etapa 4): migas con el título, encabezado, camino del flujo, panel de
  // decisión, pestañas con conteo y trazabilidad en tres grupos
  useMigaDelRegistro(texto(interaccion, 'title'))
  const siguiente = useSiguienteAccion('engagement', interaccion, COMPROBAR)
  const { can } = useAuth()
  const evidencias = useEvidenciasDe('engagement', interaccion.id)
  return (
    <article className="space-y-4">
      <CabeceraDeFicha
        antetitulo={[t('relacionamiento.ficha.tipo'), opcion(interaccion, 'engagement_type')].filter(Boolean).join(' · ')}
        titulo={texto(interaccion, 'title')}
        chips={
          <>
            {instante ? <span className="text-sg-text-secondary">{fechaYHoraPe(new Date(instante))}</span> : null}
            {texto(interaccion, 'place') ? <span className="text-sg-text-secondary">{texto(interaccion, 'place')}</span> : null}
            {convocante.data ? (
              <span className="text-sg-text-secondary">
                {t('relacionamiento.ficha.convocante')}:{' '}
                <EnlaceConRastro
                  to={`/projects/${encodeURIComponent(proyecto)}/stakeholders/${encodeURIComponent(convocante.data.id)}`}
                  className="text-sg-primary-text underline"
                >
                  <NombreDelGrupo grupo={convocante.data} />
                </EnlaceConRastro>
              </span>
            ) : null}
          </>
        }
        objeto="engagement"
        registro={interaccion}
        proyecto={proyecto}
        comprobarAntes={COMPROBAR}
        falta={siguiente?.falta}
        faltaCampo={siguiente?.campo}
        secundarias={[
          // lo que nace de la interacción, con ella como origen (revisión de UX, etapa 5): acciones de la cabecera, no un menú
          // dentro de otro (en «Más acciones» no se podría abrir)
          ...(escribe && can('commitment', 'CREATE')
            ? [
                {
                  clave: 'compromiso',
                  nodo: (
                    <Button asChild size="sm" variant="secondary">
                      <Link to={`/projects/${encodeURIComponent(proyecto)}/commitments/new?origin_engagement=${encodeURIComponent(interaccion.id)}`}>
                        {t('paginas.relacionados.compromiso')}
                      </Link>
                    </Button>
                  )
                }
              ]
            : []),
          ...(escribe && OBJETOS_DE_QCS.some((o) => can(o, 'CREATE'))
            ? [
                {
                  clave: 'qcs',
                  nodo: (
                    <Button asChild size="sm" variant="secondary">
                      <Link to={`/projects/${encodeURIComponent(proyecto)}/attention/new?origin_engagement=${encodeURIComponent(interaccion.id)}`}>
                        {t('paginas.relacionados.qcs')}
                      </Link>
                    </Button>
                  )
                }
              ]
            : []),
          ...(rutaEnElMapa('engagement', interaccion) ? [{ clave: 'mapa', nodo: <VerEnElMapa objeto="engagement" registro={interaccion} /> }] : [])
        ]}
      />
      <AccionesDeIa
        objeto="engagement"
        registro={interaccion}
        proyecto={proyecto}
        rotulo={texto(interaccion, 'title')}
        casos={casosDeInteraccion(interaccion)}
      />
      <PanelDeDecision
        camino={CAMINO}
        objeto="engagement"
        proyecto={proyecto}
        estado={interaccion.state}
        desde={texto(interaccion, 'state_changed_at') || null}
        por={texto(interaccion, 'state_changed_by') || null}
        siguiente={siguiente}
        responsable={null}
        vencimiento={null}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PestanasDeFicha
          etiqueta={texto(interaccion, 'title')}
          pestanas={[
            { id: 'resumen', etiqueta: t('relacionamiento.ficha.pestanas.resumen'), render: () => <Resumen interaccion={interaccion} /> },
            { id: 'participantes', etiqueta: t('relacionamiento.ficha.pestanas.participantes'), render: () => <Participantes interaccion={interaccion} /> },
            { id: 'preguntas', etiqueta: t('relacionamiento.ficha.pestanas.preguntas'), render: () => <Preguntas interaccion={interaccion} /> },
            { id: 'acta', etiqueta: t('relacionamiento.ficha.pestanas.acta'), render: () => <Acta interaccion={interaccion} /> },
            {
              // F3: los acuerdos que autoriza esta asamblea y los compromisos que nacen de ella
              id: 'acuerdos',
              etiqueta: t('relacionamiento.ficha.pestanas.acuerdos'),
              render: () => <AcuerdosDeLaInteraccion interaccion={interaccion} />
            },
            {
              // F3: el acta firmada, las fotos y la lista de asistentes como evidencias; la «Minuta de reunión» y la «Lista de
              // asistentes» que emite AUT-05 al aprobar el acta
              id: 'evidencias',
              etiqueta: t('relacionamiento.ficha.pestanas.evidencias'),
              conteo: evidencias.data?.totalElements ?? null,
              render: () => <EvidenciasDelRegistro objeto="engagement" registro={interaccion} escribe={escribe} />
            },
            {
              id: 'documentos',
              etiqueta: t('relacionamiento.ficha.pestanas.documentos'),
              render: () => <DocumentosEmitidos objeto="engagement" registroId={interaccion.id} escribe={escribe} />
            },
            {
              id: 'actividad',
              etiqueta: t('relacionamiento.ficha.pestanas.actividad'),
              render: () => (
                <div className="pt-3">
                  <Historia objeto="engagement" id={interaccion.id} vacio={t('relacionamiento.ficha.sinActividad')} />
                </div>
              )
            }
          ]}
        />
        <Trazabilidad interaccion={interaccion} />
      </div>
    </article>
  )
}

function Resumen({ interaccion }: { interaccion: Registro }) {
  const { t } = useTranslation(NS)
  // un conteo que no llegó (el servidor aún no lo calculó, o la cuenta no lo lee) es un guion, nunca un cero
  const n = (c: string): number | null => {
    const valor = atributo(interaccion, c)
    return valor === undefined || valor === null ? null : Number(valor)
  }
  const total = n('attendees_total_count')
  return (
    <div className="space-y-3 pt-3">
      <p className="text-sg-kpi-sm font-semibold">
        {t('relacionamiento.ficha.asistentes')}: {total === null ? '—' : numeroPe(total)}
      </p>
      <p className="text-sg-caption text-sg-text-muted">{t('relacionamiento.ficha.conteosCalculados')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Barras
          titulo={t('relacionamiento.ficha.porSexo')}
          filas={[
            { nombre: t('relacionamiento.ficha.femenino'), valor: n('attendees_female_count') },
            { nombre: t('relacionamiento.ficha.masculino'), valor: n('attendees_male_count') }
          ]}
        />
        <Barras
          titulo={t('relacionamiento.ficha.porAmbito')}
          filas={[
            { nombre: t('relacionamiento.ficha.aids'), valor: n('attendees_direct_area_count') },
            { nombre: t('relacionamiento.ficha.aiis'), valor: n('attendees_indirect_area_count') },
            { nombre: t('relacionamiento.ficha.regional'), valor: n('attendees_regional_count') },
            { nombre: t('relacionamiento.ficha.nacional'), valor: n('attendees_national_count') }
          ]}
        />
      </div>
      {/* las siglas del ámbito, explicadas (U-28 del rediseño de UX) */}
      <p className="text-sg-caption text-sg-text-muted">{t('relacionamiento.ficha.siglas')}</p>
      {/* qué pasó, con los campos sin dato plegados (DD-06 y U-26 del rediseño de UX) */}
      <Seccion titulo={t('relacionamiento.ficha.quePaso')}>
        <CamposPlegables
          campos={(['description', 'results', 'place'] as const).map((campo) => ({
            clave: campo,
            termino: t(`relacionamiento.ficha.campos.${campo}`),
            valor: texto(interaccion, campo) ? <span className="whitespace-pre-wrap">{texto(interaccion, campo)}</span> : null,
            ancho: campo !== 'place'
          }))}
        />
      </Seccion>
    </div>
  )
}

// el acta como la guarda el servidor, dibujada sin HTML. el GET trae como clave cada campo legible: sin la clave, la cuenta no
// lee el acta. se redacta en los estados en que WF-C la deja editable, a quien puede escribirla
function Acta({ interaccion }: { interaccion: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const definicion = useDefinicion('engagement')
  const proyecto = String(atributo(interaccion, 'project'))
  if (!('minutes' in interaccion.attributes))
    return (
      <div className="pt-3">
        <Restringido />
      </div>
    )
  const redacta = ESTADOS_DE_ACTA_EDITABLE.includes(interaccion.state ?? '') && can('engagement', 'UPDATE') && puedeEscribir(definicion.data, 'minutes')
  const acta = texto(interaccion, 'minutes')
  return (
    <div className="space-y-2 pt-3 text-sm">
      {acta ? <VistaMarkdown texto={acta} /> : <p className="text-sg-text-muted">{t('relacionamiento.ficha.sinActa')}</p>}
      <EnlaceConRastro
        to={`/projects/${encodeURIComponent(proyecto)}/engagements/${encodeURIComponent(interaccion.id)}/minutes`}
        className="text-sg-primary-text underline"
      >
        {redacta ? t('relacionamiento.ficha.editarActa') : t('relacionamiento.ficha.verActa')}
      </EnlaceConRastro>
    </div>
  )
}

// los asistentes: personas y grupos sin nombres. agregar participantes no exige EDIT_ANY (ASM-069): quien puede leer la
// interacción y crear participantes los agrega, y AttendanceCountsListener recalcula los conteos. quien no lee los nombres
// ve «Restringido» en la fila de una persona: nunca el identificador
function Participantes({ interaccion }: { interaccion: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const participantes = useTodosConTope('engagement_participant', { engagement: interaccion.id })
  const definicion = useDefinicion('engagement_participant')
  const refrescar = useRefrescarInteraccion(interaccion.id)
  const [agregando, setAgregando] = useState(false)
  const idDeNombres = useId()
  const leeNombres = puedeLeer(definicion.data, 'participant_name')
  const lectura = participantes.isError && !participantes.data ? participantes : definicion.isError && !definicion.data ? definicion : null
  return (
    <div className="space-y-3 pt-3">
      {lectura ? (
        <FalloDeLectura error={lectura.error} alReintentar={() => void lectura.refetch()} />
      ) : participantes.isPending || definicion.isPending ? (
        <Cargando compacto />
      ) : (
        <>
          {participantes.truncado ? (
            <p className="text-sg-caption text-sg-text-muted">{t('relacionamiento.ficha.truncado', { n: numeroPe(participantes.data?.length ?? 0) })}</p>
          ) : null}
          {participantes.data?.length === 0 ? <p className="text-sm text-sg-text-muted">{t('relacionamiento.ficha.sinParticipantes')}</p> : null}
          {participantes.data?.length ? (
            <Table aria-label={t('relacionamiento.ficha.pestanas.participantes')}>
              <thead>
                <tr>
                  {leeNombres ? (
                    <Th scope="col">{t('relacionamiento.ficha.participante')}</Th>
                  ) : (
                    <ThConExplicacion explicacion={idDeNombres} tipo="restringido">
                      {t('relacionamiento.ficha.participante')}
                    </ThConExplicacion>
                  )}
                  <Th scope="col">{t('relacionamiento.ficha.representa')}</Th>
                  <Th scope="col">{t('relacionamiento.registro.sexo')}</Th>
                  <Th scope="col">{t('relacionamiento.registro.ambito')}</Th>
                  <Th scope="col">{t('relacionamiento.ficha.asistio')}</Th>
                </tr>
              </thead>
              <tbody>
                {participantes.data.map((p) => {
                  const personas = Number(atributo(p, 'represented_people_count') ?? 1)
                  const asistio = atributo(p, 'attended')
                  return (
                    <tr key={p.id}>
                      <Td>
                        {personas > 1 ? (
                          t('relacionamiento.ficha.grupoSinNombres', { n: personas })
                        ) : leeNombres ? (
                          texto(p, 'participant_name') || '—'
                        ) : (
                          <Restringido describedPor={idDeNombres} />
                        )}
                      </Td>
                      <Td className="text-sm">{texto(p, 'represented_group') || '—'}</Td>
                      <Td className="text-sm">{opcion(p, 'sex') || '—'}</Td>
                      <Td className="text-sm">{opcion(p, 'participant_scope') || '—'}</Td>
                      <Td className="text-sm">{asistio === undefined || asistio === null ? '—' : asistio ? t('comun.si') : t('comun.no')}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          ) : null}
        </>
      )}
      {can('engagement_participant', 'CREATE') ? (
        <Button size="sm" variant="secondary" onClick={() => setAgregando(true)}>
          {t('relacionamiento.ficha.agregarParticipante')}
        </Button>
      ) : null}
      <Drawer titulo={t('relacionamiento.ficha.agregarParticipante')} abierto={agregando} alCerrar={() => setAgregando(false)}>
        <FormularioDeRegistro
          objeto="engagement_participant"
          fijos={{ engagement: interaccion.id }}
          campos={CAMPOS_DEL_PARTICIPANTE}
          alGuardar={() => {
            setAgregando(false)
            refrescar()
          }}
          alCancelar={() => setAgregando(false)}
        />
      </Drawer>
    </div>
  )
}

// una pregunta cuenta como atendida si se respondió en el lugar, tiene answered_at o, desde F4, se derivó a una QCS (referred_at,
// EngagementWriteGuard): sin eso, "Cerrar" sigue bloqueado por PENDING_QUESTIONS. responder se ofrece solo a quien puede escribir
// answer y answered_at; derivar (RF-ENG-006, api.md §4.4), a quien actualiza la pregunta y crea algún tipo de QCS, mientras la
// interacción está realizada y sin cerrar (de held a minutes_approved: fuera de eso el comando responde STATE_MISMATCH)
const DERIVABLE = ['held', 'minutes_drafted', 'minutes_in_review', 'minutes_approved']

function Preguntas({ interaccion }: { interaccion: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const preguntas = useTodosConTope('engagement_question', { engagement: interaccion.id })
  const definicion = useDefinicion('engagement_question')
  const escribe = useEscribeEnProyecto(texto(interaccion, 'project'))
  const responde = can('engagement_question', 'UPDATE') && puedeEscribir(definicion.data, 'answer') && puedeEscribir(definicion.data, 'answered_at')
  const destinos =
    escribe && can('engagement_question', 'UPDATE') && DERIVABLE.includes(interaccion.state ?? '') ? OBJETOS_DE_QCS.filter((o) => can(o, 'CREATE')) : []
  if (preguntas.isPending) return <Cargando compacto />
  if (preguntas.isError && !preguntas.data) return <FalloDeLectura error={preguntas.error} alReintentar={() => void preguntas.refetch()} />
  return (
    <ul className="space-y-3 pt-3 text-sm">
      {preguntas.truncado ? (
        <li className="text-sg-caption text-sg-text-muted">{t('relacionamiento.ficha.truncado', { n: numeroPe(preguntas.data?.length ?? 0) })}</li>
      ) : null}
      {preguntas.data?.length === 0 ? <li className="text-sg-text-muted">{t('relacionamiento.ficha.sinPreguntas')}</li> : null}
      {(preguntas.data ?? []).map((p) => (
        <FilaDePregunta
          key={p.id}
          pregunta={p}
          interaccionId={interaccion.id}
          proyecto={texto(interaccion, 'project')}
          responde={responde}
          destinos={destinos}
        />
      ))}
    </ul>
  )
}

function FilaDePregunta({
  pregunta,
  interaccionId,
  proyecto,
  responde,
  destinos
}: {
  pregunta: Registro
  interaccionId: string
  proyecto: string
  responde: boolean
  destinos: readonly (typeof OBJETOS_DE_QCS)[number][]
}) {
  const { t } = useTranslation(NS)
  const releer = useReleer()
  const actualizar = useActualizar('engagement_question')
  const refrescar = useRefrescarInteraccion(interaccionId)
  const [abierta, setAbierta] = useState(false)
  const [derivando, setDerivando] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const enElLugar = atributo(pregunta, 'answered_on_site') === true
  const respondida = atributo<string>(pregunta, 'answered_at')
  const derivada = atributo<string>(pregunta, 'referred_at')
  const estado = enElLugar
    ? t('relacionamiento.ficha.respondidaEnElLugar')
    : respondida
      ? t('relacionamiento.ficha.respondida', { fecha: fechaPe(new Date(respondida)) })
      : derivada
        ? t('relacionamiento.ficha.derivada', { fecha: fechaPe(new Date(derivada)) })
        : t('relacionamiento.ficha.pendiente')
  const pendiente = !enElLugar && !respondida && !derivada
  const cerrar = () => {
    actualizar.reset()
    setAbierta(false)
  }
  const guardar = () =>
    actualizar.mutate(
      { registro: pregunta, cambios: { answer: respuesta, answered_at: new Date().toISOString() } },
      {
        onSuccess: () => {
          setRespuesta('')
          setAbierta(false)
          // la pregunta atendida cambia lo que dicen las reglas de "Cerrar"
          refrescar()
        }
      }
    )
  return (
    <li className="space-y-1 rounded-sg-md border border-sg-border p-3">
      <p className="font-medium">{texto(pregunta, 'question_text')}</p>
      <p className="text-sg-caption text-sg-text-muted">
        {texto(pregunta, 'raised_by_role')} · <span data-estado={enElLugar || respondida ? 'respondida' : derivada ? 'derivada' : 'pendiente'}>{estado}</span>
      </p>
      {texto(pregunta, 'answer') ? <p className="text-sg-text-secondary">{texto(pregunta, 'answer')}</p> : null}
      <AccionesDeIa objeto="engagement_question" registro={pregunta} proyecto={proyecto} rotulo={texto(pregunta, 'question_text')} casos={['AI-08']} compacta />
      {derivada ? <QcsDeLaPregunta pregunta={pregunta} /> : null}
      {pendiente && destinos.length > 0 && !abierta ? (
        <Button size="sm" variant="secondary" onClick={() => setDerivando(true)}>
          {t('relacionamiento.ficha.derivar')}
        </Button>
      ) : null}
      {derivando ? <DialogoDeDerivacion pregunta={pregunta} destinos={destinos} alDerivar={refrescar} alCerrar={() => setDerivando(false)} /> : null}
      {pendiente && responde ? (
        abierta ? (
          <div className="space-y-2">
            <label className="block text-sg-label" htmlFor={`r-${pregunta.id}`}>
              {t('relacionamiento.ficha.respuesta')}
            </label>
            <Textarea id={`r-${pregunta.id}`} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" disabled={!respuesta.trim() || actualizar.isPending} aria-busy={actualizar.isPending} onClick={guardar}>
                {t('relacionamiento.ficha.guardarRespuesta')}
              </Button>
              <Button size="sm" variant="ghost" onClick={cerrar}>
                {t('comun.cancelar')}
              </Button>
            </div>
            {actualizar.isError ? (
              // la pregunta se relee con su versión nueva (la lista de preguntas es de donde sale); lo escrito queda en el cuadro
              <AvisoDeConflicto error={actualizar.error} releer={() => releer(['records', 'engagement_question'])} alRecargar={() => actualizar.reset()} />
            ) : null}
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setAbierta(true)}>
            {t('relacionamiento.ficha.responder')}
          </Button>
        )
      ) : null}
    </li>
  )
}

// la trazabilidad con los grupos fijos (revisión de UX, etapa 4): de dónde viene (la visita de campo, los grupos de interés y los
// temas), qué generó (los compromisos y las QCS que nacieron de ella) y lo que la sustenta (sus evidencias)
function Trazabilidad({ interaccion }: { interaccion: Registro }) {
  const paso = useSiguientePaso()
  // una evidencia que lo sustenta se abre en la vista previa, sobre la ficha (revisión de UX, etapa 6)
  const previa = useRutaDeVistaPrevia()
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = String(atributo(interaccion, 'project'))
  const base = `/projects/${encodeURIComponent(proyecto)}`
  const visita = useRegistro('field_visit', atributo<string>(interaccion, 'field_visit'))
  const grupos = useRelacionados('engagement', interaccion.id, 'engagement_stakeholder')
  const temas = useRelacionados('engagement', interaccion.id, 'engagement_topic')
  const compromisos = useTodos('commitment', { origin_engagement: interaccion.id }, can('commitment', 'READ'))
  const evidencias = useEvidenciasDe('engagement', interaccion.id)
  const nombreDeEvidencia = useNombreDeEvidencia()
  const rotulo = useRotuloDeRegistro()
  return (
    <PanelDeTrazabilidad
      deDondeViene={[
        {
          clave: 'visita',
          titulo: t('relacionamiento.ficha.visita'),
          contenido: visita.data ? (
            <EnlaceDeRegistro titulo={texto(visita.data, 'title')} ruta={`${base}/field-visits/${encodeURIComponent(visita.data.id)}`} />
          ) : null
        },
        {
          clave: 'grupos',
          titulo: t('relacionamiento.ficha.grupos'),
          contenido: grupos.isPending ? (
            <Cargando compacto />
          ) : grupos.data?.content.length ? (
            <ul>
              {grupos.data.content.map((g) => (
                <li key={g.id}>
                  <Link to={`${base}/stakeholders/${encodeURIComponent(g.id)}`} state={paso()} className="text-sg-primary-text underline">
                    <NombreDelGrupo grupo={g} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null
        },
        { clave: 'temas', titulo: t('relacionamiento.ficha.temas'), contenido: temas.data?.content.map((x) => texto(x, 'name')).join(', ') || null }
      ]}
      queGenero={[
        {
          clave: 'compromisos',
          titulo: t('relacionamiento.ficha.compromisos'),
          contenido: compromisos.data?.length ? (
            <ul>
              {compromisos.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <EnlaceDeRegistro titulo={rotulo(c)} ruta={rutaDeFicha('commitment', c)} />
                  <EstadoChip objeto="commitment" estado={c.state} />
                </li>
              ))}
            </ul>
          ) : null
        }
      ]}
      loSustenta={[
        {
          clave: 'evidencias',
          titulo: t('relacionamiento.ficha.pestanas.evidencias'),
          contenido: evidencias.data?.content.length ? (
            <ul>
              {evidencias.data.content.map((e) => (
                <li key={e.id}>
                  <EnlaceDeRegistro titulo={nombreDeEvidencia(e)} ruta={previa('evidence', e.id)} />
                </li>
              ))}
            </ul>
          ) : null
        }
      ]}
      pie={
        <>
          {visita.isError ? <FalloDeLectura error={visita.error} alReintentar={() => void visita.refetch()} /> : null}
          {grupos.isError ? <FalloDeLectura error={grupos.error} alReintentar={() => void grupos.refetch()} /> : null}
          {temas.isError ? <FalloDeLectura error={temas.error} alReintentar={() => void temas.refetch()} /> : null}
        </>
      }
    />
  )
}
