import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import { contentSecurityPolicy } from './csp.ts'

const api = process.env.WASICHAI_API_URL ?? 'http://localhost:8094'
// la CSP de security.md §3.2 en modo de solo informe (ADR-0020): en desarrollo la manda Vite; en producción, el proxy
const csp = { 'Content-Security-Policy-Report-Only': contentSecurityPolicy(readFileSync('index.html', 'utf8')) }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5182, strictPort: true, proxy: { '/api': api }, headers: csp },
  preview: { port: 5182, strictPort: true, proxy: { '/api': api }, headers: csp },
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
