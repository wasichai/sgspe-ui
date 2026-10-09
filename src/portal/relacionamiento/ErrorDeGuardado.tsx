import { Alert } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useMensajeDeError } from '../componentes/errores'
import { texto } from '../datos/registros'
import { NS } from '../i18n'
import { GuardadoParcial } from './guardarInteraccion'

// el error de guardar: si fue a mitad, lo ya creado queda y el aviso enlaza a la interacción para completarla
export function ErrorDeGuardado({ error, proyecto }: { error: unknown; proyecto: string }) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  if (error instanceof GuardadoParcial)
    return (
      <Alert tone="danger">
        <p>{t('relacionamiento.registro.parcial')}</p>
        <p>{mensaje(error.causa)}</p>
        <Link to={`/projects/${encodeURIComponent(proyecto)}/engagements/${encodeURIComponent(error.interaccion.id)}`} className="underline">
          {t('relacionamiento.registro.abrirCreada', { titulo: texto(error.interaccion, 'title') })}
        </Link>
      </Alert>
    )
  return <Alert tone="danger">{mensaje(error)}</Alert>
}
