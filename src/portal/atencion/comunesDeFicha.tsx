import { EnlaceConRastro } from '../contexto/Rastro'
import type { SeccionDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Textarea } from '@wasichai/ui'
import { Lock } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { tituloQueDiceQueEs } from '../componentes/CabeceraDeFicha'
import { CamposPlegables, type CampoDeFicha } from '../componentes/CamposPlegables'
import { Restringido } from '../componentes/Estados'
import { Seccion } from '../componentes/Seccion'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { nombreDe, NombreDelGrupo } from '../componentes/NombreDeActor'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { LEE_CONFIDENCIALES, plazoQueCorre, type ObjetoDeQcs } from '../datos/atencion'
import { atributo, puedeEscribir, texto, useActualizar, useDefinicion, useRegistro, type Registro } from '../datos/registros'
import { diaPe, fechaYHoraPe, NS } from '../i18n'
import { Dia } from '../componentes/Dia'
import { opcion } from '../datos/opciones'
import { Persona as PersonaDelEquipo } from '../componentes/Persona'
import { CampoDeMotivo, useMotivo } from '../componentes/Motivo'
import { EditarSeccion } from '../componentes/EditarSeccion'

// lo que comparten la ficha de queja (S36) y las de consulta y solicitud (S57): las marcas de anonimato y confidencialidad, el plazo
// que corre en el estado, los datos del caso (la persona solo para quien la lee, security.md §7.9), la edición con motivo (las QCS
// son requiresReason) y de dónde viene el planteamiento. los vínculos a otra QCS pasan por RegistroVinculado: una confidencial que
// la cuenta no lee es «Registro reservado» (ASM-095)

export function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sg-caption text-sg-text-muted">{termino}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  )
}

// anónima y confidencial, con quién puede leerla
export function MarcasDeQcs({ qcs }: { qcs: Registro }) {
  const { t } = useTranslation(NS)
  const confidencial = atributo(qcs, 'confidential') === true
  return (
    <>
      {atributo(qcs, 'anonymous') === true ? (
        <span className="rounded-sg-sm bg-sg-neutral-soft px-2 py-0.5 text-sg-caption text-sg-neutral">{t('fichaQueja.comun.anonima')}</span>
      ) : null}
      {confidencial ? (
        <span className="inline-flex items-center gap-1 rounded-sg-sm bg-sg-warning-soft px-2 py-0.5 text-sg-caption text-sg-warning">
          <Lock aria-hidden className="size-3.5" />
          {t('fichaQueja.comun.confidencial')}
        </span>
      ) : null}
    </>
  )
}

export function AvisoDeConfidencial({ qcs }: { qcs: Registro }) {
  const { t } = useTranslation(NS)
  return atributo(qcs, 'confidential') === true ? <Alert tone="notice">{t('fichaQueja.comun.confidencialAyuda')}</Alert> : null
}

// la situación de plazo (deadline_status, de JOB-01) y la fecha del plazo que corre en el estado: acuse, resolución o respuesta
export function PlazoQueCorre({ objeto, qcs }: { objeto: ObjetoDeQcs; qcs: Registro }) {
  const { t } = useTranslation(NS)
  const plazo = plazoQueCorre(objeto, qcs)
  return (
    <>
      <SituacionDePlazo valor={atributo(qcs, 'deadline_status')} />
      {plazo ? <span>{plazo.fecha ? t(`fichaQueja.plazos.${plazo.campo}`, { fecha: diaPe(plazo.fecha) }) : t('fichaQueja.plazos.sinFecha')}</span> : null}
    </>
  )
}

// la persona que la plantea: anónima, restringida (un campo restringido no llega en el GET: «Restringido», nunca vacío), la
// registrada o, sin ella, ningún dato (se pliega con los demás vacíos)
function persona(qcs: Registro, anonima: string, registrada: string): ReactNode {
  if (atributo(qcs, 'anonymous') === true) return anonima
  if (!('person' in qcs.attributes)) return <Restringido />
  return atributo(qcs, 'person') ? (
    <RegistroVinculado objeto="person" id={atributo<string>(qcs, 'person')} rotulo={(p) => nombreDe(p, 'person', registrada)} />
  ) : null
}

