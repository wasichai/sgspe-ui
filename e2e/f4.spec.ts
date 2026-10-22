import { expect, test, type Page, type Request } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// los recorridos de F4 en un navegador de verdad: reclasificar una queja (el comando con If-Match, motivo e Idempotency-Key, y la
// ficha del registro nuevo), una tarea que lleva a una queja confidencial que la cuenta no lee («Registro reservado») y una
// revisión de riesgo con su clave. la API se simula como en hilo.spec.ts; estas rutas se registran después y ganan a las comunes
const QUEJA = registro(
  'g1',
  {
    project: 'p1',
    code: 'Q-001',
    channel: 'PRESENCIAL',
    received_at: '2026-10-01T14:00:00Z',
    category: 'AGUA Y MEDIO AMBIENTE',
    description: 'El canal de riego quedó turbio',
    severity: 'MEDIA',
    deadline_status: 'AL DIA',
    ack_due_date: '2026-10-08',
    anonymous: false,
    confidential: false
  },
  'acknowledged'
)
const CONSULTA = registro('i9', { project: 'p1', code: 'C-009', description: 'El canal de riego quedó turbio', channel: 'PRESENCIAL' }, 'received')
const RIESGO = registro(
  'k1',
  { project: 'p1', code: 'R-001', title: 'Bloqueo de la vía de acceso', probability: 4, impact: 4, score: 16, risk_level: 'CRITICO', owner_user_id: 'u-srm' },
  'mitigating'
)
const TAREA = registro('t9', { project: 'p1', title: 'Acusar recibo de la queja Q-007', grievance: 'g7', assignee_user_id: 'u-smg' }, 'open')

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

