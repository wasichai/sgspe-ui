import { cn } from '@wasichai/ui'
import { type WorkflowDefinition } from '@wasichai/workflow'
import { useWorkflow } from '../datos/flujos'
import { Check } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el WorkflowStepper de design-system.md §6.1: el camino del objeto (GET /api/objects/{object}/workflow) con el estado
// actual marcado, y los cierres que no son el camino (cancelado, rechazado) aparte. compacto y sin animación

// el camino: desde el estado inicial, los estados que no cierran en el orden en que las transiciones los alcanzan, y al final
// el primer cierre al que lleva el último de ellos. una ficha que conoce su camino lo da; los cierres que no nombra van aparte
// sin transiciones (una definición a medias), el camino sigue el orden de los estados; el estado actual, si el recorrido no lo
// alcanza, se agrega igual: la ficha siempre dice dónde está el registro. del camino dado, solo los estados que el workflow tiene
export function caminoDe(definicion: WorkflowDefinition, dado?: string[], actual?: string | null): { camino: string[]; otros: string[] } {
  const finales = new Set(definicion.states.filter((s) => s.type === 'FINAL').map((s) => s.name))
  const conActual = (r: { camino: string[]; otros: string[] }) =>
    actual && !r.camino.includes(actual) && !r.otros.includes(actual) && definicion.states.some((s) => s.name === actual)
      ? { ...r, camino: [...r.camino, actual] }
      : r
  // del camino que da la ficha, solo los estados que el workflow tiene: uno que no está saldría con su nombre técnico
  const existentes = dado?.filter((nombre) => definicion.states.some((s) => s.name === nombre))
  if (existentes)
    return conActual({ camino: existentes, otros: definicion.states.filter((s) => finales.has(s.name) && !existentes.includes(s.name)).map((s) => s.name) })
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
    <div className="space-y-1 text-sg-body-sm">
      <ol aria-label={t('paginas.flujo.titulo')} className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {camino.map((nombre, i) => {
          const situacion = i < posicion ? 'hecho' : i === posicion ? 'actual' : 'pendiente'
          return (
            <li key={nombre} aria-current={situacion === 'actual' ? 'step' : undefined} className="inline-flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden className={cn('h-0.5 w-4', i <= posicion ? 'bg-sg-progress' : 'bg-sg-border')} /> : null}
              {/* el número en un círculo de 24 px, como los pasos (design-system.md §5.3): hecho en progress con el check, actual
                  en primary y 800, pendiente con el contorno en border */}
              <span
                aria-hidden
                className={cn(
                  'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sg-caption font-bold tabular-nums',
                  situacion === 'hecho' && 'bg-sg-progress text-sg-on-primary',
                  situacion === 'actual' && 'bg-sg-primary text-sg-on-primary',
                  situacion === 'pendiente' && 'border-2 border-sg-border text-sg-text-muted'
                )}
              >
                {situacion === 'hecho' ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="sr-only">{t(`paginas.flujo.${situacion}`)}: </span>
              <span className={situacion === 'actual' ? 'font-extrabold text-sg-primary-text' : situacion === 'hecho' ? 'text-sg-text' : 'text-sg-text-muted'}>
                {etiqueta(nombre)}
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
