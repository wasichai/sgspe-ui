import { createHash } from 'node:crypto'

// la política de security.md §3.2 para el portal y /admin, con el hash del único script en línea: el arranque de temas
// de index.html. Vite la manda en modo de solo informe (ADR-0020); en producción la pone el proxy, que la toma de
// `yarn csp` (ADR-0026). el proveedor del mapa base entra en img-src y connect-src cuando llegue el mapa, en F2

// el texto exacto del script en línea de index.html: lo que el navegador hashea
export function bootScript(html: string): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html)
  if (!match) throw new Error('index.html no tiene el script de arranque de temas')
  return match[1]
}

export function scriptHash(script: string): string {
  return `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`
}

export function contentSecurityPolicy(html: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHash(bootScript(html))}`,
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
}
