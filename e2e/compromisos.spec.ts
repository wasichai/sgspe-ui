import { expect, test, type Page, type Request } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// los recorridos de F3 en un navegador de verdad (flujos 9 y 10, S04): la ficha del compromiso, la entrega con el acta subida en
// dos pasos (el archivo a wasichai-files y el registro con Idempotency-Key) y vinculada por id, y la campana de avisos que lleva
// a la ficha por /r/…. la API se simula como en hilo.spec.ts; estas rutas se registran después y ganan a las comunes
const COMPROMISO = registro(
  'c1',
  {
    project: 'p1',
    code: 'C-001',
    title: 'Reservorio de agua para Tunas Pampa',
    resource_type: 'MATERIAL',
    amount: 25000,
    currency: 'PEN',
    executed_amount: 0,
    due_date: '2026-11-30',
    deadline_status: 'AL DIA',
    owner_user_id: 'u-otro',
    owner_user_email: 'cmm@sgspe.test'
  },
  'in_progress'
)
const ACTA = registro('ev1', { project: 'p1', title: 'Acta firmada', evidence_type: 'ACTA DE ENTREGA', classification: 'INTERNA' })

async function prepararCompromisos(page: Page): Promise<Request[]> {
  const escrituras: Request[] = []
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const permisos = Object.fromEntries(
    [
      ['project', ['READ']],
      ['project_assignment', ['READ']],
      ['commitment', ['READ', 'UPDATE']],
      ['delivery', ['READ', 'CREATE', 'UPDATE']],
      ['evidence', ['READ', 'CREATE', 'UPDATE', 'DOWNLOAD_RESTRICTED']],
      ['task', ['READ']],
      ['stakeholder', ['READ']],
      ['engagement', ['READ']]
    ].map(([o, a]) => [o, a])
  )
  const rutas: [RegExp, string, unknown][] = [
    [/^\/auth\/me\/permissions$/, 'GET', { admin: false, objects: permisos }],
    [
      /^\/objects\/commitment\/workflow$/,
      'GET',
      {
        id: 'w',
        objectName: 'commitment',
        name: 'commitment',
        label: 'commitment',
        enabled: true,
        definition: { states: [{ name: 'in_progress', label: 'En ejecución', type: 'INTERMEDIATE' }], transitions: [] }
      }
    ],
    [/^\/objects\/commitment\/records\/c1$/, 'GET', COMPROMISO],
    [/^\/objects\/commitment\/records\/c1\/transitions$/, 'GET', []],
    [/^\/objects\/commitment\/records\/c1\/related\//, 'GET', pagina([])],
    [
      /^\/objects\/(delivery|task|commitment_candidate|commitment_action|commitment_milestone|commitment_reschedule|commitment_dependency)\/records$/,
      'GET',
      pagina([])
    ],
    [/^\/objects\/commitment\/records\/c1\/history$/, 'GET', []],
    [
      /^\/metadata\/objects\/evidence$/,
      'GET',
      {
        id: 'ev',
        name: 'evidence',
        fields: [
          { name: 'evidence_type', type: 'ENUM', enumOptions: ['ACTA DE ENTREGA', 'FOTO'], editable: true, visible: true },
          { name: 'classification', type: 'ENUM', enumOptions: ['PUBLICA', 'INTERNA'], editable: true, visible: true },
          { name: 'title', type: 'TEXT', editable: true, visible: true }
        ]
      }
    ],
    [
      /^\/metadata\/objects\/delivery$/,
      'GET',
      {
        id: 'dl',
        name: 'delivery',
        fields: ['delivery_date', 'place', 'delivered_items', 'delivered_amount', 'conformity_given', 'conformity_by'].map((name) => ({
          name,
          type: 'TEXT',
          editable: true,
          visible: true
        }))
      }
    ],
    [/^\/objects\/evidence\/files\/file$/, 'POST', { id: 'f1', name: 'acta.pdf', contentType: 'application/pdf', size: 8, sha256: 'ab' }],
    [/^\/sgspe\/evidence$/, 'POST', ACTA],
    [/^\/sgspe\/commitments\/c1\/deliveries$/, 'POST', { delivery: registro('dl1', { commitment: 'c1' }), commitment: COMPROMISO }],
    [
      /^\/auth\/me\/notifications\/summary$/,
      'GET',
      {
        kinds: { ACTION: { active: 1, unread: 1, overdue: 0 }, WARNING: { active: 1, unread: 1, overdue: 0 }, INFO: { active: 0, unread: 0, overdue: 0 } },
        latest: null
      }
    ],
    [
      /^\/auth\/me\/notifications$/,
      'GET',
      {
        content: [
          {
            id: 'n1',
            kind: 'WARNING',
            title: 'Compromiso C-001 por vencer',
            body: null,
            link: { type: 'RECORD', object: 'commitment', recordId: 'c1' },
            publishAt: '2026-10-08T15:00:00Z',
            expiresAt: null,
            dueAt: null,
            overdue: false,
            source: 'sgspe.deadlines',
            read: false,
            snoozedUntil: null,
            dismissible: true
          }
        ],
        page: 0,
        size: 5,
        totalElements: 1,
        totalPages: 1
      }
    ],
    [/^\/auth\/me\/notifications\/n1\/read$/, 'POST', null]
  ]
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const ruta = new URL(peticion.url()).pathname.replace(/^\/api/, '')
    const encontrada = rutas.find(([patron, metodo]) => patron.test(ruta) && metodo === peticion.method())
    if (!encontrada) return route.fallback()
    if (peticion.method() !== 'GET') escrituras.push(peticion)
    const [, metodo, cuerpo] = encontrada
    return cuerpo === null ? route.fulfill({ status: 204 }) : route.fulfill(json(cuerpo, metodo === 'POST' ? 201 : 200))
  })
  return escrituras
}

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

