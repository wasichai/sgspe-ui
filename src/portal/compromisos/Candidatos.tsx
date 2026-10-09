import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useErroresDeCampo, useMensajeDeError } from '../componentes/errores'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Restringido, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { esMontoValido, normalizarMonto } from '../componentes/Monto'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { codigoDelError } from '../datos/http'
import { atributo, campoDe, texto, useDefinicion, useTodosConTope, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { useAceptarCandidato, useMarcarDuplicado, useRegistrarCandidato } from './comandosDeCandidatos'

// la vista Candidatos de S28 (screens.md §7, flujo 7): los propuestos con su procedencia (una persona, o la IA con su
// confianza, F7) y su cita (restringida: solo con DOWNLOAD_RESTRICTED, security.md §7.9), y los decididos con su enlace. una
// persona decide: aceptar crea el compromiso en borrador (POST …/accept, IK, IM, CR), «Es duplicado de…» apunta a un
// compromiso del mismo proyecto (POST …/duplicate, IM, CR) y «Rechazar» es la transición reject con motivo. la IA nunca crea
// un compromiso (RQ-AI-001)
export function Candidatos({ proyecto }: { proyecto?: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const escribe = useEscribeEnProyecto(proyecto)
  const candidatos = useTodosConTope('commitment_candidate', { project: proyecto, sort: 'created_at', dir: 'desc' })
  const [registrando, setRegistrando] = useState(false)
  const [revisando, setRevisando] = useState<string | null>(null)
  const lista = candidatos.data ?? []
  const propuestos = lista.filter((c) => c.state === 'proposed')
  const decididos = lista.filter((c) => c.state !== 'proposed')
  const enRevision = lista.find((c) => c.id === revisando)
  return (
    <section aria-label={t('compromisos.candidatos.titulo')} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-sg-text-secondary">{t('compromisos.candidatos.ayuda')}</p>
        {proyecto && escribe && can('commitment_candidate', 'CREATE') ? (
          <Button size="sm" onClick={() => setRegistrando(true)}>
            {t('compromisos.candidatos.registrar')}
          </Button>
        ) : null}
      </div>
      {candidatos.truncado ? <Alert tone="warning">{t('compromisos.candidatos.truncado', { n: numeroPe(lista.length) })}</Alert> : null}
      {candidatos.isPending ? (
        <Cargando />
      ) : candidatos.isError && !candidatos.data ? (
        <FalloDeLectura error={candidatos.error} alReintentar={() => void candidatos.refetch()} />
      ) : (
        <>
          <h2 className="text-sg-h3 font-semibold">{t('compromisos.candidatos.propuestos')}</h2>
          {propuestos.length === 0 ? (
            <Vacio titulo={t('compromisos.candidatos.sinPropuestos')} />
          ) : (
            <ul className="space-y-2">
              {propuestos.map((c) => (
                <TarjetaDeCandidato key={c.id} candidato={c} alRevisar={() => setRevisando(c.id)} />
              ))}
            </ul>
          )}
          <h2 className="text-sg-h3 font-semibold">{t('compromisos.candidatos.decididos')}</h2>
          {decididos.length === 0 ? (
            <p className="text-sm text-sg-text-muted">{t('compromisos.candidatos.sinDecididos')}</p>
          ) : (
            <ul className="space-y-2">
              {decididos.map((c) => (
                <TarjetaDeCandidato key={c.id} candidato={c} />
              ))}
            </ul>
          )}
        </>
      )}
      {proyecto ? <RegistrarCandidato proyecto={proyecto} abierto={registrando} alCerrar={() => setRegistrando(false)} /> : null}
      {enRevision ? <RevisionDeCandidato key={enRevision.id} candidato={enRevision} alCerrar={() => setRevisando(null)} /> : null}
    </section>
  )
}

function TarjetaDeCandidato({ candidato, alRevisar }: { candidato: Registro; alRevisar?: () => void }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(candidato, 'project')
  const ia = atributo(candidato, 'ai_generated') === true
  const confianza = atributo<number | string>(candidato, 'confidence')
  const creado = atributo<string>(candidato, 'created_commitment')
  const duplicado = atributo<string>(candidato, 'duplicate_of')
  return (
    <li className="space-y-1 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EstadoChip objeto="commitment_candidate" estado={candidato.state} />
        <span className="text-sg-caption text-sg-text-muted">
          {ia
            ? t('compromisos.candidatos.ia', { confianza: confianza === undefined || confianza === null ? '—' : Math.round(Number(confianza) * 100) })
            : t('compromisos.candidatos.humano')}
        </span>
      </div>
      <p>{texto(candidato, 'proposed_text')}</p>
      <p className="text-sg-caption">
        {t('compromisos.candidatos.cita')}: {'evidence_quote' in candidato.attributes ? texto(candidato, 'evidence_quote') || '—' : <Restringido />}
      </p>
      {creado ? (
        <Link to={`/projects/${encodeURIComponent(proyecto)}/commitments/${encodeURIComponent(creado)}`} className="text-sg-primary-text underline">
          {t('compromisos.candidatos.abrirCompromiso')}
        </Link>
      ) : null}
      {duplicado ? (
        <Link to={`/projects/${encodeURIComponent(proyecto)}/commitments/${encodeURIComponent(duplicado)}`} className="text-sg-primary-text underline">
          {t('compromisos.candidatos.duplicadoDe')}
        </Link>
      ) : null}
      {alRevisar ? (
        <Button size="sm" variant="secondary" onClick={alRevisar}>
          {t('compromisos.candidatos.revisar')}
        </Button>
      ) : null}
    </li>
  )
}

const esquemaDeAlta = z.object({
  proposed_text: z.string().trim().min(1),
  beneficiaries_text: z.string(),
  suggested_owner_user_email: z.union([z.literal(''), z.email()]),
  suggested_due_date: z.string()
})
type Alta = z.infer<typeof esquemaDeAlta>

function RegistrarCandidato({ proyecto, abierto, alCerrar }: { proyecto: string; abierto: boolean; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const registrar = useRegistrarCandidato()
  const erroresDeCampo = useErroresDeCampo()
  const mensaje = useMensajeDeError()
  const [interaccion, setInteraccion] = useState<Registro | null>(null)
  const { register, handleSubmit, formState, reset } = useForm<Alta>({
    resolver: zodResolver(esquemaDeAlta),
    defaultValues: { proposed_text: '', beneficiaries_text: '', suggested_owner_user_email: '', suggested_due_date: '' }
  })
  const delServidor = Object.fromEntries(Object.entries(erroresDeCampo(registrar.error)).map(([c, x]) => [c.replace(/^attributes\./, ''), x]))
  // una acción nueva cada vez que se abre: cerrar sin guardar no deja la clave de la anterior
  const cerrar = () => {
    reset()
    setInteraccion(null)
    registrar.nuevaAccion()
    alCerrar()
  }
  const enviar = handleSubmit((v) =>
    registrar.mutate(
      {
        atributos: Object.fromEntries(Object.entries({ ...v, project: proyecto, engagement: interaccion?.id }).filter(([, x]) => x !== '' && x !== undefined))
      },
      { onSuccess: cerrar }
    )
  )
  return (
    <Drawer
      titulo={t('compromisos.candidatos.registrarTitulo')}
      abierto={abierto}
      alCerrar={cerrar}
      pie={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={registrar.isPending}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" form="nuevo-candidato" disabled={registrar.isPending} aria-busy={registrar.isPending}>
            {registrar.isPending ? t('compromisos.candidatos.guardando') : t('comun.guardar')}
          </Button>
        </>
      }
    >
      <form id="nuevo-candidato" className="space-y-3" onSubmit={(e) => void enviar(e)}>
        <Campo
          etiqueta={t('compromisos.candidatos.texto')}
          error={delServidor.proposed_text ?? (formState.errors.proposed_text ? t('compromisos.candidatos.textoFalta') : undefined)}
        >
          {(p) => <Textarea {...p} {...register('proposed_text')} maxLength={4000} />}
        </Campo>
        <Campo etiqueta={t('compromisos.candidatos.beneficiarios')} error={delServidor.beneficiaries_text}>
          {(p) => <Textarea {...p} {...register('beneficiaries_text')} maxLength={2000} />}
        </Campo>
        <Campo
          etiqueta={t('compromisos.candidatos.responsableSugerido')}
          error={
            delServidor.suggested_owner_user_email ?? (formState.errors.suggested_owner_user_email ? t('compromisos.candidatos.correoInvalido') : undefined)
          }
        >
          {(p) => <Input {...p} type="email" {...register('suggested_owner_user_email')} />}
        </Campo>
        <Campo etiqueta={t('compromisos.candidatos.venceSugerido')} error={delServidor.suggested_due_date}>
          {(p) => <Input {...p} type="date" {...register('suggested_due_date')} />}
        </Campo>
        <div className="space-y-1">
          <p className="text-sg-body-sm font-medium">{t('compromisos.candidatos.interaccion')}</p>
          {interaccion ? (
            <p className="text-sm">
              {texto(interaccion, 'title')}{' '}
              <button type="button" className="text-sg-caption text-sg-primary-text underline" onClick={() => setInteraccion(null)}>
                {t('comun.quitar')}
              </button>
            </p>
          ) : (
            <BuscadorDeRegistro
              objeto="engagement"
              etiqueta={t('compromisos.candidatos.buscarInteraccion')}
              filtros={{ project: proyecto }}
              rotulo={(r) => texto(r, 'title')}
              alElegir={setInteraccion}
            />
          )}
        </div>
        {registrar.isError &&
        !Object.keys(delServidor).some((c) => ['proposed_text', 'beneficiaries_text', 'suggested_owner_user_email', 'suggested_due_date'].includes(c)) ? (
          <Alert tone="danger">{mensaje(registrar.error)}</Alert>
        ) : null}
      </form>
    </Drawer>
  )
}

const esquemaDeAceptacion = z.object({
  code: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string(),
  amount: z.string().refine(esMontoValido),
  currency: z.string().min(1),
  due_date: z.string(),
  motivo: z.string().trim().min(1)
})
type Aceptacion = z.infer<typeof esquemaDeAceptacion>
// los errores del servidor que van junto a un control del formulario; los demás (state, record…) van en el aviso
const CAMPOS_DE_ACEPTACION = ['code', 'title', 'description', 'amount', 'currency', 'due_date', 'reason']

type Decision = 'aceptar' | 'duplicado'

function RevisionDeCandidato({ candidato, alCerrar }: { candidato: Registro; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
  const proyecto = texto(candidato, 'project')
  const escribe = useEscribeEnProyecto(proyecto) && can('commitment_candidate', 'UPDATE')
  const aceptar = useAceptarCandidato()
  const duplicar = useMarcarDuplicado()
  const releer = useReleer()
  const erroresDeCampo = useErroresDeCampo()
  const definicion = useDefinicion('commitment')
  const [decision, setDecision] = useState<Decision>('aceptar')
  const [compromiso, setCompromiso] = useState<Registro | null>(null)
  const [motivoDuplicado, setMotivoDuplicado] = useState('')
  const [intentado, setIntentado] = useState(false)
  // por puntos de código: cortar en 120 unidades UTF-16 puede partir un par sustituto (un emoji)
  const texto120 = Array.from(texto(candidato, 'proposed_text')).slice(0, 120).join('')
  const { register, handleSubmit, formState } = useForm<Aceptacion>({
    resolver: zodResolver(esquemaDeAceptacion),
    defaultValues: {
      code: '',
      title: texto120,
      description: texto(candidato, 'proposed_text'),
      amount: '',
      currency: 'PEN',
      due_date: texto(candidato, 'suggested_due_date'),
      motivo: ''
    }
  })
  const monedas = campoDe(definicion.data, 'currency')?.enumOptions ?? ['PEN']
  const error = aceptar.error ?? duplicar.error
  const delServidor = Object.fromEntries(Object.entries(erroresDeCampo(aceptar.error)).map(([c, x]) => [c.replace(/^attributes\./, ''), x]))
  const falta = (campo: keyof Aceptacion, texto: string = t('compromisos.candidatos.obligatorio')) =>
    delServidor[campo] ?? (formState.errors[campo] ? texto : undefined)
  const releerCandidato = () => releer(['records', 'commitment_candidate'], ['transitions', 'commitment_candidate', candidato.id])
  const confirmarAceptacion = handleSubmit((v) =>
    aceptar.mutate(
      {
        candidato,
        atributos: Object.fromEntries(
          Object.entries({
            code: v.code.trim(),
            title: v.title.trim(),
            description: v.description.trim(),
            amount: normalizarMonto(v.amount),
            currency: v.currency,
            due_date: v.due_date,
            origin_engagement: atributo<string>(candidato, 'engagement')
          }).filter(([, x]) => x !== '' && x !== undefined && x !== null)
        ),
        motivo: v.motivo.trim()
      },
      { onSuccess: ({ commitment }) => navegar(`/projects/${proyecto}/commitments/${commitment.id}`) }
    )
  )
  const confirmarDuplicado = () => {
    setIntentado(true)
    if (!compromiso || !motivoDuplicado.trim()) return
    duplicar.mutate({ candidato, compromiso: compromiso.id, motivo: motivoDuplicado.trim() }, { onSuccess: alCerrar })
  }
  const enCurso = aceptar.isPending || duplicar.isPending
  return (
    <Drawer titulo={t('compromisos.candidatos.revisarTitulo')} abierto alCerrar={alCerrar}>
      <p className="text-sm">{texto(candidato, 'proposed_text')}</p>
      <p className="text-sg-caption">
        {t('compromisos.candidatos.cita')}: {'evidence_quote' in candidato.attributes ? texto(candidato, 'evidence_quote') || '—' : <Restringido />}
      </p>
      {texto(candidato, 'suggested_owner_user_email') || texto(candidato, 'suggested_due_date') ? (
        <p className="text-sg-caption text-sg-text-muted">
          {t('compromisos.candidatos.sugerido', {
            responsable: texto(candidato, 'suggested_owner_user_email') || '—',
            fecha: texto(candidato, 'suggested_due_date') ? diaPe(texto(candidato, 'suggested_due_date')) : '—'
          })}
        </p>
      ) : null}
      {escribe ? (
        <>
          <fieldset className="space-y-1">
            <legend className="text-sg-body-sm font-medium">{t('compromisos.candidatos.decision')}</legend>
            {can('commitment', 'CREATE') ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="decision" checked={decision === 'aceptar'} onChange={() => setDecision('aceptar')} />
                {t('compromisos.candidatos.aceptar')}
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="decision" checked={decision === 'duplicado'} onChange={() => setDecision('duplicado')} />
              {t('compromisos.candidatos.duplicado')}
            </label>
          </fieldset>
          {decision === 'aceptar' && can('commitment', 'CREATE') ? (
            <form id="aceptar-candidato" className="space-y-3" onSubmit={(e) => void confirmarAceptacion(e)}>
              <p className="text-sg-caption text-sg-text-muted">{t('compromisos.candidatos.aceptarAyuda')}</p>
              <Campo etiqueta={t('compromisos.candidatos.codigo')} error={falta('code')}>
                {(p) => <Input {...p} {...register('code')} maxLength={40} />}
              </Campo>
              <Campo etiqueta={t('compromisos.candidatos.tituloDelCompromiso')} error={falta('title')}>
                {(p) => <Input {...p} {...register('title')} maxLength={300} />}
              </Campo>
              <Campo etiqueta={t('compromisos.candidatos.descripcion')} error={falta('description')}>
                {(p) => <Textarea {...p} {...register('description')} maxLength={4000} />}
              </Campo>
              <Campo etiqueta={t('compromisos.candidatos.monto')} error={falta('amount', t('compromisos.candidatos.montoInvalido'))}>
                {(p) => <Input {...p} inputMode="decimal" {...register('amount')} />}
              </Campo>
              <Campo etiqueta={t('compromisos.candidatos.moneda')} error={falta('currency')}>
                {(p) => <SelectNativo {...p} vacio={false} {...register('currency')} opciones={monedas} />}
              </Campo>
              <Campo etiqueta={t('compromisos.candidatos.vence')} error={falta('due_date')}>
                {(p) => <Input {...p} type="date" {...register('due_date')} />}
              </Campo>
              <Campo etiqueta={t('comun.motivoObligatorio')} error={delServidor.reason ?? (formState.errors.motivo ? t('comun.motivoFalta') : undefined)}>
                {(p) => <Textarea {...p} {...register('motivo')} maxLength={500} />}
              </Campo>
              <Button type="submit" disabled={enCurso} aria-busy={aceptar.isPending}>
                {aceptar.isPending ? t('compromisos.candidatos.guardando') : t('compromisos.candidatos.aceptar')}
              </Button>
            </form>
          ) : null}
          {decision === 'duplicado' ? (
            <div role="group" aria-label={t('compromisos.candidatos.duplicado')} className="space-y-3">
              {compromiso ? (
                <p className="text-sm">
                  {texto(compromiso, 'code')} · {texto(compromiso, 'title')}{' '}
                  <button type="button" className="text-sg-caption text-sg-primary-text underline" onClick={() => setCompromiso(null)}>
                    {t('comun.quitar')}
                  </button>
                </p>
              ) : (
                <BuscadorDeRegistro
                  objeto="commitment"
                  etiqueta={t('compromisos.candidatos.buscarCompromiso')}
                  filtros={{ project: proyecto }}
                  rotulo={(r) => `${texto(r, 'code')} · ${texto(r, 'title')}`}
                  alElegir={setCompromiso}
                />
              )}
              {intentado && !compromiso ? <p className="text-sg-caption text-sg-danger">{t('compromisos.candidatos.obligatorio')}</p> : null}
              <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && !motivoDuplicado.trim() ? t('comun.motivoFalta') : undefined}>
                {(p) => <Textarea {...p} value={motivoDuplicado} maxLength={500} onChange={(e) => setMotivoDuplicado(e.target.value)} />}
              </Campo>
              <Button onClick={confirmarDuplicado} disabled={enCurso} aria-busy={duplicar.isPending}>
                {duplicar.isPending ? t('compromisos.candidatos.guardando') : t('compromisos.candidatos.confirmar')}
              </Button>
            </div>
          ) : null}
          {error && !Object.keys(delServidor).some((c) => CAMPOS_DE_ACEPTACION.includes(c)) ? (
            <AvisoDeConflicto
              error={error}
              propios={{
                STATE_MISMATCH: t('compromisos.candidatos.errores.STATE_MISMATCH'),
                PERSON_REQUIRED: t('compromisos.candidatos.errores.PERSON_REQUIRED')
              }}
              releer={releerCandidato}
              alRecargar={() => {
                aceptar.reset()
                duplicar.reset()
              }}
            >
              {codigoDelError(error) === 'STATE_MISMATCH' ? (
                <Button size="sm" variant="secondary" className="ml-2" onClick={() => void releerCandidato().then(alCerrar, () => undefined)}>
                  {t('comun.recargar')}
                </Button>
              ) : null}
            </AvisoDeConflicto>
          ) : null}
          <div className="border-t border-sg-border pt-3">
            <BotonesDeTransicion objeto="commitment_candidate" registro={candidato} proyecto={proyecto} />
          </div>
        </>
      ) : null}
    </Drawer>
  )
}
