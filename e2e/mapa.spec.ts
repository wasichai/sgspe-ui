import { expect, test, type Page } from '@playwright/test'
import { prepararEscenario } from './capturas/escenario'

// los rótulos y los símbolos del mapa con MapLibre de verdad (wasichai/sgspe-ui#120, design-system.md §3.3): los glifos PBF salen
// del propio origen (public/glifos) y los íconos se dibujan en el portal, sin sprite ni CDN, así que la CSP (connect-src y
// font-src 'self') queda intacta. vite preview manda la CSP en solo informe: una violación llega como evento y se cuenta. el
// escenario es el de las capturas (S09): diez centros poblados, dos comunidades y, en las vistas «Lista + mapa», un riesgo
// CRITICO (LYR-21), los compromisos (LYR-19) y los grupos por localidad (LYR-17)

async function vigilar(page: Page) {
  const glifos: { url: string; estado: number }[] = []
  const avisos: string[] = []
  page.on('response', (r) => {
    if (r.url().includes('/glifos/')) glifos.push({ url: r.url(), estado: r.status() })
  })
  // MapLibre avisa por consola un ícono que no pudo cargar o un glifo que no bajó
  page.on('console', (m) => {
    if (/could not be loaded|glyph|Unable to load/i.test(m.text())) avisos.push(m.text())
  })
  await page.addInitScript(() => {
    const w = window as unknown as { violaciones: string[] }
    w.violaciones = []
    document.addEventListener('securitypolicyviolation', (e) => w.violaciones.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
  return { glifos, avisos, violaciones: () => page.evaluate(() => (window as unknown as { violaciones: string[] }).violaciones) }
}

// cuántos píxeles del lienzo del mapa tienen ese color (con una tolerancia de 6 por canal): el mapa conserva su dibujo
// (preserveDrawingBuffer) y se copia a un lienzo 2D para leerlo
const pixelesDe = (page: Page, rgb: [number, number, number]) =>
  page.evaluate((color) => {
    const lienzo = document.querySelector<HTMLCanvasElement>('[data-testid="mapa"] canvas')!
    const copia = document.createElement('canvas')
    copia.width = lienzo.width
    copia.height = lienzo.height
    const ctx = copia.getContext('2d')!
    ctx.drawImage(lienzo, 0, 0)
    const { data } = ctx.getImageData(0, 0, copia.width, copia.height)
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - color[0]) <= 6 && Math.abs(data[i + 1] - color[1]) <= 6 && Math.abs(data[i + 2] - color[2]) <= 6) n++
    }
    return n
  }, rgb)

async function enReposo(page: Page) {
  await expect(page.locator('[data-testid="mapa"]')).toHaveAttribute('data-reposo', 'si')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[data-testid="mapa"]')).toHaveAttribute('data-reposo', 'si')
}

test('los rótulos piden los glifos de Public Sans al propio origen, sin violar la CSP', async ({ page }) => {
  const vigilancia = await vigilar(page)
  await prepararEscenario(page, { tema: 'light', idioma: 'es' })
  await page.goto('/territory?project=p1')
  await enReposo(page)
  // los centros poblados en semibold y el territorio comunal en bold, del rango latino (á, í, ñ)
  const pedidos = vigilancia.glifos.map((g) => new URL(g.url))
  expect(pedidos.every((u) => u.origin === new URL(page.url()).origin)).toBe(true)
  expect(pedidos.map((u) => u.pathname)).toEqual(expect.arrayContaining(['/glifos/public-sans-semibold/0-255.pbf', '/glifos/public-sans-bold/0-255.pbf']))
  expect(vigilancia.glifos.every((g) => g.estado === 200)).toBe(true)
  // el rótulo del territorio comunal en lyr-community-label (#56621A): solo el texto usa ese color
  await expect.poll(() => pixelesDe(page, [0x56, 0x62, 0x1a])).toBeGreaterThan(20)
  expect(vigilancia.avisos).toEqual([])
  expect(await vigilancia.violaciones()).toEqual([])
})

test('el rombo de un riesgo CRITICO, el cuadrado de los compromisos y el anillo de posturas se dibujan y siguen al tema', async ({ page }) => {
  const vigilancia = await vigilar(page)
  await prepararEscenario(page, { tema: 'light', idioma: 'es' })
  await page.goto('/projects/p1/risks/register?view=mapa&selected=social_risk%3Ar1')
  await enReposo(page)
  // el relleno de CRITICO (risk-critical #A11A1A) y, al pasar a oscuro, el suyo (#C42323)
  await expect.poll(() => pixelesDe(page, [0xa1, 0x1a, 0x1a])).toBeGreaterThan(30)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await expect.poll(() => pixelesDe(page, [0xc4, 0x23, 0x23])).toBeGreaterThan(30)
  expect(await pixelesDe(page, [0xa1, 0x1a, 0x1a])).toBe(0)

  await page.goto('/projects/p1/commitments?view=mapa&selected=commitment%3Ak4')
  await enReposo(page)
  // el cuadrado en data-3 (claro #159F78) con su conteo en bold
  await expect.poll(() => pixelesDe(page, [0x15, 0x9f, 0x78])).toBeGreaterThan(100)
  expect(vigilancia.glifos.map((g) => new URL(g.url).pathname)).toContain('/glifos/public-sans-bold/0-255.pbf')

  await page.goto('/projects/p1/stakeholders?view=mapa&selected=stakeholder%3As1')
  await enReposo(page)
  // el anillo de Llamapampa (3 a favor, 4 neutrales, 3 abiertos, 2 en contra): sus cuatro tramos
  for (const color of [
    [0x1d, 0x6f, 0xb8],
    [0xb7, 0xbf, 0xca],
    [0xe3, 0xa2, 0x4a],
    [0xb4, 0x47, 0x1f]
  ] as [number, number, number][])
    await expect.poll(() => pixelesDe(page, color)).toBeGreaterThan(10)
  expect(vigilancia.avisos).toEqual([])
  expect(await vigilancia.violaciones()).toEqual([])
})
