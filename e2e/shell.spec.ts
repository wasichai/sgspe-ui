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

// Civic Modern (ux-architecture.md §7.1, design-system.md §5.2): desde lg, la navegación principal es horizontal bajo la cabecera,
// con un desplegable por bloque («disclosure navigation»: Enter o flecha abajo, flechas, Esc devuelve el foco); en un proyecto, la
// navegación local es una columna de 248 px
test.describe('a 1024 px', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test('la navegación principal es horizontal y cada bloque se abre y se recorre con el teclado', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Secciones', exact: true })
    await expect(nav).toBeVisible()
    await expect(page.getByRole('banner').getByRole('button', { name: 'Menú' })).toBeHidden()
    const bloque = nav.getByRole('button', { name: 'Proyectos y territorio' })
    await expect(bloque).toBeVisible()
    // una fila: la navegación mide lo que su token (52 px)
    expect((await nav.boundingBox())!.height).toBeLessThanOrEqual(54)
    // y cabe en el ancho: la página no se desplaza en horizontal
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await bloque.focus()
    await page.keyboard.press('ArrowDown')
    await expect(nav.getByRole('link', { name: 'Proyectos' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(nav.getByRole('link', { name: 'Territorio' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(bloque).toBeFocused()
    await expect(nav.getByRole('link', { name: 'Territorio' })).toBeHidden()
  })

  test('en un proyecto, la navegación local es una columna de 248 px con «Más» como rótulo', async ({ page }) => {
    await prepararFichaDeCompromiso(page)
    await page.goto('/projects/p1/documents')
    const local = page.getByRole('navigation', { name: 'Secciones del proyecto' })
    await expect(local.getByRole('link', { name: 'Documentos' })).toHaveAttribute('aria-current', 'page')
    expect(Math.round((await local.boundingBox())!.width)).toBe(248)
    await expect(local.getByRole('group', { name: 'Más secciones del proyecto' }).getByRole('link', { name: 'Equipo y parámetros' })).toBeVisible()
    await expect(local.getByRole('button', { name: 'Más secciones del proyecto' })).toBeHidden()
  })
})

// en tableta (768–1023) la navegación local es una fila de pestañas de 48 px y la activa nunca queda oculta: si la fila no cabe,
// se desplaza sola hasta ella (DD-03, U-19). sin segunda fila de vistas
test.describe('a 800 px', () => {
  test.use({ viewport: { width: 800, height: 900 } })

  test('la pestaña activa del proyecto queda a la vista y no hay una segunda fila', async ({ page }) => {
    await prepararFichaDeCompromiso(page)
    await page.goto('/projects/p1/documents')
    const fila = page.getByRole('navigation', { name: 'Secciones del proyecto' })
    const activa = fila.getByRole('link', { name: 'Documentos' })
    await expect(activa).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('button', { name: 'Ver las secciones anteriores' })).toBeVisible()
    await expect
      .poll(async () => {
        const caja = (await fila.boundingBox())!
        const pestana = (await activa.boundingBox())!
        return pestana.x >= caja.x - 1 && pestana.x + pestana.width <= caja.x + caja.width + 1
      })
      .toBe(true)
    await expect(page.getByRole('navigation', { name: /^Vistas de/ })).toHaveCount(0)
    // «Más» es un desplegable
    await fila.getByRole('button', { name: 'Más secciones del proyecto' }).click()
    await expect(fila.getByRole('group', { name: 'Más secciones del proyecto' }).getByRole('link', { name: 'Equipo y parámetros' })).toBeVisible()
  })
})

// en el teléfono: cabecera de 56 px, la barra inferior de cinco destinos de 64 px y la navegación local tras un botón
test.describe('a 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('la barra inferior tiene cinco destinos y la sección del proyecto se elige desde su botón', async ({ page }) => {
    await prepararFichaDeCompromiso(page)
    await page.goto('/projects/p1/documents')
    const barra = page.getByRole('navigation', { name: 'Accesos rápidos' })
    await expect(barra).toBeVisible()
    expect(Math.round((await barra.boundingBox())!.height)).toBe(64)
    // 56 px más la franja de 4
    expect(Math.round((await page.getByRole('banner').boundingBox())!.height)).toBe(60)
    // los cinco, siempre en su lugar: un destino sin su sección queda deshabilitado, no desaparece
    await expect(barra.locator(':scope > *')).toHaveText(['Inicio', 'Proyectos', 'Registrar', 'Mapa', 'Tareas'])
    await expect(barra.getByRole('link', { name: 'Proyectos' })).toBeVisible()
    const local = page.getByRole('navigation', { name: 'Secciones del proyecto' })
    await expect(local.getByRole('link', { name: 'Documentos' })).toBeHidden()
    await local.getByRole('button', { name: 'Sección del proyecto: Documentos' }).click()
    await local.getByRole('link', { name: 'Mapa' }).click()
    await expect(page).toHaveURL(/\/projects\/p1\/map$/)
  })
})
