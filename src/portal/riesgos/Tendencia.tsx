import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// la tendencia de un riesgo frente a su revisión anterior (trend: AUMENTA, SE MANTIENE, DISMINUYE; S10): la flecha y la palabra en
// versalitas de 800, debajo de su nivel. la flecha es decorativa: la palabra lo dice. vacía en la primera revisión: no se dibuja
const FLECHAS = { AUMENTA: TrendingUp, 'SE MANTIENE': ArrowRight, DISMINUYE: TrendingDown } as const

export function Tendencia({ valor }: { valor: unknown }) {
  const { t } = useTranslation(NS)
  if (typeof valor !== 'string' || !Object.hasOwn(FLECHAS, valor)) return null
  const Flecha = FLECHAS[valor as keyof typeof FLECHAS]
  return (
    <span
      data-tendencia={valor}
      className="inline-flex items-center gap-1 text-sg-caption font-extrabold tracking-wide whitespace-nowrap text-sg-text uppercase"
    >
      <Flecha aria-hidden className="size-3.5" />
      <span className="sr-only">{t('riesgos.tendencia')}: </span>
      {t(`tableroRiesgos.tendencias.${valor}`)}
    </span>
  )
}
