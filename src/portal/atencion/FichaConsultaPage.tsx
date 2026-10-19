import { CaminoDelFlujo } from '../componentes/CaminoDelFlujo'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useMigaDelRegistro } from '../componentes/Migas'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { PanelDeTrazabilidad, type SeccionDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { PestanasDeFicha } from '../componentes/PestanasDeFicha'
import { plazoQueCorre } from '../datos/atencion'
import { useEvidenciasDe, useNombreDeEvidencia } from '../documentos/api'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Textarea } from '@wasichai/ui'
import { useAvailableTransitions } from '@wasichai/workflow'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { EstadoChip } from '../componentes/EstadoChip'
import { Consulta, esIlegible } from '../componentes/Estados'
import { useErroresDeCampo } from '../componentes/errores'
import { Historia } from '../componentes/Historia'
import { esMontoValido, normalizarMonto } from '../componentes/Monto'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import type { ObjetoDeQcs } from '../datos/atencion'
import { ahoraEnLima, instanteDeLima } from '../datos/fechas'
import { rutaDeFicha } from '../datos/fichas'
import { atributo, campoDe, texto, useDefinicion, usePuedeEditar, useRegistro, type Registro } from '../datos/registros'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { AccionesDeIa } from '../ia/AccionesDeIa'
import { NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { useAceptarSolicitud, type ObjetoQueNace } from './comandos'
import { AvisoDeConfidencial, Dato, DatosDelCaso, EditarQcs, MarcasDeQcs, PlazoQueCorre, useOrigenDeQcs } from './comunesDeFicha'
import { DialogoDeReclasificacion, useOfreceReclasificar } from './DialogoDeReclasificacion'
import { opcion } from '../datos/opciones'

// S57 · fichas de consulta y de solicitud (screens.md §8, WF-E2 y WF-E3): la misma anatomía que la queja (S36) con su propio
// ciclo. una consulta se responde o se deriva (las dos transiciones piden la respuesta y cuándo se comunicó, que se escriben antes
// con «Escribir la respuesta»); una solicitud se evalúa y se acepta creando el compromiso o, desde F5, el aporte en un solo
// comando (aceptar es responderla, api.md §4.6) o se declina con respuesta. las dos se reclasifican y suben su carta
// firmada como evidencia CARTA (ASM-098). un 404 puede ser una QCS confidencial que la cuenta no lee: el texto no dice cuál
const EDITABLES_COMUNES = [
  'category',
  'priority',
  'description',
  'owner_user_id',
  'owner_user_email',
  'stakeholder',
  'locality',
  'community',
  'topic',
  'response',
  'responded_at'
]

export function FichaConsultaPage() {
  const { inquiryId = '' } = useParams()
  return <FichaPorId objeto="inquiry" id={inquiryId} noExiste="fichaConsulta.consulta.noExiste" />
}

export function FichaSolicitudPage() {
  const { requestId = '' } = useParams()
  return <FichaPorId objeto="stakeholder_request" id={requestId} noExiste="fichaConsulta.solicitud.noExiste" />
}

function FichaPorId({ objeto, id, noExiste }: { objeto: 'inquiry' | 'stakeholder_request'; id: string; noExiste: string }) {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const registro = useRegistro(objeto, id)
  const aviso = (
    <div className="space-y-3">
      <Alert tone="warning">{t(noExiste)}</Alert>
      <Link to={`/projects/${encodeURIComponent(projectId)}/attention`} className="text-sm text-sg-primary-text underline">
        {t('fichaQueja.volver')}
      </Link>
    </div>
  )
  return (
    <Consulta consulta={registro} noExiste={aviso}>
      {(r) => (objeto === 'inquiry' ? <FichaDeConsulta key={r.id} consulta={r} /> : <FichaDeSolicitud key={r.id} solicitud={r} />)}
    </Consulta>
  )
}

function FichaDeConsulta({ consulta }: { consulta: Registro }) {
  const { t } = useTranslation(NS)
  const escribe = useEscribeEnProyecto(texto(consulta, 'project'))
  const edita = usePuedeEditar('inquiry') && escribe
  const [respondiendo, setRespondiendo] = useState(false)
  return (
    <>
      <Ficha
        objeto="inquiry"
        qcs={consulta}
        titulo={t('fichaConsulta.consulta.titulo', { codigo: texto(consulta, 'code') })}
        editables={EDITABLES_COMUNES}
        comprobar={['answer', 'refer', 'close', 'close_referred']}
        acciones={
          edita && consulta.state === 'received' ? (
            <Button size="sm" onClick={() => setRespondiendo(true)}>
              {t('fichaConsulta.consulta.responder')}
            </Button>
          ) : null
        }
        ayuda={consulta.state === 'received' ? <p className="text-sg-caption text-sg-text-muted">{t('fichaConsulta.consulta.responderAyuda')}</p> : null}
      />
      <EditarQcs
        objeto="inquiry"
        qcs={consulta}
        campos={['response', 'responded_at']}
        titulo={t('fichaConsulta.consulta.responderTitulo')}
        abierto={respondiendo}
        alCerrar={() => setRespondiendo(false)}
      />
    </>
  )
}

function FichaDeSolicitud({ solicitud }: { solicitud: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const escribe = useEscribeEnProyecto(texto(solicitud, 'project'))
  const transiciones = useAvailableTransitions('stakeholder_request', solicitud.id)
  const [aceptando, setAceptando] = useState(false)
  // lo que la cuenta puede crear al aceptar (spec F5 §2.2): COMMITMENT_MANAGER acepta pero no crea aportes. el aporte se ofrece solo
  // si el tenant tiene el modelo de F5 (ADMIN lo puede todo, y un tenant de F4 responde 404 por su definición). mientras la definición
  // no llega no se ofrece aceptar (el rótulo no cambia después); solo un 404 es «sin aportes»: otro error se dice y se reintenta
  const creaAportes = can('social_contribution', 'CREATE')
  const definicionDelAporte = useDefinicion(creaAportes ? 'social_contribution' : undefined)
  const aporteSinResolver = creaAportes && definicionDelAporte.isPending
  const aporteConError = creaAportes && definicionDelAporte.isError && !esIlegible(definicionDelAporte.error)
  const opciones: ObjetoQueNace[] = [
    ...(can('commitment', 'CREATE') ? (['commitment'] as const) : []),
    ...(definicionDelAporte.data ? (['social_contribution'] as const) : [])
  ]
  // aceptar es de comando: no es un botón de transición, pero GET …/transitions dice si el rol de quien mira la puede dar
  const acepta =
    escribe &&
    !aporteSinResolver &&
    opciones.length > 0 &&
    solicitud.state === 'under_evaluation' &&
    (transiciones.data ?? []).some((tr) => tr.name === 'accept' && tr.allowed)
  const textoDelBoton =
    opciones.length > 1
      ? t('fichaConsulta.solicitud.aceptar.botonElegir')
      : opciones[0] === 'social_contribution'
        ? t('fichaConsulta.solicitud.aceptar.botonAporte')
        : t('fichaConsulta.solicitud.aceptar.boton')
  return (
    <>
      <Ficha
        objeto="stakeholder_request"
        qcs={solicitud}
        titulo={t('fichaConsulta.solicitud.titulo', { codigo: texto(solicitud, 'code') })}
        editables={[...EDITABLES_COMUNES, 'request_medium', 'requested_resource']}
        generado={[
          {
            clave: 'compromiso',
            titulo: t('fichaConsulta.solicitud.campos.created_commitment'),
            contenido: texto(solicitud, 'created_commitment') ? <RegistroVinculado objeto="commitment" id={texto(solicitud, 'created_commitment')} /> : null
          },
          {
            clave: 'aporte',
            titulo: t('fichaConsulta.solicitud.campos.created_contribution'),
            contenido: texto(solicitud, 'created_contribution') ? (
              <RegistroVinculado objeto="social_contribution" id={texto(solicitud, 'created_contribution')} />
            ) : null
          }
        ]}
        comprobar={['start_evaluation', 'decline', 'close_declined', 'close_unfulfilled']}
        acciones={
          acepta ? (
            <Button size="sm" onClick={() => setAceptando(true)}>
              {textoDelBoton}
            </Button>
          ) : null
        }
        ayuda={
          <>
            <p className="text-sg-caption text-sg-text-muted">{t('fichaConsulta.solicitud.sinPlazo')}</p>
            {solicitud.state === 'under_evaluation' ? <p className="text-sg-caption text-sg-text-muted">{t('fichaConsulta.solicitud.declinarAyuda')}</p> : null}
            {escribe && aporteConError && solicitud.state === 'under_evaluation' ? (
              <Alert tone="warning">
                <p>{t('fichaConsulta.solicitud.aceptar.aporteSinDefinicion')}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => void definicionDelAporte.refetch()}>
                  {t('comun.reintentar')}
                </Button>
              </Alert>
            ) : null}
          </>
        }
        resumen={
          <>
            <Dato termino={t('fichaConsulta.solicitud.campos.request_medium')}>{opcion(solicitud, 'request_medium') || '—'}</Dato>
            {/* el compromiso o el aporte creado van en «Qué generó» del panel de trazabilidad (revisión de UX, etapa 4) */}
            <div className="sm:col-span-2">
              <Dato termino={t('fichaConsulta.solicitud.campos.requested_resource')}>{texto(solicitud, 'requested_resource') || '—'}</Dato>
            </div>
          </>
        }
      />
      {aceptando ? <DialogoDeAceptacion solicitud={solicitud} opciones={opciones} alCerrar={() => setAceptando(false)} /> : null}
    </>
  )
}

// el camino de cada workflow sin sus excepciones (derivar una consulta, declinar una solicitud); un estado de excepción se agrega
const CAMINO_DE_QCS: Record<Exclude<ObjetoDeQcs, 'grievance'>, string[]> = {
  inquiry: ['received', 'answered', 'closed'],
  stakeholder_request: ['received', 'under_evaluation', 'accepted', 'closed']
}

// la anatomía común de S57: encabezado, acciones, transiciones del rol (motivo siempre: requiresReason), pestañas y trazabilidad
function Ficha({
  objeto,
  qcs,
  titulo,
  editables,
  comprobar,
  acciones,
  ayuda,
  resumen,
  generado
}: {
  objeto: Exclude<ObjetoDeQcs, 'grievance'>
  qcs: Registro
  titulo: string
  editables: readonly string[]
  comprobar: readonly string[]
  acciones?: ReactNode
  ayuda?: ReactNode
  resumen?: ReactNode
  // lo que nació de la QCS (el compromiso o el aporte creado al aceptar una solicitud), para «Qué generó»
  generado?: SeccionDeTrazabilidad[]
}) {
  const { t } = useTranslation(NS)
  const proyecto = texto(qcs, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const edita = usePuedeEditar(objeto) && escribe
  const reclasifica = useOfreceReclasificar(objeto, qcs) && escribe
  const [editando, setEditando] = useState(false)
  const [reclasificando, setReclasificando] = useState(false)
  // la anatomía de design-system.md §6.1 (revisión de UX, etapa 4): migas con el código, encabezado, camino del flujo, panel de
  // decisión, pestañas con conteo y trazabilidad en tres grupos
  useMigaDelRegistro(texto(qcs, 'code'))
  const siguiente = useSiguienteAccion(objeto, qcs, comprobar)
  const evidencias = useEvidenciasDe(objeto, qcs.id)
  const origen = useOrigenDeQcs(objeto, qcs)
  const nombreDeEvidencia = useNombreDeEvidencia()
  const plazo = plazoQueCorre(objeto, qcs)
  return (
    <article className="space-y-4">
      <EncabezadoDePagina
        antetitulo={[t(`comun.qcs.${objeto}`), texto(qcs, 'code'), opcion(qcs, 'channel'), opcion(qcs, 'category')].filter(Boolean).join(' · ')}
        titulo={titulo}
        chips={
          <>
            <EstadoChip objeto={objeto} estado={qcs.state} />
            <PlazoQueCorre objeto={objeto} qcs={qcs} />
            <MarcasDeQcs qcs={qcs} />
          </>
        }
        primaria={
          <div className="flex flex-wrap gap-2">
            {acciones}
            <BotonesDeTransicion objeto={objeto} registro={qcs} proyecto={proyecto} comprobarAntes={comprobar} sinPrimaria={Boolean(acciones)} />
          </div>
        }
        secundarias={
          <>
            {edita ? (
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                {t('fichaQueja.comun.editar')}
              </Button>
            ) : null}
            {reclasifica ? (
              <Button size="sm" variant="secondary" onClick={() => setReclasificando(true)}>
                {t('piezas.reclasificar.boton')}
              </Button>
            ) : null}
          </>
        }
      />
      <AvisoDeConfidencial qcs={qcs} />
      {ayuda}
      <CaminoDelFlujo objeto={objeto} estado={qcs.state} camino={CAMINO_DE_QCS[objeto]} />
      <PanelDeDecision
        objeto={objeto}
        estado={qcs.state}
        desde={texto(qcs, 'state_changed_at') || null}
        por={texto(qcs, 'state_changed_by') || null}
        siguiente={siguiente}
        responsable={texto(qcs, 'owner_user_email')}
        vencimiento={plazo?.fecha ?? null}
        situacion={atributo(qcs, 'deadline_status')}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PestanasDeFicha
          etiqueta={titulo}
          pestanas={[
            { id: 'resumen', etiqueta: t('fichaQueja.pestanas.resumen'), render: () => <DatosDelCaso qcs={qcs}>{resumen}</DatosDelCaso> },
            {
              id: 'evidencias',
              etiqueta: t('fichaQueja.pestanas.evidencias'),
              conteo: evidencias.data?.totalElements ?? null,
              render: () => (
                <div className="space-y-2 pt-3">
                  <p className="text-sg-caption text-sg-text-muted">{t('fichaConsulta.cartaAyuda')}</p>
                  <EvidenciasDelRegistro
                    objeto={objeto}
                    registro={qcs}
                    escribe={escribe}
                    tipoInicial="CARTA"
                    clasificacionInicial="DATOS PERSONALES"
                    textoSubir={t('fichaConsulta.subirCarta')}
                  />
                </div>
              )
            },
            {
              id: 'actividad',
              etiqueta: t('fichaQueja.pestanas.actividad'),
              render: () => (
                <div className="pt-3">
                  <Historia objeto={objeto} id={qcs.id} vacio={t('fichaQueja.sinActividad')} />
                </div>
              )
            }
          ]}
        />
        <div className="space-y-4">
          <AccionesDeIa objeto={objeto} registro={qcs} proyecto={proyecto} rotulo={texto(qcs, 'code')} casos={['AI-08']} />
          <PanelDeTrazabilidad
            deDondeViene={origen}
            vacios={{ deDondeViene: t('fichaQueja.comun.sinOrigen') }}
            queGenero={generado ?? []}
            loSustenta={[
              {
                clave: 'evidencias',
                titulo: t('fichaQueja.pestanas.evidencias'),
                contenido: evidencias.data?.content.length ? (
                  <ul>
                    {evidencias.data.content.map((e) => (
                      <li key={e.id}>
                        <EnlaceDeRegistro titulo={nombreDeEvidencia(e)} ruta={rutaDeFicha('evidence', e)} />
                      </li>
                    ))}
                  </ul>
                ) : null
              }
            ]}
          />
        </div>
      </div>
      <EditarQcs objeto={objeto} qcs={qcs} campos={editables} abierto={editando} alCerrar={() => setEditando(false)} marcaConfidencial />
      {reclasificando ? <DialogoDeReclasificacion objeto={objeto} registro={qcs} alCerrar={() => setReclasificando(false)} /> : null}
    </article>
  )
}

// los campos del cuerpo de la aceptación que tienen control en el diálogo
const CAMPOS_DE_ACEPTACION = [
  'response',
  'respondedAt',
  'code',
  'title',
  'amount',
  'currency',
  'declared_purpose',
  'conditions',
  'payer_organization',
  'contribution_type'
]

// aceptar la solicitud creando el compromiso o el aporte (POST /api/sgspe/stakeholder-requests/{id}/accept): la respuesta y cuándo se
// comunicó, lo que nace y el motivo. el compromiso nace en borrador con lo mínimo de su alta (código, título, monto y moneda); el
// aporte nace en requested con lo mínimo del suyo (código, propósito, condiciones, quién paga y moneda; el tipo es opcional hasta
// aprobar) y sus ítems se cargan en su ficha (S44). con las dos opciones, «¿Qué se crea?». un reintento repite la misma
// Idempotency-Key: no nacen dos; cambiar lo que se crea la renueva. un 400 sobre un dato se dice junto a su control; el resto, en el aviso
function DialogoDeAceptacion({ solicitud, opciones, alCerrar }: { solicitud: Registro; opciones: ObjetoQueNace[]; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const navegar = useNavigate()
  const releer = useReleer()
  const aceptar = useAceptarSolicitud()
  const erroresDeCampo = useErroresDeCampo()
  const delServidor = Object.fromEntries(Object.entries(erroresDeCampo(aceptar.error)).map(([c, x]) => [c.replace(/^attributes\./, ''), x]))
  const soloDeCampos = Object.keys(delServidor).length > 0 && Object.keys(delServidor).every((c) => CAMPOS_DE_ACEPTACION.includes(c))
  const [crea, setCrea] = useState<ObjetoQueNace>(opciones[0] ?? 'commitment')
  const esAporte = crea === 'social_contribution'
  const definicion = useDefinicion(crea)
  const monedas = campoDe(definicion.data, 'currency')?.enumOptions ?? ['PEN']
  const tipos = campoDe(definicion.data, 'contribution_type')?.enumOptions ?? []
  const [valores, setValores] = useState({
    respuesta: texto(solicitud, 'response'),
    respondida: ahoraEnLima(),
    codigo: '',
    titulo: texto(solicitud, 'requested_resource'),
    monto: '',
    moneda: 'PEN',
    proposito: texto(solicitud, 'requested_resource'),
    condiciones: '',
    tipo: '',
    motivo: ''
  })
  const [pagador, setPagador] = useState<Registro | null>(null)
  const [intentado, setIntentado] = useState(false)
  // el error de quién paga, asociado a su buscador como los de Campo
  const idErrorDelPagador = `${useId()}-pagador`
  const errorDelPagador = intentado && !pagador ? t('fichaConsulta.solicitud.aceptar.falta') : delServidor.payer_organization
  const cambiar = (campo: keyof typeof valores) => (e: { target: { value: string } }) => setValores((v) => ({ ...v, [campo]: e.target.value }))
  const instante = instanteDeLima(valores.respondida)
  const falta = (campo: keyof typeof valores) => (intentado && valores[campo].trim() === '' ? t('fichaConsulta.solicitud.aceptar.falta') : undefined)
  const montoMal = intentado && valores.monto.trim() !== '' && !esMontoValido(valores.monto)
  const requeridos: (keyof typeof valores)[] = esAporte
    ? ['respuesta', 'codigo', 'proposito', 'condiciones', 'motivo']
    : ['respuesta', 'codigo', 'titulo', 'monto', 'motivo']
  const listo = requeridos.every((c) => valores[c].trim() !== '') && instante !== '' && (esAporte ? pagador !== null : esMontoValido(valores.monto))
  const confirmar = () => {
    setIntentado(true)
    if (!listo) return
    const atributos = esAporte
      ? {
          code: valores.codigo.trim(),
          declared_purpose: valores.proposito.trim(),
          conditions: valores.condiciones.trim(),
          currency: valores.moneda,
          payer_organization: pagador?.id,
          ...(valores.tipo ? { contribution_type: valores.tipo } : {})
        }
      : { code: valores.codigo.trim(), title: valores.titulo.trim(), amount: normalizarMonto(valores.monto), currency: valores.moneda }
    aceptar.mutate(
      { solicitud, crea, respuesta: valores.respuesta.trim(), respondidaEn: instante, atributos, motivo: valores.motivo.trim() },
      {
        onSuccess: ({ commitment, contribution }) => {
          const nacido = esAporte ? contribution : commitment
          navegar((nacido && rutaDeFicha(crea, nacido)) ?? '/attention')
        }
      }
    )
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('fichaConsulta.solicitud.aceptar.titulo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">
          {t(esAporte ? 'fichaConsulta.solicitud.aceptar.descripcionAporte' : 'fichaConsulta.solicitud.aceptar.descripcion')}
        </DialogDescription>
        <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
          {opciones.length > 1 ? (
            <fieldset className="space-y-1">
              <legend className="text-sg-body-sm font-medium">{t('fichaConsulta.solicitud.aceptar.queSeCrea')}</legend>
              {opciones.map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="crea"
                    value={o}
                    checked={crea === o}
                    onChange={() => {
                      // crear otra cosa es otra acción: otro cuerpo no reusa la Idempotency-Key del envío anterior
                      if (o !== crea) aceptar.nuevaAccion()
                      setCrea(o)
                    }}
                  />
                  {t(o === 'commitment' ? 'fichaConsulta.solicitud.aceptar.unCompromiso' : 'fichaConsulta.solicitud.aceptar.unAporte')}
                </label>
              ))}
            </fieldset>
          ) : null}
          <Campo etiqueta={t('fichaConsulta.solicitud.aceptar.respuesta')} error={falta('respuesta') ?? delServidor.response}>
            {(p) => <Textarea {...p} value={valores.respuesta} maxLength={4000} onChange={cambiar('respuesta')} />}
          </Campo>
          <Campo
            etiqueta={t('fichaConsulta.solicitud.aceptar.respondida')}
            error={
              intentado && instante === ''
                ? t('fichaConsulta.solicitud.aceptar.falta')
                : delServidor.respondedAt
                  ? t('fichaConsulta.solicitud.aceptar.respondidaInvalida')
                  : undefined
            }
          >
            {(p) => <Input {...p} type="datetime-local" value={valores.respondida} onChange={cambiar('respondida')} />}
          </Campo>
          {esAporte ? (
            <fieldset className="space-y-3">
              <legend className="text-sg-body-sm font-medium">{t('fichaConsulta.solicitud.aceptar.aporte')}</legend>
              <Campo etiqueta={t('fichaConsulta.solicitud.aceptar.codigoDelAporte')} error={falta('codigo') ?? delServidor.code}>
                {(p) => <Input {...p} value={valores.codigo} maxLength={60} onChange={cambiar('codigo')} />}
              </Campo>
              <Campo etiqueta={t('fichaConsulta.solicitud.aceptar.proposito')} error={falta('proposito') ?? delServidor.declared_purpose}>
                {(p) => <Textarea {...p} value={valores.proposito} maxLength={4000} onChange={cambiar('proposito')} />}
              </Campo>
              <Campo etiqueta={t('fichaConsulta.solicitud.aceptar.condiciones')} error={falta('condiciones') ?? delServidor.conditions}>
                {(p) => <Textarea {...p} value={valores.condiciones} maxLength={4000} onChange={cambiar('condiciones')} />}
              </Campo>
              <div className="space-y-1">
                <span className="block text-sg-body-sm font-medium">{t('fichaConsulta.solicitud.aceptar.pagador')}</span>
                {pagador ? (
                  <p className="flex items-center gap-2 text-sm">
                    {texto(pagador, 'name')}
                    <button type="button" className="text-sg-caption text-sg-primary-text underline" onClick={() => setPagador(null)}>
                      {t('fichaConsulta.solicitud.aceptar.cambiarPagador')}
                    </button>
                  </p>
                ) : (
                  <BuscadorDeRegistro
                    objeto="organization"
                    etiqueta={t('fichaConsulta.solicitud.aceptar.pagador')}
                    rotulo={(r) => texto(r, 'name')}
                    alElegir={setPagador}
                    describidoPor={errorDelPagador ? idErrorDelPagador : undefined}
                    invalido={Boolean(errorDelPagador)}
                  />
                )}
                <div aria-live="polite">
                  {errorDelPagador ? (
                    <p id={idErrorDelPagador} className="text-sg-caption text-sg-danger">
                      {errorDelPagador}
                    </p>
                  ) : null}
                </div>
              </div>
              <Campo etiqueta={t('fichaConsulta.solicitud.aceptar.tipo')} error={delServidor.contribution_type}>
                {(p) => <SelectNativo {...p} value={valores.tipo} opciones={tipos} onChange={cambiar('tipo')} />}
              </Campo>
              <Campo etiqueta={t('fichaConsulta.solicitud.aceptar.moneda')} error={delServidor.currency}>
                {(p) => <SelectNativo {...p} vacio={false} value={valores.moneda} opciones={monedas} onChange={cambiar('moneda')} />}
              </Campo>
            </fieldset>
          ) : (
            <fieldset className="space-y-3">
              <legend className="text-sg-body-sm font-medium">{t('fichaConsulta.solicitud.aceptar.compromiso')}</legend>
              <Campo etiqueta={t('fichaConsulta.solicitud.aceptar.codigo')} error={falta('codigo') ?? delServidor.code}>
                {(p) => <Input {...p} value={valores.codigo} maxLength={60} onChange={cambiar('codigo')} />}
              </Campo>
              <Campo etiqueta={t('fichaConsulta.solicitud.aceptar.tituloDelCompromiso')} error={falta('titulo') ?? delServidor.title}>
                {(p) => <Input {...p} value={valores.titulo} maxLength={300} onChange={cambiar('titulo')} />}
              </Campo>
              <Campo
                etiqueta={t('fichaConsulta.solicitud.aceptar.monto')}
                error={falta('monto') ?? (montoMal ? t('fichaConsulta.solicitud.aceptar.montoInvalido') : delServidor.amount)}
              >
                {(p) => <Input {...p} inputMode="decimal" value={valores.monto} onChange={cambiar('monto')} />}
              </Campo>
              <Campo etiqueta={t('fichaConsulta.solicitud.aceptar.moneda')} error={delServidor.currency}>
                {(p) => <SelectNativo {...p} vacio={false} value={valores.moneda} opciones={monedas} onChange={cambiar('moneda')} />}
              </Campo>
            </fieldset>
          )}
          <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && valores.motivo.trim() === '' ? t('comun.motivoFalta') : undefined}>
            {(p) => <Textarea {...p} value={valores.motivo} maxLength={500} onChange={cambiar('motivo')} />}
          </Campo>
          {aceptar.isError && !soloDeCampos ? (
            <AvisoDeConflicto
              error={aceptar.error}
              releer={() => releer(['record', 'stakeholder_request', solicitud.id], ['transitions', 'stakeholder_request', solicitud.id])}
              alRecargar={() => aceptar.reset()}
            />
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={aceptar.isPending} aria-busy={aceptar.isPending}>
            {aceptar.isPending ? t('fichaConsulta.solicitud.aceptar.confirmando') : t('fichaConsulta.solicitud.aceptar.confirmar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
