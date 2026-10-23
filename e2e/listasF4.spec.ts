import { expect, test, type Locator, type Page } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// P-02 en las listas de QCS, Riesgos, alerta temprana y Programas (rediseño de UX, área 4.3b), en un navegador de verdad: lo que jsdom no ve porque
// depende del CSS compilado. una sola fila de pestañas (las vistas van en el selector de la barra de filtros), la tabla sin
// desborde a 1440 px y, a 390 px, tarjetas en lugar de la tabla. la API se simula como en f4.spec.ts: estas rutas ganan a las
// comunes
const QUEJA = registro(
  'g1',
  {
    project: 'p1',
    code: 'Q-001',
    channel: 'PRESENCIAL',
    category: 'AGUA Y MEDIO AMBIENTE',
    severity: 'MEDIA',
    description: 'El canal de riego quedó turbio después de las obras de la plataforma en la quebrada alta',
    deadline_status: 'VENCIDO',
    ack_due_date: '2026-10-02',
    owner_user_email: 'gvm@sgspe.test',
    anonymous: true
  },
  'received'
)
const CONSULTA = registro(
  'i1',
  {
    project: 'p1',
    code: 'C-001',
    channel: 'TELEFONO',
    category: 'EMPLEO LOCAL',
    description: '¿Cuándo abre la convocatoria de empleo local para la comunidad?',
    deadline_status: 'AL DIA',
    response_due_date: '2026-10-20',
    owner_user_email: 'rel@sgspe.test',
    anonymous: false
  },
  'received'
)
const RIESGOS = [
  registro(
    'k1',
    {
      project: 'p1',
      code: 'R-001',
      title: 'Bloqueo de la vía de acceso por la comunidad de la parte alta durante la temporada de lluvias',
      category: 'EXPECTATIVAS Y BENEFICIOS',
      probability: 4,
      impact: 4,
      score: 16,
      risk_level: 'CRITICO',
      review_status: 'AL DIA',
      next_review_date: '2026-10-30',
      owner_user_email: 'srm@sgspe.test'
    },
    'mitigating'
  ),
  registro(
    'k2',
    { project: 'p1', code: 'R-002', title: 'Desinformación sobre el uso del agua', category: 'AGUA', owner_user_email: 'rel@sgspe.test' },
    'identified'
  )
]
const ALERTA = registro(
  'w1',
  { project: 'p1', title: 'Asamblea de protesta anunciada en la radio local', detected_at: '2026-10-03T13:00:00Z', severity: 'ALTO' },
  'detected'
)
const PROGRAMA = registro('sp1', { project: 'p1', code: 'PS-001', name: 'Programa de agua segura para las comunidades de la cuenca alta' }, 'executing')
const APORTE = registro(
  'a1',
  { project: 'p1', code: 'AP-001', contribution_type: 'DONACION', total_amount: '1750.5', currency: 'PEN', recipient_organization: 'o1' },
  'requested'
)

const flujo = (objeto: string, estados: [string, string][]) => ({
  id: objeto,
  objectName: objeto,
  name: objeto,
  label: objeto,
  enabled: true,
  definition: { states: estados.map(([name, label]) => ({ name, label, type: 'INTERMEDIATE' })), transitions: [] }
})

