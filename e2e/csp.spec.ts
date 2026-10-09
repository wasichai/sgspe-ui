import { expect, test } from '@playwright/test'

// security.md §3.2: la build no hace eval. zod 4 prueba Function('') la primera vez que valida y, sin jitless, cada pantalla
// (también /login, sin sesión) reportaba una violación de script-src por eval desde un chunk de la build (revisión final,
// M9). vite preview sirve la CSP en modo de solo informe, así que una violación llega como evento. el control positivo es un
// script en línea que la prueba inyecta al final (page.evaluate no sirve: Playwright lo exime de la CSP): los eventos llegan
// en orden, así que cuando llega su violación ya llegó cualquier eval anterior
test('la build no viola script-src al arrancar: zod va sin JIT', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { violaciones: string[] }
    w.violaciones = []
    document.addEventListener('securitypolicyviolation', (e) => w.violaciones.push(e.blockedURI))
  })
  await page.route('**/api/**', (ruta) =>
    ruta.fulfill({ status: 401, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Unauthorized', status: 401 }) })
  )
  const violaciones = () => page.evaluate(() => (window as unknown as { violaciones: string[] }).violaciones)
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
  await page.addScriptTag({ content: 'void 0' })
  await expect.poll(violaciones).toContain('inline')
  expect(await violaciones()).not.toContain('eval')
})
