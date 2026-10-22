import { expect, test, type Page } from '@playwright/test'
import { prepararApi } from './api'

// el shell del rediseño de UX (fase 3 del plan, DD-09 y DD-10) en un navegador de verdad: lo que jsdom no puede comprobar
// porque depende de las media queries del CSS compilado (qué se ve a cada ancho) y de la recarga de la página
test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

// la IA y la bandeja de avisos responden: así Preguntar y la campana se dibujan, como en un despliegue con F7 y F3
async function conIaYAvisos(page: Page) {
  await page.route('**/api/sgspe/ai/status', (r) => r.fulfill({ json: { enabled: true, providerAvailable: true, useCases: ['AI-05'] } }))
  const vacio = { active: 0, unread: 0, overdue: 0 }
  await page.route('**/api/auth/me/notifications/summary', (r) => r.fulfill({ json: { kinds: { ACTION: vacio, WARNING: vacio, INFO: vacio }, latest: null } }))
}

// los controles de la barra que se ven (con caja y sin visibility: hidden)
const controlesVisibles = (page: Page) =>
  page
    .getByRole('banner')
    .locator('a, button, select, input, [role="combobox"]')
    .evaluateAll(
      (els) =>
        els.filter((e) => {
          const caja = e.getBoundingClientRect()
          return caja.width > 0 && caja.height > 0 && getComputedStyle(e).visibility !== 'hidden'
        }).length
    )

test.describe('a 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('la barra superior tiene seis controles; el idioma, el tema y la salida están en el menú de la cuenta', async ({ page }) => {
    await conIaYAvisos(page)
    await page.goto('/')
    const barra = page.getByRole('banner')
    await expect(barra.getByRole('button', { name: 'Preguntar' })).toBeVisible()
    await expect(barra.getByRole('button', { name: /^Avisos/ })).toBeVisible()
    await expect(barra.getByRole('combobox', { name: 'Proyecto' })).toBeVisible()
    expect(await controlesVisibles(page)).toBe(6)
    // el lema solo desde 2xl (1536 px)
    await expect(barra.getByText('Gestión social de proyectos extractivos')).toBeHidden()
    await barra.getByRole('button', { name: 'Su cuenta' }).click()
    const menu = page.getByRole('group', { name: 'Su cuenta' })
    await expect(menu.getByRole('combobox', { name: 'Idioma' })).toBeVisible()
    await expect(menu.getByRole('button', { name: /^Tema/ })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
  })
})
