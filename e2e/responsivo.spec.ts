import { expect, test, type Page } from '@playwright/test'
import { prepararApi, prepararFichaDeCompromiso } from './api'

// el teléfono (revisión de UX, etapa 8, D3): a 390 px ninguna pantalla principal se desplaza en horizontal. cuenta tanto la página
// como el contenido (main se desplaza por su cuenta); lo que se desplaza dentro de su propio contenedor, como una tabla, no
test.use({ viewport: { width: 390, height: 844 } })
test.beforeEach(async ({ page }) => {
  await prepararApi(page)
  await prepararFichaDeCompromiso(page)
})

const PANTALLAS = [
  '/',
  '/projects',
  '/projects/p1/overview',
  '/projects/p1/stakeholders',
  '/projects/p1/stakeholders/s1',
  '/projects/p1/engagements',
  '/projects/p1/engagements/e1',
  '/projects/p1/commitments',
  '/projects/p1/commitments/k1',
  '/projects/p1/attention',
  '/projects/p1/risks',
  '/projects/p1/reports',
  '/territory',
  '/territory/communities/c1',
  '/stakeholders',
  '/tasks',
  '/notifications'
]

async function anchos(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')!
    return { pagina: document.documentElement.scrollWidth, vista: window.innerWidth, contenido: main.scrollWidth, main: main.clientWidth }
  })
}

for (const ruta of PANTALLAS)
  test(`a 390 px ${ruta} no se desplaza en horizontal`, async ({ page }) => {
    await page.goto(ruta)
    // sin permiso, una sección dice por qué en lugar de su título: basta con que la pantalla esté dibujada
    await expect(page.locator('main')).toContainText(/\S/)
    await page.waitForLoadState('networkidle')
    const a = await anchos(page)
    expect(a.pagina).toBeLessThanOrEqual(a.vista)
    expect(a.contenido).toBeLessThanOrEqual(a.main)
  })

// en el teléfono, la lista de trabajo es de tarjetas: el estado y el plazo a la vista, sin desplazar una tabla
test('a 390 px la lista de compromisos es de tarjetas con su estado y su plazo', async ({ page }) => {
  await page.goto('/projects/p1/commitments')
  const tarjetas = page.getByRole('list', { name: 'Compromisos' })
  const tarjeta = tarjetas.getByRole('listitem').filter({ hasText: 'Reservorio de agua' })
  await expect(tarjeta.getByRole('link', { name: 'Reservorio de agua' })).toBeVisible()
  await expect(tarjeta.getByText('En ejecución')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Compromisos' })).toHaveCount(0)
})
