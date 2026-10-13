import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Cargando, Restringido } from '../componentes/Estados'
import { texto, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useFuenteDeCandidato, useFuenteDeSugerencia, type Fuente } from './fuentes'
import { TextoDeIa } from './TextoDeIa'

// la cita de una propuesta (evidence_quote): restringida si el campo no se lee (security.md §7.9); «Fuente restringida» si
// quien mira no abre la fuente; si la abre, la cita re-identificada y el enlace a la fuente
export function CitaDeIa({ registro, fuente, etiqueta }: { registro: Registro; fuente: Fuente; etiqueta: string }) {
  const { t } = useTranslation(NS)
  if (!('evidence_quote' in registro.attributes))
    return (
      <p className="text-sg-caption">
        {etiqueta}: <Restringido />
      </p>
    )
  const cita = texto(registro, 'evidence_quote')
  if (!cita) return <p className="text-sg-caption">{etiqueta}: —</p>
  if (fuente.estado === 'cargando') return <Cargando compacto />
  if (fuente.estado === 'restringida')
    return (
      <p className="text-sg-caption">
        {etiqueta}: <span className="text-sg-text-muted">{t('ia.cita.fuenteRestringida')}</span>
      </p>
    )
  return (
    <figure className="space-y-1 text-sg-caption">
      <figcaption className="text-sg-text-muted">{etiqueta}</figcaption>
      <blockquote className="border-l-2 border-sg-ai-border pl-2">
        <TextoDeIa texto={cita} />
      </blockquote>
      {fuente.estado === 'abrible' ? (
        <Link to={fuente.enlace} className="text-sg-primary-text underline">
          {t('ia.cita.abrirFuente')}
        </Link>
      ) : null}
    </figure>
  )
}

export function CitaDelCandidato({ candidato, etiqueta }: { candidato: Registro; etiqueta: string }) {
  return <CitaDeIa registro={candidato} fuente={useFuenteDeCandidato(candidato)} etiqueta={etiqueta} />
}

export function CitaDeLaSugerencia({ sugerencia, etiqueta }: { sugerencia: Registro; etiqueta: string }) {
  return <CitaDeIa registro={sugerencia} fuente={useFuenteDeSugerencia(sugerencia)} etiqueta={etiqueta} />
}
