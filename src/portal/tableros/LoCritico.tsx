import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { NS } from '../i18n'
import type { ItemDeAtencion } from './atencionEjecutiva'

// «Qué es crítico y dónde se atiende» como lista (S02 y S03; design-system.md §6.7): cada asunto en una fila con el código del
// proyecto en la monoespaciada, el asunto con su cifra en negrita, el proyecto debajo y, a la derecha, el módulo donde se atiende.
// lo vencido lleva su situación. el orden es el de la regla fija (atencionEjecutiva.ts), ya por gravedad; el enlace dice el asunto
// y el proyecto, para que cuatro «Compromisos» no se confundan
const VENCIDOS = new Set(['KPI-COM-03'])

export function ListaDeLoCritico({ items }: { items: ItemDeAtencion[] }) {
  const { t } = useTranslation(NS)
  return (
    <ul className="divide-y divide-sg-border-subtle">
      {items.map((i) => {
        const proyecto = i.nombre ?? t('tablerosF8.ejecutivo.todaLaCartera')
        const asunto = t(`tableros.cifras.${i.code}`)
        return (
          <li
            key={`${i.code}-${i.proyecto ?? 'cartera'}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-3 first:pt-1 last:pb-1 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]"
          >
            <span className="font-sg-mono text-sg-body-sm text-sg-text-secondary max-sm:col-span-2">{i.codigo ?? t('tablerosF8.ejecutivo.cartera')}</span>
            <div className="min-w-0 space-y-1">
              <p className="text-sg-body font-bold text-sg-text">{t(`tablerosF8.ejecutivo.asuntos.${i.code}`, { count: i.valor })}</p>
              <p className="flex flex-wrap items-center gap-2 text-sg-body-sm text-sg-text-secondary">
                {VENCIDOS.has(i.code) ? <SituacionDePlazo valor="VENCIDO" /> : null}
                <span>{proyecto}</span>
              </p>
            </div>
            <Link
              to={i.ruta}
              aria-label={t('tablerosF8.ejecutivo.enlaceDeAsunto', { asunto, proyecto })}
              className="inline-flex min-h-8 items-center gap-1 text-sg-body-sm font-bold whitespace-nowrap text-sg-primary-text underline underline-offset-3"
            >
              {t(`tablerosF8.ejecutivo.modulos.${i.code}`)}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
