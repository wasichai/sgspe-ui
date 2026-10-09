import { expect, test } from '@playwright/test'
import { prepararApi } from './api'

// lo que las pruebas de jsdom no pueden comprobar porque necesita un navegador de verdad: el dibujo de ECharts, el CSS
// compilado (:focus-within) y lo que la build carga al abrir la página. la API se simula igual que en hilo.spec.ts
test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('la barra de posturas dibuja NEUTRAL en dos series, una a cada lado del centro', async ({ page }) => {
  await page.goto('/stakeholders/dashboard')
  const figura = page.locator('figure').filter({ has: page.locator('caption', { hasText: 'Posturas' }) })
  // ECharts dibuja SVG: cada barra es un trazo cerrado con relleno de color (el decal repite el trazo con un patrón url())
  const trazos = figura.locator('svg path[d$="Z"][fill^="#"]')
  await expect(trazos.first()).toBeVisible()
  // las barras miden la altura del eje; los símbolos de la leyenda, unos píxeles
  const barras = (
    await trazos.evaluateAll((ps) =>
      ps.map((p) => {
        const caja = (p as SVGGraphicsElement).getBoundingClientRect()
        return { fill: p.getAttribute('fill'), izquierda: caja.left, derecha: caja.right, ancho: caja.width, alto: caja.height }
      })
    )
  ).filter((b) => b.alto > 30)
  // NEUTRAL (2) + A FAVOR + EN CONTRA PERO ABIERTO + EN CONTRA
  expect(barras).toHaveLength(5)
  // dos series de NEUTRAL (el mismo color), contiguas: la mitad de cada lado del centro
  const porColor = new Map<string, typeof barras>()
  for (const b of barras) porColor.set(b.fill ?? '', [...(porColor.get(b.fill ?? '') ?? []), b])
  const neutral = [...porColor.values()].filter((grupo) => grupo.length === 2)
  expect(neutral).toHaveLength(1)
  const [izquierda, derecha] = [...neutral[0]].sort((a, b) => a.izquierda - b.izquierda)
  expect(izquierda.derecha).toBeCloseTo(derecha.izquierda, 0)
  expect(izquierda.ancho).toBeCloseTo(derecha.ancho, 0)
  // con A FAVOR 3, NEUTRAL 4, EN CONTRA PERO ABIERTO 2 y EN CONTRA 1: cada mitad mide 2 unidades, A FAVOR 3 y EN CONTRA 1
  const unidad = barras.find((b) => !neutral[0].includes(b) && Math.abs(b.ancho - Math.min(...barras.map((x) => x.ancho))) < 0.5)!.ancho
  expect(izquierda.ancho / unidad).toBeCloseTo(2, 1)
  const aFavor = barras.find((b) => Math.abs(b.derecha - izquierda.izquierda) < 0.5)!
  expect(aFavor.ancho / unidad).toBeCloseTo(3, 1)
  // la tabla "Ver datos" dice el conteo real de NEUTRAL, no su mitad
  await figura.getByText('Ver datos').click()
  await expect(figura.getByRole('row', { name: /NEUTRAL/ })).toContainText('4')
})

test('el motivo de una interacción cancelada aparece al enfocar su enlace con el teclado', async ({ page }) => {
  await page.goto('/projects/p1/engagements/calendar?month=2026-10')
  const enlace = page.getByRole('table', { name: 'Calendario de interacciones' }).getByRole('link', { name: 'Taller de agua' })
  await expect(enlace).toBeVisible()
  const motivo = page.getByText('Cancelada: Lluvias intensas en la zona')
  // fuera de foco el motivo es solo para lectores de pantalla (sr-only: una caja de 1 px)
  expect((await motivo.boundingBox())!.width).toBeLessThanOrEqual(1)
  // con Tab hasta el enlace, como lo haría una persona con teclado
  for (let i = 0; i < 80 && !(await enlace.evaluate((a) => a === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(enlace).toBeFocused()
  await expect.poll(async () => (await motivo.boundingBox())!.width).toBeGreaterThan(40)
  await expect(motivo).toBeVisible()
  // y se lee como descripción del enlace
  await expect(enlace).toHaveAccessibleDescription('Cancelada: Lluvias intensas en la zona')
})

test('MapLibre y ECharts no están en index.html ni bajan en una pantalla sin mapa ni gráfico', async ({ page }) => {
  const html = await (await page.request.get('/')).text()
  expect(html).not.toMatch(/maplibre|echarts|zrender/i)
  const pesados: string[] = []
  page.on('request', (r) => {
    if (/\/assets\/(maplibre|echarts)/i.test(r.url())) pesados.push(r.url())
  })
  await page.goto('/stakeholders')
  await expect(page.getByRole('table', { name: 'Grupos de interés' })).toBeVisible()
  expect(pesados).toEqual([])
  // y bajan con el primer mapa: el chunk existe y se pide cuando hace falta
  await page.goto('/territory')
  await expect(page.getByRole('region', { name: 'Mapa territorial' }).locator('canvas')).toBeVisible()
  expect(pesados.some((u) => /maplibre/i.test(u))).toBe(true)
})
