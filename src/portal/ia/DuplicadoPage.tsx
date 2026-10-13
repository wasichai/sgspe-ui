import type { FieldMeta } from '@wasichai/core'
import { Alert, Button, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useAvailableTransitions } from '@wasichai/workflow'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { Campo } from '../componentes/Campo'
import { useMensajeDeError } from '../componentes/errores'
import { Consulta, NoEsDeSusProyectos } from '../componentes/Estados'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { texto, useDefinicion, useRegistro, type Registro } from '../datos/registros'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { NS } from '../i18n'
import { useAplicarTransicion } from '../transiciones/api'
import { useAceptarSugerencia } from './contrato'
import { MarcaDeIa } from './MarcaDeIa'
import { quedanMarcadores } from './marcadores'
import { cuerpoDeAceptacion, filaDe } from './sugerencias'
import { TextoDeIa } from './TextoDeIa'

// «Posible duplicado» (screens.md §13, AI-07; ai-architecture.md §4.2): los dos registros con los campos que quien mira lee, lado
// a lado. «Es duplicado» acepta la sugerencia: en una queja escribe duplicate_of y la rechaza con la respuesta, en una
// organización suma el nombre a alternative_names, en los demás solo registra la decisión. «No es duplicado» la rechaza. nunca se
// fusiona nada (RQ-AI-015)
export function DuplicadoPage() {
  const { projectId = '', suggestionId = '' } = useParams()
  const sugerencia = useRegistro('ai_suggestion', suggestionId)
  return (
    <Consulta consulta={sugerencia} noExiste={<NoEsDeSusProyectos />}>
      {(s) => <Comparacion sugerencia={s} proyecto={projectId} />}
    </Consulta>
  )
}

const comparables = (campos: readonly FieldMeta[]) => campos.filter((f) => f.visible !== false && f.type !== 'GEOMETRY' && f.type !== 'FILE')
const igual = (a: unknown, b: unknown) => a !== undefined && a !== null && a !== '' && JSON.stringify(a) === JSON.stringify(b)

function Valor({ campo, registro }: { campo: FieldMeta; registro: Registro | undefined }) {
  const valor = registro?.attributes[campo.name]
  if (valor === undefined || valor === null || valor === '') return <>—</>
  if (campo.type === 'RELATION' && campo.relationTarget) return <RegistroVinculado objeto={campo.relationTarget} id={String(valor)} />
  return <>{typeof valor === 'object' ? JSON.stringify(valor) : String(valor)}</>
}

