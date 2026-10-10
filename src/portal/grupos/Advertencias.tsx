import { Alert } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { tieneCodigos } from '../componentes/codigosVisibles'
import { NS } from '../i18n'
import type { Advertencia } from './api'

// las advertencias de la vista previa y del alta con su texto (api.md §4.3); una que el portal no conoce, con su mensaje, y
// sin mensaje no se dice: nunca el código, ni un mensaje que lo delate (humo F4, D3)
const ADVERTENCIAS: Record<string, string> = {
  STANCE_DIVERGENCE: 'grupos.ficha.divergencia',
  BACKDATED_ASSESSMENT: 'grupos.evaluacion.atrasada',
  NO_PRIORITY_RULE: 'grupos.evaluacion.sinRegla'
}

export function Advertencias({ advertencias }: { advertencias: Advertencia[] }) {
  const { t } = useTranslation(NS)
  return (
    <>
      {advertencias.map((w, i) =>
        ADVERTENCIAS[w.code] || w.message ? (
          <Alert key={`${w.code}-${i}`} tone="warning">
            {ADVERTENCIAS[w.code] ? t(ADVERTENCIAS[w.code]) : tieneCodigos(w.message ?? '') ? t('grupos.advertenciaSinTexto') : w.message}
          </Alert>
        ) : null
      )}
    </>
  )
}