async function prepararF4(page: Page): Promise<Request[]> {
  const escrituras: Request[] = []
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const permisos = {
    project: ['READ'],
    project_assignment: ['READ'],
    grievance: ['READ', 'CREATE', 'UPDATE'],
    inquiry: ['READ', 'CREATE', 'UPDATE'],
    stakeholder_request: ['READ', 'CREATE', 'UPDATE'],
    social_risk: ['READ', 'UPDATE'],
    risk_assessment: ['READ', 'CREATE'],
    task: ['READ', 'UPDATE']
  }
  const rutas: [RegExp, string, unknown, number?][] = [
    [/^\/auth\/me\/permissions$/, 'GET', { admin: false, objects: permisos }],
    [/^\/objects\/project_assignment\/records$/, 'GET', pagina([registro('as', { project: 'p1', member_user_id: 'u-smg', active: true })])],
    [
      /^\/objects\/grievance\/workflow$/,
      'GET',
      flujo('grievance', [
        ['acknowledged', 'Acusada'],
        ['closed', 'Cerrada']
      ])
    ],
    [/^\/objects\/inquiry\/workflow$/, 'GET', flujo('inquiry', [['received', 'Recibida']])],
    [/^\/objects\/social_risk\/workflow$/, 'GET', flujo('social_risk', [['mitigating', 'En mitigación']])],
    [/^\/objects\/task\/workflow$/, 'GET', flujo('task', [['open', 'Abierta']])],
    [/^\/metadata\/objects\/grievance$/, 'GET', definicion('grievance', ['code', 'description', 'category', 'severity', 'response'])],
    [/^\/metadata\/objects\/inquiry$/, 'GET', definicion('inquiry', ['code', 'description', 'response'])],
    [/^\/metadata\/objects\/social_risk$/, 'GET', definicion('social_risk', ['code', 'title', 'owner_user_id'])],
    [/^\/objects\/grievance\/records\/g1$/, 'GET', QUEJA],
    [/^\/objects\/grievance\/records\/g7$/, 'GET', { title: 'Not Found', status: 404 }, 404],
    [
      /^\/objects\/grievance\/records\/g1\/transitions$/,
      'GET',
      [{ name: 'close_reclassified_acknowledged', label: 'Cerrar por reclasificación', to: 'closed', toLabel: 'Cerrada', allowed: true, reason: null }]
    ],
    [/^\/objects\/inquiry\/records\/i9$/, 'GET', CONSULTA],
    [/^\/objects\/social_risk\/records\/k1$/, 'GET', RIESGO],
    [/^\/objects\/[a-z_]+\/records\/[a-z0-9]+\/(transitions|history)$/, 'GET', []],
    [/^\/objects\/[a-z_]+\/records\/[a-z0-9]+\/related\//, 'GET', pagina([])],
    [/^\/objects\/task\/records$/, 'GET', pagina([TAREA])],
    [/^\/objects\/[a-z_]+\/records$/, 'GET', pagina([])],
    [/^\/objects\/grievance\/records$/, 'POST', registro('g10', { project: 'p1', code: 'Q-010' }, 'received')],
    [/^\/sgspe\/transition-checks$/, 'POST', { allowed: true, blocking: [], warnings: [] }, 200],
    [/^\/sgspe\/grievances\/g1\/reclassify$/, 'POST', { original: { ...QUEJA, state: 'closed' }, created: CONSULTA }],
    [
      /^\/sgspe\/social-risks\/k1\/assessments$/,
      'POST',
      { assessment: registro('a1', { score: 12 }), risk: { ...RIESGO, attributes: { ...RIESGO.attributes, risk_level: 'ALTO' } } }
    ]
  ]
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const ruta = new URL(peticion.url()).pathname.replace(/^\/api/, '')
    const encontrada = rutas.find(([patron, metodo]) => patron.test(ruta) && metodo === peticion.method())
    if (!encontrada) return route.fallback()
    const [, metodo, cuerpo, estado] = encontrada
    if (metodo !== 'GET' && !ruta.startsWith('/sgspe/transition-checks')) escrituras.push(peticion)
    return route.fulfill(json(cuerpo, estado ?? (metodo === 'POST' ? 201 : 200)))
  })
  return escrituras
}

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('reclasificar una queja manda If-Match, motivo y clave, y abre la ficha de la consulta nueva (S36)', async ({ page }) => {
  const escrituras = await prepararF4(page)
  await page.goto('/projects/p1/grievances/g1')
  // el título dice lo que se planteó y el código va en el antetítulo (P-09 del rediseño de UX, U-27)
  await expect(page.getByRole('heading', { name: 'El canal de riego quedó turbio', level: 1 })).toBeVisible()
  await expect(page.getByText(/^Queja · Q-001/)).toBeVisible()
  // con dos secundarias a la vista, «Reclasificar…» puede ir en «Más acciones» (CabeceraDeFicha)
  const acciones = page.getByRole('group', { name: 'Acciones del registro' })
  await expect(acciones).toBeVisible()
  const reclasificar = page.getByRole('button', { name: 'Reclasificar…' })
  if (!(await reclasificar.isVisible())) await acciones.getByRole('button', { name: 'Más acciones' }).click()
  await reclasificar.click()
  const dialogo = page.getByRole('dialog', { name: 'Reclasificar' })
  await dialogo.getByRole('radio', { name: 'Consulta' }).check()
  await dialogo.getByLabel('Código del registro nuevo').fill('C-009')
  await dialogo.getByLabel('Motivo (obligatorio)').fill('Es una pregunta, no un reclamo')
  await dialogo.getByRole('button', { name: 'Reclasificar' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/inquiries\/i9$/)
  const [reclasificacion] = escrituras
  expect(new URL(reclasificacion.url()).pathname).toBe('/api/sgspe/grievances/g1/reclassify')
  expect(reclasificacion.postDataJSON()).toEqual({ targetType: 'inquiry', attributes: { code: 'C-009' } })
  expect(await reclasificacion.headerValue('if-match')).toBe(`"${QUEJA.updatedAt}"`)
  expect(await reclasificacion.headerValue('idempotency-key')).toBeTruthy()
})

test('la tarea de una queja confidencial que la cuenta no lee lleva a «Registro reservado» (ASM-095)', async ({ page }) => {
  await prepararF4(page)
  await page.goto('/r/grievance/g7')
  await expect(page.getByText('Registro reservado')).toBeVisible()
  await expect(page).toHaveURL(/\/r\/grievance\/g7$/)
})

test('una revisión de riesgo va con su motivo y su clave, y dice el nivel que dejó (S40)', async ({ page }) => {
  const escrituras = await prepararF4(page)
  await page.goto('/projects/p1/risks/k1')
  await expect(page.getByRole('heading', { name: 'Bloqueo de la vía de acceso', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Nueva revisión' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Nueva revisión' })
  await dialogo.getByLabel('Probabilidad (1 a 5)').selectOption('3')
  await dialogo.getByLabel('Impacto (1 a 5)').selectOption('4')
  await dialogo.getByLabel('Motivo (obligatorio)').fill('Revisión semanal')
  await dialogo.getByRole('button', { name: 'Registrar revisión' }).click()
  await expect(page.getByText('Revisión registrada: el riesgo queda en nivel ALTO.')).toBeVisible()
  const revision = escrituras.find((r) => new URL(r.url()).pathname === '/api/sgspe/social-risks/k1/assessments')!
  expect(revision.postDataJSON()).toMatchObject({ attributes: { probability: 3, impact: 4, residual: false } })
  expect(await revision.headerValue('idempotency-key')).toBeTruthy()
  expect(await revision.headerValue('x-change-reason')).toBe("UTF-8''Revisi%C3%B3n%20semanal")
})

// P-04 y U-30 (rediseño de UX, área 4.5a): registrar una QCS en tres pasos, con «Qué pasará al registrar» al costado del
// formulario en cada paso a 1440 px (lo que jsdom no ve: depende del CSS compilado), y el mismo cuerpo de escritura de siempre
test('registrar una queja en tres pasos con «Qué pasará al registrar» al costado en cada uno (P-04)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const escrituras = await prepararF4(page)
  await page.goto('/projects/p1/attention/new')
  await expect(page.getByRole('heading', { name: 'Registrar queja, consulta o solicitud', level: 1 })).toBeVisible()
  const quePasara = page.getByRole('complementary', { name: 'Qué pasará al registrar' })
  const alCostado = async (paso: string) => {
    const titulo = page.getByRole('heading', { name: paso, level: 2 })
    await expect(titulo).toBeVisible()
    await expect(quePasara).toBeVisible()
    await expect(quePasara.getByText(/El acuse vence \d+ días hábiles/)).toBeVisible()
    const [caja, form] = [await quePasara.boundingBox(), await titulo.boundingBox()]
    expect(caja!.x).toBeGreaterThan(form!.x + form!.width)
  }
  await alCostado('Qué se plantea')
  await page.getByLabel('Código').fill('Q-010')
  await page.getByLabel('Descripción').fill('Polvo en la vía')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await alCostado('Cómo llegó y quién')
  await page.getByLabel('Fecha y hora de recepción', { exact: true }).fill('20/10/2026')
  await page.getByLabel('Fecha y hora de recepción (hora)').fill('10:15')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await alCostado('Revisión')
  await page.getByLabel('Motivo (obligatorio)').fill('recibida en la oficina')
  await page.getByRole('button', { name: 'Registrar queja' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/grievances\/g10$/)
  const alta = escrituras.find((r) => new URL(r.url()).pathname === '/api/objects/grievance/records')!
  expect(alta.postDataJSON()).toMatchObject({
    attributes: { project: 'p1', code: 'Q-010', description: 'Polvo en la vía', received_at: '2026-10-20T15:15:00.000Z', anonymous: false }
  })
  expect(await alta.headerValue('idempotency-key')).toBeTruthy()
})
