import { createHash } from 'node:crypto'

// la política de security.md §3.2 para el portal y /admin, con el hash del único script en línea: el arranque de temas
// de index.html. Vite la manda en modo de solo informe (ADR-0020); en producción la pone el proxy, que la toma de
// `yarn csp` (ADR-0026). los proveedores del mapa base (SGSPE_MAPA_BASE, una lista de URL; gis.md §6.4) entran en img-src y connect-src

// el texto exacto del script en línea de index.html: lo que el navegador hashea
export function bootScript(html: string): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('index.html no tiene el script de arranque de temas')
  return match[1]
}

export function scriptHash(script: string): string {
  return `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`
}

// los orígenes del mapa base: SGSPE_MAPA_BASE es una lista de URL separadas por espacios (el estilo y los hosts de sus teselas,
// glifos y sprites, README de @wasichai/gis, «Content-Security-Policy»). una URL que no es https no abre nada (mismo origen o
// inválida); una https mal formada falla
export function origenesDelMapa(lista: string): string[] {
  const origenes = lista
    .split(/\s+/)
    .filter((url) => /^https:\/\//.test(url))
    .map((url) => {
      try {
        return new URL(url).origin
      } catch {
        throw new Error(`SGSPE_MAPA_BASE no es una lista de URL válidas: ${url}`)
      }
    })
  return [...new Set(origenes)]
}

export function contentSecurityPolicy(html: string, mapaBase = ''): string {
  const origenes = origenesDelMapa(mapaBase)
  const externo = origenes.length > 0 ? ` ${origenes.join(' ')}` : ''
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHash(bootScript(html))}`,
    "style-src 'self'",
    `img-src 'self' data: blob:${externo}`,
    `connect-src 'self'${externo}`,
    "worker-src 'self' blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
}
