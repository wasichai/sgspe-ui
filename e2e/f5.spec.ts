import { expect, test, type Page, type Request } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// los recorridos de F5 en un navegador de verdad: aceptar una solicitud como aporte (S57 → S44), registrar la única entrega de un
// aporte adquirido y abrir un programa de otro proyecto. la API se simula como en f4.spec.ts; estas rutas se registran después y
// ganan a las comunes
const SOLICITUD = registro(
  'r1',
  {
    project: 'p1',
    code: 'S-001',
    channel: 'CARTA',
    received_at: '2026-10-03T15:00:00Z',
    description: 'La asociación pide apoyo para su biblioteca',
    requested_resource: 'Estantes para la biblioteca',
    anonymous: false,
    confidential: false
  },
  'under_evaluation'
)
const APORTE = registro(
  'a1',
  {
    project: 'p1',
    code: 'AP-001',
    contribution_type: 'APOYO EN ESPECIE',
    declared_purpose: 'Equipar la biblioteca escolar',
    conditions: 'Entrega con acta',
    currency: 'PEN',
    total_amount: '1750.50',
    payer_organization: 'o3'
  },
  'procured'
)
const NUEVO = registro(
  'a9',
  { project: 'p1', code: 'AP-010', currency: 'PEN', declared_purpose: 'Estantes para la biblioteca', payer_organization: 'o3' },
  'requested'
)
const ENTREGA = registro('dl9', { social_contribution: 'a1', delivery_date: '2026-10-10', conformity_given: false })
const EMPRESA = registro('o3', { name: 'Empresa Ejemplo S.A.' })

const flujo = (objeto: string, estados: [string, string][]) => ({
  id: objeto,
  objectName: objeto,
  name: objeto,
  label: objeto,
  enabled: true,
  definition: { states: estados.map(([name, label]) => ({ name, label, type: 'INTERMEDIATE' })), transitions: [] }
})
const definicion = (objeto: string, campos: string[]) => ({
  id: objeto,
  name: objeto,
  fields: campos.map((name) => ({ name, label: name, type: 'TEXT', editable: true, visible: true }))
})

