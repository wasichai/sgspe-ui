import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router'
import { Cargando, esIlegible, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { rutaDeFicha } from '../datos/fichas'
import { useRegistro } from '../datos/registros'
import { NS } from '../i18n'

// /r/:object/:recordId: el destino de un aviso o de una tarea que solo trae el objeto y el id. lee el registro como quien
// mira y salta a su ficha bajo su proyecto (ux-architecture.md §6.3), reemplazando esta entrada del historial: volver atrás no
// rebota aquí. un 404 es «Registro reservado», sin datos ni «Reintentar»: la bandeja no se filtra por proyecto (spec 4.4 §3.8),
// así que un aviso viejo puede llevar a un registro de un proyecto que la cuenta ya no lee, a una QCS confidencial o a uno
// borrado, y el portal no los distingue. un 403 es «no disponible». un objeto sin ficha en el portal (o un registro de proyecto
// sin proyecto) da null en rutaDeFicha: es «No disponible» y no salta a ninguna parte
export function AbrirRegistroPage() {
  const { t } = useTranslation(NS)
  const { object = '', recordId = '' } = useParams()
  const registro = useRegistro(object, recordId)
  if (registro.isPending) return <Cargando etiqueta={t('avisos.abrirRegistro.abriendo')} />
  if (registro.isError && !registro.data && esIlegible(registro.error))
    return <Vacio titulo={t('comun.registroReservado')}>{t('comun.registroReservadoAyuda')}</Vacio>
  if (registro.isError && !registro.data) return <FalloDeLectura error={registro.error} alReintentar={() => void registro.refetch()} />
  const ruta = rutaDeFicha(object, registro.data)
  return ruta ? <Navigate to={ruta} replace /> : <Vacio titulo={t('comun.noDisponible')}>{t('avisos.abrirRegistro.sinFicha')}</Vacio>
}
