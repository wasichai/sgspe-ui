import { useAvailableTransitions } from '../datos/flujos'
import { esCompletable } from '../componentes/CompletarCampo'
import type { SiguienteAccion } from '../componentes/PanelDeDecision'
import { useDefinicion, type Registro } from '../datos/registros'
import { useComprobacion } from '../transiciones/api'
import { useTextoDeAviso } from '../transiciones/avisos'
import { useBloqueosDelPaso } from '../transiciones/DatosDelPaso'
import { siguienteTransicion } from './siguienteAccion'

// la siguiente acción para el panel de decisión: la transición del camino (siguienteTransicion) con su etiqueta y, si una regla
// de transition-checks la bloquea, lo que falta en el texto de esa regla, nunca su código. comprobar: solo las transiciones que
// la ficha ya comprueba antes (las de la guarda del servidor); null mientras no hay transiciones o no hay una del camino. los datos
// que el diálogo pide no son una falta: se dicen como lo que el paso pedirá (pide). campo: el primero de los que bloquean que quien
// mira puede completar ahí mismo (tercera pasada de UX, 1.1 y 1.2)
export function useSiguienteAccion(objeto: string, registro: Registro, comprobar: readonly string[] = []): SiguienteAccion | null {
  const transiciones = useAvailableTransitions(objeto, registro.id)
  const tr = siguienteTransicion(objeto, transiciones.data ?? [])
  const comprobacion = useComprobacion(objeto, registro.id, tr && comprobar.includes(tr.name) ? tr.name : null)
  const textoDe = useTextoDeAviso(objeto)
  const definicion = useDefinicion(objeto)
  const { pedidos, otros } = useBloqueosDelPaso(objeto, comprobacion.data?.blocking ?? [])
  if (!tr) return null
  const falta = otros.map((b) => textoDe(b, tr).texto).find((x) => x)
  const campo = otros.map((b) => b.field).find((f): f is string => typeof f === 'string' && esCompletable(objeto, definicion.data, f))
  const pide = pedidos.map((c) => c.label || c.name)
  return { etiqueta: tr.label, falta: falta || undefined, campo, pide: pide.length > 0 ? pide : undefined }
}
