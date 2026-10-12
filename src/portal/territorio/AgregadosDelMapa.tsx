import { useTranslation } from 'react-i18next'
import { montoPe } from '../componentes/Monto'
import { NS } from '../i18n'
import type { Elemento, EstadoDeCapa } from '../mapa/api'
import { esAgregado } from '../mapa/capas'

// los agregados por localidad de las capas de gestión (H1 bis del plan 6.3), la alternativa de texto de sus puntos: LYR-17 dice
// cuántos grupos de interés hay en cada localidad y su postura (o «No disponible» si la cuenta no lee la postura: byStance null,
// nunca un cero) y los aportes de LYR-23 suman cada moneda aparte (ASM-063). es un lugar con sus conteos, nunca una persona
interface Aporte {
  currency: string
  count: number
  totalAmount: number | string
}

export function AgregadosDelMapa({ estados }: { estados: EstadoDeCapa[] }) {
  const { t } = useTranslation(NS)
  const conAgregados = estados
    .map((e) => ({ id: e.id, elementos: (e.datos?.features ?? []).filter((f) => esAgregado(f.properties)) }))
    .filter((e) => e.elementos.length > 0)
  if (conAgregados.length === 0) return null
  const detalle = (f: Elemento): string[] => {
    const p = f.properties
    if (p.__aggregate === 'stakeholder') {
      const posturas = p.byStance as Record<string, number> | null | undefined
      return [
        // sin total, «No disponible»: nunca un cero que no se contó
        typeof p.total === 'number' ? t('sig.gruposDeInteres', { count: p.total }) : t('sig.totalNoDisponible'),
        ...(posturas
          ? Object.entries(posturas).map(([postura, n]) => `${postura === 'SIN DATO' ? t('sig.sinDato') : postura}: ${n}`)
          : [t('sig.posturaNoDisponible')])
      ]
    }
    if (p.__aggregate === 'social_contribution')
      return ((p.contributions as Aporte[] | undefined) ?? []).map((a) => t('sig.aportes', { count: a.count, monto: montoPe(a.totalAmount, a.currency) }))
    return []
  }
  return (
    <>
      {conAgregados.map(({ id, elementos }) => (
        <section key={id} aria-label={t(`mapa.capasNombre.${id}`)} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
          <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t(`mapa.capasNombre.${id}`)}</h2>
          <ul className="max-h-[240px] space-y-1 overflow-y-auto">
            {elementos.map((f) => (
              <li key={String(f.id ?? f.properties.__id)} className="tabular-nums">
                {[String(f.properties.name || t('territorio.sinNombre')), ...detalle(f)].join(' · ')}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
