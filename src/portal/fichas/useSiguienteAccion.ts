import { useAvailableTransitions } from '../datos/flujos'
import { esCompletable } from '../componentes/CompletarCampo'
import type { SiguienteAccion } from '../componentes/PanelDeDecision'
import { useDefinicion, type Registro } from '../datos/registros'
import { useComprobacion } from '../transiciones/api'
import { useTextoDeAviso } from '../transiciones/avisos'
import { siguienteTransicion } from './siguienteAccion'

// la siguiente acción para el panel de decisión: la transición del camino (siguienteTransicion) con su etiqueta y, si una regla
// de transition-checks la bloquea, lo que falta en el texto de esa regla, nunca su código. comprobar: solo las transiciones que
// la ficha ya comprueba antes (las de la guarda del servidor); null mientras no hay transiciones o no hay una del camino. campo: el
// primero de los que bloquean que quien mira puede completar ahí mismo (tercera pasada de UX, 1.1)
export function useSiguienteAccion(objeto: string, registro: Registro, comprobar: readonly string[] = []): SiguienteAccion | null {
  const transiciones = useAvailableTransitions(objeto, registro.id)
  const tr = siguienteTransicion(objeto, transiciones.data ?? [])
  const comprobacion = useComprobacion(objeto, registro.id, tr && comprobar.includes(tr.name) ? tr.name : null)
  const textoDe = useTextoDeAviso(objeto)
  const definicion = useDefinicion(objeto)
  if (!tr) return null
  const bloqueos = comprobacion.data?.blocking ?? []
  const falta = bloqueos.map((b) => textoDe(b, tr).texto).find((x) => x)
  const campo = bloqueos.map((b) => b.field).find((f): f is string => typeof f === 'string' && esCompletable(objeto, definicion.data, f))
  return { etiqueta: tr.label, falta: falta || undefined, campo }
}
