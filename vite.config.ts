import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import { contentSecurityPolicy } from './csp.ts'

const api = process.env.WASICHAI_API_URL ?? 'http://localhost:8094'
// configuración por despliegue (no código de src/): el rol de la jefatura del proyecto (ASM-080). el rol se lee de aquí para que ningún fuente del portal nombre un rol (RQ-SEC-005, boundaries.test.ts)
const rolJefatura = process.env.SGSPE_ROL_JEFATURA ?? 'PROJECT_MANAGER'
// el mapa base ya no se compila (spec F6 elección 9: llega por /map/settings); SGSPE_MAPA_BASE es la lista de URL del estilo y de
// los hosts que nombra, que solo abre la CSP
const mapaBase = process.env.SGSPE_MAPA_BASE ?? ''
// la CSP de security.md §3.2 en modo de solo informe (ADR-0020): en desarrollo la manda Vite; en producción, el proxy
const csp = { 'Content-Security-Policy-Report-Only': contentSecurityPolicy(readFileSync('index.html', 'utf8'), mapaBase) }

// maplibre y echarts solo bajan con la primera pantalla que los usa (dashboards.md §9.1, gis.md §6.5). los ids con `?`
// (main.tsx importa maplibre-gl-worker.mjs?worker&url) quedan fuera: esa constante es solo una URL y, dentro del chunk
// de maplibre, ataría la entrada a 1 MB que el portal no necesita
export function partirEnChunks(id: string): string | undefined {
  if (id.includes('?')) return undefined
  if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
  if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) return 'echarts'
  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __SGSPE_ROL_JEFATURA__: JSON.stringify(rolJefatura)
  },
  // @wasichai/sgspe-slides llega como TypeScript sin compilar y carga sus fuentes con new URL('../fonts/…', import.meta.url): en
  // desarrollo no se preempaqueta, para que esas URL sigan apuntando a los archivos del paquete (el build las emite como assets).
  // remotion sí, junto con el Player: así el paquete y el Player usan la misma copia (dos copias no comparten el fotograma)
  optimizeDeps: { exclude: ['@wasichai/sgspe-slides'], include: ['remotion', '@remotion/player'] },
  server: { port: 5182, strictPort: true, proxy: { '/api': api }, headers: csp },
  preview: { port: 5182, strictPort: true, proxy: { '/api': api }, headers: csp },
  build: {
    rollupOptions: {
      output: {
        manualChunks: partirEnChunks
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
