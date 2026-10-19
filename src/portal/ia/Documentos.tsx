import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Campo, SelectNativo } from '../componentes/Campo'
import { Cargando } from '../componentes/Estados'
import { nombreDeProyecto, useProyectos } from '../contexto/proyectos'
import { rutaParaAbrir } from '../datos/fichas'
import { useRegistro } from '../datos/registros'
import { useNombreDeEvidencia, usePuedeDescargar } from '../documentos/api'
import { NS } from '../i18n'
import type { Cita, RespuestaConCitas } from './contrato'
import { MarcaDeIa } from './MarcaDeIa'
import { TextoDeIa } from './TextoDeIa'
import { opcion } from '../datos/opciones'

// S05 «Respuesta con citas» (AI-06): la pregunta va sobre los documentos de un proyecto; la respuesta lleva sus fuentes, y
// cada cita solo para quien descarga la evidencia (RF-DOC-003; el servidor ya filtra, el portal no confía solo en eso)
export function ProyectoDeLaPregunta({ valor, alCambiar }: { valor: string; alCambiar: (proyecto: string) => void }) {
  const { t } = useTranslation(NS)
  const proyectos = useProyectos()
  return (
    <Campo etiqueta={t('asistente.proyecto')} ayuda={valor ? undefined : t('asistente.eligeProyecto')}>
      {(p) => (
        <SelectNativo
          {...p}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          opciones={(proyectos.data ?? []).map((r) => ({ valor: r.id, etiqueta: nombreDeProyecto(r) }))}
        />
      )}
    </Campo>
  )
}

export function RespuestaConFuentes({ respuesta }: { respuesta: RespuestaConCitas }) {
  const { t } = useTranslation(NS)
  // nunca responde sin fuente (decisión 7 del plan)
  if (respuesta.citations.length === 0) return <p className="rounded-sg-md border border-sg-border bg-sg-surface p-3 text-sm">{t('asistente.sinEvidencia')}</p>
  return (
    <article className="space-y-2 rounded-sg-md border border-dashed border-sg-ai-border bg-sg-ai-soft p-3 text-sm">
      <MarcaDeIa clase="resumen" />
      <TextoDeIa texto={respuesta.answer} markdown />
      <h3 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('asistente.fuentes')}</h3>
      <ol className="space-y-2">
        {respuesta.citations.map((cita, i) => (
          <FuenteCitada key={`${cita.evidenceId}-${cita.chunkIndex}`} cita={cita} n={i + 1} />
        ))}
      </ol>
    </article>
  )
}

function FuenteCitada({ cita, n }: { cita: Cita; n: number }) {
  const { t } = useTranslation(NS)
  const evidencia = useRegistro('evidence', cita.evidenceId)
  const puedeDescargar = usePuedeDescargar()
  const nombre = useNombreDeEvidencia()
  if (evidencia.isPending)
    return (
      <li>
        <Cargando compacto />
      </li>
    )
  const leida = evidencia.data
  const abrible = leida !== undefined && puedeDescargar(leida)
  return (
    <li className="space-y-1 rounded-sg-md border border-sg-border bg-sg-surface p-2">
      <p className="font-medium">
        {t('asistente.fuente', { n })}
        {leida ? ` · ${nombre(leida)}` : ''}
      </p>
      {leida ? (
        <p className="text-sg-caption text-sg-text-muted">
          {t('asistente.tipo', { valor: opcion(leida, 'evidence_type') || '—' })} ·{' '}
          {t('asistente.clasificacion', { valor: opcion(leida, 'classification') || '—' })}
        </p>
      ) : null}
      {abrible ? (
        <>
          <blockquote className="border-l-2 border-sg-ai-border pl-2 text-sg-caption">
            <TextoDeIa texto={cita.quote} />
          </blockquote>
          <Link to={rutaParaAbrir('evidence', cita.evidenceId)} className="text-sg-primary-text underline">
            {t('asistente.abrirDocumento')}
          </Link>
        </>
      ) : (
        <p className="text-sg-caption text-sg-text-muted">{t('ia.cita.fuenteRestringida')}</p>
      )}
    </li>
  )
}
