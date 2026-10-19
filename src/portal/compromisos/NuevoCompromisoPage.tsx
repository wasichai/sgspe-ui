import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { esConflictoDeVersion, useErroresDeCampo, useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { ConDefiniciones, FalloDeLectura } from '../componentes/LecturaConEstados'
import { esMontoValido, normalizarMonto } from '../componentes/Monto'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { Pasos } from '../componentes/Pasos'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { SelectorDeUsuario, type Usuaria } from '../componentes/SelectorDeUsuario'
import { useAsignadoAlProyecto } from '../contexto/ProyectoLayout'
import { useMisAsignaciones } from '../contexto/proyectos'
import { usePedir } from '../datos/http'
import { campoDe, puedeEscribir, texto, useCrear, useDefinicion, useTodos, type Registro } from '../datos/registros'
import { fechaYHoraPe, NS } from '../i18n'
import { BarraDelTope } from './BarraDelTope'
import { opcion } from '../datos/opciones'

// S30 · crear compromiso (screens.md §7, flujo 8): los siete pasos de la matriz de DOC-01 (qué, origen, solicitantes,
// beneficiarios, monto y campaña, plazo y responsable, revisión). el alta exige monto (RN-COM-004) y, como commitment es
// requiresReason, un motivo: nada se escribe hasta el último paso, donde se crea el borrador (con la clave nativa de
// Idempotency-Key), se vinculan los solicitantes y, si se pide, se envía a aprobación (submit). la revisión dice, antes de
// enviar, lo que D1 y D2 van a exigir, con el paso donde se completa. si algo falla después del alta, el borrador existe: se
// dice y se enlaza su ficha, y un reintento no lo vuelve a crear. desde F4, «Crear compromiso desde esta queja» (S36) llega con
// ?origin_grievance=<id>: el paso de origen lo dice y el alta lo manda (el proyecto ya es el de la queja: ProjectLinkGuard
// rechaza otro con PROJECT_MISMATCH, que vuelve a ese paso)
const PASOS = ['que', 'origen', 'solicitantes', 'beneficiarios', 'monto', 'plazo', 'revision'] as const
type Paso = (typeof PASOS)[number]

// la interacción de origen que exige justificación (RN-ENG-001)
const ORIGENES_CON_JUSTIFICACION = ['TALLER', 'REUNION INFORMATIVA']

const decimal = z.string().refine((v) => v.trim() === '' || esMontoValido(v))
const entero = z.string().refine((v) => v.trim() === '' || /^\d{1,9}$/.test(v.trim()))
const esquema = z.object({
  code: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string(),
  objective: z.string(),
  resource_type: z.string(),
  quantity: decimal,
  unit: z.string(),
  execution_time: z.string(),
  commitment_theme: z.string(),
  formality: z.string(),
  origin_justification: z.string(),
  request_medium: z.string(),
  agreed_date: z.string(),
  beneficiaries_count: entero,
  beneficiaries_female_count: entero,
  beneficiaries_male_count: entero,
  beneficiaries_detail: z.string(),
  amount: z.string().refine(esMontoValido),
  currency: z.string().min(1),
  exploration_campaign: z.string(),
  due_date: z.string(),
  priority: z.string(),
  motivo: z.string().trim().min(1)
})
type Valores = z.infer<typeof esquema>

const CAMPOS: Record<Paso, (keyof Valores)[]> = {
  que: ['code', 'title', 'description', 'objective', 'resource_type', 'quantity', 'unit', 'execution_time', 'commitment_theme', 'formality'],
  origen: ['origin_justification', 'request_medium', 'agreed_date'],
  solicitantes: [],
  beneficiarios: ['beneficiaries_count', 'beneficiaries_female_count', 'beneficiaries_male_count', 'beneficiaries_detail'],
  monto: ['amount', 'currency', 'exploration_campaign'],
  plazo: ['due_date', 'priority'],
  revision: ['motivo']
}
const pasoDe = (campo: string): Paso | undefined => PASOS.find((p) => (CAMPOS[p] as string[]).includes(campo))

// lo que el alta manda fuera del formulario (los buscadores y los selectores de persona) y el paso donde se elige. un error del
// servidor sobre uno de ellos (PROJECT_MISMATCH, WORKSHOP_COMMITMENT_BLOCKED, una persona desconocida) vuelve a ese paso
type Externo = 'origin_engagement' | 'owner' | 'verifier'
const EXTERNOS: Record<string, Externo> = {
  origin_engagement: 'origin_engagement',
  // la queja de origen se dice en el mismo paso, junto al origen
  origin_grievance: 'origin_engagement',
  owner_user_id: 'owner',
  owner_user_email: 'owner',
  verifier_user_id: 'verifier',
  verifier_user_email: 'verifier'
}
const PASO_DEL_EXTERNO: Record<Externo, Paso> = { origin_engagement: 'origen', owner: 'plazo', verifier: 'plazo' }
const pasoDelServidor = (campo: string): Paso | undefined => pasoDe(campo) ?? (EXTERNOS[campo] ? PASO_DEL_EXTERNO[EXTERNOS[campo]] : undefined)

// D1 (los campos de la matriz) y D2 (el responsable), con el paso donde se completa cada uno
const D1: (keyof Valores)[] = [
  'description',
  'objective',
  'resource_type',
  'quantity',
  'unit',
  'request_medium',
  'agreed_date',
  'due_date',
  'beneficiaries_count',
  'currency'
]

const VACIO: Valores = {
  code: '',
  title: '',
  description: '',
  objective: '',
  resource_type: '',
  quantity: '',
  unit: '',
  execution_time: '',
  commitment_theme: '',
  formality: '',
  origin_justification: '',
  request_medium: '',
  agreed_date: '',
  beneficiaries_count: '',
  beneficiaries_female_count: '',
  beneficiaries_male_count: '',
  beneficiaries_detail: '',
  amount: '',
  currency: 'PEN',
  exploration_campaign: '',
  due_date: '',
  priority: '',
  motivo: ''
}

export function NuevoCompromisoPage() {
  const { t } = useTranslation(NS)
  const { can, isAdmin } = useAuth()
  const { projectId = '' } = useParams()
  const asignaciones = useMisAsignaciones()
  const asignado = useAsignadoAlProyecto(projectId)
  const definicion = useDefinicion('commitment')
  // sin permiso o sin asignación vigente, el servidor rechazaría el alta. mientras se leen las asignaciones no se dice «solo
  // lectura», y si su lectura falla se dice con reintento
  if (!can('commitment', 'CREATE')) return <Alert tone="notice">{t('contexto.soloLectura')}</Alert>
  if (!isAdmin) {
    if (asignaciones.isPending) return <Cargando />
    if (asignaciones.isError && !asignaciones.data) return <FalloDeLectura error={asignaciones.error} alReintentar={() => void asignaciones.refetch()} />
    if (!asignado) return <Alert tone="notice">{t('contexto.soloLectura')}</Alert>
  }
  // la clave del proyecto: lo tecleado para un proyecto nunca pasa al alta de otro
  return <ConDefiniciones definiciones={[definicion]}>{() => <Asistente key={projectId} />}</ConDefiniciones>
}

// el borrador del alta en este navegador (design-system.md §6.3: guardado automático): lo escrito en el formulario se guarda
// por proyecto mientras se completan los pasos, se recupera al volver y se borra al registrar el compromiso. solo los campos del
// formulario: el origen, los solicitantes y las personas se vuelven a elegir. si el navegador no guarda, no pasa nada
const claveDelBorrador = (proyecto: string) => `sgspe.borrador.compromiso.${proyecto}`
interface Borrador {
  valores: Valores
  guardado: string
}
function leerBorrador(proyecto: string): Borrador | null {
  try {
    const crudo = localStorage.getItem(claveDelBorrador(proyecto))
    return crudo ? (JSON.parse(crudo) as Borrador) : null
  } catch {
    return null
  }
}
function guardarBorrador(proyecto: string, valores: Valores) {
  try {
    if (Object.values(valores).every((v) => v === '' || v === undefined || v === null)) localStorage.removeItem(claveDelBorrador(proyecto))
    else localStorage.setItem(claveDelBorrador(proyecto), JSON.stringify({ valores, guardado: new Date().toISOString() } satisfies Borrador))
  } catch {
    // sin almacenamiento, el formulario sigue sin borrador
  }
}
function borrarBorrador(proyecto: string) {
  try {
    localStorage.removeItem(claveDelBorrador(proyecto))
  } catch {
    // nada que borrar
  }
}

function Asistente() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const [busqueda] = useSearchParams()
  const quejaDeOrigen = busqueda.get('origin_grievance') || null
  const navegar = useNavigate()
  const pedir = usePedir()
  const cliente = useQueryClient()
  const definicion = useDefinicion('commitment')
  const crear = useCrear('commitment')
  const mensaje = useMensajeDeError()
  const erroresDeCampo = useErroresDeCampo()
  // P54: un compromiso solo referencia lo de su proyecto (409 PROJECT_MISMATCH): las campañas y las interacciones de origen se
  // piden filtradas por él
  const campanas = useTodos('exploration_campaign', { project: projectId })
  const grupos = useTodos('stakeholder', { project: projectId })
  const [actual, setActual] = useState(0)
  const [visitados, setVisitados] = useState(0)
  const [origen, setOrigen] = useState<Registro | null>(null)
  const [solicitantes, setSolicitantes] = useState<Set<string>>(new Set())
  const [responsable, setResponsable] = useState<Usuaria | null>(null)
  const [verificador, setVerificador] = useState<Usuaria | null>(null)
  const [errorDePersona, setErrorDePersona] = useState<string | undefined>(undefined)
  const [faltaJustificacion, setFaltaJustificacion] = useState(false)
  // los errores del servidor sobre lo que no está en el formulario, junto a su buscador o su selector
  const [erroresExternos, setErroresExternos] = useState<Partial<Record<Externo, string>>>({})
  const sinErrorExterno = (externo: Externo) => setErroresExternos(({ [externo]: _, ...resto }) => resto)
  // el borrador ya creado y los solicitantes ya vinculados: un reintento no los repite
  const [creado, setCreado] = useState<Registro | null>(null)
  const [vinculados, setVinculados] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<unknown>(null)
  const [recuperado] = useState(() => leerBorrador(projectId))
  const [avisoDeBorrador, setAvisoDeBorrador] = useState(recuperado !== null)
  const { register, handleSubmit, control, formState, trigger, setError, getValues, reset } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: recuperado ? { ...VACIO, ...recuperado.valores } : VACIO
  })
  const valores = useWatch({ control })
  // lo escrito se guarda medio segundo después de dejar de escribir; tras el alta ya no hay borrador que guardar
  useEffect(() => {
    if (creado) return
    const plazo = setTimeout(() => guardarBorrador(projectId, { ...VACIO, ...valores } as Valores), 500)
    return () => clearTimeout(plazo)
  }, [valores, projectId, creado])
  const descartarBorrador = () => {
    borrarBorrador(projectId)
    reset(VACIO)
    setAvisoDeBorrador(false)
  }
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const escribible = (campo: string) => puedeEscribir(definicion.data, campo)
  const paso = PASOS[actual]
  const requiereJustificacion = ORIGENES_CON_JUSTIFICACION.includes(texto(origen, 'engagement_type'))
  const campana = campanas.data?.find((c) => c.id === valores.exploration_campaign)
  // el monto viaja a la barra como texto decimal: la barra suma sin coma flotante
  const monto = valores.amount && esMontoValido(valores.amount) ? normalizarMonto(valores.amount) : null

  const error = (campo: keyof Valores, texto?: string) => {
    const e = formState.errors[campo]
    if (!e) return undefined
    if (e.type === 'manual') return e.message
    if (campo === 'motivo') return t('comun.motivoFalta')
    if (campo === 'amount' || campo === 'quantity') return t('nuevoCompromiso.errores.numero')
    if (campo.startsWith('beneficiaries_') && campo !== 'beneficiaries_detail') return t('nuevoCompromiso.errores.entero')
    return texto ?? t('nuevoCompromiso.errores.obligatorio')
  }

  // lo que el esquema no ve: la justificación de un origen en taller y las personas del plazo
  const revisarPropio = (p: Paso): boolean => {
    if (p === 'origen' && requiereJustificacion && !getValues('origin_justification').trim()) {
      setFaltaJustificacion(true)
      return false
    }
    if (p === 'plazo') {
      const mal = (u: Usuaria | null) => u !== null && (!u.id || !/^\S+@\S+\.\S+$/.test(u.email))
      if (mal(responsable) || mal(verificador)) {
        setErrorDePersona(t('nuevoCompromiso.errores.usuario'))
        return false
      }
      if (responsable && verificador && responsable.id === verificador.id) {
        setErrorDePersona(t('nuevoCompromiso.errores.mismaPersona'))
        return false
      }
    }
    return true
  }
  // avanzar valida solo el paso actual; volver no valida. por eso registrar vuelve a revisar todos los pasos
  const validarPaso = async (p: Paso): Promise<boolean> => {
    const bien = CAMPOS[p].length === 0 || (await trigger(CAMPOS[p].filter((c) => c !== 'motivo')))
    return revisarPropio(p) && bien
  }
  const ir = async (indice: number) => {
    if (indice > actual && !(await validarPaso(paso))) return
    setActual(indice)
    setVisitados((v) => Math.max(v, indice))
  }

  const nombreDeCampo = (campo: string) => t(`nuevoCompromiso.campos.${campo}`, { defaultValue: campoDe(definicion.data, campo)?.label ?? campo })
  const faltantes = [
    ...D1.filter((c) => !String(valores[c] ?? '').trim()).map((c) => ({ etiqueta: nombreDeCampo(c), paso: pasoDe(c) ?? 'que' })),
    ...(solicitantes.size === 0 ? [{ etiqueta: t('nuevoCompromiso.revision.solicitantes'), paso: 'solicitantes' as Paso }] : []),
    ...(!responsable ? [{ etiqueta: nombreDeCampo('owner'), paso: 'plazo' as Paso }] : [])
  ]

  const atributos = (v: Valores): Record<string, unknown> => {
    const salida: Record<string, unknown> = { project: projectId }
    for (const [campo, valor] of Object.entries(v)) {
      if (campo === 'motivo' || valor === '') continue
      // la justificación solo acompaña a un origen que la pide: si se quitó o se cambió el origen, no se manda
      if (campo === 'origin_justification' && !requiereJustificacion) continue
      salida[campo] = campo === 'amount' || campo === 'quantity' ? normalizarMonto(valor) : typeof valor === 'string' ? valor.trim() : valor
    }
    if (origen) salida.origin_engagement = origen.id
    if (quejaDeOrigen) salida.origin_grievance = quejaDeOrigen
    if (responsable) Object.assign(salida, { owner_user_id: responsable.id, owner_user_email: responsable.email })
    if (verificador) Object.assign(salida, { verifier_user_id: verificador.id, verifier_user_email: verificador.email })
    return salida
  }

  const registrar = (enviar: boolean) =>
    handleSubmit(
      async (v) => {
        setFallo(null)
        // un paso al que se volvió y no se validó al salir (el esquema ya se validó entero)
        const conProblema = creado ? undefined : PASOS.find((p) => !revisarPropio(p))
        if (conProblema) {
          setActual(PASOS.indexOf(conProblema))
          return
        }
        setErroresExternos({})
        setEnviando(true)
        const motivo = v.motivo.trim()
        let compromiso = creado
        try {
          if (!compromiso) {
            compromiso = await crear.mutateAsync({ atributos: atributos(v), motivo })
            setCreado(compromiso)
          }
        } catch (e) {
          // un error de un campo vuelve a su paso, con su texto junto al control; si alguno no tiene paso (o no hay errores de
          // campo), el aviso queda en la revisión con todos: nada se pierde en silencio
          const porCampo = Object.entries(erroresDeCampo(e)).map(([campo, texto]) => [campo.replace(/^attributes\./, ''), texto] as const)
          const externos: Partial<Record<Externo, string>> = {}
          for (const [campo, textoDelError] of porCampo) {
            if (pasoDe(campo)) setError(campo as keyof Valores, { type: 'manual', message: textoDelError })
            else if (EXTERNOS[campo]) externos[EXTERNOS[campo]] = [externos[EXTERNOS[campo]], textoDelError].filter(Boolean).join(' ')
          }
          setErroresExternos(externos)
          const pasos = porCampo.map(([campo]) => pasoDelServidor(campo))
          if (pasos.length === 0 || pasos.includes(undefined)) setFallo(e)
          else setActual(Math.min(...pasos.map((p) => PASOS.indexOf(p!))))
          setEnviando(false)
          return
        }
        try {
          const hechos = new Set(vinculados)
          for (const grupo of solicitantes) {
            if (hechos.has(grupo)) continue
            await pedir(`/objects/commitment/records/${compromiso.id}/related/commitment_stakeholder`, { json: { otherId: grupo }, motivo })
            hechos.add(grupo)
            setVinculados(new Set(hechos))
          }
          if (enviar) {
            try {
              await pedir(`/objects/commitment/records/${compromiso.id}/transitions/submit`, { metodo: 'POST', version: compromiso.updatedAt, motivo })
            } catch (e) {
              // los vínculos no cuentan como conflicto mientras la versión siga en el historial reciente (api.md §3.6); si
              // aun así llega un 412, se relee la versión y se reintenta una vez
              if (!esConflictoDeVersion(e)) throw e
              const releido = await pedir<Registro>(`/objects/commitment/records/${compromiso.id}`)
              await pedir(`/objects/commitment/records/${compromiso.id}/transitions/submit`, { metodo: 'POST', version: releido.updatedAt, motivo })
            }
          }
          void cliente.invalidateQueries({ queryKey: ['records', 'commitment'] })
          borrarBorrador(projectId)
          navegar(`/projects/${encodeURIComponent(projectId)}/commitments/${encodeURIComponent(compromiso.id)}`)
        } catch (e) {
          setFallo(e)
        } finally {
          setEnviando(false)
        }
      },
      (errores) => {
        const primero = Object.keys(errores)[0]
        const p = primero ? pasoDe(primero) : undefined
        if (p && p !== 'revision') setActual(PASOS.indexOf(p))
      }
    )()

  const campoDeTexto = (campo: keyof Valores, largo = false) =>
    escribible(campo) ? (
      <Campo key={campo} etiqueta={nombreDeCampo(campo)} error={error(campo)}>
        {(p) => (largo ? <Textarea {...p} {...register(campo)} maxLength={4000} /> : <Input {...p} {...register(campo)} maxLength={300} />)}
      </Campo>
    ) : null
  const campoDeFecha = (campo: keyof Valores) =>
    escribible(campo) ? (
      <Campo key={campo} etiqueta={nombreDeCampo(campo)} error={error(campo)}>
        {(p) => <Input {...p} type="date" {...register(campo)} />}
      </Campo>
    ) : null
  const campoDeOpciones = (campo: keyof Valores) =>
    escribible(campo) ? (
      <Campo key={campo} etiqueta={nombreDeCampo(campo)} error={error(campo)}>
        {(p) => <SelectNativo {...p} {...register(campo)} opciones={opciones(campo)} />}
      </Campo>
    ) : null
  const campoNumerico = (campo: keyof Valores) =>
    escribible(campo) ? (
      <Campo key={campo} etiqueta={nombreDeCampo(campo)} error={error(campo)}>
        {(p) => <Input {...p} inputMode="decimal" {...register(campo)} />}
      </Campo>
    ) : null

  return (
    <section className="mx-auto max-w-[1100px] space-y-4">
      <h1 className="text-sg-h1 font-semibold">{t('nuevoCompromiso.titulo')}</h1>
      <p className="text-sm text-sg-text-secondary">{t('nuevoCompromiso.ayuda')}</p>
      {avisoDeBorrador && recuperado ? (
        <Alert tone="notice">
          <span>{t('nuevoCompromiso.borrador.recuperado', { cuando: fechaYHoraPe(new Date(recuperado.guardado)) })}</span>{' '}
          <Button variant="ghost" size="sm" onClick={descartarBorrador}>
            {t('nuevoCompromiso.borrador.descartar')}
          </Button>
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Pasos pasos={PASOS.map((p) => t(`nuevoCompromiso.pasos.${p}`))} actual={actual} visitados={visitados} alIr={(i) => void ir(i)} />
        <form
          className="space-y-3"
          aria-label={t(`nuevoCompromiso.pasos.${paso}`)}
          onSubmit={(e) => {
            e.preventDefault()
            if (paso !== 'revision') void ir(actual + 1)
          }}
        >
          <h2 className="text-sg-h2 font-semibold">{t(`nuevoCompromiso.pasos.${paso}`)}</h2>
          {creado && paso !== 'revision' ? <Alert tone="notice">{t('nuevoCompromiso.revision.yaCreado')}</Alert> : null}
          {/* tras el alta, los pasos no se editan: un reintento solo vincula y envía, y lo cambiado aquí no se guardaría */}
          <fieldset disabled={creado !== null} className="space-y-3">
            {paso === 'que' ? (
              <>
                {campoDeTexto('code')}
                {campoDeTexto('title')}
                {campoDeTexto('description', true)}
                {campoDeTexto('objective', true)}
                {campoDeOpciones('resource_type')}
                <div className="grid gap-3 sm:grid-cols-2">
                  {campoNumerico('quantity')}
                  {campoDeTexto('unit')}
                </div>
                {campoDeTexto('execution_time')}
                {campoDeOpciones('commitment_theme')}
                {campoDeOpciones('formality')}
              </>
            ) : null}
            {paso === 'origen' ? (
              <>
                {quejaDeOrigen ? (
                  <div className="text-sm">
                    {t('nuevoCompromiso.naceDeLaQueja')}: <RegistroVinculado objeto="grievance" id={quejaDeOrigen} />
                  </div>
                ) : null}
                <div className="space-y-1">
                  <p className="text-sg-body-sm font-medium">{nombreDeCampo('origin_engagement')}</p>
                  {origen ? (
                    <p className="text-sm">
                      {texto(origen, 'title')} · {opcion(origen, 'engagement_type')}{' '}
                      <button
                        type="button"
                        className="text-sg-caption text-sg-primary-text underline"
                        onClick={() => {
                          setOrigen(null)
                          sinErrorExterno('origin_engagement')
                        }}
                      >
                        {t('comun.quitar')}
                      </button>
                    </p>
                  ) : (
                    <BuscadorDeRegistro
                      objeto="engagement"
                      etiqueta={t('nuevoCompromiso.buscarInteraccion')}
                      filtros={{ project: projectId }}
                      rotulo={(r) => `${texto(r, 'title')} · ${opcion(r, 'engagement_type')}`}
                      alElegir={(r) => {
                        setOrigen(r)
                        setFaltaJustificacion(false)
                        sinErrorExterno('origin_engagement')
                      }}
                    />
                  )}
                  <div aria-live="polite">
                    {erroresExternos.origin_engagement ? <p className="text-sg-caption text-sg-danger">{erroresExternos.origin_engagement}</p> : null}
                  </div>
                </div>
                {requiereJustificacion ? (
                  <Campo
                    etiqueta={nombreDeCampo('origin_justification')}
                    error={
                      faltaJustificacion && !valores.origin_justification?.trim() ? t('nuevoCompromiso.errores.justificacion') : error('origin_justification')
                    }
                  >
                    {(p) => <Textarea {...p} {...register('origin_justification')} maxLength={4000} />}
                  </Campo>
                ) : null}
                {campoDeOpciones('request_medium')}
                {campoDeFecha('agreed_date')}
              </>
            ) : null}
            {paso === 'solicitantes' ? (
              grupos.isPending ? (
                <Cargando compacto />
              ) : grupos.isError && !grupos.data ? (
                <FalloDeLectura error={grupos.error} alReintentar={() => void grupos.refetch()} />
              ) : (
                <fieldset className="space-y-1">
                  <legend className="sr-only">{t('nuevoCompromiso.pasos.solicitantes')}</legend>
                  {solicitantes.size === 0 ? <p className="text-sm text-sg-text-muted">{t('nuevoCompromiso.sinSolicitantes')}</p> : null}
                  {grupos.data
                    .filter((g) => g.state !== 'retired')
                    .map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={solicitantes.has(g.id)}
                          onChange={(e) => {
                            const siguiente = new Set(solicitantes)
                            if (e.target.checked) siguiente.add(g.id)
                            else siguiente.delete(g.id)
                            setSolicitantes(siguiente)
                          }}
                        />
                        <NombreDelGrupo grupo={g} />
                      </label>
                    ))}
                </fieldset>
              )
            ) : null}
            {paso === 'beneficiarios' ? (
              <>
                {campoNumerico('beneficiaries_count')}
                {campoNumerico('beneficiaries_female_count')}
                {campoNumerico('beneficiaries_male_count')}
                {campoDeTexto('beneficiaries_detail', true)}
              </>
            ) : null}
            {paso === 'monto' ? (
              <>
                {campoNumerico('amount')}
                {campoDeOpciones('currency')}
                {escribible('exploration_campaign') && campanas.isPending ? <Cargando compacto /> : null}
                {escribible('exploration_campaign') && campanas.data ? (
                  <Campo etiqueta={nombreDeCampo('exploration_campaign')} error={error('exploration_campaign')}>
                    {(p) => (
                      <SelectNativo
                        {...p}
                        {...register('exploration_campaign')}
                        opciones={campanas.data.map((c) => ({ valor: c.id, etiqueta: texto(c, 'name') }))}
                      />
                    )}
                  </Campo>
                ) : null}
                {campanas.isError && !campanas.data ? <FalloDeLectura error={campanas.error} alReintentar={() => void campanas.refetch()} /> : null}
                {campana ? <BarraDelTope campana={campana} monto={monto} moneda={valores.currency ?? 'PEN'} /> : null}
              </>
            ) : null}
            {paso === 'plazo' ? (
              <>
                {campoDeFecha('due_date')}
                <SelectorDeUsuario
                  etiqueta={nombreDeCampo('owner')}
                  valor={responsable}
                  alCambiar={(u) => {
                    setResponsable(u)
                    setErrorDePersona(undefined)
                    sinErrorExterno('owner')
                  }}
                  error={errorDePersona ?? erroresExternos.owner}
                />
                <SelectorDeUsuario
                  etiqueta={nombreDeCampo('verifier')}
                  valor={verificador}
                  alCambiar={(u) => {
                    setVerificador(u)
                    setErrorDePersona(undefined)
                    sinErrorExterno('verifier')
                  }}
                  error={erroresExternos.verifier}
                />
                {campoDeOpciones('priority')}
              </>
            ) : null}
          </fieldset>
          {paso === 'revision' ? (
            <>
              <section aria-label={t('nuevoCompromiso.revision.lista')} className="space-y-2 rounded-sg-md border border-sg-border p-3 text-sm">
                <h3 className="font-medium">{t('nuevoCompromiso.revision.lista')}</h3>
                {faltantes.length === 0 ? (
                  <p className="text-sg-success">{t('nuevoCompromiso.revision.completo')}</p>
                ) : (
                  <ul className="space-y-1">
                    {faltantes.map((f) => (
                      <li key={f.etiqueta} className="flex flex-wrap items-center gap-2">
                        {t('nuevoCompromiso.revision.falta', { campo: f.etiqueta })}
                        <button type="button" className="text-sg-caption text-sg-primary-text underline" onClick={() => setActual(PASOS.indexOf(f.paso))}>
                          {t('nuevoCompromiso.revision.irAlPaso')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="rounded-sg-md bg-sg-surface-sunken p-3 text-sm">
                <h3 className="font-medium">{t('nuevoCompromiso.revision.quePasara')}</h3>
                <p>{t('nuevoCompromiso.revision.quePasaraTexto')}</p>
              </section>
              <Campo etiqueta={t('comun.motivoObligatorio')} error={error('motivo')}>
                {(p) => <Textarea {...p} {...register('motivo')} maxLength={500} />}
              </Campo>
              {fallo ? (
                <Alert tone="danger">
                  {creado ? <p>{t('nuevoCompromiso.revision.parcial')}</p> : null}
                  <p>{mensaje(fallo)}</p>
                  {creado ? (
                    <Link to={`/projects/${encodeURIComponent(projectId)}/commitments/${encodeURIComponent(creado.id)}`} className="underline">
                      {t('nuevoCompromiso.revision.abrirFicha')}
                    </Link>
                  ) : null}
                </Alert>
              ) : null}
            </>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2 border-t border-sg-border pt-3">
            <Button type="button" variant="secondary" disabled={actual === 0 || enviando} onClick={() => setActual(actual - 1)}>
              {t('comun.anterior')}
            </Button>
            {paso === 'revision' ? (
              <div className="flex gap-2">
                <Button type="button" variant="secondary" disabled={enviando} aria-busy={enviando} onClick={() => void registrar(false)}>
                  {enviando ? t('nuevoCompromiso.revision.guardando') : t('nuevoCompromiso.revision.guardar')}
                </Button>
                <Button type="button" disabled={enviando || faltantes.length > 0} aria-busy={enviando} onClick={() => void registrar(true)}>
                  {t('nuevoCompromiso.revision.enviar')}
                </Button>
              </div>
            ) : (
              <Button type="submit">{t('comun.siguiente')}</Button>
            )}
          </div>
        </form>
      </div>
    </section>
  )
}
