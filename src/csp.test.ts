import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bootScript, contentSecurityPolicy, scriptHash } from '../csp'
import html from '../index.html?raw'
import config from '../vite.config'

// security.md §3.2 y ADR-0020: el script de arranque de temas es el único script en línea y la CSP lo autoriza por su hash;
// en desarrollo la manda Vite en modo de solo informe
describe('CSP', () => {
  it('autoriza el script de arranque por su hash y nada más en línea', () => {
    const policy = contentSecurityPolicy(html)
    expect(policy).toContain(`script-src 'self' ${scriptHash(bootScript(html))}`)
    expect(policy).not.toContain('unsafe-inline')
    expect(policy).toContain("frame-ancestors 'none'")
    // todo script en línea, con o sin atributos; los externos (con src) no cuentan
    expect(html.match(/<script(?![^>]*\bsrc=)/g)).toHaveLength(1)
  })

  it('no nombra ningún host externo: todo es del mismo origen', () => {
    const policy = contentSecurityPolicy(html)
    expect(policy).not.toMatch(/https?:|\*/)
    expect(policy).toContain("font-src 'self'")
    expect(policy).toContain("style-src 'self'")
  })

  it('el ícono de la pestaña es un archivo del mismo origen, que la CSP deja pasar', () => {
    const href = /<link rel="icon"[^>]*href="([^"]+)"/.exec(html)?.[1]
    expect(href).toBe('/favicon.svg')
    expect(existsSync(`public${href}`)).toBe(true)
    expect(contentSecurityPolicy(html)).toMatch(/img-src 'self'/)
  })

  it('el hash cambia si cambia el script', () => {
    expect(scriptHash('a')).not.toBe(scriptHash('b'))
    expect(scriptHash('a')).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/)
  })

  it('Vite la manda en modo de solo informe, en dev y en preview', () => {
    expect(config.server?.headers?.['Content-Security-Policy-Report-Only']).toBe(contentSecurityPolicy(html))
    expect(config.preview?.headers?.['Content-Security-Policy-Report-Only']).toBe(contentSecurityPolicy(html))
  })
})