function Grupo({ id }: { id: string }) {
  const grupo = useRegistro('stakeholder', id)
  if (!grupo.data) return <RegistroVinculado objeto="stakeholder" id={id} />
  return (
    <EnlaceConRastro
      to={`/projects/${encodeURIComponent(texto(grupo.data, 'project'))}/stakeholders/${encodeURIComponent(id)}`}
      className="text-sg-primary-text underline"
    >
      <NombreDelGrupo grupo={grupo.data} />
    </EnlaceConRastro>
  )
}

// el título de la ficha de una QCS dice lo que se planteó (U-27 del rediseño de UX)
export const tituloDeQcs = (qcs: Registro, porCodigo: string): string => tituloQueDiceQueEs(texto(qcs, 'description'), porCodigo)

// los datos del caso comunes a las tres QCS, por tema (DD-06 y U-26 del rediseño de UX): qué se plantea, cómo llegó y quién, y la
// atención con su respuesta; cada sección pliega sus campos sin dato. planteamiento y atencion suman los propios del tipo
export function DatosDelCaso({
  objeto,
  qcs,
  editables,
  planteamiento = [],
  atencion = []
}: {
  objeto: ObjetoDeQcs
  qcs: Registro
  // los campos que la ficha deja editar: cada sección ofrece «Editar» con los suyos (tercera pasada de UX, 2.10)
  editables: readonly string[]
  planteamiento?: readonly CampoDeFicha[]
  atencion?: readonly CampoDeFicha[]
}) {
  const { t } = useTranslation(NS)
  const momento = (campo: string) => (texto(qcs, campo) ? fechaYHoraPe(new Date(texto(qcs, campo))) : null)
  const delEquipo = (campo: string) => (texto(qcs, campo) ? <PersonaDelEquipo correo={texto(qcs, campo)} /> : null)
  const anonima = atributo(qcs, 'anonymous') === true
  const campo = (clave: string, valor: ReactNode, ancho = false): CampoDeFicha => ({ clave, termino: t(`fichaQueja.campos.${clave}`), valor, ancho })
  const proyecto = String(atributo(qcs, 'project') ?? '')
  // la sección con su «Editar»: los campos que muestra, si la ficha los deja editar
  const seccion = (clave: string, campos: readonly CampoDeFicha[]) => (
    <Seccion
      titulo={t(`fichaQueja.comun.secciones.${clave}`)}
      acciones={
        <EditarSeccion
          objeto={objeto}
          registro={qcs}
          proyecto={proyecto || undefined}
          seccion={t(`fichaQueja.comun.secciones.${clave}`)}
          campos={campos.map((c) => c.clave)}
          permitidos={editables}
        />
      }
    >
      <CamposPlegables campos={campos} />
    </Seccion>
  )
  return (
    <div className="space-y-4 pt-3">
      {seccion('planteamiento', [
        campo('description', texto(qcs, 'description') ? <span className="whitespace-pre-line">{texto(qcs, 'description')}</span> : null, true),
        campo('category', opcion(qcs, 'category')),
        campo('priority', opcion(qcs, 'priority')),
        ...planteamiento
      ])}
      <Seccion titulo={t('fichaQueja.comun.secciones.llegada')}>
        <CamposPlegables
          campos={[
            campo('channel', opcion(qcs, 'channel')),
            campo('received_at', momento('received_at')),
            campo('received_by', delEquipo('received_by_user_email')),
            campo('person', persona(qcs, t('fichaQueja.comun.anonima'), t('comun.personaRegistrada'))),
            campo(
              'stakeholder',
              anonima ? t('fichaQueja.comun.anonima') : atributo(qcs, 'stakeholder') ? <Grupo id={String(atributo(qcs, 'stakeholder'))} /> : null
            )
          ]}
        />
      </Seccion>
      {seccion('atencion', [
        campo('owner', delEquipo('owner_user_email')),
        ...atencion,
        campo('response', texto(qcs, 'response') ? <span className="whitespace-pre-line">{texto(qcs, 'response')}</span> : null, true),
        campo('responded_at', momento('responded_at')),
        campo('closed_date', texto(qcs, 'closed_date') ? <Dia valor={texto(qcs, 'closed_date')} /> : null)
      ])}
    </div>
  )
}

