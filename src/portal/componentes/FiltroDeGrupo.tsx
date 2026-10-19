import { useTranslation } from 'react-i18next'
import { useRegistro } from '../datos/registros'
import { NS } from '../i18n'
import { useNombreDelGrupo } from './NombreDeActor'

// el chip del filtro ?stakeholder=<id> de una lista (revisión de UX, etapa 6): las cifras de la ficha del grupo de interés llevan a
// la lista con él puesto. el nombre se lee como quien mira; mientras llega, «…»
export function useChipDeGrupo(id: string): string {
  const { t } = useTranslation(NS)
  const grupo = useRegistro('stakeholder', id || undefined)
  const nombre = useNombreDelGrupo(grupo.data)
  return t('paginas.filtroDeGrupo', { nombre: nombre || '…' })
}
