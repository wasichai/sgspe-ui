import { cn } from '@wasichai/ui'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { PestanasDesplazables } from './PestanasDesplazables'

// las pestañas de una ficha (design-system.md §6.1, D6 de la revisión de UX): se desplazan con flechas cuando no caben
// (PestanasDesplazables), la elegida vive en la URL (?tab=) para compartirla y volver a ella, y cada una puede llevar su
// conteo. como las de wasichai: una pestaña ya visitada queda montada (oculta), así lo escrito en ella no se pierde, y las
// flechas, Inicio y Fin mueven el foco; Enter o un clic la eligen
export interface PestanaDeFicha {
  id: string
  etiqueta: string
  conteo?: number | null
  render: () => ReactNode
}

export function PestanasDeFicha({ etiqueta, pestanas }: { etiqueta: string; pestanas: PestanaDeFicha[] }) {
  const [busqueda, fijarBusqueda] = useSearchParams()
  const pedida = busqueda.get('tab')
  const actual = pestanas.some((p) => p.id === pedida) ? pedida! : (pestanas[0]?.id ?? '')
  const [visitadas, setVisitadas] = useState<string[]>([actual])
  const id = useId()
  const fila = useRef<HTMLDivElement>(null)
  if (!visitadas.includes(actual)) setVisitadas((v) => [...v, actual])
  if (pestanas.length === 0) return null

  const elegir = (pestana: string) => {
    const siguiente = new URLSearchParams(busqueda)
    siguiente.set('tab', pestana)
    fijarBusqueda(siguiente, { replace: true, preventScrollReset: true })
  }
  const alTeclear = (e: KeyboardEvent, i: number) => {
    const ultima = pestanas.length - 1
    const destino: Record<string, number> = { ArrowRight: i === ultima ? 0 : i + 1, ArrowLeft: i === 0 ? ultima : i - 1, Home: 0, End: ultima }
    if (!(e.key in destino)) return
    e.preventDefault()
    fila.current?.querySelectorAll<HTMLElement>('[role="tab"]')[destino[e.key]]?.focus()
  }

  return (
    <div ref={fila}>
      <PestanasDesplazables etiqueta={etiqueta} rol="tablist">
        {pestanas.map((p, i) => {
          const elegida = p.id === actual
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`${id}-pestana-${p.id}`}
              aria-selected={elegida}
              aria-controls={`${id}-panel-${p.id}`}
              tabIndex={elegida ? 0 : -1}
              onClick={() => elegir(p.id)}
              onKeyDown={(e) => alTeclear(e, i)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm',
                elegida ? 'border-sg-primary font-medium text-sg-primary-text' : 'border-transparent text-sg-text-secondary hover:text-sg-text'
              )}
            >
              {p.etiqueta}
              {/* el espacio separa el conteo en el nombre de la pestaña («Entregas 2»); el flex no lo dibuja */}
              {p.conteo != null ? ' ' : null}
              {p.conteo != null ? (
                <span className="rounded-full bg-sg-surface-sunken px-1.5 text-sg-caption tabular-nums text-sg-text-muted">{p.conteo}</span>
              ) : null}
            </button>
          )
        })}
      </PestanasDesplazables>
      {pestanas.map((p) =>
        visitadas.includes(p.id) || p.id === actual ? (
          <div key={p.id} role="tabpanel" id={`${id}-panel-${p.id}`} aria-labelledby={`${id}-pestana-${p.id}`} hidden={p.id !== actual}>
            {p.render()}
          </div>
        ) : null
      )}
    </div>
  )
}
