import { cn } from '@wasichai/ui'
import { useWorkflow, type WorkflowDefinition } from '@wasichai/workflow'
import { Check } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el WorkflowStepper de design-system.md §6.1: el camino del objeto (GET /api/objects/{object}/workflow) con el estado
// actual marcado, y los cierres que no son el camino (cancelado, rechazado) aparte. compacto y sin animación

// el camino: desde el estado inicial, los estados que no cierran en el orden en que las transiciones los alcanzan, y al final
// el primer cierre al que lleva el último de ellos. una ficha que conoce su camino lo da; los cierres que no nombra van aparte
// sin transiciones (una definición a medias), el camino sigue el orden de los estados; el estado actual, si el recorrido no lo
// alcanza, se agrega igual: la ficha siempre dice dónde está el registro
export function caminoDe(definicion: WorkflowDefinition, dado?: string[], actual?: string | null): { camino: string[]; otros: string[] } {
  const finales = new Set(definicion.states.filter((s) => s.type === 'FINAL').map((s) => s.name))
  const conActual = (r: { camino: string[]; otros: string[] }) =>
    actual && !r.camino.includes(actual) && !r.otros.includes(actual) && definicion.states.some((s) => s.name === actual)
      ? { ...r, camino: [...r.camino, actual] }
      : r
  if (dado) return conActual({ camino: dado, otros: definicion.states.filter((s) => finales.has(s.name) && !dado.includes(s.name)).map((s) => s.name) })
  if (definicion.transitions.length === 0)
    return conActual({
      camino: definicion.states.filter((s) => !finales.has(s.name)).map((s) => s.name),
      otros: definicion.states.filter((s) => finales.has(s.name)).map((s) => s.name)
    })
  const inicial = definicion.states.find((s) => s.type === 'INITIAL')?.name
  const orden: string[] = []
  for (let cola = inicial ? [inicial] : []; cola.length > 0;) {
    const estado = cola.shift()!
    if (orden.includes(estado)) continue
    orden.push(estado)
    cola.push(...definicion.transitions.filter((t) => t.from === estado).map((t) => t.to))
  }
  const intermedios = orden.filter((e) => !finales.has(e))
  const ultimo = intermedios[intermedios.length - 1]
  const cierre = definicion.transitions.find((t) => t.from === ultimo && finales.has(t.to))?.to
  const camino = cierre ? [...intermedios, cierre] : intermedios
  return conActual({ camino, otros: definicion.states.filter((s) => finales.has(s.name) && !camino.includes(s.name)).map((s) => s.name) })
}

export function CaminoDelFlujo({ objeto, estado, camino: dado }: { objeto: string; estado: string | null | undefined; camino?: string[] }) {
  const { t } = useTranslation(NS)
  const workflow = useWorkflow(objeto)
  const definicion = workflow.data?.definition
  if (!definicion) return null
  const { camino, otros } = caminoDe(definicion, dado, estado)
  const etiqueta = (nombre: string) => definicion.states.find((s) => s.name === nombre)?.label ?? nombre
  const posicion = estado ? camino.indexOf(estado) : -1
  return (
    <div className="space-y-1 text-sg-caption">
      <ol aria-label={t('paginas.flujo.titulo')} className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {camino.map((nombre, i) => {
          const situacion = i < posicion ? 'hecho' : i === posicion ? 'actual' : 'pendiente'
          return (
            <li key={nombre} aria-current={situacion === 'actual' ? 'step' : undefined} className="inline-flex items-center gap-1">
              {i > 0 ? <span aria-hidden className={cn('h-px w-4', i <= posicion ? 'bg-sg-primary' : 'bg-sg-border-strong')} /> : null}
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                  situacion === 'actual' && 'border-sg-primary bg-sg-primary-soft font-medium text-sg-primary-text',
                  situacion === 'hecho' && 'border-sg-border text-sg-text-secondary',
                  situacion === 'pendiente' && 'border-dashed border-sg-border text-sg-text-muted'
                )}
              >
                {situacion === 'hecho' ? <Check aria-hidden className="size-3" /> : null}
                <span className="sr-only">{t(`paginas.flujo.${situacion}`)}: </span>
                <span>{etiqueta(nombre)}</span>
              </span>
            </li>
          )
        })}
      </ol>
      {otros.length > 0 ? (
        <p className="text-sg-text-muted">
          {t('paginas.flujo.terminales')}:{' '}
          {otros.map((nombre, i) => (
            <Fragment key={nombre}>
              {i > 0 ? ', ' : null}
              <span aria-current={nombre === estado ? 'step' : undefined} className={nombre === estado ? 'font-medium text-sg-text' : undefined}>
                {etiqueta(nombre)}
              </span>
            </Fragment>
          ))}
        </p>
      ) : null}
    </div>
  )
}
