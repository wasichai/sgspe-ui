import { Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// una huella SHA-256 (64 caracteres) no se lee de corrido ni cabe en una columna: se ven sus primeros 12 con la completa en el
// title y para el lector de pantalla, y se copia entera para compararla con la del archivo
export function Huella({ valor, etiqueta }: { valor: string; etiqueta?: string }) {
  const { t } = useTranslation(NS)
  const [copiada, setCopiada] = useState(false)
  const copiar = () => {
    void navigator.clipboard?.writeText(valor).then(
      () => setCopiada(true),
      () => undefined
    )
  }
  return (
    <span role={etiqueta ? 'group' : undefined} aria-label={etiqueta} className="inline-flex flex-wrap items-center gap-x-2 text-sg-caption">
      {etiqueta ? <span className="text-sg-text-secondary">{etiqueta}:</span> : null}
      <code title={valor} aria-hidden className="font-sg-mono">
        {`${valor.slice(0, 12)}…`}
      </code>
      <span className="sr-only">{valor}</span>
      <button type="button" onClick={copiar} aria-label={t('comun.copiarHuella')} className="inline-flex items-center gap-1 text-sg-primary-text">
        <Copy aria-hidden className="size-3.5" />
        {copiada ? <span aria-live="polite">{t('comun.huellaCopiada')}</span> : null}
      </button>
    </span>
  )
}
