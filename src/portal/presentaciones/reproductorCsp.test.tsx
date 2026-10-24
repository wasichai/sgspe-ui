import { Player } from '@remotion/player'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { contentSecurityPolicy, scriptHash } from '../../../csp'
import html from '../../../index.html?raw'

// security.md §3.2: style-src 'self' no deja pasar un <style> en línea. el Player de Remotion inyecta uno solo (su CSS de vista
// previa, makeDefaultPreviewCSS) y la CSP lo autoriza por su hash, como el script de arranque. si una subida de Remotion lo
// cambia, esta prueba falla antes que el navegador
const Vacia = () => null

afterEach(() => document.head.querySelectorAll('style').forEach((s) => s.remove()))

describe('el reproductor de presentaciones y la CSP', () => {
  it('todo <style> que inyecta el Player está autorizado por su hash en style-src', () => {
    const antes = new Set(document.head.querySelectorAll('style'))
    render(
      <Player
        component={Vacia}
        durationInFrames={90}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        acknowledgeRemotionLicense
        style={{ width: 640 }}
      />
    )
    const nuevos = [...document.head.querySelectorAll('style')].filter((s) => !antes.has(s))
    expect(nuevos.length).toBeGreaterThan(0)
    const estilos = /style-src ([^;]+)/.exec(contentSecurityPolicy(html))?.[1].split(' ') ?? []
    for (const estilo of nuevos) expect(estilos).toContain(scriptHash(estilo.textContent ?? ''))
    // y nada más se abre: ni 'unsafe-inline' ni otro origen
    expect(estilos).not.toContain("'unsafe-inline'")
  })
})