async function prepararListas(page: Page): Promise<void> {
  const permisos = {
    project: ['READ'],
    project_assignment: ['READ'],
    organization: ['READ'],
    grievance: ['READ'],
    inquiry: ['READ'],
    stakeholder_request: ['READ'],
    social_risk: ['READ'],
    early_warning: ['READ'],
    early_warning_rule: ['READ'],
    social_program: ['READ'],
    social_contribution: ['READ']
  }
  const rutas: [RegExp, unknown][] = [
    [/^\/auth\/me\/permissions$/, { admin: false, objects: permisos }],
    [/^\/objects\/grievance\/workflow$/, flujo('grievance', [['received', 'Recibida']])],
    [/^\/objects\/inquiry\/workflow$/, flujo('inquiry', [['received', 'Recibida']])],
    [
      /^\/sgspe\/attention\/queue$/,
      {
        content: [
          { type: 'grievance', group: 'overdue', record: QUEJA },
          { type: 'inquiry', group: 'onTime', record: CONSULTA }
        ],
        page: 0,
        size: 25,
        totalElements: 2,
        totalPages: 1,
        views: { attention: 2, grievances: 1, inquiries: 1, requests: 0, mine: 0, all: 2 },
        groups: { overdue: 1, dueSoon: 0, onTime: 1 },
        unfiltered: 2,
        openDueSoon: 0,
        readable: ['grievance', 'inquiry', 'stakeholder_request']
      }
    ],
    [/^\/sgspe\/dashboards\/indicators\/KPI-GRV-02$/, { code: 'KPI-GRV-02', label: 'QCS abiertas', available: true, value: 2, unit: 'QCS' }],
    [/^\/sgspe\/dashboards\/indicators\/KPI-GRV-06$/, { code: 'KPI-GRV-06', label: 'QCS fuera de plazo', available: true, value: 1, unit: 'QCS' }],
    [
      /^\/sgspe\/dashboards\/indicators\/KPI-GRV-07$/,
      { code: 'KPI-GRV-07', label: '#6 QCS absueltas', available: true, value: 0, unit: '%', numerator: 0, denominator: 4 }
    ],
    [/^\/objects\/social_risk\/workflow$/, flujo('social_risk', [['mitigating', 'En mitigación']])],
    [/^\/objects\/social_risk\/records$/, pagina(RIESGOS)],
    [/^\/objects\/early_warning\/workflow$/, flujo('early_warning', [['detected', 'Detectada']])],
    [/^\/objects\/early_warning\/records$/, pagina([ALERTA])],
    [/^\/objects\/social_program\/records$/, pagina([PROGRAMA])],
    [/^\/objects\/social_contribution\/records$/, pagina([APORTE])],
    [/^\/objects\/[a-z_]+\/records$/, pagina([])]
  ]
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const ruta = new URL(peticion.url()).pathname.replace(/^\/api/, '')
    const encontrada = rutas.find(([patron]) => patron.test(ruta))
    if (!encontrada || peticion.method() !== 'GET') return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(encontrada[1]) })
  })
}

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
  await prepararListas(page)
})

// la tabla cabe en su contenedor (no se desplaza por dentro) y el contenido no se desplaza en horizontal
async function sinDesborde(page: Page, tabla: Locator) {
  await expect(tabla).toBeVisible()
  const contenedor = await tabla.evaluate((t) => {
    const caja = t.parentElement!
    return { ancho: caja.scrollWidth, visible: caja.clientWidth }
  })
  expect(contenedor.ancho).toBeLessThanOrEqual(contenedor.visible)
  const main = await page.evaluate(() => {
    const m = document.querySelector('main')!
    return { ancho: m.scrollWidth, visible: m.clientWidth, pagina: document.documentElement.scrollWidth, vista: window.innerWidth }
  })
  expect(main.ancho).toBeLessThanOrEqual(main.visible)
  expect(main.pagina).toBeLessThanOrEqual(main.vista)
}

