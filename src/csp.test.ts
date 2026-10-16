import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bootScript, contentSecurityPolicy, origenesDelMapa, scriptHash } from '../csp'
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

  // gis.md §6.4 y README de @wasichai/gis («Content-Security-Policy»): el estilo y los hosts que nombra entran en img-src y
  // connect-src; SGSPE_MAPA_BASE es una lista de URL separadas por espacios que solo lee yarn csp
  it('cada proveedor de la lista entra en img-src y connect-src, sin rutas ni repetidos', () => {
    const policy = contentSecurityPolicy(
      html,
      'https://mapas.example/estilos/apagado.json https://teselas.example/{z}/{x}/{y}.pbf https://mapas.example/sprite'
    )
    expect(policy).toContain("img-src 'self' data: blob: https://mapas.example https://teselas.example")
    expect(policy).toContain("connect-src 'self' https://mapas.example https://teselas.example")
    expect(policy).not.toContain('/estilos/')
  })

  it.each(['', '/estilos/local.json', 'http://inseguro.example/estilo.json', 'javascript:alert(1)'])('%j no agrega ningún origen', (mapa) => {
    expect(origenesDelMapa(mapa)).toEqual([])
    expect(contentSecurityPolicy(html, mapa)).toBe(contentSecurityPolicy(html))
  })

  it('una URL https mal formada falla nombrando SGSPE_MAPA_BASE', () => {
    expect(() => origenesDelMapa('https://bien.example/a https://')).toThrow(/SGSPE_MAPA_BASE/)
  })

  // plan 8.3, decisión 9: PdfDialog de @wasichai/ui dibuja el borrador en un iframe con una URL blob:, que default-src 'self'
  // bloquearía; ningún otro origen entra en frame-src
  it('la vista previa del PDF puede dibujar un blob en un marco', () => {
    expect(contentSecurityPolicy(html)).toContain("frame-src 'self' blob:")
  })
})
