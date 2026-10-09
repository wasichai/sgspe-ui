import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { useErroresDeCampo, useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { ConDefiniciones, FalloDeLectura } from '../componentes/LecturaConEstados'
import { esMontoValido, normalizarMonto } from '../componentes/Monto'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { Pasos } from '../componentes/Pasos'
import { SelectorDeUsuario, type Usuaria } from '../componentes/SelectorDeUsuario'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { esConflictoDeVersion } from '../componentes/errores'
import { usePedir } from '../datos/http'
import { campoDe, puedeEscribir, texto, useCrear, useDefinicion, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { BarraDelTope } from './BarraDelTope'

// S30 · crear compromiso (screens.md §7, flujo 8): los siete pasos de la matriz de DOC-01 (qué, origen, solicitantes,
// beneficiarios, monto y campaña, plazo y responsable, revisión). el alta exige monto (RN-COM-004) y, como commitment es
// requiresReason, un motivo: nada se escribe hasta el último paso, donde se crea el borrador (con la clave nativa de
// Idempotency-Key), se vinculan los solicitantes y, si se pide, se envía a aprobación (submit). la revisión dice, antes de
// enviar, lo que D1 y D2 van a exigir, con el paso donde se completa. si algo falla después del alta, el borrador existe: se
// dice y se enlaza su ficha, y un reintento no lo vuelve a crear
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
  const definicion = useDefinicion('commitment')
  return <ConDefiniciones definiciones={[definicion]}>{() => <Asistente />}</ConDefiniciones>
}

function Asistente() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { projectId = '' } = useParams()
  const navegar = useNavigate()
  const pedir = usePedir()
  const cliente = useQueryClient()
  const escribe = useEscribeEnProyecto(projectId)
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
  // el borrador ya creado y los solicitantes ya vinculados: un reintento no los repite
  const [creado, setCreado] = useState<Registro | null>(null)
  const [vinculados, setVinculados] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<unknown>(null)
  const { register, handleSubmit, control, formState, trigger, setError, getValues } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: VACIO
  })
  const valores = useWatch({ control })
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const escribible = (campo: string) => puedeEscribir(definicion.data, campo)
  const paso = PASOS[actual]
  const requiereJustificacion = ORIGENES_CON_JUSTIFICACION.includes(texto(origen, 'engagement_type'))
  const campana = campanas.data?.find((c) => c.id === valores.exploration_campaign)
  const monto = valores.amount && esMontoValido(valores.amount) ? Number(normalizarMonto(valores.amount)) : null

  if (!escribe || !can('commitment', 'CREATE')) return <Alert tone="notice">{t('contexto.soloLectura')}</Alert>

  const error = (campo: keyof Valores, texto?: string) => {
    const e = formState.errors[campo]
    if (!e) return undefined
    if (e.type === 'manual') return e.message
    if (campo === 'motivo') return t('comun.motivoFalta')
    if (campo === 'amount' || campo === 'quantity') return t('nuevoCompromiso.errores.numero')
    if (campo.startsWith('beneficiaries_') && campo !== 'beneficiaries_detail') return t('nuevoCompromiso.errores.entero')
    return texto ?? t('nuevoCompromiso.errores.obligatorio')
  }

  // avanzar valida solo el paso actual; volver no valida
  const validarPaso = async (p: Paso): Promise<boolean> => {
    const bien = CAMPOS[p].length === 0 || (await trigger(CAMPOS[p].filter((c) => c !== 'motivo')))
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
    return bien
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
      salida[campo] = campo === 'amount' || campo === 'quantity' ? normalizarMonto(valor) : typeof valor === 'string' ? valor.trim() : valor
    }
    if (origen) salida.origin_engagement = origen.id
    if (responsable) Object.assign(salida, { owner_user_id: responsable.id, owner_user_email: responsable.email })
    if (verificador) Object.assign(salida, { verifier_user_id: verificador.id, verifier_user_email: verificador.email })
    return salida
  }

  const registrar = (enviar: boolean) =>
    handleSubmit(
      async (v) => {
        setFallo(null)
        setEnviando(true)
        const motivo = v.motivo.trim()
        let compromiso = creado
        try {
          if (!compromiso) {
            compromiso = await crear.mutateAsync({ atributos: atributos(v), motivo })
            setCreado(compromiso)
          }
        } catch (e) {
          // un error de un campo vuelve a su paso, con su texto; lo demás va al aviso de la revisión
          const porCampo = erroresDeCampo(e)
          const primero = Object.keys(porCampo)
            .map((c) => c.replace(/^attributes\./, ''))
            .find((c) => pasoDe(c))
          for (const [campo, textoDelError] of Object.entries(porCampo)) {
            const nombre = campo.replace(/^attributes\./, '') as keyof Valores
            if (pasoDe(nombre)) setError(nombre, { type: 'manual', message: textoDelError })
          }
          if (primero) setActual(PASOS.indexOf(pasoDe(primero)!))
          else setFallo(e)
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
          navegar(`/projects/${encodeURIComponent(projectId)}/commitments/${compromiso.id}`)
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
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
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
          {paso === 'que' ? (
            <>
              {campoDeTexto('code')}
              {campoDeTexto('title')}
              {campoDeTexto('description', true)}
              {campoDeTexto('objective', true)}
              {campoDeOpciones('resource_type')}
              {campoNumerico('quantity')}
              {campoDeTexto('unit')}
              {campoDeTexto('execution_time')}
              {campoDeOpciones('commitment_theme')}
              {campoDeOpciones('formality')}
            </>
          ) : null}
          {paso === 'origen' ? (
            <>
              <div className="space-y-1">
                <p className="text-sg-body-sm font-medium">{nombreDeCampo('origin_engagement')}</p>
                {origen ? (
                  <p className="text-sm">
                    {texto(origen, 'title')} · {texto(origen, 'engagement_type')}{' '}
                    <button type="button" className="text-sg-caption text-sg-primary-text underline" onClick={() => setOrigen(null)}>
                      {t('comun.quitar')}
                    </button>
                  </p>
                ) : (
                  <BuscadorDeRegistro
                    objeto="engagement"
                    etiqueta={t('nuevoCompromiso.buscarInteraccion')}
                    filtros={{ project: projectId }}
                    rotulo={(r) => `${texto(r, 'title')} · ${texto(r, 'engagement_type')}`}
                    alElegir={(r) => {
                      setOrigen(r)
                      setFaltaJustificacion(false)
                    }}
                  />
                )}
              </div>
              {requiereJustificacion ? (
                <Campo
                  etiqueta={nombreDeCampo('origin_justification')}
                  error={faltaJustificacion ? t('nuevoCompromiso.errores.justificacion') : error('origin_justification')}
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
              {escribible('exploration_campaign') ? (
                <Campo etiqueta={nombreDeCampo('exploration_campaign')} error={error('exploration_campaign')}>
                  {(p) => (
                    <SelectNativo
                      {...p}
                      {...register('exploration_campaign')}
                      opciones={(campanas.data ?? []).map((c) => ({ valor: c.id, etiqueta: texto(c, 'name') }))}
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
                }}
                error={errorDePersona}
              />
              <SelectorDeUsuario
                etiqueta={nombreDeCampo('verifier')}
                valor={verificador}
                alCambiar={(u) => {
                  setVerificador(u)
                  setErrorDePersona(undefined)
                }}
              />
              {campoDeOpciones('priority')}
            </>
          ) : null}
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
                    <Link to={`/projects/${encodeURIComponent(projectId)}/commitments/${creado.id}`} className="underline">
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
