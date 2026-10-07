import { describe, expect, it } from 'vitest'
import config from '../vite.config'

// ADR-0026: Vite sirve en el 5182 y reenvía /api al backend en el 8094; mismo origen, sin CORS
describe('vite.config', () => {
  it('sirve en 5182 y reenvía /api al backend en 8094', () => {
    expect(config.server?.port).toBe(5182)
    expect(config.server?.strictPort).toBe(true)
    expect(config.server?.proxy).toEqual({ '/api': 'http://localhost:8094' })
    expect(config.preview?.port).toBe(5182)
    expect(config.preview?.proxy).toEqual({ '/api': 'http://localhost:8094' })
  })
})