// etapa 2 de la revisión de UX (P-01 del rediseño): desde «Lo que me toca hoy» se llega a la ficha de un compromiso a cargo en un clic
test('el inicio lleva a la ficha de un compromiso en un clic', async ({ page }) => {
  await prepararCompromisos(page)
  // la lista de los compromisos a su cargo (las rutas registradas después ganan a las de prepararCompromisos)
  await page.route(/\/api\/objects\/commitment\/records\?/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pagina([COMPROMISO])) })
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.getByRole('region', { name: 'Lo que me toca hoy' }).getByRole('link', { name: /C-001/ }).click()
  await expect(page.getByRole('heading', { name: 'Reservorio de agua para Tunas Pampa', level: 1 })).toBeVisible()
  await expect(page).toHaveURL(/\/projects\/p1\/commitments\/c1$/)
})

// etapa 1 de la revisión de UX: en una ficha, las migas dicen dónde vive el registro, la barra lateral marca el módulo y el
// título del documento lleva el código; las migas llevan de vuelta a la lista
test('la ficha dice dónde se está: migas, sección marcada y título del documento', async ({ page }) => {
  await prepararCompromisos(page)
  await page.goto('/projects/p1/commitments/c1')
  await expect(page.getByRole('heading', { name: 'Reservorio de agua para Tunas Pampa', level: 1 })).toBeVisible()
  const migas = page.getByRole('navigation', { name: 'Ubicación' })
  await expect(migas.getByText('C-001')).toHaveAttribute('aria-current', 'page')
  await expect(migas.getByRole('link', { name: /^PRJ-01 · / })).toHaveAttribute('href', '/projects/p1/overview')
  await expect(page.getByRole('navigation', { name: 'Secciones', exact: true }).getByRole('link', { name: 'Compromisos' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(page).toHaveTitle(/^C-001 Reservorio de agua para Tunas Pampa · .* · SGSPE$/)
  await migas.getByRole('link', { name: 'Compromisos' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/commitments$/)
})

// D6 de la revisión de UX: en el teléfono las pestañas de la ficha caben en la pantalla y se desplazan con su flecha, sin
// empujar el contenido hacia la derecha
test('a 390 px las pestañas de la ficha se desplazan sin salirse de la pantalla', async ({ page }) => {
  await prepararCompromisos(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/projects/p1/commitments/c1')
  const pestanas = page.getByRole('tablist', { name: 'Reservorio de agua para Tunas Pampa' })
  await expect(pestanas).toBeVisible()
  const caja = await pestanas.boundingBox()
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(390)
  await expect(pestanas.locator('..').getByRole('button', { name: 'Ver más secciones' })).toBeVisible()
})

test('la entrega lleva el acta subida en dos pasos, por id, con su clave y su motivo (flujo 10)', async ({ page }) => {
  const escrituras = await prepararCompromisos(page)
  await page.goto('/projects/p1/commitments/c1')
  await expect(page.getByRole('heading', { name: 'Reservorio de agua para Tunas Pampa', level: 1 })).toBeVisible()
  await page.getByRole('tab', { name: 'Entregas' }).click()
  await page.getByRole('button', { name: 'Registrar entrega' }).click()
  const panel = page.getByRole('dialog')
  const evidencia = panel.getByRole('group', { name: 'Subir una evidencia' })
  await evidencia.getByLabel(/Archivo/).setInputFiles({ name: 'acta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') })
  await expect(evidencia.getByLabel('Tipo de evidencia')).toHaveValue('ACTA DE ENTREGA')
  await evidencia.getByLabel('Clasificación').selectOption('INTERNA')
  await evidencia.getByRole('button', { name: 'Subir evidencia' }).click()
  await expect(panel.getByText('Acta firmada · ACTA DE ENTREGA')).toBeVisible()
  await panel.getByLabel('Monto entregado').fill('25,000')
  await panel.getByLabel('El grupo de interés dio conformidad').check()
  await panel.getByLabel('Quiénes dieron la conformidad').fill('Junta directiva')
  await panel.getByLabel('Motivo (obligatorio)').fill('Entrega en obra')
  await panel.getByRole('button', { name: 'Guardar entrega' }).click()
  await expect(panel).toBeHidden()
  const rutasEscritas = escrituras.map((r) => new URL(r.url()).pathname)
  expect(rutasEscritas).toEqual(['/api/objects/evidence/files/file', '/api/sgspe/evidence', '/api/sgspe/commitments/c1/deliveries'])
  const entrega = escrituras[2]
  expect(entrega.postDataJSON()).toMatchObject({ attributes: { delivered_amount: '25000', conformity_given: true }, evidence: ['ev1'] })
  expect(await entrega.headerValue('idempotency-key')).toBeTruthy()
  expect(await escrituras[1].headerValue('idempotency-key')).toBeTruthy()
})

test('la campana cuenta los avisos sin leer y abrir uno lleva a la ficha del registro (S04)', async ({ page }) => {
  const escrituras = await prepararCompromisos(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Avisos, 2 sin leer' }).click()
  await page
    .getByRole('region', { name: 'Últimos avisos' })
    .getByRole('button', { name: /Compromiso C-001 por vencer/ })
    .click()
  await expect(page).toHaveURL(/\/projects\/p1\/commitments\/c1$/)
  await expect(page.getByRole('heading', { name: 'Reservorio de agua para Tunas Pampa', level: 1 })).toBeVisible()
  expect(escrituras.map((r) => new URL(r.url()).pathname)).toContain('/api/auth/me/notifications/n1/read')
})

// etapa 5 de la revisión de UX: «Crear relacionado» desde la interacción abre el alta con ella como origen, y el compromiso
// creado llega a su ficha con el origen enlazado en «De dónde viene»
test('desde una interacción se crea el compromiso con ella como origen y la ficha lo enlaza', async ({ page }) => {
  const campo = (name: string, extra: Record<string, unknown> = {}) => ({ name, label: name, type: 'TEXT', editable: true, visible: true, ...extra })
  const enumeracion = (name: string, opciones: string[]) => campo(name, { type: 'ENUM', enumOptions: opciones })
  const definicion = {
    id: 'cm',
    name: 'commitment',
    fields: [
      campo('code'),
      campo('title'),
      campo('description', { type: 'LONG_TEXT' }),
      enumeracion('request_medium', ['ACUERDO EN REUNION']),
      campo('agreed_date', { type: 'DATE' }),
      campo('amount', { type: 'DECIMAL' }),
      enumeracion('currency', ['PEN', 'USD']),
      campo('due_date', { type: 'DATE' }),
      campo('origin_engagement', { type: 'RELATION', relationTarget: 'engagement' }),
      campo('origin_justification', { type: 'LONG_TEXT' }),
      campo('project', { type: 'RELATION', relationTarget: 'project' })
    ]
  }
  const creado = registro('c9', { project: 'p1', code: 'C-009', title: 'Canal de riego', origin_engagement: 'e1', currency: 'PEN' }, 'draft')
  const altas: Request[] = []
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const permisos = Object.fromEntries(
    [
      ['project', ['READ']],
      ['project_assignment', ['READ']],
      ['commitment', ['READ', 'CREATE']],
      ['engagement', ['READ']],
      ['stakeholder', ['READ']],
      ['exploration_campaign', ['READ']]
    ].map(([o, a]) => [o, a])
  )
  const rutas: [RegExp, string, unknown][] = [
    [/^\/auth\/me\/permissions$/, 'GET', { admin: false, objects: permisos }],
    [/^\/metadata\/objects\/commitment$/, 'GET', definicion],
    [
      /^\/objects\/commitment\/workflow$/,
      'GET',
      {
        id: 'w',
        objectName: 'commitment',
        name: 'commitment',
        label: 'commitment',
        enabled: true,
        definition: { states: [{ name: 'draft', label: 'Borrador', type: 'INITIAL' }], transitions: [] }
      }
    ],
    [/^\/objects\/commitment\/records$/, 'POST', creado],
    [/^\/objects\/commitment\/records$/, 'GET', pagina([])],
    [/^\/objects\/commitment\/records\/c9$/, 'GET', creado],
    [/^\/objects\/commitment\/records\/c9\/transitions$/, 'GET', []],
    [/^\/objects\/commitment\/records\/c9\/related\//, 'GET', pagina([])],
    [/^\/objects\/commitment\/records\/c9\/history$/, 'GET', []],
    [/^\/objects\/[a-z_]+\/records$/, 'GET', pagina([])]
  ]
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const ruta = new URL(peticion.url()).pathname.replace(/^\/api/, '')
    const encontrada = rutas.find(([patron, metodo]) => patron.test(ruta) && metodo === peticion.method())
    // las listas de la interacción y del proyecto siguen con las respuestas comunes
    if (
      !encontrada ||
      (encontrada[0].source === '^\\/objects\\/[a-z_]+\\/records$' &&
        /^\/objects\/(engagement|stakeholder|project|project_assignment|organization)\//.test(ruta))
    )
      return route.fallback()
    if (peticion.method() === 'POST') altas.push(peticion)
    return route.fulfill(json(encontrada[2], peticion.method() === 'POST' ? 201 : 200))
  })

  await page.goto('/projects/p1/engagements/e1')
  await page.getByRole('button', { name: 'Crear relacionado' }).click()
  await page.getByRole('link', { name: 'Registrar compromiso' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/commitments\/new\?origin_engagement=e1$/)
  // el origen viene propuesto: la interacción, sin buscarla
  await expect(page.getByRole('heading', { name: 'Nuevo compromiso', level: 1 })).toBeVisible()
  await expect(page.getByRole('form', { name: 'Origen' }).getByText(/Asamblea de agosto/)).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('textbox', { name: 'Código' }).fill('C-009')
  await page.getByRole('textbox', { name: 'Título' }).fill('Canal de riego')
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('textbox', { name: 'Monto' }).fill('500')
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('textbox', { name: 'Motivo (obligatorio)' }).fill('Acordado en la asamblea')
  await page.getByRole('button', { name: 'Guardar borrador' }).click()

  await expect(page).toHaveURL(/\/projects\/p1\/commitments\/c9$/)
  expect(altas).toHaveLength(1)
  expect(altas[0].postDataJSON()).toMatchObject({ attributes: { project: 'p1', code: 'C-009', origin_engagement: 'e1' } })
  const deDondeViene = page.getByRole('complementary', { name: 'Trazabilidad' }).getByRole('region', { name: 'De dónde viene' })
  await expect(deDondeViene.getByRole('link', { name: /Asamblea de agosto/ })).toBeVisible()
})
