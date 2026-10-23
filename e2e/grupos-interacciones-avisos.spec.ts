import { expect, test, type Page } from '@playwright/test'
import { GRUPO, INTERACCION, pagina, prepararApi, registro } from './api'

// P-02, el listado (rediseño de UX, área 4.3a), en Grupos de interés, Interacciones y Avisos con un navegador de verdad: lo que
// jsdom no ve porque depende del CSS compilado. una sola fila de pestañas (las vistas van en el selector de la barra de filtros),
// los filtros como chips con «Limpiar filtros», las tablas sin desborde a 1440 px y el ojo de la vista previa que aparece al
// pasar sobre la fila o con el foco en ella (hallazgos U-06, U-17, U-18 y U-22). las tarjetas a 390 px son de responsivo.spec.ts
test.use({ viewport: { width: 1440, height: 900 } })

const LARGO = 'Asamblea general de la comunidad campesina para informar el avance del monitoreo participativo del agua en la época seca'
// un grupo con todas sus columnas llenas y uno retirado, para que la tabla tenga su ancho de verdad
const COMPLETO = registro(
  's2',
  {
    ...GRUPO.attributes,
    organization: 'o1',
    information_priority: 'MUY ALTA',
    relationship_status: 'EN CONFLICTO LATENTE',
    owner_user_email: 'relacionista.de.campo@sgspe.test',
    last_contact_date: '2026-09-30',
    last_assessment_date: '2026-09-15'
  },
  'assessed'
)
const OTRA = registro(
  'e3',
  {
    project: 'p1',
    title: LARGO,
    engagement_type: 'REUNION',
    place: 'Local comunal de Tunas Pampa',
    held_at: '2026-10-02T15:00:00Z',
    attendees_total_count: 120
  },
  'held'
)
const aviso = (id: string, kind: string, title: string) => ({
  id,
  kind,
  title,
  body: null,
  link: null,
  publishAt: '2026-10-05T15:00:00Z',
  expiresAt: null,
  dueAt: null,
  overdue: false,
  source: 'manual',
  read: false,
  snoozedUntil: null,
  dismissible: true
})

async function prepararListas(page: Page) {
  await prepararApi(page)
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  // registradas después de prepararApi, ganan a las respuestas comunes
  await page.route(/\/api\/objects\/stakeholder\/records(\?.*)?$/, (r) => r.fulfill(json(pagina([GRUPO, COMPLETO]))))
  await page.route(/\/api\/objects\/engagement\/records(\?.*)?$/, (r) => r.fulfill(json(pagina([INTERACCION, OTRA]))))
  await page.route(/\/api\/auth\/me\/notifications\/summary$/, (r) =>
    r.fulfill(
      json({
        kinds: { ACTION: { active: 1, unread: 1, overdue: 0 }, WARNING: { active: 1, unread: 1, overdue: 0 }, INFO: { active: 0, unread: 0, overdue: 0 } },
        latest: null
      })
    )
  )
  await page.route(/\/api\/auth\/me\/notifications(\?.*)?$/, (r) =>
    r.fulfill(
      json({
        content: [aviso('n1', 'ACTION', 'Compromiso pendiente de aprobación'), aviso('n2', 'WARNING', 'Plazo por vencer')],
        page: 0,
        size: 25,
        totalElements: 2,
        totalPages: 1
      })
    )
  )
  await page.route(/\/api\/auth\/me\/notification-preferences$/, (r) => r.fulfill(json({ email: ['ACTION'] })))
}

test.beforeEach(async ({ page }) => prepararListas(page))

// lo que se desplaza en horizontal: la página, el contenido y la caja de cada tabla
async function desbordes(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')!
    const tablas = [...document.querySelectorAll('main table')].map((t) => t.parentElement!).filter((c) => c.scrollWidth > c.clientWidth + 1)
    return { pagina: document.documentElement.scrollWidth > window.innerWidth, contenido: main.scrollWidth > main.clientWidth + 1, tablas: tablas.length }
  })
}

