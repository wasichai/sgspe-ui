import { defineConfig, devices } from '@playwright/test'

// las pruebas extremo a extremo de F2 (ASM-066, design-system.md §9): los recorridos del hilo de contexto sobre la build
// de producción servida por vite preview, con la API simulada en el navegador (e2e/api.ts): no necesitan el backend.
// el puerto es 5182 salvo que SGSPE_E2E_PORT diga otro (vite.config.ts lo lee también para vite preview): así las pruebas
// corren junto a un servidor de desarrollo vivo en 5182 sin reutilizarlo (reuseExistingServer fuera de la CI)
const puerto = Number(process.env.SGSPE_E2E_PORT ?? 5182)
const base = `http://localhost:${puerto}`

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: base,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
    // las medidas del gráfico no dependen de la animación de ECharts (GraficoImpl.tsx la apaga con reduced-motion)
    reducedMotion: 'reduce'
  },
  projects: [
    // yarn e2e: todas las pruebas de e2e/ menos las capturas
    { name: 'chromium', testIgnore: /[\/]capturas[\/]/, use: { ...devices['Desktop Chrome'] } },
    // yarn capturas (wasichai/sgspe-ui#88): las fotos del rediseño, que no son pruebas y no corren con yarn e2e
    { name: 'capturas', testDir: 'e2e/capturas', retries: 0, use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: { command: 'yarn build && yarn preview', url: `${base}/login`, reuseExistingServer: !process.env.CI, timeout: 180_000 }
})