// cambiar los datos del caso, con motivo (requiresReason): FormularioDeRegistro manda If-Match con la versión leída y un 412 ofrece
// «Recargar» sin perder lo escrito. el formulario se arma con la forma del GET: lo que la cuenta no escribe no viaja
export function EditarQcs({
  objeto,
  qcs,
  campos,
  abierto,
  alCerrar,
  titulo,
  marcaConfidencial = false
}: {
  objeto: ObjetoDeQcs
  qcs: Registro
  campos: readonly string[]
  abierto: boolean
  alCerrar: () => void
  titulo?: string
  // «Editar» ofrece marcarla confidencial; «Responder», que reusa este cajón, no
  marcaConfidencial?: boolean
}) {
  const { t } = useTranslation(NS)
  const motivo = useMotivo()
  const cerrar = () => {
    motivo.limpiar()
    alCerrar()
  }
  return (
    <Drawer titulo={titulo ?? t('fichaQueja.comun.editarTitulo')} abierto={abierto} alCerrar={cerrar}>
      <CampoDeMotivo motivo={motivo} etiqueta={t('fichaQueja.comun.motivo')} ayuda={t('fichaQueja.comun.motivoAyuda')} />
      {abierto ? (
        <>
          {marcaConfidencial ? <MarcarConfidencial objeto={objeto} qcs={qcs} alMarcar={cerrar} /> : null}
          <FormularioDeRegistro
            objeto={objeto}
            registro={qcs}
            campos={campos}
            motivo={motivo.recortado}
            antesDeEnviar={motivo.exigir}
            alGuardar={cerrar}
            alCancelar={cerrar}
          />
        </>
      ) : null}
    </Drawer>
  )
}

