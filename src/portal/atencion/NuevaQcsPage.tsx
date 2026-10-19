import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, CONTROL, SelectNativo } from '../componentes/Campo'
import { useErroresDeCampo, useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { AvisoAlSalir, useSalidaPermitida } from '../componentes/FormularioPorPasos'
import { ConDefiniciones, FalloDeLectura } from '../componentes/LecturaConEstados'
import { nombreDe, useNombreDelGrupo } from '../componentes/NombreDeActor'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { SelectorDeUsuario, type Usuaria } from '../componentes/SelectorDeUsuario'
import { useAsignadoAlProyecto } from '../contexto/ProyectoLayout'
import { useMisAsignaciones, useProyecto } from '../contexto/proyectos'
import { esQcs, OBJETOS_DE_QCS, rutaDeQcs, SEVERIDADES_GRAVES, type ObjetoDeQcs } from '../datos/atencion'
import { ahoraEnLima, instanteDeLima } from '../datos/fechas'
import { atributo, campoDe, puedeLeer, texto, useCrear, useDefinicion, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// los campos que, escritos, son cambios por perder al salir (la fecha de recepción ya viene propuesta)
const CON_CAMBIOS = ['code', 'channel', 'category', 'description', 'priority', 'severity', 'request_medium', 'requested_resource'] as const

// S37 · registrar QCS (screens.md §8): en un solo paso lo que se planteó, por el canal que llegó, sin decidir todavía su
// tratamiento. es la única entrada de QCS (ASM-104): el equipo social registra también lo que llega por un contratista. el tipo
// se elige entre los que la cuenta puede crear, con su definición y la regla de sus plazos (los calcula el servidor al registrar,
// el acuse en días hábiles con los feriados configurados; ASM-096 y ASM-100). quien registra es quien la recibe
// (received_by_user_id, decisión 2 de F4): así una QCS confidencial nunca se pierde para quien la registró, y la regla
// CONFIDENTIAL_RECEIVER_REQUIRED nunca rechaza el alta. una anónima no lleva persona ni grupo de interés; la persona es un campo
// restringido y solo se ofrece si la definición la trae. el alta es requiresReason: pide motivo, y va con la Idempotency-Key
// nativa (useCrear): un reintento tras un corte no registra dos veces
const PLAZOS_POR_DEFECTO = { grievance_ack_days: 5, grievance_resolution_days: 30, inquiry_response_days: 15 }

export function NuevaQcsPage() {
  const { t } = useTranslation(NS)
  const { can, isAdmin } = useAuth()
  const { projectId = '' } = useParams()
  const asignaciones = useMisAsignaciones()
  const asignado = useAsignadoAlProyecto(projectId)
  const tipos = OBJETOS_DE_QCS.filter((o) => can(o, 'CREATE'))
  // solo las definiciones de los tipos que crea
  const definiciones = [
    useDefinicion(tipos.includes('grievance') ? 'grievance' : undefined),
    useDefinicion(tipos.includes('inquiry') ? 'inquiry' : undefined),
    useDefinicion(tipos.includes('stakeholder_request') ? 'stakeholder_request' : undefined)
  ]
  if (tipos.length === 0) return <Alert tone="notice">{t('nuevaQcs.sinTipo')}</Alert>
  if (!isAdmin) {
    if (asignaciones.isPending) return <Cargando />
    if (asignaciones.isError && !asignaciones.data) return <FalloDeLectura error={asignaciones.error} alReintentar={() => void asignaciones.refetch()} />
    if (!asignado) return <Alert tone="notice">{t('contexto.soloLectura')}</Alert>
  }
  // la clave del proyecto: lo tecleado para uno nunca pasa al alta de otro
  return (
    <ConDefiniciones definiciones={definiciones.filter((_, i) => tipos.includes(OBJETOS_DE_QCS[i]))}>
      {() => <Formulario key={projectId} tipos={tipos} />}
    </ConDefiniciones>
  )
}

interface Valores {
  code: string
  channel: string
  received_at: string
  category: string
  description: string
  priority: string
  severity: string
  request_medium: string
  requested_resource: string
}

function Formulario({ tipos }: { tipos: ObjetoDeQcs[] }) {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  const { projectId = '' } = useParams()
  const [busqueda] = useSearchParams()
  const navegar = useNavigate()
  const mensaje = useMensajeDeError()
  const erroresDeCampo = useErroresDeCampo()
  const pedido = busqueda.get('type') ?? ''
  const [tipo, setTipo] = useState<ObjetoDeQcs>(esQcs(pedido) && tipos.includes(pedido) ? pedido : tipos[0])
  const crearQueja = useCrear('grievance')
  const crearConsulta = useCrear('inquiry')
  const crearSolicitud = useCrear('stakeholder_request')
  const crear = { grievance: crearQueja, inquiry: crearConsulta, stakeholder_request: crearSolicitud }[tipo]
  const definicion = useDefinicion(tipo)
  const proyecto = useProyecto(projectId)
  const grupos = useTodos('stakeholder', { project: projectId })
  const origen = busqueda.get('origin_engagement')
  const [valores, setValores] = useState<Valores>({
    code: '',
    channel: '',
    received_at: ahoraEnLima(),
    category: '',
    description: '',
    priority: '',
    severity: '',
    request_medium: '',
    requested_resource: ''
  })
  const [anonima, setAnonima] = useState(false)
  const salida = useSalidaPermitida()
  const [confidencial, setConfidencial] = useState(false)
  const [responsable, setResponsable] = useState<Usuaria | null>(null)
  const [grupo, setGrupo] = useState('')
  const [persona, setPersona] = useState<Registro | null>(null)
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const cambiar = (campo: keyof Valores, valor: string) => setValores((v) => ({ ...v, [campo]: valor }))
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const etiqueta = (campo: string) => t(`nuevaQcs.campos.${campo}`)
  const instante = instanteDeLima(valores.received_at)
  const faltas = {
    code: valores.code.trim() === '',
    description: valores.description.trim() === '',
    received_at: instante === '',
    motivo: motivo.trim() === ''
  }
  const delServidor = erroresDeCampo(crear.error)
  const errorDe = (campo: keyof typeof faltas | string): string | undefined => {
    if (intentado && campo in faltas && faltas[campo as keyof typeof faltas]) {
      return campo === 'motivo' ? t('comun.motivoFalta') : campo === 'received_at' ? t('nuevaQcs.fechaInvalida') : t('nuevaQcs.obligatorio')
    }
    return delServidor[campo] ?? delServidor[`attributes.${campo}`]
  }
  const parametro = (campo: keyof typeof PLAZOS_POR_DEFECTO) => {
    const valor = atributo<number>(proyecto.data, campo)
    return typeof valor === 'number' ? valor : PLAZOS_POR_DEFECTO[campo]
  }
  const conPersona = puedeLeer(definicion.data, 'person')

  const registrar = () => {
    setIntentado(true)
    if (Object.values(faltas).some(Boolean)) return
    const atributos: Record<string, unknown> = {
      project: projectId,
      code: valores.code.trim(),
      received_at: instante,
      description: valores.description.trim(),
      anonymous: anonima,
      confidential: confidencial,
      // quien registra es quien la recibe (decisión 2 de F4)
      received_by_user_id: user?.id,
      received_by_user_email: user?.email
    }
    for (const campo of ['channel', 'category', 'priority'] as const) if (valores[campo]) atributos[campo] = valores[campo]
    if (tipo === 'grievance' && valores.severity) atributos.severity = valores.severity
    if (tipo === 'stakeholder_request') {
      if (valores.request_medium) atributos.request_medium = valores.request_medium
      if (valores.requested_resource.trim()) atributos.requested_resource = valores.requested_resource.trim()
    }
    if (responsable) Object.assign(atributos, { owner_user_id: responsable.id, owner_user_email: responsable.email })
    if (!anonima && grupo) atributos.stakeholder = grupo
    if (!anonima && persona && conPersona) atributos.person = persona.id
    if (origen) atributos.origin_engagement = origen
    crear.mutate(
      { atributos, motivo: motivo.trim() },
      {
        onSuccess: (r) => {
          salida.current = true
          navegar(rutaDeQcs(projectId, tipo, r.id))
        }
      }
    )
  }

  // los errores de campos sin control a la vista (quien recibe, el proyecto) van en el aviso general
  const conControl = ['code', 'channel', 'received_at', 'category', 'description', 'priority', 'severity', 'stakeholder', 'person', 'owner_user_id']
  const sinControl = Object.keys(delServidor).filter((c) => !conControl.includes(c.replace(/^attributes\./, '')))

  // un alta corta de una sola página (revisión de UX, etapa 5): el encabezado común, «Cancelar» junto a «Registrar» y, con
  // cambios, salir pide confirmar como en el formulario por pasos. la fecha de recepción propuesta no cuenta como cambio
  const conCambios = CON_CAMBIOS.some((c) => valores[c].trim() !== '') || motivo.trim() !== '' || responsable !== null || grupo !== '' || persona !== null
  const volverA = origen
    ? `/projects/${encodeURIComponent(projectId)}/engagements/${encodeURIComponent(origen)}`
    : `/projects/${encodeURIComponent(projectId)}/attention`
  return (
    <section className="mx-auto max-w-[1100px] space-y-4">
      <EncabezadoDePagina titulo={t('nuevaQcs.titulo')} descripcion={t('nuevaQcs.ayuda')} />
      <AvisoAlSalir conCambios={conCambios} salidaPermitida={salida} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          className="space-y-4"
          aria-label={t('nuevaQcs.titulo')}
          onSubmit={(e) => {
            e.preventDefault()
            registrar()
          }}
        >
          <fieldset className="space-y-2 rounded-sg-lg border border-sg-border p-4">
            <legend className="px-1 font-medium">{t('nuevaQcs.tipo')}</legend>
            {tipos.map((o) => (
              <label key={o} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="tipo"
                  className="mt-1"
                  checked={tipo === o}
                  onChange={() => {
                    setTipo(o)
                    crear.reset()
                  }}
                />
                <span>
                  <span className="font-medium">{t(`comun.qcs.${o}`)}</span>
                  <span className="block text-sg-caption text-sg-text-muted">{t(`nuevaQcs.definiciones.${o}`)}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-3 rounded-sg-lg border border-sg-border p-4">
            <legend className="px-1 font-medium">{t('nuevaQcs.secciones.comoLlego')}</legend>
            <Campo etiqueta={etiqueta('code')} error={errorDe('code')}>
              {(p) => <Input {...p} value={valores.code} maxLength={60} onChange={(e) => cambiar('code', e.target.value)} />}
            </Campo>
            <Campo etiqueta={etiqueta('channel')} error={errorDe('channel')}>
              {(p) => <SelectNativo {...p} value={valores.channel} onChange={(e) => cambiar('channel', e.target.value)} opciones={opciones('channel')} />}
            </Campo>
            <Campo etiqueta={etiqueta('received_at')} error={errorDe('received_at')}>
              {(p) => (
                <input {...p} type="datetime-local" className={CONTROL} value={valores.received_at} onChange={(e) => cambiar('received_at', e.target.value)} />
              )}
            </Campo>
            <p className="text-sg-caption text-sg-text-muted">{t('nuevaQcs.recibidaPor', { correo: user?.email ?? '' })}</p>
            {origen ? <p className="text-sg-caption text-sg-text-muted">{t('nuevaQcs.origen')}</p> : null}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={anonima}
                onChange={(e) => {
                  setAnonima(e.target.checked)
                  if (e.target.checked) {
                    setGrupo('')
                    setPersona(null)
                  }
                }}
              />
              <span>
                {etiqueta('anonymous')}
                <span className="block text-sg-caption text-sg-text-muted">{t('nuevaQcs.anonimaAyuda')}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={confidencial} onChange={(e) => setConfidencial(e.target.checked)} />
              <span>
                {etiqueta('confidential')}
                <span className="block text-sg-caption text-sg-text-muted">{t('nuevaQcs.confidencialAyuda')}</span>
              </span>
            </label>
            {anonima ? null : (
              <>
                <Campo etiqueta={etiqueta('stakeholder')} error={errorDe('stakeholder')}>
                  {(p) => (
                    <select {...p} className={CONTROL} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                      <option value="">{t('nuevaQcs.ningunGrupo')}</option>
                      {(grupos.data ?? []).map((g) => (
                        <OpcionDeGrupo key={g.id} grupo={g} />
                      ))}
                    </select>
                  )}
                </Campo>
                {grupos.isError && !grupos.data ? <FalloDeLectura error={grupos.error} alReintentar={() => void grupos.refetch()} /> : null}
                {conPersona ? (
                  <div className="space-y-1">
                    <p className="text-sg-body-sm font-medium">{etiqueta('person')}</p>
                    {persona ? (
                      <p className="text-sm">
                        {nombreDe(persona, 'person', t('comun.personaRegistrada'))}{' '}
                        <button type="button" className="text-sg-caption text-sg-primary-text underline" onClick={() => setPersona(null)}>
                          {t('nuevaQcs.quitar')}
                        </button>
                      </p>
                    ) : (
                      <BuscadorDeRegistro
                        objeto="person"
                        etiqueta={t('nuevaQcs.buscarPersona')}
                        rotulo={(r) => nombreDe(r, 'person', t('comun.personaRegistrada'))}
                        alElegir={setPersona}
                      />
                    )}
                    {errorDe('person') ? <p className="text-sg-caption text-sg-danger">{errorDe('person')}</p> : null}
                  </div>
                ) : null}
              </>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-sg-lg border border-sg-border p-4">
            <legend className="px-1 font-medium">{t('nuevaQcs.secciones.quePlantea')}</legend>
            <Campo etiqueta={etiqueta('description')} error={errorDe('description')}>
              {(p) => <Textarea {...p} value={valores.description} maxLength={4000} onChange={(e) => cambiar('description', e.target.value)} />}
            </Campo>
            <Campo etiqueta={etiqueta('category')} error={errorDe('category')}>
              {(p) => <SelectNativo {...p} value={valores.category} onChange={(e) => cambiar('category', e.target.value)} opciones={opciones('category')} />}
            </Campo>
            {tipo === 'grievance' ? (
              <Campo
                etiqueta={etiqueta('severity')}
                error={errorDe('severity')}
                ayuda={SEVERIDADES_GRAVES.includes(valores.severity) ? t('nuevaQcs.graveAyuda') : undefined}
              >
                {(p) => <SelectNativo {...p} value={valores.severity} onChange={(e) => cambiar('severity', e.target.value)} opciones={opciones('severity')} />}
              </Campo>
            ) : null}
            {tipo === 'stakeholder_request' ? (
              <>
                <Campo etiqueta={etiqueta('request_medium')}>
                  {(p) => (
                    <SelectNativo
                      {...p}
                      value={valores.request_medium}
                      onChange={(e) => cambiar('request_medium', e.target.value)}
                      opciones={opciones('request_medium')}
                    />
                  )}
                </Campo>
                <Campo etiqueta={etiqueta('requested_resource')}>
                  {(p) => (
                    <Textarea {...p} value={valores.requested_resource} maxLength={4000} onChange={(e) => cambiar('requested_resource', e.target.value)} />
                  )}
                </Campo>
              </>
            ) : null}
            <Campo etiqueta={etiqueta('priority')}>
              {(p) => <SelectNativo {...p} value={valores.priority} onChange={(e) => cambiar('priority', e.target.value)} opciones={opciones('priority')} />}
            </Campo>
            <SelectorDeUsuario etiqueta={etiqueta('owner')} valor={responsable} alCambiar={setResponsable} error={errorDe('owner_user_id')} />
          </fieldset>

          <Campo etiqueta={t('comun.motivoObligatorio')} error={errorDe('motivo')}>
            {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {crear.isError && (sinControl.length > 0 || Object.keys(delServidor).length === 0) ? <Alert tone="danger">{mensaje(crear.error)}</Alert> : null}
          <div className="flex flex-wrap justify-between gap-2 border-t border-sg-border pt-3">
            <Button type="button" variant="ghost" disabled={crear.isPending} onClick={() => navegar(volverA)}>
              {t('paginas.formulario.cancelar')}
            </Button>
            <Button type="submit" disabled={crear.isPending} aria-busy={crear.isPending}>
              {crear.isPending ? t('nuevaQcs.registrando') : t(`nuevaQcs.registrar.${tipo}`)}
            </Button>
          </div>
        </form>

        <aside aria-label={t('nuevaQcs.secciones.quePasara')} className="h-fit space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
          <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('nuevaQcs.secciones.quePasara')}</h2>
          <p>{valores.code.trim() ? t('nuevaQcs.quePasara.codigo', { codigo: valores.code.trim() }) : t('nuevaQcs.quePasara.sinCodigo')}</p>
          <p>
            {t(`nuevaQcs.plazos.${tipo}`, {
              acuse: parametro('grievance_ack_days'),
              resolucion: parametro('grievance_resolution_days'),
              respuesta: parametro('inquiry_response_days')
            })}
          </p>
          {tipo === 'stakeholder_request' ? null : <p className="text-sg-text-muted">{t('nuevaQcs.quePasara.plazoAlRegistrar')}</p>}
          {/* la tarea de acuse de una confidencial es genérica, sin vínculo con la queja (sgspe#20, D-1) */}
          {tipo === 'grievance' ? <p>{t(confidencial ? 'nuevaQcs.quePasara.tareaGenerica' : 'nuevaQcs.quePasara.tarea')}</p> : null}
          {confidencial ? <p className="text-sg-caption text-sg-text-muted">{t('nuevaQcs.confidencialAyuda')}</p> : null}
        </aside>
      </div>
    </section>
  )
}

function OpcionDeGrupo({ grupo }: { grupo: Registro }) {
  const nombre = useNombreDelGrupo(grupo)
  return <option value={grupo.id}>{nombre || texto(grupo, 'code')}</option>
}
