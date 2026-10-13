import { ApiError } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { correlacionDe, useMensajeDeError } from '../componentes/errores'
import { campoDelError, codigoDelError } from '../datos/http'
import { NS } from '../i18n'

// se reintenta lo que puede cambiar: el proveedor caído, una corrida sin margen, otra falla del servidor o de la red
export function esRepetible(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true
  if (codigoDelError(error) === 'AI_RUN_TRUNCATED') return true
  if (codigoDelError(error) === 'AI_UNAVAILABLE') return campoDelError(error) === 'provider'
  return error.status >= 500
}

// el fallo de una corrida de IA: su mensaje, la correlación para soporte y, si repetir puede cambiar algo, «Reintentar»
export function FalloDeCorrida({ error, alReintentar }: { error: unknown; alReintentar: (() => void) | null }) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  const correlacion = correlacionDe(error)
  return (
    <Alert tone="danger">
      <p>{mensaje(error)}</p>
      {correlacion ? <p className="font-sg-mono text-sg-caption">{t('comun.correlacion', { id: correlacion })}</p> : null}
      {esRepetible(error) && alReintentar ? (
        <Button size="sm" variant="secondary" className="mt-2" onClick={alReintentar}>
          {t('accionesIa.reintentar')}
        </Button>
      ) : null}
    </Alert>
  )
}