// marcar confidencial una QCS ya registrada (decisión del usuario del 2026-10-10, D-3; security.md §9.6): lo hacen su receptor o
// su responsable guardados, o quien lee todas las confidenciales (READ_CONFIDENTIAL); a los demás el servidor responde 403
// CONFIDENTIAL_MARK_FORBIDDEN, así que la marca no se les ofrece. no es un campo más del formulario: se confirma aparte, con lo
// que implica (los colegas sin acceso dejan de verla) y su motivo. quitar la marca exige READ_CONFIDENTIAL y no se ofrece aquí
function MarcarConfidencial({ objeto, qcs, alMarcar }: { objeto: ObjetoDeQcs; qcs: Registro; alMarcar: () => void }) {
  const { t } = useTranslation(NS)
  const { user, can } = useAuth()
  const definicion = useDefinicion(objeto)
  const actualizar = useActualizar(objeto)
  const releer = useReleer()
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const suya = Boolean(user?.id) && (atributo(qcs, 'received_by_user_id') === user?.id || atributo(qcs, 'owner_user_id') === user?.id)
  const ofrece = atributo(qcs, 'confidential') !== true && puedeEscribir(definicion.data, 'confidential') && (suya || can(objeto, LEE_CONFIDENCIALES))
  if (!ofrece) return null
  const cerrar = () => {
    setConfirmando(false)
    setMotivo('')
    setIntentado(false)
    actualizar.reset()
  }
  const confirmar = () => {
    setIntentado(true)
    if (!motivo.trim() || actualizar.isPending) return
    actualizar.mutate(
      { registro: qcs, cambios: { confidential: true }, motivo: motivo.trim() },
      {
        onSuccess: () => {
          cerrar()
          alMarcar()
        }
      }
    )
  }
  return (
    <section className="space-y-1 rounded-sg-md border border-sg-border p-3 text-sm">
      <p className="text-sg-text-secondary">{t('fichaQueja.comun.marcar.ayuda')}</p>
      <Button size="sm" variant="secondary" onClick={() => setConfirmando(true)}>
        {t('fichaQueja.comun.marcar.boton')}
      </Button>
      <Dialog open={confirmando} onOpenChange={(abierto) => !abierto && cerrar()}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="text-sg-h3 font-semibold">
            {t('fichaQueja.comun.marcar.titulo', { tipo: t(`comun.qcs.${objeto}`).toLowerCase() })}
          </DialogTitle>
          <DialogDescription className="text-sm text-sg-text-secondary">{t('fichaQueja.comun.marcar.texto')}</DialogDescription>
          <div className="mt-4 space-y-3">
            <Campo etiqueta={t('fichaQueja.comun.motivo')} error={intentado && !motivo.trim() ? t('comun.motivoFalta') : undefined}>
              {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
            </Campo>
            {actualizar.isError ? (
              <AvisoDeConflicto error={actualizar.error} releer={() => releer(['record', objeto, qcs.id])} alRecargar={() => actualizar.reset()} />
            ) : null}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={cerrar}>
              {t('comun.cancelar')}
            </Button>
            <Button onClick={confirmar} disabled={actualizar.isPending} aria-busy={actualizar.isPending}>
              {actualizar.isPending ? t('fichaQueja.comun.marcar.marcando') : t('fichaQueja.comun.marcar.confirmar')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// el texto de la pregunta de origen; si la cuenta no la lee, nada (la interacción ya se enlaza)
function Pregunta({ id }: { id: string }) {
  const pregunta = useRegistro('engagement_question', id)
  return pregunta.data ? <>«{texto(pregunta.data, 'question_text')}»</> : null
}

const RECLASIFICADA_DE: Readonly<Record<ObjetoDeQcs, [string, ObjetoDeQcs][]>> = {
  grievance: [
    ['reclassified_from_inquiry', 'inquiry'],
    ['reclassified_from_request', 'stakeholder_request']
  ],
  inquiry: [
    ['reclassified_from_grievance', 'grievance'],
    ['reclassified_from_request', 'stakeholder_request']
  ],
  stakeholder_request: [
    ['reclassified_from_grievance', 'grievance'],
    ['reclassified_from_inquiry', 'inquiry']
  ]
}

// de dónde viene el planteamiento: la interacción y la pregunta de origen y, si se reclasificó, el registro anterior de la cadena
// el origen de una QCS como secciones del panel de trazabilidad común (revisión de UX, etapa 4): la interacción, la pregunta y
// la QCS de la que se reclasificó; sin ninguna, el grupo dice que se registró directamente
export function useOrigenDeQcs(objeto: ObjetoDeQcs, qcs: Registro): SeccionDeTrazabilidad[] {
  const { t } = useTranslation(NS)
  const interaccion = atributo<string>(qcs, 'origin_engagement')
  const pregunta = atributo<string>(qcs, 'origin_question')
  return [
    {
      clave: 'interaccion',
      titulo: t('fichaQueja.comun.interaccion'),
      contenido: interaccion ? <RegistroVinculado objeto="engagement" id={interaccion} /> : null
    },
    { clave: 'pregunta', titulo: t('fichaQueja.comun.pregunta'), contenido: pregunta ? <Pregunta id={pregunta} /> : null },
    ...RECLASIFICADA_DE[objeto].map(([campo, otro]) => ({
      clave: campo,
      titulo: `${t('fichaQueja.comun.reclasificadaDe')} (${t(`comun.qcs.${otro}`)})`,
      contenido: atributo(qcs, campo) ? <RegistroVinculado objeto={otro} id={atributo<string>(qcs, campo)} /> : null
    }))
  ]
}

export function DeDondeViene({ objeto, qcs }: { objeto: ObjetoDeQcs; qcs: Registro }) {
  const { t } = useTranslation(NS)
  const reclasificadas = RECLASIFICADA_DE[objeto].filter(([campo]) => atributo(qcs, campo))
  const interaccion = atributo<string>(qcs, 'origin_engagement')
  const pregunta = atributo<string>(qcs, 'origin_question')
  return (
    <section aria-label={t('fichaQueja.comun.deDondeViene')} className="space-y-1">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('fichaQueja.comun.deDondeViene')}</h2>
      {interaccion ? (
        <div>
          {t('fichaQueja.comun.interaccion')}: <RegistroVinculado objeto="engagement" id={interaccion} />
        </div>
      ) : null}
      {pregunta ? (
        <div>
          {t('fichaQueja.comun.pregunta')}: <Pregunta id={pregunta} />
        </div>
      ) : null}
      {reclasificadas.map(([campo, otro]) => (
        <div key={campo}>
          {t('fichaQueja.comun.reclasificadaDe')} ({t(`comun.qcs.${otro}`)}): <RegistroVinculado objeto={otro} id={atributo<string>(qcs, campo)} />
        </div>
      ))}
      {!interaccion && !pregunta && reclasificadas.length === 0 ? <p className="text-sg-text-muted">{t('fichaQueja.comun.sinOrigen')}</p> : null}
    </section>
  )
}
