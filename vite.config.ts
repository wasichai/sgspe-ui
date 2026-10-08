import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import { contentSecurityPolicy } from './csp.ts'

const api = process.env.WASICHAI_API_URL ?? 'http://localhost:8094'
// configuración por despliegue (no código de src/): el rol de la jefatura del proyecto (ASM-080) y el estilo del mapa base
// (gis.md §6.4). el rol se lee de aquí para que ningún fuente del portal nombre un rol (RQ-SEC-005, boundaries.test.ts)
const rolJefatura = process.env.SGSPE_ROL_JEFATURA ?? 'PROJECT_MANAGER'
const mapaBase = process.env.SGSPE_MAPA_BASE ?? ''
// la CSP de security.md §3.2 en modo de solo informe (ADR-0020): en desarrollo la manda Vite; en producción, el proxy
const csp = { 'Content-Security-Policy-Report-Only': contentSecurityPolicy(readFileSync('index.html', 'utf8'), mapaBase) }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __SGSPE_ROL_JEFATURA__: JSON.stringify(rolJefatura),
    __SGSPE_MAPA_BASE__: JSON.stringify(mapaBase)
  },
  server: { port: 5182, strictPort: true, proxy: { '/api': api }, headers: csp },
  preview: { port: 5182, strictPort: true, proxy: { '/api': api }, headers: csp },
  build: {
    rollupOptions: {
      output: {
        // maplibre y echarts solo bajan con la primera pantalla que los usa (dashboards.md §9.1, gis.md §6.5)
        manualChunks: (id) =>
          id.includes('node_modules/maplibre-gl')
            ? 'maplibre'
            : id.includes('node_modules/echarts') || id.includes('node_modules/zrender')
              ? 'echarts'
              : undefined
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    // con carga (CI, varias suites a la vez) una pantalla entera pasa los 5 s de vitest sin nada malo: 15 s
    testTimeout: 15000,
    hookTimeout: 15000
  }
})
