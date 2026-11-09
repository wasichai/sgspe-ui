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
  // Civic Modern (S05): cada cifra es una celda con nombre de la RejillaDeKpi
  const cifras = franja.getByRole('region')
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
  // S05: las áreas en una tabla compacta con su estado
  const areas = page.getByRole('region', { name: 'Áreas de influencia' })
  await expect(areas.getByRole('row')).toHaveCount(4)
  await expect(page.getByRole('link', { name: 'Ver el tablero de compromisos' })).toBeVisible()
  const subrayados = await page
    .locator('main section a')
    .evaluateAll((els) => els.filter((e) => getComputedStyle(e).textDecorationLine.includes('underline')).map((e) => e.textContent))
  expect(subrayados).toEqual([])
})

// #118: a 1440 px las dos columnas del resumen terminan a la misma altura: la actividad reciente ocupa el alto que deja la
// columna derecha, sin mover nada de sitio. el orden del DOM (y del foco) sigue siendo el de lectura: la columna izquierda entera y
// después la derecha; a 1024 px, una sola columna, cada panel con su alto
const PANELES = ['Qué requiere atención', 'Actividad reciente', 'Paisaje de grupos de interés', 'Reuniones al mes frente a la meta', 'Áreas de influencia']
const columnas = (page: import('@playwright/test').Page) =>
  page.locator('main').evaluate((main, nombres) => {
    const secciones = [...main.querySelectorAll('section')].filter((s) => nombres.some((n) => s.querySelector('h2')?.textContent?.startsWith(n)))
    return secciones.map((s) => {
      const caja = s.getBoundingClientRect()
      return {
        titulo: nombres.find((n) => s.querySelector('h2')!.textContent!.startsWith(n))!,
        x: Math.round(caja.left),
        arriba: caja.top,
        abajo: caja.bottom,
        alto: caja.height
      }
    })
  }, PANELES)

test('a 1440 px las dos columnas del resumen terminan a la misma altura, en el orden de lectura', async ({ page }) => {
  await page.goto('/projects/p1/overview')
  await expect(page.getByRole('region', { name: 'Áreas de influencia' }).getByRole('row')).toHaveCount(4)
  await page.waitForLoadState('networkidle')
  const paneles = await columnas(page)
  expect(paneles.map((p) => p.titulo)).toEqual(PANELES)
  const [izquierda, derecha] = [paneles.filter((p) => p.x === paneles[0].x), paneles.filter((p) => p.x !== paneles[0].x)]
  expect(izquierda.map((p) => p.titulo)).toEqual(PANELES.slice(0, 2))
  expect(derecha.map((p) => p.titulo)).toEqual(PANELES.slice(2))
  expect(Math.abs(izquierda.at(-1)!.abajo - derecha.at(-1)!.abajo)).toBeLessThanOrEqual(2)
})

test.describe('a 1024 px', () => {
  test.use({ viewport: { width: 1024, height: 768 } })
  test('el resumen es una sola columna y la actividad conserva su alto', async ({ page }) => {
    await page.goto('/projects/p1/overview')
    await expect(page.getByRole('region', { name: 'Áreas de influencia' }).getByRole('row')).toHaveCount(4)
    await page.waitForLoadState('networkidle')
    const paneles = await columnas(page)
    expect(paneles.map((p) => p.titulo)).toEqual(PANELES)
    expect(new Set(paneles.map((p) => p.x)).size).toBe(1)
    for (let i = 1; i < paneles.length; i++) expect(paneles[i].arriba).toBeGreaterThan(paneles[i - 1].abajo)
    const actividad = page.getByRole('region', { name: 'Actividad reciente' })
    // sin estirar: el panel mide lo que su cabecera y su cuerpo, más el borde
    const { alto, contenido } = await actividad.evaluate((s) => ({
      alto: s.getBoundingClientRect().height,
      contenido: [...s.children].reduce((suma, h) => suma + h.getBoundingClientRect().height, 0)
    }))
    expect(alto - contenido).toBeLessThanOrEqual(2)
  })
})