test.describe('a 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('la lista de QCS: las vistas en el selector, ninguna segunda fila de pestañas y la tabla sin desborde', async ({ page }) => {
    await page.goto('/projects/p1/attention')
    const barra = page.getByRole('group', { name: 'Filtros' })
    await expect(barra.getByRole('radio', { name: 'Atención, 2' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('tablist')).toHaveCount(0)
    // las cifras se entienden sin conocer el modelo (U-24)
    const respondidas = page.getByRole('region', { name: 'Respondidas' })
    await expect(respondidas).toContainText('0 de 4 recibidas en el periodo tienen respuesta')
    await expect(respondidas).not.toContainText('/ 4')
    await sinDesborde(page, page.getByRole('table', { name: 'Quejas, consultas y solicitudes: Vencidas' }))
  })

  test('el registro de riesgos: el selector de páginas arriba, las vistas en la barra y la tabla sin desborde', async ({ page }) => {
    await page.goto('/projects/p1/risks')
    await expect(page.getByRole('navigation', { name: 'Páginas de Riesgos' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Filtros' }).getByRole('radio', { name: 'Registro y matriz, 2' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await sinDesborde(page, page.getByRole('table', { name: 'Riesgos', exact: true }))
  })

  test('las alertas: las vistas en la barra, sin la fila de pestañas vieja, y la tabla sin desborde', async ({ page }) => {
    await page.goto('/projects/p1/risks/warnings')
    await expect(page.getByRole('navigation', { name: 'Páginas de Riesgos' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Filtros' }).getByRole('radio', { name: /^Por triar\b/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await sinDesborde(page, page.getByRole('table', { name: 'Alertas del proyecto' }))
  })

  // 05-especificacion §1.6: el encabezado ordenable es un botón y el th dice el orden con aria-sort
  test('las alertas se ordenan por la fecha desde su encabezado, con aria-sort y la consulta del servidor', async ({ page }) => {
    await page.goto('/projects/p1/risks/warnings')
    const tabla = page.getByRole('table', { name: 'Alertas del proyecto' })
    const detectada = tabla.getByRole('columnheader', { name: 'Detectada' })
    await expect(detectada).toHaveAttribute('aria-sort', 'descending')
    const pedida = page.waitForRequest((r) => r.url().includes('/objects/early_warning/records?') && r.url().includes('dir=asc'))
    await detectada.getByRole('button', { name: 'Detectada' }).click()
    await pedida
    await expect(detectada).toHaveAttribute('aria-sort', 'ascending')
  })

  // 05-especificacion §1.4: la búsqueda espera 300 ms tras la última tecla: escribir de corrido es una sola consulta
  test('la búsqueda de las alertas se manda una vez al terminar de escribir, no con cada tecla', async ({ page }) => {
    await page.goto('/projects/p1/risks/warnings')
    await expect(page.getByRole('table', { name: 'Alertas del proyecto' })).toBeVisible()
    const busquedas: string[] = []
    page.on('request', (r) => {
      const q = new URL(r.url()).searchParams.get('q')
      if (r.url().includes('/objects/early_warning/records?') && q) busquedas.push(q)
    })
    const caja = page.getByRole('searchbox', { name: 'Buscar por título' })
    await caja.pressSequentially('agua', { delay: 50 })
    await expect(caja).toHaveValue('agua')
    await expect(page).toHaveURL(/[?&]q=agua(&|$)/)
    expect(new Set(busquedas)).toEqual(new Set(['agua']))
  })

  test('programas: Programas y Aportes en un solo selector, nunca dos listados apilados, y la tabla sin desborde', async ({ page }) => {
    await page.goto('/projects/p1/programs')
    const barra = page.getByRole('group', { name: 'Filtros' })
    await expect(barra.getByRole('radio', { name: 'Programas, 1' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await sinDesborde(page, page.getByRole('table', { name: 'Programas del alcance' }))
    await expect(page.getByRole('table', { name: 'Aportes del alcance' })).toHaveCount(0)
    await barra.getByRole('radio', { name: /^Aportes en curso\b/ }).click()
    await expect(page).toHaveURL(/\/projects\/p1\/programs\?view=enCurso$/)
    await sinDesborde(page, page.getByRole('table', { name: 'Aportes del alcance' }))
    await expect(page.getByRole('table', { name: 'Programas del alcance' })).toHaveCount(0)
  })
})

test.describe('a 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('la lista de QCS es de tarjetas con su estado', async ({ page }) => {
    await page.goto('/projects/p1/attention')
    const tarjetas = page.getByRole('list', { name: 'Quejas, consultas y solicitudes: Vencidas' })
    await expect(tarjetas.getByRole('listitem').filter({ hasText: 'Q-001' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Quejas, consultas y solicitudes: Vencidas' })).toHaveCount(0)
  })

  test('el registro de riesgos es de tarjetas con su nivel', async ({ page }) => {
    await page.goto('/projects/p1/risks')
    const tarjetas = page.getByRole('list', { name: 'Riesgos' })
    await expect(tarjetas.getByRole('listitem').filter({ hasText: 'R-001' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Riesgos', exact: true })).toHaveCount(0)
  })

  test('las alertas son tarjetas', async ({ page }) => {
    await page.goto('/projects/p1/risks/warnings')
    const tarjetas = page.getByRole('list', { name: 'Alertas del proyecto' })
    await expect(tarjetas.getByRole('listitem').filter({ hasText: 'Asamblea de protesta' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Alertas del proyecto' })).toHaveCount(0)
  })

  test('los programas y los aportes son tarjetas', async ({ page }) => {
    await page.goto('/projects/p1/programs')
    await expect(page.getByRole('list', { name: 'Programas del alcance' }).getByRole('listitem').filter({ hasText: 'PS-001' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Programas del alcance' })).toHaveCount(0)
    await page.goto('/projects/p1/programs?view=enCurso')
    await expect(page.getByRole('list', { name: 'Aportes del alcance' }).getByRole('listitem').filter({ hasText: 'AP-001' })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Aportes del alcance' })).toHaveCount(0)
  })
})
