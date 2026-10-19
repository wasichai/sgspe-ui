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
  await expect(tarjeta.getByRole('link', { name: 'Reservorio de agua', exact: true })).toBeVisible()
  await expect(tarjeta.getByText('En ejecución')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Compromisos' })).toHaveCount(0)
})

// en el teléfono, las acciones de la ficha quedan en una barra fija sobre la barra de accesos: a mano mientras se lee
test('a 390 px las acciones de la ficha van en una barra fija sobre la barra de accesos', async ({ page }) => {
  await page.goto('/projects/p1/commitments/k1')
  await expect(page.getByRole('heading', { name: 'Reservorio de agua', level: 1 })).toBeVisible()
  const barra = page.locator('[data-barra-de-acciones]')
  await expect(barra.getByRole('link', { name: 'Ver en el mapa' })).toBeVisible()
  expect(await barra.evaluate((e) => getComputedStyle(e).position)).toBe('fixed')
  const accesos = (await page.getByRole('navigation', { name: 'Accesos' }).boundingBox())!
  const caja = (await barra.boundingBox())!
  expect(caja.y + caja.height).toBeLessThanOrEqual(accesos.y + 1)
  // desplazarse hasta el final no la mueve
  await page.locator('main').evaluate((m) => m.scrollTo(0, m.scrollHeight))
  expect((await barra.boundingBox())!.y).toBeCloseTo(caja.y, 0)
})

// las demás listas también son de tarjetas en el teléfono
for (const [ruta, lista, titulo] of [
  ['/projects/p1/stakeholders', 'Grupos de interés', 'Junta directiva comunal'],
  ['/projects', 'Proyectos', 'Pukaqaqa'],
  ['/projects/p1/engagements?view=lista', 'Relacionamiento', 'Asamblea de agosto']
] as const)
  test(`a 390 px ${ruta} es una lista de tarjetas`, async ({ page }) => {
    await page.goto(ruta)
    const tarjetas = page.getByRole('list', { name: lista })
    await expect(tarjetas.getByRole('listitem').filter({ hasText: titulo }).first()).toBeVisible()
    await expect(page.getByRole('table', { name: lista })).toHaveCount(0)
  })
