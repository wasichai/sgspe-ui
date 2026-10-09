import { expect, test } from '@playwright/test'
import { prepararApi } from './api'

// el hilo de contexto (ux-architecture.md §8, flujo 17): del lugar en el mapa a sus grupos de interés, a la interacción,
// sin perder el proyecto ni el territorio, y con vuelta atrás por el rastro (ASM-066)
test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('del mapa territorial a la interacción, con el chip de territorio y el rastro', async ({ page }) => {
  await page.goto('/territory?project=p1')
  const lugares = page.getByRole('navigation', { name: 'Lugares visibles' })
  await lugares.getByRole('link', { name: 'CC Tunas Pampa' }).click()
  await expect(page).toHaveURL(/\/territory\/communities\/c1\?project=p1$/)
  await expect(page.getByRole('heading', { name: 'CC Tunas Pampa', level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Recorrido' }).getByRole('link', { name: 'Mapa territorial' })).toBeVisible()

  await page.getByRole('link', { name: 'Trabajar en el proyecto con este lugar' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/stakeholders\?territory=community%3Ac1$/)
  const contexto = page.getByRole('navigation', { name: 'Contexto' })
  await expect(contexto.getByText('PRJ-01 · Pukaqaqa')).toBeVisible()
  await expect(contexto.getByText('Territorio: Comunidad CC Tunas Pampa')).toBeVisible()

  await page.goto('/projects/p1/stakeholders/s1')
  await expect(page.getByRole('heading', { name: 'Junta directiva comunal', level: 1 })).toBeVisible()
  await page.getByRole('complementary', { name: 'Qué generó' }).getByRole('link', { name: 'Asamblea de agosto' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/engagements\/e1$/)
  await expect(page.getByRole('heading', { name: 'Asamblea de agosto', level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Contexto' }).getByText('PRJ-01 · Pukaqaqa')).toBeVisible()
})

test('quitar el chip de territorio devuelve el proyecto entero sin cambiar de pantalla', async ({ page }) => {
  await page.goto('/projects/p1/stakeholders?territory=community:c1')
  await page.getByRole('button', { name: 'Quitar el filtro de territorio' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/stakeholders$/)
  await expect(page.getByRole('table', { name: 'Grupos de interés' })).toBeVisible()
})

test('el selector de proyecto monta la misma sección con el otro alcance (ASM-076)', async ({ page }) => {
  await page.goto('/stakeholders')
  await expect(page.getByRole('columnheader', { name: 'Proyecto' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Proyecto' }).selectOption('p1')
  await expect(page).toHaveURL(/\/projects\/p1\/stakeholders$/)
  await expect(page.getByRole('columnheader', { name: 'Proyecto' })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Proyecto' }).selectOption('')
  await expect(page).toHaveURL(/\/stakeholders$/)
})

test('el mapa territorial dibuja con MapLibre sin pedir teselas externas', async ({ page, baseURL }) => {
  const externas: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!)) externas.push(r.url())
  })
  await page.goto('/territory')
  await expect(page.getByRole('region', { name: 'Mapa territorial' }).locator('canvas')).toBeVisible()
  // MapLibre pide teselas y fuentes después del primer dibujo: se espera a que la red quede en reposo y a que el mapa
  // asiente (no expone un evento al exterior) antes de afirmar
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  expect(externas).toEqual([])
})
