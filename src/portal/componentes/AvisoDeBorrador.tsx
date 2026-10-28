import { Alert, Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { fechaYHoraPe, NS } from '../i18n'

// el aviso de un borrador recuperado en un alta (tercera pasada de UX, 2.4): dice desde cuándo es lo que se recuperó y ofrece
// descartarlo, que deja el formulario vacío
export function AvisoDeBorrador({ guardado, alDescartar }: { guardado: string; alDescartar: () => void }) {
  const { t } = useTranslation(NS)
  const fecha = new Date(guardado)
  return (
    <Alert tone="notice">
      <span>{Number.isNaN(fecha.getTime()) ? t('comun.borrador.recuperadoSinFecha') : t('comun.borrador.recuperado', { cuando: fechaYHoraPe(fecha) })}</span>{' '}
      <Button variant="ghost" size="sm" onClick={alDescartar}>
        {t('comun.borrador.descartar')}
      </Button>
    </Alert>
  )
}
