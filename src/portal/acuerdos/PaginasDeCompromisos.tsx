import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { SelectorDePagina } from '../componentes/SelectorDeVista'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { LEE_ACUERDOS } from '../shell/leeAcuerdos'
import { ofrece } from '../shell/navTree'

// Compromisos y Acuerdos en el selector de páginas de su cabecera (DD-03, U-18): los acuerdos eran una segunda fila de pestañas
// bajo la de Project 360. no son una vista ?view= de la lista de compromisos (otro objeto, con sus columnas, su paginación y sus
// permisos): son otra página, con su ruta de siempre (/agreements y /projects/:projectId/agreements). cada una se ofrece con su
// permiso, como su pestaña y sus rutas; con una sola, no se dibuja
export function PaginasDeCompromisos({ actual }: { actual: 'commitments' | 'agreements' }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { scope } = useContextFilters()
  const base = scope.kind === 'project' ? `/projects/${encodeURIComponent(scope.projectId)}` : ''
  const paginas = [
    ...(can('commitment', 'READ') ? [{ id: 'commitments', etiqueta: t('contexto.pestanas.commitments'), a: `${base}/commitments` }] : []),
    ...(ofrece(LEE_ACUERDOS, can) ? [{ id: 'agreements', etiqueta: t('contexto.pestanas.agreements'), a: `${base}/agreements` }] : [])
  ]
  return <SelectorDePagina etiqueta={t('comun.selectorDePagina.etiqueta', { modulo: t('secciones.commitments') })} paginas={paginas} actual={actual} />
}
