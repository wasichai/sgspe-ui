import { Textarea } from '@wasichai/ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { Campo } from './Campo'

// el motivo de una edición de un objeto requiresReason (tercera pasada de UX, 2.2; DD-36): se valida antes de enviar, en su campo,
// y sin él el foco va ahí, en vez de mandar el cambio y esperar el REASON_REQUIRED del servidor. la pantalla lo dibuja con
// CampoDeMotivo y le pasa exigir a FormularioDeRegistro (antesDeEnviar). X-Change-Reason admite 500 caracteres (RQ-AUD-002)
export interface Motivo {
  id: string
  valor: string
  // el motivo recortado, o undefined si no hay
  recortado: string | undefined
  falta: boolean
  cambiar: (valor: string) => void
  limpiar: () => void
  // antes de enviar: con motivo, true; sin él, lo dice en su campo, lleva el foco ahí y devuelve false
  exigir: () => boolean
}

export function useMotivo(): Motivo {
  const id = useId()
  const [valor, setValor] = useState('')
  const [intentado, setIntentado] = useState(false)
  const recortado = valor.trim() || undefined
  return {
    id,
    valor,
    recortado,
    falta: intentado && !recortado,
    cambiar: setValor,
    limpiar: () => {
      setValor('')
      setIntentado(false)
    },
    exigir: () => {
      if (recortado) return true
      setIntentado(true)
      document.getElementById(id)?.focus()
      return false
    }
  }
}

export function CampoDeMotivo({ motivo, etiqueta, ayuda }: { motivo: Motivo; etiqueta: string; ayuda?: string }) {
  const { t } = useTranslation(NS)
  return (
    <Campo id={motivo.id} etiqueta={etiqueta} ayuda={ayuda} error={motivo.falta ? t('comun.motivoFalta') : undefined}>
      {(p) => <Textarea {...p} value={motivo.valor} maxLength={500} onChange={(e) => motivo.cambiar(e.target.value)} />}
    </Campo>
  )
}
