import type { EstadoDeCapa } from './api'

// qué decir cuando el mapa no dibuja nada. «sin geometrías» solo vale si hay capas encendidas, ninguna falló ni está
// bloqueada y la consulta cubre todo el proyecto (sin bbox): con una vista acotada, un mapa vacío solo dice que la vista lo está
export function avisoDelMapa(
  estados: EstadoDeCapa[],
  acotado: boolean
): 'todasApagadas' | 'todasBloqueadas' | 'todasConError' | 'vistaVacia' | 'sinGeometrias' | null {
  if (estados.length === 0) return 'todasApagadas'
  if (estados.some((e) => e.cargando || (e.datos?.features.length ?? 0) > 0)) return null
  const bloqueadas = estados.filter((e) => e.bloqueada).length
  const conError = estados.filter((e) => !e.bloqueada && e.error).length
  if (bloqueadas === estados.length) return 'todasBloqueadas'
  if (bloqueadas + conError === estados.length) return 'todasConError'
  return acotado || bloqueadas + conError > 0 ? 'vistaVacia' : 'sinGeometrias'
}
