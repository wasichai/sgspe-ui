import { cn } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { CLASE_DE_TONO } from '../componentes/apariencias'
import { NS } from '../i18n'
import { esNivel, TONO_DE_NIVEL } from './niveles'

// el nivel de un riesgo (risk_level o residual_level) con su tono y su texto, nunca solo color (design-system.md §4.1); sin nivel,
// «sin evaluar»
export function NivelDeRiesgo({ valor, residual = false }: { valor: unknown; residual?: boolean }) {
  const { t } = useTranslation(NS)
  const nombre = t(residual ? 'riesgos.nivelResidual' : 'riesgos.nivel')
  if (!esNivel(valor)) return <span className="text-sg-caption text-sg-text-muted">{t('riesgos.sinEvaluar')}</span>
  return (
    <span
      data-nivel={valor}
      aria-label={`${nombre}: ${t(`tableroRiesgos.niveles.${valor}`)}`}
      className={cn('inline-flex items-center rounded-sg-sm px-2 py-0.5 text-sg-caption font-medium', CLASE_DE_TONO[TONO_DE_NIVEL[valor]])}
    >
      {t(`tableroRiesgos.niveles.${valor}`)}
    </span>
  )
}