function Comparacion({ sugerencia, proyecto }: { sugerencia: Registro; proyecto: string }) {
  const { t } = useTranslation(NS)
  const navegar = useNavigate()
  const mensaje = useMensajeDeError()
  const fila = filaDe(sugerencia)
  const objeto = texto(sugerencia, 'target_object')
  const este = useRegistro(objeto, texto(sugerencia, 'target_record_id') || undefined)
  const otro = useRegistro(objeto, fila?.fila === 'duplicado' ? fila.otro : undefined)
  const definicion = useDefinicion(objeto)
  const transiciones = useAvailableTransitions('ai_suggestion', sugerencia.id)
  const aceptar = useAceptarSugerencia()
  const rechazar = useAplicarTransicion('ai_suggestion')
  const [decision, setDecision] = useState<'es' | 'noEs' | null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const escribe = useEscribeEnProyecto(proyecto)
  const bandeja = `/projects/${encodeURIComponent(proyecto)}/ai-review`
  const volver = (
    <Link to={bandeja} className="text-sm text-sg-primary-text underline">
      {t('bandejaIa.duplicado.volver')}
    </Link>
  )
  if (!fila || fila.fila !== 'duplicado')
    return (
      <div className="space-y-3">
        <Alert tone="notice">{t('bandejaIa.duplicado.noEsDuplicado')}</Alert>
        {volver}
      </div>
    )
  const permitida = (nombre: string) => (transiciones.data ?? []).some((tr) => tr.name === nombre && tr.allowed)
  const esQueja = objeto === 'grievance'
  const faltaRespuesta = decision === 'es' && esQueja && !respuesta.trim()
  const enCurso = aceptar.isPending || rechazar.isPending
  const error = aceptar.error ?? rechazar.error
  const confirmar = () => {
    setIntentado(true)
    if (!decision || !motivo.trim() || faltaRespuesta || (esQueja && quedanMarcadores(respuesta))) return
    if (decision === 'es')
      aceptar.mutate(
        { sugerencia, atributos: cuerpoDeAceptacion({ fila: 'duplicado', otro: fila.otro, respuesta: esQueja ? respuesta : null }), motivo: motivo.trim() },
        { onSuccess: () => navegar(bandeja) }
      )
    else rechazar.mutate({ registro: sugerencia, transicion: 'reject', motivo: motivo.trim() }, { onSuccess: () => navegar(bandeja) })
  }
  const nota =
    decision === 'es'
      ? esQueja
        ? t('bandejaIa.duplicado.queja')
        : objeto === 'organization'
          ? t('bandejaIa.duplicado.organizacion')
          : t('bandejaIa.duplicado.soloDecision')
      : decision === 'noEs'
        ? t('bandejaIa.duplicado.noEsNota')
        : null
  return (
    <section aria-label={t('bandejaIa.duplicado.titulo')} className="space-y-4">
      {volver}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-sg-h1 font-semibold">{t('bandejaIa.duplicado.titulo')}</h1>
          <MarcaDeIa clase="sugerencia" />
        </div>
        <p className="text-sm text-sg-text-secondary">{t('bandejaIa.duplicado.ayuda')}</p>
      </header>
      {fila.razones.length > 0 ? (
        <div className="space-y-1 text-sm">
          <p className="text-sg-caption text-sg-text-muted">{t('bandejaIa.propuesta.razones')}</p>
          <ul className="ml-5 list-disc">
            {fila.razones.map((razon, i) => (
              <li key={i}>
                <TextoDeIa texto={razon} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
        <Table aria-label={t('bandejaIa.duplicado.titulo')}>
          <thead>
            <tr>
              <Th scope="col">{t('bandejaIa.duplicado.dato')}</Th>
              <Th scope="col">{t('bandejaIa.duplicado.este')}</Th>
              <Th scope="col">{t('bandejaIa.duplicado.otro')}</Th>
              <Th scope="col">
                <span className="sr-only">{t('bandejaIa.duplicado.coincide')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {comparables(definicion.data?.fields ?? []).map((campo) => {
              const coinciden = igual(este.data?.attributes[campo.name], otro.data?.attributes[campo.name])
              return (
                <tr key={campo.name}>
                  <Th scope="row">{campo.label}</Th>
                  <Td className="text-sm">
                    <Valor campo={campo} registro={este.data} />
                  </Td>
                  <Td className="text-sm">
                    <Valor campo={campo} registro={otro.data} />
                  </Td>
                  <Td className={coinciden ? 'text-sm font-medium text-sg-warning' : 'text-sm text-sg-text-muted'}>
                    {coinciden ? t('bandejaIa.duplicado.coincide') : t('bandejaIa.duplicado.difiere')}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </div>
      {sugerencia.state === 'proposed' && escribe ? (
        <div className="max-w-xl space-y-3">
          <fieldset className="space-y-1">
            <legend className="text-sg-body-sm font-medium">{t('bandejaIa.duplicado.decision')}</legend>
            {permitida('accept') ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="decision" checked={decision === 'es'} onChange={() => setDecision('es')} />
                {t('bandejaIa.duplicado.es')}
              </label>
            ) : null}
            {permitida('reject') ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="decision" checked={decision === 'noEs'} onChange={() => setDecision('noEs')} />
                {t('bandejaIa.duplicado.noEs')}
              </label>
            ) : null}
            {intentado && !decision ? <p className="text-sg-caption text-sg-danger">{t('bandejaIa.aceptacion.obligatorio')}</p> : null}
          </fieldset>
          {decision === 'es' && esQueja ? (
            <Campo
              etiqueta={t('bandejaIa.duplicado.respuesta')}
              error={
                intentado && faltaRespuesta
                  ? t('bandejaIa.aceptacion.obligatorio')
                  : intentado && quedanMarcadores(respuesta)
                    ? t('ia.marcadores.quedan')
                    : undefined
              }
            >
              {(p) => <Textarea {...p} value={respuesta} maxLength={4000} onChange={(e) => setRespuesta(e.target.value)} />}
            </Campo>
          ) : null}
          {nota ? <p className="rounded-sg-md border border-sg-border bg-sg-surface p-3 text-sm">{nota}</p> : null}
          <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && !motivo.trim() ? t('comun.motivoFalta') : undefined}>
            {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {error ? <Alert tone="danger">{mensaje(error, { STATE_MISMATCH: t('bandejaIa.aceptacion.errores.STATE_MISMATCH') })}</Alert> : null}
          <Button onClick={confirmar} disabled={enCurso} aria-busy={enCurso}>
            {enCurso ? t('bandejaIa.duplicado.confirmando') : t('bandejaIa.duplicado.confirmar')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
