import { expect, test, type Page } from '@playwright/test'
import { prepararApi, prepararFichaDeCompromiso } from './api'

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
    // el lema solo desde 1536 px (el 2xl de SGSPE es 1440 px)
    await expect(barra.getByText('Gestión social de proyectos extractivos')).toBeHidden()
    await barra.getByRole('button', { name: 'Su cuenta' }).click()
    const menu = page.getByRole('group', { name: 'Su cuenta' })
    await expect(menu.getByRole('combobox', { name: 'Idioma' })).toBeVisible()
    await expect(menu.getByRole('button', { name: /^Tema/ })).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
  })
})

// DD-10: desde lg (1024 px) la barra lateral está expandida, con las etiquetas y los títulos de bloque a la vista; «Contraer»
// la deja en íconos y se recuerda al recargar
test.describe('a 1024 px', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test('la navegación muestra las etiquetas y los títulos de bloque, y «Contraer» persiste al recargar', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Secciones' })
    await expect(nav.getByRole('link', { name: 'Proyectos' }).getByText('Proyectos')).toBeVisible()
    await expect(nav.getByText('Proyectos y territorio')).toBeVisible()
    await expect(nav.getByText('Trabajo con las comunidades')).toBeVisible()
    expect((await nav.boundingBox())!.width).toBeGreaterThan(200)
    await nav.getByRole('button', { name: 'Contraer' }).click()
    await expect(nav.getByRole('button', { name: 'Expandir' })).toBeVisible()
    expect((await nav.boundingBox())!.width).toBeLessThan(60)
    await page.reload()
    const otra = page.getByRole('navigation', { name: 'Secciones' })
    await expect(otra.getByRole('button', { name: 'Expandir' })).toBeVisible()
    expect((await otra.boundingBox())!.width).toBeLessThan(60)
    // contraída, la etiqueta y el título quedan solo para lectores de pantalla (sr-only: una caja de 1 px)
    expect((await otra.getByRole('link', { name: 'Proyectos' }).getByText('Proyectos').boundingBox())!.width).toBeLessThanOrEqual(1)
    expect((await otra.getByText('Proyectos y territorio').boundingBox())!.width).toBeLessThanOrEqual(1)
    await otra.getByRole('button', { name: 'Expandir' }).click()
    await expect(otra.getByText('Proyectos y territorio')).toBeVisible()
  })
})

// DD-03 y U-19: una sola fila de pestañas en el proyecto, y la pestaña activa nunca queda oculta: si la fila no cabe, se desplaza
// sola hasta ella. a 480 px las pestañas de Project 360 no caben, y Documentos es la última a la vista
test.describe('a 480 px', () => {
  test.use({ viewport: { width: 480, height: 900 } })

  test('la pestaña activa del proyecto queda a la vista y no hay una segunda fila', async ({ page }) => {
    await prepararFichaDeCompromiso(page)
    await page.goto('/projects/p1/documents')
    const fila = page.getByRole('navigation', { name: 'Secciones del proyecto' })
    const activa = fila.getByRole('link', { name: 'Documentos' })
    await expect(activa).toHaveAttribute('aria-current', 'page')
    // la fila desborda: hay a qué volver, y la activa entra entera en su caja
    await expect(page.getByRole('button', { name: 'Ver las secciones anteriores' })).toBeVisible()
    await expect
      .poll(async () => {
        const caja = (await fila.boundingBox())!
        const pestana = (await activa.boundingBox())!
        return pestana.x >= caja.x - 1 && pestana.x + pestana.width <= caja.x + caja.width + 1
      })
      .toBe(true)
    await expect(page.getByRole('navigation', { name: /^Vistas de/ })).toHaveCount(0)
  })
})
