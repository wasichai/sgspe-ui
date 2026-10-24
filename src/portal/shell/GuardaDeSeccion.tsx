import { useAuth } from '@wasichai/core'
import { Alert } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { EstadoSinAcceso } from '../componentes/EstadoSinAcceso'
import { ROL_DE_JEFATURA } from '../config'
import { useNombreDePersona } from '../datos/personas'
import { texto, useTodos } from '../datos/registros'
import { NS } from '../i18n'
import { estadoDe, useOferta, type SeccionNav } from './navTree'

// la pantalla de una sección se guarda con lo mismo que el árbol (como GuardaDeHoja de caja-ui@a45b224): quien llega por la
// URL sin los permisos lee que su cuenta no puede abrirla, en lugar de una pantalla llena de 403: desde el rediseño de UX
// (hallazgo U-09) con EstadoSinAcceso, que dice a quién pedirlo y ofrece volver al inicio. fuera de un proyecto no se sabe
// quién lleva la jefatura, así que se pide a la administración de la organización. dentro de un proyecto (enProyecto, la
// pestaña de ProyectosRutas; DD-12, 05 §1.8) se nombra a la jefatura del proyecto si la cuenta la lee, y se vuelve a su resumen
export function GuardaDeSeccion({ seccion, enProyecto = false, children }: { seccion: SeccionNav; enProyecto?: boolean; children: ReactNode }) {
  const { t } = useTranslation(NS)
  const { permissions, permissionsError } = useAuth()
  const oferta = useOferta()
  // permisos que no se pudieron leer no son permisos que faltan: no se afirma que la cuenta no pueda abrirla
  if (!permissions && permissionsError) return <Alert tone="warning">{t('shell.sinPermisos')}</Alert>
  if (!permissions) return <p className="text-sm text-sg-text-muted">{t('shell.leyendoPermisos')}</p>
  if (estadoDe(seccion, oferta) === 'disponible') return children
  if (enProyecto) return <SinAccesoEnProyecto que={t(`secciones.${seccion.clave}`)} />
  return <EstadoSinAcceso que={t(`secciones.${seccion.clave}`)} aQuien={null} volver={{ etiqueta: t('comun.sinAcceso.volverAlInicio'), a: '/' }} />
}

// la jefatura es la asignación vigente con ROL_DE_JEFATURA (ASM-080, como «Mis proyectos»), dicha con el nombre de la persona
// (o su correo, si el nombre no se lee); sin leer las asignaciones, o sin jefatura, se pide a la administración, como fuera
function SinAccesoEnProyecto({ que }: { que: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = useParams().projectId ?? ''
  const jefaturas = useTodos(
    'project_assignment',
    { project: proyecto, role_name: ROL_DE_JEFATURA, active: true },
    Boolean(proyecto) && can('project_assignment', 'READ')
  )
  const correo =
    (jefaturas.data ?? [])
      .map((j) => texto(j, 'member_user_email'))
      .filter(Boolean)
      .sort()[0] ?? null
  const nombre = useNombreDePersona(correo)
  const aQuien = correo ? t('comun.sinAcceso.jefatura', { nombre: nombre ?? correo }) : null
  return (
    <EstadoSinAcceso
      que={que}
      aQuien={aQuien}
      volver={{ etiqueta: t('comun.sinAcceso.volverAlProyecto'), a: `/projects/${encodeURIComponent(proyecto)}/overview` }}
    />
  )
}
