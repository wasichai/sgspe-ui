import { useTranslation } from 'react-i18next'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { montoPe } from '../componentes/Monto'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// la barra del tope de apoyo social de la campaña (screens.md S30, paso 5; D7, RN-INV-003): lo aprobado en la campaña (los
// compromisos comprometidos de dashboards.md §3.2, en la moneda de la campaña), este compromiso y lo que queda. es una ayuda:
// la regla la aplica SupportPolicyGuard al aprobar. lo que está en otra moneda no se suma (CAP_OTHER_CURRENCY)
export const COMPROMETIDOS: readonly string[] = ['approved', 'in_progress', 'blocked', 'fulfilled', 'verified', 'closed']

export function BarraDelTope({ campana, monto, moneda }: { campana: Registro; monto: number | null; moneda: string }) {
  const { t } = useTranslation(NS)
  const compromisos = useTodos('commitment', { exploration_campaign: campana.id })
  const tope = atributo<number | string>(campana, 'social_support_cap')
  const monedaDelTope = texto(campana, 'currency') || 'PEN'
  if (tope === undefined || tope === null || tope === '') return <p className="text-sm text-sg-text-muted">{t('nuevoCompromiso.tope.sinTope')}</p>
  if (compromisos.isPending) return <Cargando compacto etiqueta={t('nuevoCompromiso.tope.leyendo')} />
  if (compromisos.isError && !compromisos.data) return <FalloDeLectura error={compromisos.error} alReintentar={() => void compromisos.refetch()} />
  const aprobado = compromisos.data
    .filter((c) => COMPROMETIDOS.includes(c.state ?? '') && (texto(c, 'currency') || 'PEN') === monedaDelTope)
    .reduce((suma, c) => suma + Number(atributo(c, 'amount') ?? 0), 0)
  const este = moneda === monedaDelTope && monto !== null ? monto : 0
  const limite = Number(tope)
  const queda = limite - aprobado - este
  const porcentaje = (n: number) => `${Math.max(0, Math.min(100, (n / Math.max(limite, 1)) * 100))}%`
  return (
    <section aria-label={t('nuevoCompromiso.tope.titulo')} className="space-y-2 rounded-sg-md border border-sg-border p-3 text-sm">
      <h3 className="font-medium">
        {t('nuevoCompromiso.tope.titulo')}: {montoPe(limite, monedaDelTope)}
      </h3>
      <div className="flex h-3 overflow-hidden rounded-sg-sm bg-sg-surface-sunken" aria-hidden>
        <div className="bg-sg-primary" style={{ width: porcentaje(aprobado) }} />
        <div className={queda < 0 ? 'bg-sg-danger' : 'bg-sg-info'} style={{ width: porcentaje(este) }} />
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('nuevoCompromiso.tope.aprobado')}</dt>
          <dd className="tabular-nums">{montoPe(aprobado, monedaDelTope)}</dd>
        </div>
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('nuevoCompromiso.tope.este')}</dt>
          <dd className="tabular-nums">{montoPe(este, monedaDelTope)}</dd>
        </div>
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('nuevoCompromiso.tope.queda')}</dt>
          <dd className="tabular-nums">{montoPe(queda, monedaDelTope)}</dd>
        </div>
      </dl>
      {moneda !== monedaDelTope ? <p className="text-sg-caption">{t('nuevoCompromiso.tope.otraMoneda', { moneda: monedaDelTope })}</p> : null}
      {queda < 0 ? (
        <p role="alert" className="text-sg-caption text-sg-warning">
          {t('nuevoCompromiso.tope.supera')}
        </p>
      ) : null}
    </section>
  )
}
