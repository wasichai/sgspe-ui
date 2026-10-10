import { expect, test, type Page } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// el alcance de lectura por proyecto en un navegador de verdad (plan 4.4b): el selector con «Todos los proyectos» para quien lee
// todos, el aviso de una cuenta sin proyectos y un aviso que lleva a un registro que la cuenta no lee. la API se simula como en
// f4.spec.ts: estas rutas se registran después de las comunes y les ganan
const A = registro('pa', { code: 'PRJ-A', name: 'Proyecto Ejemplo A' }, 'active')
const B = registro('pb', { code: 'PRJ-B', name: 'Proyecto Ejemplo B' }, 'active')

async function conAlcance(page: Page, objetos: Record<string, string[]>, proyectos: unknown[]) {
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route('**/api/**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const ruta = new URL(route.request().url()).pathname.replace(/^\/api/, '')
    if (ruta === '/auth/me/permissions') return route.fulfill(json({ admin: false, objects: objetos }))
    if (ruta === '/objects/project/records') return route.fulfill(json(pagina(proyectos)))
    if (ruta === '/objects/project_assignment/records') return route.fulfill(json(pagina([])))
    if (ruta === '/objects/commitment/records/c9') return route.fulfill(json({ title: 'Not Found', status: 404 }, 404))
    return route.fallback()
  })
}

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('quien lee todos los proyectos ve «Todos los proyectos» por defecto y todos los proyectos', async ({ page }) => {
  await conAlcance(page, { project: ['READ', 'READ_ALL_PROJECTS'], project_assignment: ['READ'] }, [A, B])
  await page.goto('/projects')
  const selector = page.getByRole('combobox', { name: 'Proyecto' })
  await expect(selector).toHaveValue('')
  await expect(selector.locator('option')).toHaveText(['Todos los proyectos', 'PRJ-A · Proyecto Ejemplo A', 'PRJ-B · Proyecto Ejemplo B'])
})

test('una cuenta sin proyectos asignados lo dice en lugar de un selector vacío', async ({ page }) => {
  await conAlcance(page, { project: ['READ'], project_assignment: ['READ'] }, [])
  await page.goto('/projects')
  await expect(page.getByText('No tiene proyectos asignados. Pida una asignación al administrador de proyectos.').first()).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Proyecto' })).toHaveCount(0)
})

test('un aviso que lleva a un registro que la cuenta no lee dice «Registro reservado» y no salta', async ({ page }) => {
  await conAlcance(page, { project: ['READ'], project_assignment: ['READ'], commitment: ['READ'] }, [A])
  await page.goto('/r/commitment/c9')
  await expect(page.getByText('Registro reservado')).toBeVisible()
  await expect(page.getByText(/Su cuenta no lee este registro/)).toBeVisible()
  await expect(page).toHaveURL(/\/r\/commitment\/c9$/)
})