async function prepararF5(page: Page): Promise<{ escrituras: Request[] }> {
  const escrituras: Request[] = []
  let entregada = false
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const permisos = {
    project: ['READ'],
    project_assignment: ['READ'],
    organization: ['READ'],
    exploration_campaign: ['READ'],
    stakeholder_request: ['READ', 'UPDATE'],
    social_contribution: ['READ', 'CREATE', 'UPDATE'],
    contribution_item: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    receipt: ['READ', 'CREATE', 'UPDATE'],
    delivery: ['READ', 'CREATE', 'UPDATE'],
    social_program: ['READ'],
    evidence: ['READ']
  }
  const rutas: [RegExp, string, () => unknown, number?][] = [
    [/^\/auth\/me\/permissions$/, 'GET', () => ({ admin: false, objects: permisos })],
    [/^\/objects\/project_assignment\/records$/, 'GET', () => pagina([registro('as', { project: 'p1', member_user_id: 'u-smg', active: true })])],
    [/^\/objects\/stakeholder_request\/workflow$/, 'GET', () => flujo('stakeholder_request', [['under_evaluation', 'En evaluación']])],
    [
      /^\/objects\/social_contribution\/workflow$/,
      'GET',
      () =>
        flujo('social_contribution', [
          ['requested', 'Solicitado'],
          ['procured', 'Adquirido']
        ])
    ],
    [/^\/metadata\/objects\/stakeholder_request$/, 'GET', () => definicion('stakeholder_request', ['code', 'description', 'response', 'requested_resource'])],
    [
      /^\/metadata\/objects\/social_contribution$/,
      'GET',
      () => definicion('social_contribution', ['code', 'declared_purpose', 'conditions', 'currency', 'contribution_type'])
    ],
    [
      /^\/metadata\/objects\/delivery$/,
      'GET',
      () => definicion('delivery', ['delivery_date', 'place', 'delivered_items', 'recipients', 'conformity_given', 'conformity_by'])
    ],
    [/^\/objects\/stakeholder_request\/records\/r1$/, 'GET', () => SOLICITUD],
    [
      /^\/objects\/stakeholder_request\/records\/r1\/transitions$/,
      'GET',
      () => [{ name: 'accept', label: 'Aceptar', to: 'accepted', toLabel: 'Aceptada', allowed: true, reason: null }]
    ],
    [/^\/objects\/social_contribution\/records\/a1$/, 'GET', () => APORTE],
    [/^\/objects\/social_contribution\/records\/a9$/, 'GET', () => NUEVO],
    [/^\/objects\/social_program\/records\/sp9$/, 'GET', () => ({ title: 'Not Found', status: 404, detail: 'Record sp9 does not exist' }), 404],
    [/^\/objects\/organization\/records\/o3$/, 'GET', () => EMPRESA],
    [/^\/objects\/organization\/records$/, 'GET', () => pagina([EMPRESA])],
    [/^\/objects\/delivery\/records$/, 'GET', () => pagina(entregada ? [ENTREGA] : [])],
    [/^\/objects\/[a-z_]+\/records\/[a-z0-9]+\/(transitions|history)$/, 'GET', () => []],
    [/^\/objects\/[a-z_]+\/records\/[a-z0-9]+\/related\//, 'GET', () => pagina([])],
    [/^\/objects\/[a-z_]+\/records$/, 'GET', () => pagina([])],
    [/^\/sgspe\/transition-checks$/, 'POST', () => ({ allowed: true, blocking: [], warnings: [] }), 200],
    [/^\/sgspe\/stakeholder-requests\/r1\/accept$/, 'POST', () => ({ request: { ...SOLICITUD, state: 'accepted' }, contribution: NUEVO })],
    [
      /^\/sgspe\/social-contributions\/a1\/deliveries$/,
      'POST',
      () => {
        entregada = true
        return { delivery: ENTREGA, contribution: APORTE }
      }
    ]
  ]
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const ruta = new URL(peticion.url()).pathname.replace(/^\/api/, '')
    const encontrada = rutas.find(([patron, metodo]) => patron.test(ruta) && metodo === peticion.method())
    if (!encontrada) return route.fallback()
    const [, metodo, cuerpo, estado] = encontrada
    if (metodo !== 'GET' && !ruta.startsWith('/sgspe/transition-checks')) escrituras.push(peticion)
    return route.fulfill(json(cuerpo(), estado ?? (metodo === 'POST' ? 201 : 200)))
  })
  return { escrituras }
}

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('aceptar una solicitud como aporte manda creates, If-Match, motivo y clave, y abre la ficha del aporte (S57 → S44)', async ({ page }) => {
  const { escrituras } = await prepararF5(page)
  await page.goto('/projects/p1/requests/r1')
  await page.getByRole('button', { name: 'Aceptar y crear el aporte' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Aceptar la solicitud' })
  await dialogo.getByLabel('Respuesta a la solicitud').fill('Se apoyará con los estantes')
  await dialogo.getByLabel('Código del aporte').fill('AP-010')
  await dialogo.getByLabel('Condiciones').fill('Entrega con acta firmada')
  await dialogo.getByLabel('Quién paga').fill('Empr')
  await dialogo.getByRole('button', { name: 'Empresa Ejemplo S.A.' }).click()
  await dialogo.getByLabel('Motivo (obligatorio)').fill('Aprobada en comité')
  await dialogo.getByRole('button', { name: 'Aceptar y crear' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/contributions\/a9$/)
  // el título dice para qué es (P-09 del rediseño de UX, U-27); el código va en el antetítulo
  await expect(page.getByRole('heading', { name: 'Estantes para la biblioteca', level: 1 })).toBeVisible()
  const aceptacion = escrituras.find((r) => new URL(r.url()).pathname === '/api/sgspe/stakeholder-requests/r1/accept')!
  expect(aceptacion.postDataJSON()).toMatchObject({
    creates: 'social_contribution',
    response: 'Se apoyará con los estantes',
    attributes: {
      code: 'AP-010',
      declared_purpose: 'Estantes para la biblioteca',
      conditions: 'Entrega con acta firmada',
      currency: 'PEN',
      payer_organization: 'o3'
    }
  })
  expect(await aceptacion.headerValue('if-match')).toBe(`"${SOLICITUD.updatedAt}"`)
  expect(await aceptacion.headerValue('idempotency-key')).toBeTruthy()
  expect(await aceptacion.headerValue('x-change-reason')).toBe("UTF-8''Aprobada%20en%20comit%C3%A9")
})

test('en S44 la única entrega de un aporte adquirido se registra sin monto, con su clave y su motivo; después no se ofrece otra', async ({ page }) => {
  const { escrituras } = await prepararF5(page)
  await page.goto('/projects/p1/contributions/a1')
  await expect(page.getByRole('heading', { name: 'Equipar la biblioteca escolar', level: 1 })).toBeVisible()
  await page.getByRole('tab', { name: 'Entrega' }).click()
  await page.getByRole('button', { name: 'Registrar entrega' }).click()
  const panel = page.getByRole('dialog', { name: 'Registrar la entrega del aporte' })
  await expect(panel.getByLabel('Monto entregado')).toHaveCount(0)
  await panel.getByLabel('Motivo (obligatorio)').fill('Entrega en la plaza')
  await panel.getByRole('button', { name: 'Guardar entrega' }).click()
  await expect(page.getByText('Entrega guardada.')).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Entrega del/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar entrega' })).toHaveCount(0)
  const entrega = escrituras.find((r) => new URL(r.url()).pathname === '/api/sgspe/social-contributions/a1/deliveries')!
  expect(Object.keys(entrega.postDataJSON().attributes)).not.toContain('delivered_amount')
  expect(await entrega.headerValue('if-match')).toBe(`"${APORTE.updatedAt}"`)
  expect(await entrega.headerValue('idempotency-key')).toBeTruthy()
  expect(await entrega.headerValue('x-change-reason')).toBe("UTF-8''Entrega%20en%20la%20plaza")
})

test('un programa de otro proyecto dice que no existe o no es de sus proyectos, sin reintento (alcance por proyecto)', async ({ page }) => {
  await prepararF5(page)
  await page.goto('/projects/p1/programs/sp9')
  await expect(page.getByText('El registro no existe o no es de sus proyectos.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0)
  await expect(page.getByText(/does not exist/)).toHaveCount(0)
})

// P-05 (flujo F-E): el aporte se decide desde la bandeja, con el detalle al lado y la selección en la URL, sin abrir su ficha. solo
// se ofrece lo que el servidor permite (aquí, «Aprobar»), con motivo, por el diálogo de transición
test('aprobar un aporte desde la bandeja manda el motivo y la versión leída sin salir de la bandeja (P-05)', async ({ page }) => {
  const { escrituras } = await prepararF5(page)
  const ITEM = registro('it1', { social_contribution: 'a9', description: 'Estantes de madera', item_kind: 'BIEN', quantity: 5, line_amount: '1500' })
  const aviso = {
    id: 'n1',
    kind: 'ACTION',
    title: 'Aporte por aprobar',
    body: null,
    link: { type: 'RECORD', object: 'social_contribution', recordId: 'a9' },
    publishAt: '2026-10-06T15:00:00Z',
    expiresAt: null,
    dueAt: null,
    overdue: false,
    source: 'sgspe.approvals',
    read: false,
    snoozedUntil: null,
    dismissible: false
  }
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route(/\/api\/auth\/me\/permissions$/, (r) =>
    r.fulfill(
      json({
        admin: false,
        // la bandeja es de la sección Tareas: se ofrece a quien lee task (navTree.ts)
        objects: {
          project: ['READ'],
          project_assignment: ['READ'],
          task: ['READ'],
          social_contribution: ['READ', 'UPDATE', 'APPROVE'],
          contribution_item: ['READ']
        }
      })
    )
  )
  await page.route(/\/api\/auth\/me\/notifications(\?.*)?$/, (r) => r.fulfill(json({ content: [aviso], page: 0, size: 200, totalElements: 1, totalPages: 1 })))
  await page.route(/\/api\/objects\/contribution_item\/records(\?.*)?$/, (r) => r.fulfill(json(pagina([ITEM]))))
  await page.route(/\/api\/objects\/social_contribution\/records\/a9\/transitions$/, (r) =>
    r.request().method() === 'GET'
      ? r.fulfill(json([{ name: 'approve', label: 'Aprobar', to: 'approved', toLabel: 'Aprobado', allowed: true, reason: null }]))
      : r.fallback()
  )
  await page.route(/\/api\/objects\/social_contribution\/records\/a9\/transitions\/approve$/, (r) => {
    escrituras.push(r.request())
    return r.fulfill(json({ ...NUEVO, state: 'approved' }))
  })
  await page.goto('/tasks/approvals')
  await page.getByRole('list', { name: 'Por aprobar' }).getByRole('link', { name: 'AP-010' }).click()
  await expect(page).toHaveURL(/\/tasks\/approvals\?selected=social_contribution%3Aa9$/)
  const detalle = page.getByRole('region', { name: 'Detalle' })
  await expect(detalle.getByRole('heading', { name: 'Aporte AP-010' })).toBeVisible()
  await expect(detalle.getByText('Estantes de madera')).toBeVisible()
  await expect(detalle.getByRole('button', { name: 'Rechazar' })).toHaveCount(0)
  await detalle.getByRole('button', { name: 'Aprobar' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Aprobar' })
  await dialogo.getByLabel('Motivo (obligatorio)').fill('Dentro del tope')
  await dialogo.getByRole('button', { name: 'Aprobar' }).click()
  await expect(detalle.getByText('Decisión registrada.')).toBeVisible()
  await expect(page).toHaveURL(/\/tasks\/approvals\?selected=social_contribution%3Aa9$/)
  const aprobacion = escrituras.find((r) => new URL(r.url()).pathname === '/api/objects/social_contribution/records/a9/transitions/approve')!
  expect(await aprobacion.headerValue('if-match')).toBe(`"${NUEVO.updatedAt}"`)
  expect(await aprobacion.headerValue('x-change-reason')).toBe("UTF-8''Dentro%20del%20tope")
})
