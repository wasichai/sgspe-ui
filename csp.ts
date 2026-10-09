import { createHash } from 'node:crypto'

// la política de security.md §3.2 para el portal y /admin, con el hash del único script en línea: el arranque de temas
// de index.html. Vite la manda en modo de solo informe (ADR-0020); en producción la pone el proxy, que la toma de
// `yarn csp` (ADR-0026). el proveedor del mapa base (SGSPE_MAPA_BASE, gis.md §6.4) entra en img-src y connect-src

// el texto exacto del script en línea de index.html: lo que el navegador hashea
export function bootScript(html: string): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('index.html no tiene el script de arranque de temas')
  return match[1]
}

export function scriptHash(script: string): string {
  return `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`
}

// el origen del estilo del mapa base, o nada: una URL relativa o vacía es del mismo origen
export function origenDelMapa(mapaBase: string): string | null {
  if (!/^https:\/\//.test(mapaBase)) return null
  try {
    return new URL(mapaBase).origin
  } catch {
    throw new Error(`SGSPE_MAPA_BASE no es una URL válida: ${mapaBase}`)
  }
}

export function contentSecurityPolicy(html: string, mapaBase = ''): string {
  const mapa = origenDelMapa(mapaBase)
  const externo = mapa ? ` ${mapa}` : ''
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
