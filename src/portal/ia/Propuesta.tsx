import { EnlaceConRastro } from '../contexto/Rastro'
import { Button, cn } from '@wasichai/ui'
import { useAvailableTransitions } from '../datos/flujos'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { atributo, campoDe, texto, useDefinicion, useRegistro, type Registro } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { CitaDelCandidato, CitaDeLaSugerencia } from './Cita'
import { MarcaDeIa } from './MarcaDeIa'
import { confianzaDe, filaDe, valorLegible, type Fila } from './sugerencias'
import { TextoDeIa } from './TextoDeIa'

// las tarjetas de S52 (AiSuggestionCard y CandidateCard de screens.md §13): tipo, confianza, modelo y versión de la instrucción
// (RQ-AI-004), el registro al que se refiere, lo propuesto con sus marcadores resueltos y la cita con su fuente (Tarea 3)
const porcentaje = (confianza: number) => Math.round(confianza * 100)

export function LoPropuesto({ fila, destino }: { fila: Fila; destino: string }) {
  const { t } = useTranslation(NS)
  const definicion = useDefinicion(fila.fila === 'clasificacion' ? destino : undefined)
  switch (fila.fila) {
    case 'clasificacion': {
      const campo = campoDe(definicion.data, fila.campo)?.label ?? t(`bandejaIa.campos.${fila.campo}`, { defaultValue: fila.campo })
      return fila.campo === 'topic' ? (
        <p>
          {campo}: <RegistroVinculado objeto="topic" id={fila.valor} />
        </p>
      ) : (
        <p>{t('bandejaIa.propuesta.clasificacion', { campo, valor: fila.valor })}</p>
      )
    }
    case 'lugar':
      return (
        <p>
          {t('bandejaIa.propuesta.lugar')}: <RegistroVinculado objeto={fila.campo} id={fila.valor} />
        </p>
      )
    case 'tema':
      return (
        <p>
          {t('bandejaIa.propuesta.tema')}: <RegistroVinculado objeto="topic" id={fila.valor} />
        </p>
      )
    case 'fecha':
      return <p>{t('bandejaIa.propuesta.fecha', { campo: t(`bandejaIa.campos.${fila.campo}`), valor: diaPe(fila.valor) })}</p>
    case 'clausula':
      return (
        <div>
          <p className="font-medium">{t('bandejaIa.propuesta.clausula', { numero: fila.numero || '—' })}</p>
          <TextoDeIa texto={fila.texto} />
        </div>
      )
    case 'organizacion':
      return (
        <p>
          {t('bandejaIa.propuesta.organizacion')}: <TextoDeIa texto={fila.nombre} />
        </p>
      )
    case 'persona':
      return (
        <p>
          {t('bandejaIa.propuesta.persona')}: <TextoDeIa texto={fila.nombre} />
        </p>
      )
    case 'borrador':
    case 'resumen':
      return (
        <div className="max-h-48 overflow-y-auto rounded-sg-md border border-sg-border p-2">
          <TextoDeIa texto={fila.texto} markdown />
        </div>
      )
    case 'duplicado':
      return (
        <div className="space-y-1">
          <p>
            {t('bandejaIa.propuesta.duplicadoDe')}: <RegistroVinculado objeto={destino} id={fila.otro} />
          </p>
          {fila.razones.length > 0 ? (
            <>
              <p className="text-sg-caption text-sg-text-muted">{t('bandejaIa.propuesta.razones')}</p>
              <ul className="ml-5 list-disc">
                {fila.razones.map((razon, i) => (
                  <li key={i}>
                    <TextoDeIa texto={razon} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      )
  }
}

export function TarjetaDeSugerencia({ sugerencia, proyecto, alAceptar }: { sugerencia: Registro; proyecto: string; alAceptar?: () => void }) {
  const { t } = useTranslation(NS)
  const fila = filaDe(sugerencia)
  const tipo = texto(sugerencia, 'suggestion_kind')
  const confianza = confianzaDe(sugerencia)
  const interaccion = useRegistro('ai_interaction', atributo<string>(sugerencia, 'ai_interaction'))
  const transiciones = useAvailableTransitions('ai_suggestion', sugerencia.id)
  const escribe = useEscribeEnProyecto(proyecto)
  // aceptar: el rol de WF-K (accept permitida) y una fila de la lista cerrada (decisión 13 del plan)
  const acepta = escribe && fila !== null && (transiciones.data ?? []).some((tr) => tr.name === 'accept' && tr.allowed)
  const destino = texto(sugerencia, 'target_object')
  const destinoId = texto(sugerencia, 'target_record_id')
  const version = texto(interaccion.data, 'prompt_version')
  const base = `/projects/${encodeURIComponent(proyecto)}`
  return (
    <li className="space-y-2 rounded-sg-lg border border-dashed border-sg-ai-border bg-sg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <MarcaDeIa clase="sugerencia" />
        <span className="font-medium">{t(`bandejaIa.tipos.${tipo}`, { defaultValue: tipo })}</span>
        {confianza !== null ? <span className="text-sg-caption text-sg-text-muted">{t('ia.confianza', { n: porcentaje(confianza) })}</span> : null}
        <span className="text-sg-caption text-sg-text-muted">{t('ia.modelo', { modelo: texto(sugerencia, 'model') || '—' })}</span>
        {version ? <span className="text-sg-caption text-sg-text-muted">{t('ia.instruccion', { version })}</span> : null}
      </div>
      <p className="text-sg-caption">
        {t('bandejaIa.sobre')}: {destinoId ? <RegistroVinculado objeto={destino} id={destinoId} /> : t('bandejaIa.registroNuevo')}
      </p>
      {fila ? (
        <LoPropuesto fila={fila} destino={destino} />
      ) : (
        <p className="text-sg-caption text-sg-warning">{valorLegible(sugerencia) ? t('bandejaIa.fueraDeLista') : t('bandejaIa.ilegible')}</p>
      )}
      <CitaDeLaSugerencia sugerencia={sugerencia} etiqueta={t('bandejaIa.cita')} />
      <div className="flex flex-wrap items-center gap-2">
        {acepta && alAceptar && fila && fila.fila !== 'duplicado' && fila.fila !== 'borrador' && fila.fila !== 'resumen' ? (
          <Button size="sm" onClick={alAceptar}>
            {t('bandejaIa.aceptar')}
          </Button>
        ) : null}
        {fila?.fila === 'duplicado' ? (
          <Button asChild size="sm" variant="secondary">
            <Link to={`${base}/ai-review/${encodeURIComponent(sugerencia.id)}`}>{t('bandejaIa.comparar')}</Link>
          </Button>
        ) : null}
        {fila?.fila === 'borrador' && destinoId ? (
          <Button asChild size="sm" variant="secondary">
            <EnlaceConRastro to={`${base}/engagements/${encodeURIComponent(destinoId)}/minutes`}>{t('bandejaIa.abrirEditor')}</EnlaceConRastro>
          </Button>
        ) : null}
        <BotonesDeTransicion objeto="ai_suggestion" registro={sugerencia} solo={fila ? ['reject', 'mark_duplicate'] : ['reject']} proyecto={proyecto} />
      </div>
    </li>
  )
}

export function TarjetaDeCandidatoEnBandeja({ candidato, alRevisar }: { candidato: Registro; alRevisar?: () => void }) {
  const { t } = useTranslation(NS)
  const ia = atributo(candidato, 'ai_generated') === true
  const confianza = confianzaDe(candidato)
  return (
    <li className={cn('space-y-2 rounded-sg-lg border bg-sg-surface p-3 text-sm', ia ? 'border-dashed border-sg-ai-border' : 'border-sg-border')}>
      <div className="flex flex-wrap items-center gap-2">
        {ia ? <MarcaDeIa clase="sugerencia" /> : null}
        <span className="font-medium">{t('bandejaIa.tipos.candidato')}</span>
        <span className="text-sg-caption text-sg-text-muted">{ia ? t('bandejaIa.origenIa') : t('bandejaIa.origenPersona')}</span>
        {confianza !== null ? <span className="text-sg-caption text-sg-text-muted">{t('ia.confianza', { n: porcentaje(confianza) })}</span> : null}
      </div>
      <p>
        <TextoDeIa texto={texto(candidato, 'proposed_text')} />
      </p>
      <CitaDelCandidato candidato={candidato} etiqueta={t('bandejaIa.cita')} />
      {alRevisar ? (
        <Button size="sm" variant="secondary" onClick={alRevisar}>
          {t('bandejaIa.revisar')}
        </Button>
      ) : null}
    </li>
  )
}
