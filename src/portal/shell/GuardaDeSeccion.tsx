import { useAuth } from '@wasichai/core'
import { Alert } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EstadoSinAcceso } from '../componentes/EstadoSinAcceso'
import { NS } from '../i18n'
import { estadoDe, useOferta, type SeccionNav } from './navTree'

// la pantalla de una sección se guarda con lo mismo que el árbol (como GuardaDeHoja de caja-ui@a45b224): quien llega por la
// URL sin los permisos lee que su cuenta no puede abrirla, en lugar de una pantalla llena de 403: desde el rediseño de UX
// (hallazgo U-09) con EstadoSinAcceso, que dice a quién pedirlo y ofrece volver al inicio. fuera de un proyecto no se sabe
// quién lleva la jefatura, así que se pide a la administración de la organización
export function GuardaDeSeccion({ seccion, children }: { seccion: SeccionNav; children: ReactNode }) {
  const { t } = useTranslation(NS)
  const { permissions, permissionsError } = useAuth()
  const oferta = useOferta()
  // permisos que no se pudieron leer no son permisos que faltan: no se afirma que la cuenta no pueda abrirla
  if (!permissions && permissionsError) return <Alert tone="warning">{t('shell.sinPermisos')}</Alert>
  if (!permissions) return <p className="text-sm text-sg-text-muted">{t('shell.leyendoPermisos')}</p>
  if (estadoDe(seccion, oferta) === 'disponible') return children
  return <EstadoSinAcceso que={t(`secciones.${seccion.clave}`)} aQuien={null} volver={{ etiqueta: t('comun.sinAcceso.volverAlInicio'), a: '/' }} />
}
