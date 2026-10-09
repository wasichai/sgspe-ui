import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { texto, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// la pestaña Acuerdos de la ficha de interacción (S23, F3): los acuerdos que nombran esta interacción como la asamblea que
// los autoriza (assembly_engagement) y los compromisos que nacen de ella (origin_engagement). un objeto que la cuenta no lee
// dice «no disponible», nunca una lista vacía
export function AcuerdosDeLaInteraccion({ interaccion }: { interaccion: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(interaccion, 'project')
  const acuerdos = useTodos('agreement', { assembly_engagement: interaccion.id })
  const compromisos = useTodos('commitment', { origin_engagement: interaccion.id })
  return (
    <section aria-label={t('acuerdos.deLaInteraccion.titulo')} className="space-y-3 pt-3 text-sm">
      <h2 className="text-sg-h3 font-semibold">{t('acuerdos.deLaInteraccion.acuerdos')}</h2>
      {acuerdos.isPending ? (
        <Cargando compacto />
      ) : acuerdos.isError && !acuerdos.data ? (
        <FalloDeLectura error={acuerdos.error} alReintentar={() => void acuerdos.refetch()} />
      ) : acuerdos.data.length === 0 ? (
        <p className="text-sg-text-muted">{t('acuerdos.deLaInteraccion.sinAcuerdos')}</p>
      ) : (
        <ul className="space-y-1">
          {acuerdos.data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <Link to={`/projects/${encodeURIComponent(proyecto)}/agreements/${encodeURIComponent(a.id)}`} className="text-sg-primary-text underline">
                {texto(a, 'code')} · {texto(a, 'title')}
              </Link>
              <EstadoChip objeto="agreement" estado={a.state} />
            </li>
          ))}
        </ul>
      )}
      <h2 className="text-sg-h3 font-semibold">{t('acuerdos.deLaInteraccion.compromisos')}</h2>
      {compromisos.isPending ? (
        <Cargando compacto />
      ) : compromisos.isError && !compromisos.data ? (
        <FalloDeLectura error={compromisos.error} alReintentar={() => void compromisos.refetch()} />
      ) : compromisos.data.length === 0 ? (
        <p className="text-sg-text-muted">{t('acuerdos.deLaInteraccion.sinCompromisos')}</p>
      ) : (
        <ul className="space-y-1">
          {compromisos.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <Link to={`/projects/${encodeURIComponent(proyecto)}/commitments/${encodeURIComponent(c.id)}`} className="text-sg-primary-text underline">
                {texto(c, 'code')} · {texto(c, 'title')}
              </Link>
              <EstadoChip objeto="commitment" estado={c.state} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
