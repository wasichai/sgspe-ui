import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { Cargando, esIlegible } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { montoPe } from '../componentes/Monto'
import { aDiezmilesimos, deDiezmilesimos } from '../datos/decimales'
import { APORTE_COMPROMETIDO } from '../datos/inversion'
import { atributo, texto, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// la barra del tope de apoyo social de la campaña (screens.md S30, paso 5, y S44; D7, P1, RN-INV-003): lo aprobado en la campaña,
// este registro y lo que queda. desde F5 lo aprobado son los compromisos comprometidos (dashboards.md §3.2) y los aportes
// comprometidos (approved, procured, delivered y closed, elección 6), en la moneda de la campaña; el registro que se aprueba
// (excluir) no se cuenta dos veces. es una ayuda: la regla la aplican SupportPolicyGuard y ContributionCapRule al aprobar. lo que
// está en otra moneda no se suma (CAP_OTHER_CURRENCY). los montos se suman en diezmilésimos exactos (datos/decimales): en coma
// flotante una campaña justo en su tope parecería superarlo. quien no lee los aportes no los ve sumados y se le dice; un tenant
// sin el modelo de F5 responde 404 por social_contribution (aunque ADMIN lo pida): no hay aportes que sumar
export const COMPROMETIDOS: readonly string[] = ['approved', 'in_progress', 'blocked', 'fulfilled', 'verified', 'closed']

export function BarraDelTope({
  campana,
  monto,
  moneda,
  excluir,
  de = 'compromiso'
}: {
  campana: Registro
  monto: string | null
  moneda: string
  excluir?: string
  de?: 'compromiso' | 'aporte'
}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const leeAportes = can('social_contribution', 'READ')
  const compromisos = useTodos('commitment', { exploration_campaign: campana.id })
  const aportes = useTodos('social_contribution', { exploration_campaign: campana.id }, leeAportes)
  const limite = aDiezmilesimos(atributo(campana, 'social_support_cap'))
  const monedaDelTope = texto(campana, 'currency') || 'PEN'
  if (limite === null) return <p className="text-sm text-sg-text-muted">{t('nuevoCompromiso.tope.sinTope')}</p>
  if (compromisos.isPending || (leeAportes && aportes.isPending)) return <Cargando compacto etiqueta={t('nuevoCompromiso.tope.leyendo')} />
  if (compromisos.isError && !compromisos.data) return <FalloDeLectura error={compromisos.error} alReintentar={() => void compromisos.refetch()} />
  if (leeAportes && aportes.isError && !aportes.data && !esIlegible(aportes.error))
    return <FalloDeLectura error={aportes.error} alReintentar={() => void aportes.refetch()} />
  const enLaMoneda = (r: Registro) => (texto(r, 'currency') || 'PEN') === monedaDelTope
  const suma = (registros: Registro[], estados: readonly string[], campo: string) =>
    registros
      .filter((r) => r.id !== excluir && estados.includes(r.state ?? '') && enLaMoneda(r))
      .reduce((total, r) => total + (aDiezmilesimos(atributo(r, campo)) ?? 0n), 0n)
  const aprobado = suma(compromisos.data, COMPROMETIDOS, 'amount') + suma(aportes.data ?? [], APORTE_COMPROMETIDO, 'total_amount')
  const este = moneda === monedaDelTope && monto !== null ? (aDiezmilesimos(monto) ?? 0n) : 0n
  const queda = limite - aprobado - este
  // el ancho de la barra es solo dibujo: en centésimas de punto porcentual, acotado entre 0 y 100
  const porcentaje = (n: bigint) => {
    if (limite <= 0n) return n > 0n ? '100%' : '0%'
    const centesimas = (n * 10000n) / limite
    return `${Number(centesimas < 0n ? 0n : centesimas > 10000n ? 10000n : centesimas) / 100}%`
  }
  const dicho = (n: bigint) => montoPe(deDiezmilesimos(n), monedaDelTope)
  return (
    <section aria-label={t('nuevoCompromiso.tope.titulo')} className="space-y-2 rounded-sg-md border border-sg-border p-3 text-sm">
      <h3 className="font-medium">
        {t('nuevoCompromiso.tope.titulo')}: {dicho(limite)}
      </h3>
      <div className="flex h-3 overflow-hidden rounded-sg-sm bg-sg-surface-sunken" aria-hidden>
        <div className="bg-sg-primary" style={{ width: porcentaje(aprobado) }} />
        <div className={queda < 0n ? 'bg-sg-danger' : 'bg-sg-info'} style={{ width: porcentaje(este) }} />
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('nuevoCompromiso.tope.aprobado')}</dt>
          <dd className="tabular-nums">{dicho(aprobado)}</dd>
        </div>
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t(de === 'aporte' ? 'nuevoCompromiso.tope.esteAporte' : 'nuevoCompromiso.tope.este')}</dt>
          <dd className="tabular-nums">{dicho(este)}</dd>
        </div>
        <div>
          <dt className="text-sg-caption text-sg-text-muted">{t('nuevoCompromiso.tope.queda')}</dt>
          <dd className="tabular-nums">{dicho(queda)}</dd>
        </div>
      </dl>
      {moneda !== monedaDelTope ? <p className="text-sg-caption">{t('nuevoCompromiso.tope.otraMoneda', { moneda: monedaDelTope })}</p> : null}
      {!leeAportes ? <p className="text-sg-caption text-sg-text-muted">{t('nuevoCompromiso.tope.sinAportes')}</p> : null}
      {queda < 0n ? (
        <p role="alert" className="text-sg-caption text-sg-warning">
          {t(de === 'aporte' ? 'nuevoCompromiso.tope.superaAporte' : 'nuevoCompromiso.tope.supera')}
        </p>
      ) : null}
    </section>
  )
}
