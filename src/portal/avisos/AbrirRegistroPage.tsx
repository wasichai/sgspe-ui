import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { rutaDeFicha } from '../datos/fichas'
import { useRegistro } from '../datos/registros'
import { NS } from '../i18n'

// /r/:object/:recordId: el destino de un aviso o de una tarea que solo trae el objeto y el id. lee el registro como quien
// mira (un 403 es «no disponible», un 404 dice que no existe) y salta a su ficha bajo su proyecto (ux-architecture.md §6.3),
// reemplazando esta entrada del historial: volver atrás no rebota aquí. un objeto sin ficha en el portal (o un registro de
// proyecto sin proyecto) da null en rutaDeFicha: es «No disponible» y no salta a ninguna parte
export function AbrirRegistroPage() {
  const { t } = useTranslation(NS)
  const { object = '', recordId = '' } = useParams()
  const registro = useRegistro(object, recordId)
  if (registro.isPending) return <Cargando etiqueta={t('avisos.abrirRegistro.abriendo')} />
  if (registro.isError && !registro.data) return <FalloDeLectura error={registro.error} alReintentar={() => void registro.refetch()} />
  const ruta = rutaDeFicha(object, registro.data)
  return ruta ? <Navigate to={ruta} replace /> : <Vacio titulo={t('comun.noDisponible')}>{t('avisos.abrirRegistro.sinFicha')}</Vacio>
}
