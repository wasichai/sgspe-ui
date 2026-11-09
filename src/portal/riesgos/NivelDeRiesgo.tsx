import { useTranslation } from 'react-i18next'
import { Nivel } from '../componentes/Nivel'
import { NS } from '../i18n'
import { esNivel } from './niveles'

// el nivel de un riesgo (risk_level o residual_level): la insignia de barras de componentes/Nivel.tsx con el rótulo del tablero de
// riesgos, nunca solo color (design-system.md §4.3); sin nivel, «sin evaluar»
export function NivelDeRiesgo({ valor, residual = false }: { valor: unknown; residual?: boolean }) {
  const { t } = useTranslation(NS)
  if (!esNivel(valor)) return <span className="text-sg-caption text-sg-text-muted">{t('riesgos.sinEvaluar')}</span>
  return <Nivel valor={valor} nombre={t(residual ? 'riesgos.nivelResidual' : 'riesgos.nivel')} rotulo={t(`tableroRiesgos.niveles.${valor}`)} />
}
