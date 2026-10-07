import { useAuth } from '@wasichai/core'
import { Alert } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { estadoDe, useOferta, type SeccionNav } from './navTree'

// la pantalla de una sección se guarda con lo mismo que el árbol (como GuardaDeHoja de caja-ui@a45b224): quien llega por la
// URL sin los permisos lee que su cuenta no puede abrirla, en lugar de una pantalla llena de 403
export function GuardaDeSeccion({ seccion, children }: { seccion: SeccionNav; children: ReactNode }) {
  const { t } = useTranslation(NS)
  const { permissions, permissionsError } = useAuth()
  const oferta = useOferta()
  if (!permissions && !permissionsError) return <p className="text-sm text-sg-text-muted">{t('shell.leyendoPermisos')}</p>
  if (estadoDe(seccion, oferta) === 'disponible') return children
  return <Alert tone="warning">{t('shell.sinAcceso', { seccion: t(`secciones.${seccion.clave}`) })}</Alert>
}
