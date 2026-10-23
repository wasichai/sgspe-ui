import { expect, test } from '@playwright/test'
import { prepararApi, prepararFichaDeCompromiso } from './api'

// criterios de aceptación del rediseño de UX que piden un navegador de verdad (el CSS compilado y la barra de acciones tal
// como se dibuja). CA-1.6.2 (la lista de grupos de interés a 1440 px sin desplazamiento horizontal) ya lo cubre
// grupos-interacciones-avisos.spec.ts para /projects/p1/stakeholders y /stakeholders: no se repite aquí

// CA-1.2.5 (U-02, U-03, DD-02): en la ficha de un compromiso en ejecución, la única acción primaria de la cabecera es
// «Registrar cumplimiento», la siguiente del camino, aunque el servidor liste antes «Bloquear», que no es primaria
test('CA-1.2.5 · en un compromiso en ejecución la única primaria de la cabecera es «Registrar cumplimiento»', async ({ page }) => {
  await prepararApi(page)
  await prepararFichaDeCompromiso(page)
  const estados: [string, string, string][] = [
    ['draft', 'Borrador', 'INITIAL'],
    ['approved', 'Aprobado', 'INTERMEDIATE'],
    ['in_progress', 'En ejecución', 'INTERMEDIATE'],
    ['blocked', 'Bloqueado', 'INTERMEDIATE'],
    ['fulfilled', 'Cumplido', 'INTERMEDIATE'],
    ['cancelled', 'Cancelado', 'FINAL']
  ]
  const respuestas: [RegExp, string, unknown][] = [
    [
      /^\/objects\/commitment\/workflow$/,
      'GET',
      {
        id: 'w',
        objectName: 'commitment',
        name: 'commitment',
        label: 'commitment',
        enabled: true,
        definition: {
          states: estados.map(([name, label, type]) => ({ name, label, type })),
          transitions: [
            { name: 'block', from: 'in_progress', to: 'blocked' },
            { name: 'cancel', from: 'in_progress', to: 'cancelled' },
            { name: 'register_fulfillment', from: 'in_progress', to: 'fulfilled' }
          ]
        }
      }
    ],
    [
      /^\/objects\/commitment\/records\/k1\/transitions$/,
      'GET',
      [
        { name: 'block', label: 'Bloquear', to: 'blocked', toLabel: 'Bloqueado', allowed: true, reason: null },
        { name: 'cancel', label: 'Cancelar', to: 'cancelled', toLabel: 'Cancelado', allowed: true, reason: null },
        { name: 'register_fulfillment', label: 'Registrar cumplimiento', to: 'fulfilled', toLabel: 'Cumplido', allowed: true, reason: null }
      ]
    ],
    [/^\/sgspe\/transition-checks$/, 'POST', { allowed: true, blocking: [], warnings: [] }]
  ]
  // registradas después de prepararFichaDeCompromiso, ganan a sus respuestas
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const ruta = new URL(peticion.url()).pathname.replace(/^\/api/, '')
    const encontrada = respuestas.find(([patron, metodo]) => patron.test(ruta) && metodo === peticion.method())
    if (!encontrada) return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(encontrada[2]) })
  })

  await page.goto('/projects/p1/commitments/k1')
  await expect(page.getByRole('heading', { name: 'Reservorio de agua', level: 1 })).toBeVisible()
  const acciones = page.getByRole('group', { name: 'Acciones del registro' })
  const cumplimiento = acciones.getByRole('button', { name: 'Registrar cumplimiento' })
  await expect(cumplimiento).toBeVisible()
  await expect(cumplimiento).toHaveAttribute('data-variant', 'primary')
  await expect(acciones.locator('[data-variant="primary"]')).toHaveCount(1)
  // «Bloquear», a la vista o en «Más acciones», nunca es primaria
  const bloquear = page.getByRole('button', { name: 'Bloquear' })
  if ((await bloquear.count()) === 0) await acciones.getByRole('button', { name: 'Más acciones' }).click()
  await expect(bloquear).toBeVisible()
  await expect(bloquear).not.toHaveAttribute('data-variant', 'primary')
})
