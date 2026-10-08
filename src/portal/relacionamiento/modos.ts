// la misma búsqueda (grupos de interés, visita de campo, chip de territorio) con otro modo
export const conModo = (busqueda: URLSearchParams, modo: 'quick' | 'full'): string => {
  const siguiente = new URLSearchParams(busqueda)
  siguiente.set('mode', modo)
  return `?${siguiente.toString()}`
}
