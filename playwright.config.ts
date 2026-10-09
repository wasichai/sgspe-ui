import { defineConfig, devices } from '@playwright/test'

// las pruebas extremo a extremo de F2 (ASM-066, design-system.md §9): los recorridos del hilo de contexto sobre la build
// de producción servida por vite preview, con la API simulada en el navegador (e2e/api.ts): no necesitan el backend
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5182',
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
    // las medidas del gráfico no dependen de la animación de ECharts (GraficoImpl.tsx la apaga con reduced-motion)
    reducedMotion: 'reduce'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'yarn build && yarn preview', url: 'http://localhost:5182/login', reuseExistingServer: !process.env.CI, timeout: 180_000 }
})
