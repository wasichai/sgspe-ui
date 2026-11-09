import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// «Revise sus respuestas» (design-system.md §6.3): el último paso de un formulario por pasos dice cada dato con su nombre y un
// «Cambiar» que vuelve a su paso sin perder nada. el nombre del dato acompaña a «Cambiar» para los lectores de pantalla
export interface RespuestaRevisada {
  clave: string
  termino: string
  valor: ReactNode
  // el paso (desde 0) donde se escribe
  aPaso: number
}

export function RevisionDeRespuestas({ filas, alCambiar, pie }: { filas: RespuestaRevisada[]; alCambiar: (paso: number) => void; pie?: ReactNode }) {
  const { t } = useTranslation(NS)
  return (
    <section className="space-y-3 text-sm" aria-label={t('comun.revisarRespuestas')}>
      <h3 className="text-sg-h3 font-bold text-sg-text">{t('comun.revisarRespuestas')}</h3>
      <dl className="divide-y divide-sg-border border-y border-sg-border">
        {filas.map((fila) => (
          <div key={fila.clave} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 py-2.5 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)_auto]">
            <dt className="font-semibold text-sg-text">{fila.termino}</dt>
            <dd className="col-start-1 break-words whitespace-pre-line text-sg-text-secondary sm:col-start-2">{fila.valor}</dd>
            <dd className="col-start-2 row-start-1 sm:col-start-3">
              <button type="button" onClick={() => alCambiar(fila.aPaso)} className="rounded-sg-sm font-semibold text-sg-primary-text underline">
                {t('comun.cambiar')} <span className="sr-only">{fila.termino}</span>
              </button>
            </dd>
          </div>
        ))}
      </dl>
      {pie}
    </section>
  )
}
