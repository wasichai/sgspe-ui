import { ApiError } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { esQcs } from '../datos/atencion'
import { rutaDeFicha, rutaParaAbrir } from '../datos/fichas'
import { texto, useRegistro, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { Cargando, NoDisponible, Reservado } from './Estados'
import { FalloDeLectura } from './LecturaConEstados'

// el nombre de un registro vinculado: su código y su título, nombre o titular; sin ninguno, un texto (nunca su id)
export function useRotuloDeRegistro(): (registro: Registro) => string {
  const { t } = useTranslation(NS)
  return (r) => [texto(r, 'code'), texto(r, 'title') || texto(r, 'name') || texto(r, 'headline')].filter(Boolean).join(' · ') || t('piezas.vinculado.sinNombre')
}

// un vínculo a otro registro (la queja de origen de un compromiso, el origen de una tarea, el riesgo de una alerta): lo lee como
// quien mira y enlaza su ficha. una QCS confidencial que la cuenta no lee responde 404 (RecordReadScope, security.md §9.6): se dice
// «Registro reservado», sin enlace ni datos; nadie borra una QCS, así que su 404 no es un registro borrado. un 404 de otro objeto es
// un registro que ya no existe; un 403, «No disponible»; otro fallo, con su reintento. sin id no dibuja nada
export function RegistroVinculado({ objeto, id, rotulo }: { objeto: string; id: string | null | undefined; rotulo?: (registro: Registro) => string }) {
  const { t } = useTranslation(NS)
  const registro = useRegistro(objeto, id ?? undefined)
  const rotuloPorDefecto = useRotuloDeRegistro()
  if (!id) return null
  if (registro.isPending) return <Cargando compacto />
  if (registro.isError && !registro.data) {
    const estado = registro.error instanceof ApiError ? registro.error.status : null
    if (estado === 404) return esQcs(objeto) ? <Reservado /> : <span className="text-sg-text-muted">{t('piezas.vinculado.noExiste')}</span>
    if (estado === 403) return <NoDisponible enLista />
    return <FalloDeLectura error={registro.error} alReintentar={() => void registro.refetch()} />
  }
  const r = registro.data as Registro
  return (
    <Link to={rutaDeFicha(objeto, r) ?? rutaParaAbrir(objeto, r.id)} className="text-sg-primary-text underline">
      {(rotulo ?? rotuloPorDefecto)(r)}
    </Link>
  )
}
