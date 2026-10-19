import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { rutaDeFicha, rutaParaAbrir } from '../datos/fichas'
import { texto, useRegistro, type Registro } from '../datos/registros'
import { useSiguientePaso } from '../contexto/Rastro'
import { NS } from '../i18n'
import { Cargando, esIlegible, esProhibido, NoDisponible, Reservado } from './Estados'
import { FalloDeLectura } from './LecturaConEstados'

// el nombre de un registro vinculado: su código y su título, nombre o titular; sin ninguno, un texto (nunca su id)
export function useRotuloDeRegistro(): (registro: Registro) => string {
  const { t } = useTranslation(NS)
  return (r) => [texto(r, 'code'), texto(r, 'title') || texto(r, 'name') || texto(r, 'headline')].filter(Boolean).join(' · ') || t('piezas.vinculado.sinNombre')
}

// un vínculo a otro registro (la queja de origen de un compromiso, el origen de una tarea, el riesgo de una alerta): lo lee como
// quien mira y enlaza su ficha (con su paso en el rastro). un destino que responde 404 es «Registro reservado», sin enlace ni datos: wasichai responde igual
// por un registro de un proyecto en que la cuenta no está asignada (alcance por proyecto, ADR-0029), por una QCS confidencial que
// no lee (ADR-0028) y por uno borrado, y el portal no los distingue (spec 4.4 §3.6 y §3.12). un 403, «No disponible»; otro fallo,
// con su reintento. sin id no dibuja nada
export function RegistroVinculado({ objeto, id, rotulo }: { objeto: string; id: string | null | undefined; rotulo?: (registro: Registro) => string }) {
  const registro = useRegistro(objeto, id ?? undefined)
  const rotuloPorDefecto = useRotuloDeRegistro()
  const paso = useSiguientePaso()
  if (!id) return null
  if (registro.isPending) return <Cargando compacto />
  if (registro.isError && !registro.data) {
    if (esIlegible(registro.error)) return <Reservado />
    if (esProhibido(registro.error)) return <NoDisponible enLista />
    return <FalloDeLectura error={registro.error} alReintentar={() => void registro.refetch()} />
  }
  const r = registro.data as Registro
  const ruta = rutaDeFicha(objeto, r) ?? rutaParaAbrir(objeto, r.id)
  return (
    <Link to={ruta} state={paso(undefined, ruta)} className="text-sg-primary-text underline">
      {(rotulo ?? rotuloPorDefecto)(r)}
    </Link>
  )
}

// el enlace a la ficha de un registro ya leído, con su paso en el rastro; sin ruta (un registro de proyecto que llega sin proyecto), su nombre sin enlace,
// nunca un enlace a «#»
export function EnlaceDeFicha({ objeto, registro, children }: { objeto: string; registro: Registro; children: React.ReactNode }) {
  const ruta = rutaDeFicha(objeto, registro)
  const paso = useSiguientePaso()
  return ruta ? (
    <Link to={ruta} state={paso(undefined, ruta)} className="text-sg-primary-text underline">
      {children}
    </Link>
  ) : (
    <span>{children}</span>
  )
}
