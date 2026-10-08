// el mapa pinta con los tokens del tema activo (design-system.md §9: los colores de ECharts y MapLibre se leen de las
// mismas variables). MapLibre lee hex y rgb(); un valor que el navegador no resuelve usa el respaldo
const RESPALDO = '#838b85'

export function colorDe(variable: string): string {
  if (typeof document === 'undefined') return RESPALDO
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return /^#|^rgb/.test(valor) ? valor : RESPALDO
}

// avisa cada vez que cambia el tema (data-theme de <html>); devuelve la función que deja de avisar
export function alCambiarTema(avisar: () => void): () => void {
  const observador = new MutationObserver(avisar)
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observador.disconnect()
}
