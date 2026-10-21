import { cn } from '@wasichai/ui'
import { useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { NS, numeroPe } from '../i18n'
import { MasAcciones } from './Pagina'

// las vistas de un módulo en una sola fila, con su conteo (hallazgo U-18, DD-03): reemplaza la segunda fila de pestañas y va
// dentro de la barra de filtros. es un radiogroup con tabulación itinerante: un solo radio entra en el orden de tabulación,
// las flechas mueven y eligen, y Home y End van a los extremos. las que no caben van en «Más vistas»; la actual nunca queda
// escondida: si está en el menú, entra en lugar de la última visible. quien lo usa escribe ?view= con los demás parámetros

export interface VistaDelSelector {
  id: string
  etiqueta: string
  // cuántos registros tiene la vista; nulo o ausente, no se dice
  n?: number | null
}

export function SelectorDeVista({
  etiqueta,
  vistas,
  actual,
  alElegir,
  visibles = 4
}: {
  etiqueta: string
  vistas: VistaDelSelector[]
  actual: string
  alElegir: (id: string) => void
  visibles?: number
}) {
  const { t } = useTranslation(NS)
  const radios = useRef(new Map<string, HTMLButtonElement>())
  const [aLaVista, enMenu] = repartir(vistas, actual, visibles)
  const nombre = (v: VistaDelSelector) => (v.n != null ? t('comun.selectorDeVista.conConteo', { etiqueta: v.etiqueta, n: numeroPe(v.n) }) : undefined)
  // la que entra en el orden de tabulación: la actual o, si no está, la primera
  const enfocable = aLaVista.some((v) => v.id === actual) ? actual : aLaVista[0]?.id

  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const ultimo = aLaVista.length - 1
    const destino =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? i === ultimo
          ? 0
          : i + 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? i === 0
            ? ultimo
            : i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? ultimo
              : null
    if (destino === null) return
    e.preventDefault()
    const vista = aLaVista[destino]
    radios.current.get(vista.id)?.focus()
    if (vista.id !== actual) alElegir(vista.id)
  }

  return (
    <div className="flex max-w-full items-center gap-2">
      <div
        role="radiogroup"
        aria-label={etiqueta}
        className="inline-flex max-w-full overflow-x-auto rounded-sg-md border border-sg-border bg-sg-surface p-0.5 text-sm"
      >
        {aLaVista.map((v, i) => {
          const elegida = v.id === actual
          return (
            <button
              key={v.id}
              ref={(el) => {
                if (el) radios.current.set(v.id, el)
                else radios.current.delete(v.id)
              }}
              type="button"
              role="radio"
              aria-checked={elegida}
              aria-label={nombre(v)}
              tabIndex={v.id === enfocable ? 0 : -1}
              onClick={() => alElegir(v.id)}
              onKeyDown={(e) => alTeclear(e, i)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-sg-sm px-2.5 py-1',
                elegida ? 'bg-sg-primary-soft font-medium text-sg-primary-text' : 'text-sg-text-secondary hover:bg-sg-surface-hover'
              )}
            >
              {v.etiqueta}
              {v.n != null ? <Conteo n={v.n} /> : null}
            </button>
          )
        })}
      </div>
      {enMenu.length > 0 ? (
        <MasAcciones etiqueta={t('comun.selectorDeVista.mas')}>
          {enMenu.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-label={nombre(v)}
              onClick={() => alElegir(v.id)}
              className="flex items-center justify-between gap-3 whitespace-nowrap rounded-sg-sm px-2 py-1.5 text-left text-sm text-sg-text hover:bg-sg-surface-hover"
            >
              {v.etiqueta}
              {v.n != null ? <Conteo n={v.n} /> : null}
            </button>
          ))}
        </MasAcciones>
      ) : null}
    </div>
  )
}

// el conteo se ve; el nombre accesible del radio ya lo dice
function Conteo({ n }: { n: number }) {
  return (
    <span aria-hidden className="rounded-full bg-sg-surface-sunken px-1.5 text-sg-caption tabular-nums text-sg-text-muted">
      {numeroPe(n)}
    </span>
  )
}

// las primeras `visibles` a la vista y el resto en el menú; si la actual cae en el menú, toma el lugar de la última visible
export function repartir(vistas: VistaDelSelector[], actual: string, visibles: number): [VistaDelSelector[], VistaDelSelector[]] {
  const cuantas = Math.max(1, visibles)
  if (vistas.length <= cuantas) return [vistas, []]
  const aLaVista = vistas.slice(0, cuantas)
  const resto = vistas.slice(cuantas)
  const i = resto.findIndex((v) => v.id === actual)
  if (i < 0) return [aLaVista, resto]
  const cedida = aLaVista[cuantas - 1]
  const elegida = resto[i]
  return [
    [...aLaVista.slice(0, cuantas - 1), elegida],
    // la que cede su lugar encabeza el menú
    [cedida, ...resto.filter((v) => v.id !== actual)]
  ]
}
