// las teclas del presentador: la lámina a la que llevan desde `actual`, o null si la tecla no es de navegación. Escape no está:
// cierra el presentador (o, a pantalla completa, primero la deja el navegador)
const SIGUIENTE = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'])
const ANTERIOR = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'])

export function laminaTrasTecla(tecla: string, actual: number, total: number): number | null {
  if (total <= 0) return null
  const ultima = total - 1
  if (SIGUIENTE.has(tecla)) return Math.min(actual + 1, ultima)
  if (ANTERIOR.has(tecla)) return Math.max(actual - 1, 0)
  if (tecla === 'Home') return 0
  if (tecla === 'End') return ultima
  return null
}
