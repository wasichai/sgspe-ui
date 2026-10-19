import { useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Tabs, Textarea } from '@wasichai/ui'
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
import { campoDe, texto, useDefinicion, usePuedeEditar, useRegistro, type Registro } from '../datos/registros'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { AccionesDeIa } from '../ia/AccionesDeIa'
import { NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { useAceptarSolicitud, type ObjetoQueNace } from './comandos'
import { AvisoDeConfidencial, Dato, DatosDelCaso, DeDondeViene, EditarQcs, MarcasDeQcs, PlazoQueCorre } from './comunesDeFicha'
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
            <Dato termino={t('fichaConsulta.solicitud.campos.created_commitment')}>
              {texto(solicitud, 'created_commitment') ? <RegistroVinculado objeto="commitment" id={texto(solicitud, 'created_commitment')} /> : '—'}
            </Dato>
            <Dato termino={t('fichaConsulta.solicitud.campos.created_contribution')}>
              {texto(solicitud, 'created_contribution') ? (
                <RegistroVinculado objeto="social_contribution" id={texto(solicitud, 'created_contribution')} />
              ) : (
                '—'
              )}
            </Dato>
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

// la anatomía común de S57: encabezado, acciones, transiciones del rol (motivo siempre: requiresReason), pestañas y de dónde viene
function Ficha({
  objeto,
  qcs,
  titulo,
  editables,
  comprobar,
  acciones,
  ayuda,
  resumen
}: {
  objeto: Exclude<ObjetoDeQcs, 'grievance'>
  qcs: Registro
  titulo: string
  editables: readonly string[]
  comprobar: readonly string[]
  acciones?: ReactNode
  ayuda?: ReactNode
  resumen?: ReactNode
}) {
  const { t } = useTranslation(NS)
  const proyecto = texto(qcs, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const edita = usePuedeEditar(objeto) && escribe
  const reclasifica = useOfreceReclasificar(objeto, qcs) && escribe
  const [editando, setEditando] = useState(false)
  const [reclasificando, setReclasificando] = useState(false)
  return (
    <article className="space-y-4">
      <Link to={`/projects/${encodeURIComponent(proyecto)}/attention`} className="text-sm text-sg-primary-text underline">
        {t('fichaQueja.volver')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sg-overline font-semibold uppercase text-sg-text-muted">
            {[opcion(qcs, 'channel'), opcion(qcs, 'category')].filter(Boolean).join(' · ') || '—'}
          </p>
          <h1 className="text-sg-h1 font-semibold">{titulo}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <EstadoChip objeto={objeto} estado={qcs.state} />
            <PlazoQueCorre objeto={objeto} qcs={qcs} />
            <MarcasDeQcs qcs={qcs} />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {acciones}
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
          </div>
          <BotonesDeTransicion objeto={objeto} registro={qcs} proyecto={proyecto} comprobarAntes={comprobar} />
        </div>
      </header>
      <AvisoDeConfidencial qcs={qcs} />
      {ayuda}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Tabs
          label={titulo}
          tabs={[
            { id: 'resumen', label: t('fichaQueja.pestanas.resumen'), render: () => <DatosDelCaso qcs={qcs}>{resumen}</DatosDelCaso> },
            {
              id: 'evidencias',
              label: t('fichaQueja.pestanas.evidencias'),
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
              label: t('fichaQueja.pestanas.actividad'),
              render: () => (
                <div className="pt-3">
                  <Historia objeto={objeto} id={qcs.id} vacio={t('fichaQueja.sinActividad')} />
                </div>
              )
            }
          ]}
        />
        <aside className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
          <AccionesDeIa objeto={objeto} registro={qcs} proyecto={proyecto} rotulo={texto(qcs, 'code')} casos={['AI-08']} />
          <DeDondeViene objeto={objeto} qcs={qcs} />
        </aside>
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
