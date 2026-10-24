import { expect, test } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// P-03, la ficha 360 del proyecto (rediseño de UX, área 4.2), en un navegador de verdad: lo que jsdom no ve porque depende del
// CSS compilado (la franja de cifras en una fila, el subrayado que de verdad se dibuja)
const indicador = (code: string, value: number, unit: string) => ({ code, label: code, available: true, value, unit })
const TABLERO = {
  dashboard: 'project',
  computedAt: '2026-10-05T15:00:00Z',
  filters: { project: ['p1'] },
  indicators: [
    indicador('KPI-STK-01', 42, 'grupos de interés'),
    indicador('KPI-ENG-01', 7, 'interacciones'),
    indicador('KPI-COM-02', 6, 'compromisos'),
    indicador('KPI-COM-03', 3, 'compromisos'),
    indicador('KPI-COM-04', 2, 'compromisos'),
    indicador('KPI-COM-06', 1, 'compromisos'),
    indicador('KPI-GRV-01', 5, 'QCS'),
    indicador('KPI-GRV-02', 4, 'quejas'),
    indicador('KPI-GRV-06', 1, 'QCS'),
    indicador('KPI-RSK-01', 0, 'riesgos')
  ]
}
const AREAS = ['AIDS', 'AIDI', 'AIS', 'AII'].map((tipo, n) => registro(`a${n}`, { project: 'p1', area_type: tipo, version_number: n + 1 }, 'approved'))

test.use({ viewport: { width: 1440, height: 900 } })
test.beforeEach(async ({ page }) => {
  await prepararApi(page)
  await page.route('**/api/sgspe/dashboards/project**', (r) => r.fulfill({ json: TABLERO }))
  await page.route(/\/api\/objects\/area_of_influence\/records(\?|$)/, (r) => r.fulfill({ json: pagina(AREAS) }))
})

test('la franja lleva las cinco cifras en una fila y tiñe solo la que pide acción', async ({ page }) => {
  await page.goto('/projects/p1/overview')
  const franja = page.getByRole('region', { name: 'Salud del proyecto' })
  const cifras = franja.getByRole('group')
  await expect(cifras).toHaveCount(5)
  await expect(franja.getByRole('link', { name: 'Compromisos vencidos: 3' })).toBeVisible()
  const filas = new Set(await cifras.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top))))
  expect(filas.size).toBe(1)
  // los compromisos vencidos piden acción; los riesgos altos en cero, no
  const color = (nombre: string) => franja.getByRole('link', { name: nombre }).evaluate((e) => getComputedStyle(e).color)
  const neutro = await color('Grupos de interés vigentes: 42')
  expect(await color('Compromisos vencidos: 3')).not.toBe(neutro)
  expect(await color('Riesgos altos: 0')).toBe(neutro)
  await expect(franja.getByText('Pide acción')).toHaveCount(1)
})

test('ningún enlace de las listas ni de los accesos del resumen se dibuja subrayado', async ({ page }) => {
  await page.goto('/projects/p1/overview')
  const areas = page.getByRole('region', { name: 'Áreas de influencia vigentes' })
  await expect(areas.getByRole('listitem')).toHaveCount(4)
  await expect(page.getByRole('link', { name: 'Ver el tablero de compromisos' })).toBeVisible()
  const subrayados = await page
    .locator('main section a')
    .evaluateAll((els) => els.filter((e) => getComputedStyle(e).textDecorationLine.includes('underline')).map((e) => e.textContent))
  expect(subrayados).toEqual([])
})
