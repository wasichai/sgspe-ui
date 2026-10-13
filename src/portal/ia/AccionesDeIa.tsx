import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { descriptorDe } from '../datos/archivos'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useAsistente } from './Asistente'
import { useCorrida, useEstadoDeIa, type CasoDeIa } from './contrato'
import { FalloDeCorrida } from './FalloDeCorrida'
import { MarcaDeIa } from './MarcaDeIa'

// las acciones de IA de una ficha (screens.md §13, decisiones 19 y 20 del plan): la IA lee como la persona y deja sugerencias o
// candidatos en la bandeja del proyecto; nada cambia hasta que una persona decide. sin IA en la organización el bloque no aparece

// lo que la IA puede leer de una evidencia: PDF con texto y DOCX (ASM-132); lo demás responde 422 AI_NO_TEXT
const LEGIBLES_POR_LA_IA: readonly string[] = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

export function casosDeEvidencia(evidencia: Registro, descarga: boolean): CasoDeIa[] {
  const tipo = descriptorDe(atributo(evidencia, 'file'))?.contentType ?? ''
  if (!descarga || !LEGIBLES_POR_LA_IA.includes(tipo)) return []
  return texto(evidencia, 'evidence_type') === 'ACTA' ? ['AI-01', 'AI-03'] : ['AI-01']
}

export function casosDeInteraccion(interaccion: Registro): CasoDeIa[] {
  return texto(interaccion, 'minutes').trim() ? ['AI-02', 'AI-03'] : ['AI-02']
}

// el texto de cada caso según el objeto de la ficha
const ETIQUETAS: Readonly<Record<string, Partial<Record<CasoDeIa, string>>>> = {
  evidence: { 'AI-01': 'extraer', 'AI-03': 'compromisosDelDocumento' },
  engagement: { 'AI-02': 'borrador', 'AI-03': 'compromisosDelActa' },
  grievance: { 'AI-08': 'clasificarQcs' },
  inquiry: { 'AI-08': 'clasificarQcs' },
  stakeholder_request: { 'AI-08': 'clasificarQcs' },
  engagement_question: { 'AI-08': 'temaDePregunta' },
  media_mention: { 'AI-08': 'tonoDeMencion' },
  project: { 'AI-07': 'duplicados' }
}

export function AccionesDeIa({
  objeto,
  registro,
  proyecto,
  rotulo,
  casos,
  compacta = false,
  contextual = true
}: {
  objeto: string
  registro: Registro
  proyecto: string
  // cómo se nombra el registro en el chip del asistente; nunca va en la pregunta (decisión 6)
  rotulo: string
  casos: readonly CasoDeIa[]
  // una fila dentro de una lista (las preguntas de una interacción): solo los botones y su resultado
  compacta?: boolean
  // false dentro de un drawer: el asistente es otro drawer y los drawers no se apilan
  contextual?: boolean
}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const estado = useEstadoDeIa()
  const escribe = useEscribeEnProyecto(proyecto)
  const asistente = useAsistente()
  const corrida = useCorrida()
  const ultimo = useRef<CasoDeIa | null>(null)
  const pendientes = useTodos('ai_suggestion', { target_record_id: registro.id }, !compacta && can('ai_suggestion', 'READ'))
  // sin servidor con F7 o sin IA en la organización: el bloque no aparece (screens.md «Resumen ejecutivo»: «sin IA, la tarjeta no
  // aparece»); lo ya propuesto se sigue decidiendo en la bandeja
  if (!estado.data?.enabled) return null
  const { useCases, providerAvailable } = estado.data
  const ofrecidos = escribe ? casos.filter((c) => useCases.includes(c) && ETIQUETAS[objeto]?.[c]) : []
  const pregunta = contextual && !compacta && asistente !== null && useCases.includes('AI-05')
  const nPendientes = (pendientes.data ?? []).filter((s) => s.state === 'proposed' && texto(s, 'target_object') === objeto).length
  if (ofrecidos.length === 0 && !pregunta && nPendientes === 0) return null
  const correr = (caso: CasoDeIa) => {
    // la ruta es la misma para todos los casos: otro caso es otra acción, con otra clave (decisión 20)
    if (ultimo.current !== caso) corrida.nuevaAccion()
    ultimo.current = caso
    corrida.mutate({ caso, objetivo: { object: objeto, recordId: registro.id } })
  }
  const resultado = corrida.data
  const borrador = resultado?.suggestions.some((s) => texto(s, 'suggestion_kind') === 'BORRADOR DE ACTA') ?? false
  const base = `/projects/${encodeURIComponent(proyecto)}`
  return (
    <section
      aria-label={t('accionesIa.titulo')}
      className={compacta ? 'space-y-1' : 'space-y-2 rounded-sg-lg border border-dashed border-sg-ai-border bg-sg-ai-soft p-3 text-sm'}
    >
      {compacta ? null : (
        <>
          <div className="flex items-center gap-2">
            <MarcaDeIa clase="sugerencia" />
            <h2 className="font-semibold">{t('accionesIa.titulo')}</h2>
          </div>
          {ofrecidos.length > 0 ? <p className="text-sg-caption text-sg-text-secondary">{t('accionesIa.ayuda')}</p> : null}
        </>
      )}
      {!providerAvailable && ofrecidos.length > 0 ? <p className="text-sg-caption text-sg-warning">{t('accionesIa.proveedorCaido')}</p> : null}
      <div className="flex flex-wrap gap-2">
        {ofrecidos.map((caso) => {
          const enCurso = corrida.isPending && ultimo.current === caso
          return (
            <Button
              key={caso}
              size="sm"
              variant="secondary"
              disabled={!providerAvailable || corrida.isPending}
              aria-busy={enCurso}
              onClick={() => correr(caso)}
            >
              {enCurso ? t('accionesIa.analizando') : t(`accionesIa.casos.${ETIQUETAS[objeto]![caso]!}`)}
            </Button>
          )
        })}
        {pregunta ? (
          <Button size="sm" variant="ghost" onClick={() => asistente!.abrir({ proyecto, registro: { objeto, id: registro.id, rotulo } })}>
            {t('accionesIa.preguntarSobre')}
          </Button>
        ) : null}
      </div>
      {resultado ? (
        <p role="status" className="text-sg-caption">
          {borrador ? (
            <>
              {t('accionesIa.borradorListo')}{' '}
              <Link to={`${base}/engagements/${encodeURIComponent(registro.id)}/minutes`} className="text-sg-primary-text underline">
                {t('accionesIa.abrirEditor')}
              </Link>
            </>
          ) : resultado.suggestions.length + resultado.candidates.length === 0 ? (
            t('accionesIa.sinResultado')
          ) : (
            <>
              {t('accionesIa.resultado', { sugerencias: resultado.suggestions.length, candidatos: resultado.candidates.length })}{' '}
              <Link to={`${base}/ai-review`} className="text-sg-primary-text underline">
                {t('accionesIa.irALaBandeja')}
              </Link>
            </>
          )}
        </p>
      ) : null}
      {corrida.isError ? (
        <FalloDeCorrida
          error={corrida.error}
          alReintentar={ultimo.current ? () => corrida.mutate({ caso: ultimo.current!, objetivo: { object: objeto, recordId: registro.id } }) : null}
        />
      ) : null}
      {nPendientes > 0 ? (
        <p className="text-sg-caption">
          <Link to={`${base}/ai-review`} className="text-sg-primary-text underline">
            {t('accionesIa.pendientes', { n: nPendientes })}
          </Link>
        </p>
      ) : null}
    </section>
  )
}
