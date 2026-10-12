import { afterEach, describe, expect, it, vi } from 'vitest'

// la configuración se evalúa al importarla: cada caso fija WASICHAI_API_URL antes de cargarla, de modo que la prueba no
// depende de lo que haya en el shell de quien la corre
async function cargar(api: string | undefined) {
  vi.resetModules()
  vi.stubEnv('WASICHAI_API_URL', api)
  return (await import('../vite.config')).default
}

afterEach(() => vi.unstubAllEnvs())

// ADR-0026: Vite sirve en el 5182 y reenvía /api al backend en el 8094; mismo origen, sin CORS
describe('vite.config', () => {
  it('sirve en 5182 y reenvía /api al backend en 8094', async () => {
    const config = await cargar(undefined)
    expect(config.server?.port).toBe(5182)
    expect(config.server?.strictPort).toBe(true)
    expect(config.server?.proxy).toEqual({ '/api': 'http://localhost:8094' })
    expect(config.preview?.port).toBe(5182)
    expect(config.preview?.proxy).toEqual({ '/api': 'http://localhost:8094' })
  })

  it('WASICHAI_API_URL cambia el destino del proxy', async () => {
    const config = await cargar('http://otro-backend.test:9000')
    expect(config.server?.proxy).toEqual({ '/api': 'http://otro-backend.test:9000' })
    expect(config.preview?.proxy).toEqual({ '/api': 'http://otro-backend.test:9000' })
  })

  // ASM-080: la jefatura es configuración del despliegue; el mapa base ya no se compila (spec F6 elección 9): llega por
  // /map/settings, y SGSPE_MAPA_BASE solo abre la CSP
  it('define el rol de la jefatura, con su valor por defecto, y ya no el mapa base', async () => {
    vi.stubEnv('SGSPE_ROL_JEFATURA', undefined)
    vi.stubEnv('SGSPE_MAPA_BASE', undefined)
    const config = await cargar(undefined)
    expect(config.define).toEqual({ __SGSPE_ROL_JEFATURA__: JSON.stringify('PROJECT_MANAGER') })
  })

  it('SGSPE_ROL_JEFATURA lo cambia y SGSPE_MAPA_BASE abre la CSP', async () => {
    vi.stubEnv('SGSPE_ROL_JEFATURA', 'OTRO_ROL')
    vi.stubEnv('SGSPE_MAPA_BASE', 'https://mapas.example/estilo.json')
    const config = await cargar(undefined)
    expect(config.define?.__SGSPE_ROL_JEFATURA__).toBe('"OTRO_ROL"')
    expect(config.server?.headers?.['Content-Security-Policy-Report-Only']).toContain('https://mapas.example')
  })

  // decisión 15: MapLibre y ECharts bajan con el primer mapa o gráfico; el módulo ?worker&url que importa main.tsx no
  // puede meterse en su chunk, porque ataría la entrada a él
  it('parte maplibre y echarts en chunks, pero no los módulos con ? como el del worker', async () => {
    await cargar(undefined)
    const { partirEnChunks } = await import('../vite.config')
    expect(partirEnChunks('/x/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url')).toBeUndefined()
    expect(partirEnChunks('/x/node_modules/maplibre-gl/dist/maplibre-gl.js')).toBe('maplibre')
    expect(partirEnChunks('/x/node_modules/echarts/lib/echarts.js')).toBe('echarts')
    expect(partirEnChunks('/x/node_modules/zrender/lib/zrender.js')).toBe('echarts')
    expect(partirEnChunks('/x/src/main.tsx')).toBeUndefined()
  })
})
