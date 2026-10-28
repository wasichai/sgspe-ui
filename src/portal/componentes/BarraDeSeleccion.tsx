import { Button } from '@wasichai/ui'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// la barra de una selección múltiple (tercera pasada de UX, 3.9; sale de la lista de grupos de interés): cuántos van elegidos, las
// acciones sobre ellos, elegir todos los de la página y quitar la selección. el resultado del último lote (cuántos salieron y
// cuántos no) queda a la vista aunque la selección ya se haya vaciado. sin elegidos ni resultado, no se dibuja
export function BarraDeSeleccion({
  n,
  texto,
  acciones,
  todos,
  alElegirTodos,
  alQuitar,
  resultado
}: {
  n: number
  // cómo se dice lo elegido («2 seleccionados», «2 tareas elegidas»); sin él, el texto común
  texto?: string
  acciones?: ReactNode
  // cuántos se pueden elegir aquí: si son más que los elegidos, se ofrece elegirlos todos
  todos?: number
  alElegirTodos?: () => void
  alQuitar?: () => void
  resultado?: ReactNode
}) {
  const { t } = useTranslation(NS)
  if (n === 0 && !resultado) return null
  const dicho = texto ?? t('comun.seleccionados', { n, count: n })
  return (
    <div className="space-y-2">
      {n > 0 ? (
        <div role="region" aria-label={dicho} className="flex flex-wrap items-center gap-3 rounded-sg-md bg-sg-primary-soft px-3 py-2 text-sm">
          <span aria-live="polite">{dicho}</span>
          {acciones}
          {alElegirTodos && todos != null && todos > n ? (
            <Button size="sm" variant="secondary" onClick={alElegirTodos}>
              {t('comun.seleccion.todos', { count: todos })}
            </Button>
          ) : null}
          {alQuitar ? (
            <button type="button" className="text-sg-primary-text underline" onClick={alQuitar}>
              {t('comun.seleccion.quitar')}
            </button>
          ) : null}
        </div>
      ) : null}
      {resultado}
    </div>
  )
}
