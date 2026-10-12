// el mapa pinta con los tokens del tema activo (design-system.md §9: los colores de ECharts y MapLibre se leen de las
// mismas variables). MapLibre lee hex y rgb(); un valor que el navegador no resuelve usa el token neutro de respaldo, y
// 'gray' solo si ni siquiera hay hoja de tokens
const TOKEN_DE_RESPALDO = '--sg-data-6'

const leer = (variable: string): string | null => {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return /^#|^rgb/.test(valor) ? valor : null
}

// un color de la paleta (hex) se usa tal cual; un token --sg-* se lee del tema activo
export function colorDe(variable: string): string {
  if (/^#[0-9a-f]{3,8}$/i.test(variable)) return variable
  if (typeof document === 'undefined') return 'gray'
  return leer(variable) ?? leer(TOKEN_DE_RESPALDO) ?? 'gray'
}

// avisa cada vez que cambia el tema: el atributo data-theme de <html> o, sin él, la preferencia del sistema
// (prefers-color-scheme, que tokens.css también usa); devuelve la función que deja de avisar
export function alCambiarTema(avisar: () => void): () => void {
  const observador = new MutationObserver(avisar)
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const sistema = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  sistema?.addEventListener('change', avisar)
  return () => {
    observador.disconnect()
    sistema?.removeEventListener('change', avisar)
  }
}