for (const [ruta, vistas, contenido] of [
  ['/projects/p1/stakeholders', 'Vistas', 'Junta directiva comunal'],
  ['/stakeholders', 'Vistas', 'Junta directiva comunal'],
  ['/projects/p1/engagements?view=lista', 'Vista', 'Asamblea de agosto'],
  ['/engagements?view=lista', 'Vista', 'Asamblea de agosto'],
  ['/notifications', 'Vistas', 'Plazo por vencer']
] as const)
  test(`a 1440 px ${ruta} lleva una sola fila de pestañas y no se desplaza en horizontal`, async ({ page }) => {
    await page.goto(ruta)
    await expect(page.locator('main').getByText(contenido).first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    // las vistas son el selector de la barra de filtros, no una segunda fila de pestañas
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Filtros' }).getByRole('radiogroup', { name: vistas })).toBeVisible()
    expect(await desbordes(page)).toEqual({ pagina: false, contenido: false, tablas: 0 })
  })

test('los filtros de Grupos de interés son chips: «Limpiar filtros» los quita y deja la vista', async ({ page }) => {
  await page.goto('/projects/p1/stakeholders?view=todos&influence_group=ESTRATEGICO')
  const chips = page.getByRole('list', { name: 'Filtros aplicados' })
  await expect(chips.getByRole('listitem')).toHaveText(['Grupo de influencia: Estratégico'])
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/stakeholders\?view=todos$/)
  await expect(chips).toHaveCount(0)
})

// U-22: el filtro «Tipo» de Avisos medía 860 px; en la barra mide lo que su contenido
test('el filtro Tipo de Avisos es de la barra, de su ancho, con su chip y «Limpiar filtros»', async ({ page }) => {
  await page.goto('/notifications')
  const tipo = page.getByRole('group', { name: 'Filtros' }).getByRole('combobox', { name: 'Tipo' })
  await expect(tipo).toBeVisible()
  expect((await tipo.boundingBox())!.width).toBeLessThan(320)
  await tipo.selectOption('WARNING')
  await expect(page).toHaveURL(/\/notifications\?kind=WARNING$/)
  await expect(page.getByRole('list', { name: 'Filtros aplicados' }).getByRole('listitem')).toHaveText(['Tipo: Advertencia'])
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(page).toHaveURL(/\/notifications$/)
})

// U-17: el ojo tiene su nombre y aparece al pasar sobre la fila o con el foco en ella
test('el ojo de la vista previa aparece al pasar sobre la fila o con el foco, y abre la vista previa', async ({ page }) => {
  await page.goto('/projects/p1/stakeholders')
  const tabla = page.getByRole('table', { name: 'Grupos de interés' })
  const fila = tabla
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: /^Vista previa de / }) })
    .first()
  const ojo = fila.getByRole('link', { name: /^Vista previa de / })
  await expect(ojo).toHaveCSS('opacity', '0')
  await fila.hover()
  await expect(ojo).toHaveCSS('opacity', '1')
  await page.mouse.move(0, 0)
  await expect(ojo).toHaveCSS('opacity', '0')
  await fila.focus()
  await expect(ojo).toHaveCSS('opacity', '1')
  await ojo.click()
  await expect(page).toHaveURL(/[?&]peek=stakeholder%3As/)
  await expect(page.getByRole('dialog')).toBeVisible()
})

// 05-especificacion §1.6: a 1440 px una opcional no se ve hasta que se elige en «Columnas», y la elección sobrevive a recargar
test('«Columnas» muestra una opcional a 1440 px y la recuerda al recargar', async ({ page }) => {
  await page.goto('/projects/p1/stakeholders')
  const tabla = page.getByRole('table', { name: 'Grupos de interés' })
  const evaluacion = tabla.getByRole('columnheader', { name: 'Evaluación' })
  await expect(tabla).toBeVisible()
  await expect(evaluacion).toBeHidden()
  await page.getByRole('button', { name: 'Columnas' }).click()
  await page.getByRole('group', { name: 'Columnas' }).getByRole('checkbox', { name: 'Evaluación' }).check()
  await expect(evaluacion).toBeVisible()
  await page.reload()
  await expect(page.getByRole('table', { name: 'Grupos de interés' }).getByRole('columnheader', { name: 'Evaluación' })).toBeVisible()
})

// 05-especificacion §1.6: Espacio en una fila enfocada abre su vista previa y no desplaza la página
test('Espacio en una fila enfocada abre la vista previa sin desplazar la página', async ({ page }) => {
  await page.goto('/projects/p1/stakeholders')
  const fila = page
    .getByRole('table', { name: 'Grupos de interés' })
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: /^Vista previa de / }) })
    .first()
  await fila.focus()
  const antes = await page.evaluate(() => window.scrollY)
  await page.keyboard.press('Space')
  await expect(page).toHaveURL(/[?&]peek=stakeholder%3As/)
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(antes)
})
