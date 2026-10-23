import { expect, test, type Request } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// el calendario de CampoFecha (05-especificacion §1.5, DD-07) en un navegador de verdad: registrar una queja eligiendo la
// fecha de recepción con el teclado, con el patrón «Date Picker Dialog» de WAI-ARIA APG. la API se simula como en f4.spec.ts;
// estas rutas se registran después de las comunes y les ganan. hoy, para el portal, es el 20 de octubre de 2026 en Lima
const permisos = { project: ['READ'], project_assignment: ['READ'], grievance: ['READ', 'CREATE', 'UPDATE'] }
const campos = ['project', 'code', 'description', 'category', 'severity', 'received_at', 'anonymous', 'response']

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('la fecha de recepción de una queja se elige en el calendario con el teclado y conserva la hora escrita', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-20T15:00:00Z'))
  const escrituras: Request[] = []
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const rutas: [RegExp, string, unknown][] = [
    [/^\/auth\/me\/permissions$/, 'GET', { admin: false, objects: permisos }],
    [/^\/objects\/project_assignment\/records$/, 'GET', pagina([registro('as', { project: 'p1', member_user_id: 'u-smg', active: true })])],
    [
      /^\/metadata\/objects\/grievance$/,
      'GET',
      { id: 'grievance', name: 'grievance', fields: campos.map((name) => ({ name, label: name, type: 'TEXT', editable: true, visible: true })) }
    ],
    [/^\/objects\/[a-z_]+\/records$/, 'GET', pagina([])],
    [/^\/objects\/grievance\/records$/, 'POST', registro('g10', { project: 'p1', code: 'Q-010' }, 'received')],
    [/^\/sgspe\/transition-checks$/, 'POST', { allowed: true, blocking: [], warnings: [] }]
  ]
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const ruta = new URL(peticion.url()).pathname.replace(/^\/api/, '')
    const encontrada = rutas.find(([patron, metodo]) => patron.test(ruta) && metodo === peticion.method())
    if (!encontrada) return route.fallback()
    const [, metodo, cuerpo] = encontrada
    if (metodo !== 'GET' && !ruta.startsWith('/sgspe/transition-checks')) escrituras.push(peticion)
    return route.fulfill(json(cuerpo, metodo === 'POST' && !ruta.startsWith('/sgspe/') ? 201 : 200))
  })

  await page.goto('/projects/p1/attention/new')
  await expect(page.getByRole('heading', { name: 'Registrar queja, consulta o solicitud', level: 1 })).toBeVisible()
  await page.getByLabel('Código').fill('Q-010')
  await page.getByLabel('Descripción').fill('Polvo en la vía')
  await page.getByRole('button', { name: 'Siguiente' }).click()

  await page.getByLabel('Fecha y hora de recepción (hora)').fill('10:15')
  const boton = page.getByRole('button', { name: 'Elegir Fecha y hora de recepción en el calendario' })
  await boton.click()
  const calendario = page.getByRole('dialog', { name: 'Calendario de Fecha y hora de recepción' })
  await expect(calendario).toBeVisible()
  await expect(calendario).toHaveAttribute('aria-modal', 'false')
  // sin fecha escrita abre en hoy, con lunes primero
  await expect(calendario.getByRole('columnheader').first()).toContainText('lunes')
  const hoy = calendario.getByRole('gridcell', { name: 'martes, 20 de octubre de 2026' })
  await expect(hoy).toBeFocused()
  await expect(hoy).toHaveAttribute('aria-current', 'date')

  // Esc cierra sin elegir y devuelve el foco al botón
  await page.keyboard.press('Escape')
  await expect(calendario).toBeHidden()
  await expect(boton).toBeFocused()

  // un mes atrás y dos días adelante: el martes 22 de setiembre
  await page.keyboard.press('Enter')
  await page.keyboard.press('PageUp')
  await expect(calendario.getByText('Setiembre de 2026')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(calendario.getByRole('gridcell', { name: 'martes, 22 de setiembre de 2026' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(calendario).toBeHidden()
  await expect(boton).toBeFocused()
  await expect(page.getByLabel('Fecha y hora de recepción', { exact: true })).toHaveValue('22/09/2026')
  await expect(page.getByLabel('Fecha y hora de recepción (hora)')).toHaveValue('10:15')

  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByLabel('Motivo (obligatorio)').fill('recibida en la oficina')
  await page.getByRole('button', { name: 'Registrar queja' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/grievances\/g10$/)
  const alta = escrituras.find((r) => new URL(r.url()).pathname === '/api/objects/grievance/records')!
  expect(alta.postDataJSON()).toMatchObject({ attributes: { project: 'p1', code: 'Q-010', received_at: '2026-09-22T15:15:00.000Z' } })
})
