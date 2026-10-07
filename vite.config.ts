import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const api = process.env.WASICHAI_API_URL ?? 'http://localhost:8094'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5182, strictPort: true, proxy: { '/api': api } },
  preview: { port: 5182, strictPort: true, proxy: { '/api': api } },
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
