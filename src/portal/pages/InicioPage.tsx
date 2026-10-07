import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el Dashboard de F1: el contenido llega en la Tarea 18
export function InicioPage() {
  const { t } = useTranslation(NS)
  return <h1 className="text-xl font-semibold text-ink">{t('inicio.titulo')}</h1>
}
