import { expect, test, type Page, type Request } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// los recorridos de F8 en un navegador de verdad: los tableros, el editor de secciones, el borrador en PdfDialog y la emisión. la
// API se simula como en f7.spec.ts; estas rutas se registran después y ganan a las comunes. el tiempo lo maneja page.clock
const PERSONA_ID = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const SHA_MODELO = '0f'.repeat(32)
const SHA_INTERNO = '1e'.repeat(32)
const SHA_EXTERNO = '2d'.repeat(32)
const ind = (code: string, label: string, value: number | null) => ({ code, label, available: true, value })
const EJECUTIVO = {
  dashboard: 'executive',
  computedAt: '2026-10-16T15:00:00Z',
  filters: { project: ['p1'] },
  indicators: [
    ind('KPI-EXE-01', 'Proyectos activos', 1),
    ind('KPI-COM-03', 'Compromisos vencidos', 3),
    {
      ...ind('KPI-EXE-03', 'Tendencia mensual', null),
      series: [
        { period: '2026-09', engagements: 5, grievancesReceived: 2, grievancesClosed: 1, overdueCommitments: 2 },
        { period: '2026-10', engagements: 7, grievancesReceived: 1, grievancesClosed: 2, overdueCommitments: 3 }
      ]
    }
  ],
  byProject: [{ project: 'p1', code: 'PRJ-01', name: 'Proyecto Ejemplo A', indicators: [ind('KPI-COM-03', 'Compromisos vencidos', 3)] }]
}
const MONITOREO = {
  dashboard: 'monitoring',
  computedAt: '2026-10-16T15:00:00Z',
  filters: {},
  indicators: [ind('KPI-STK-06', 'Cambio de postura', 1)],
  rows: [
    {
      number: 3,
      code: 'KPI-STK-06',
      label: 'Porcentaje de grupos de interés de oposición que variaron su posición',
      verificationMeans: 'Reporte de cobertura de grupos de interés contactados',
      deliverable: 'T5',
      available: true,
      value: 1,
      target: null,
      targetSource: 'NONE',
      official: null,
      indicatorId: 'i-stk06'
    }
  ]
}
const entregable = (estado: string) =>
  registro(
    'd1',
    {
      project: 'p1',
      document_code: 'INF-001',
      title: 'Informe de campo de la Comunidad Ejemplo',
      deliverable_type: 'INFORME DE CAMPO Y AVANCE',
      period_start_date: '2026-09-01',
      period_end_date: '2026-09-30',
      community: 'c1',
      draft_generation_status: 'LISTO',
      draft_generated_at: '2026-10-10T15:00:00Z',
      draft_model_sha256: SHA_MODELO,
      draft_revision: 'A'
    },
    estado
  )
const SECCION = registro('sec-antecedentes', {
  deliverable: 'd1',
  section_key: 'antecedentes',
  title: 'Antecedentes',
  sort_order: 2,
  section_kind: 'MIXTA',
  content_origin: 'HUMANO',
  content: 'La comunidad pidió una reunión.',
  reviewed: false
})
const borrador = (status: string, pending: boolean) => ({
  status,
  requestedAt: '2026-10-16T14:59:00Z',
  generatedAt: '2026-10-16T15:00:00Z',
  revision: 'A',
  modelSha256: SHA_MODELO,
  pending,
  levels: [
    { level: 'INTERNO', candidateSha256: pending ? null : SHA_INTERNO },
    { level: 'EXTERNO', candidateSha256: pending ? null : SHA_EXTERNO }
  ],
  warnings: []
})
const definicion = (objeto: string, campos: [string, Record<string, unknown>][]) => ({
  id: objeto,
  name: objeto,
  fields: campos.map(([name, extra]) => ({ name, label: name, type: 'TEXT', editable: true, visible: true, ...extra }))
})

// con pendiente, el borrador se contesta EN COLA hasta que el recorrido llama a terminarBorrador(): el sondeo de 5 s lo ve LISTO
async function prepararF8(page: Page, { estado = 'draft', pendiente = false } = {}): Promise<{ escrituras: Request[]; terminarBorrador: () => void }> {
  const escrituras: Request[] = []
  let pendienteAun = pendiente
  const permisos = {
    project: ['READ'],
    project_assignment: ['READ'],
    deliverable: ['READ', 'CREATE', 'UPDATE', 'GENERATE', 'APPROVE', 'ISSUE', 'EXPORT', 'DOWNLOAD_RESTRICTED'],
    deliverable_section: ['READ', 'UPDATE'],
    deliverable_version: ['READ'],
    ai_interaction: ['READ', 'CREATE'],
    ai_suggestion: ['READ', 'CREATE'],
    deliverable_template: ['READ'],
    indicator: ['READ', 'UPDATE'],
    indicator_measurement: ['READ', 'CREATE'],
    export_log: ['READ', 'CREATE'],
    person: ['READ']
  }
  const rutas: [RegExp, string, () => unknown, number?][] = [
    [/^\/auth\/me\/permissions$/, 'GET', () => ({ admin: false, objects: permisos })],
    [/^\/objects\/project_assignment\/records$/, 'GET', () => pagina([registro('as', { project: 'p1', member_user_id: 'u-smg', active: true })])],
    [/^\/sgspe\/ai\/status$/, 'GET', () => ({ enabled: true, providerAvailable: true, useCases: ['AI-04'] })],
    [/^\/objects\/ai_suggestion\/records$/, 'GET', () => pagina([])],
    [
      /^\/sgspe\/deliverable-types$/,
      'GET',
      () => [
        { type: 'DIAGNOSTICO SOCIAL', version: 1, sections: [] },
        {
          type: 'INFORME DE CAMPO Y AVANCE',
          version: 1,
          sections: [
            { key: 'antecedentes', title: 'Antecedentes', order: 2, kind: 'MIXTA', required: true, assisted: true, guide: 'Describa el contexto del periodo.' }
          ]
        }
      ]
    ],
    [/^\/sgspe\/dashboards\/indicators$/, 'GET', () => [{ code: 'KPI-EXE-01', label: 'Proyectos activos', dashboard: 'executive', available: true }]],
    [/^\/sgspe\/dashboards\/executive$/, 'GET', () => EJECUTIVO],
    [/^\/sgspe\/dashboards\/monitoring$/, 'GET', () => MONITOREO],
    [/^\/objects\/indicator\/records$/, 'GET', () => pagina([registro('i-stk06', { code: 'KPI-STK-06', name: 'Cambio de postura' })])],
    [
      /^\/sgspe\/indicators\/i-stk06\/measurements$/,
      'POST',
      () => ({ title: 'Conflict', status: 409, errors: [{ field: 'indicator', message: 'INDICATOR_NOT_CLOSABLE' }], reason: 'STANCE' }),
      409
    ],
    [/^\/objects\/deliverable\/records\/d1$/, 'GET', () => entregable(estado)],
    [/^\/objects\/deliverable\/records\/d1\/transitions$/, 'GET', () => []],
    [
      /^\/objects\/deliverable\/workflow$/,
      'GET',
      () => ({ id: 'wf', objectName: 'deliverable', name: 'x', label: 'x', enabled: true, definition: { states: [], transitions: [] } })
    ],
    [/^\/objects\/deliverable_section\/records$/, 'GET', () => pagina([SECCION])],
    [/^\/objects\/deliverable_section\/records\/sec-antecedentes$/, 'GET', () => SECCION],
    [/^\/objects\/deliverable_section\/records\/sec-antecedentes$/, 'PUT', () => SECCION, 200],
    [/^\/sgspe\/deliverables\/d1\/draft$/, 'GET', () => (pendienteAun ? borrador('EN COLA', true) : borrador('LISTO', false))],
    [
      /^\/sgspe\/deliverables\/d1\/issue$/,
      'POST',
      () => ({ deliverable: { ...entregable('issued'), attributes: { current_revision: '0' } }, versions: [] }),
      201
    ],
    [/^\/objects\/deliverable_version\/records$/, 'GET', () => pagina([])],
    [/^\/objects\/deliverable\/records\/d1\/documents$/, 'GET', () => []],
    [/^\/objects\/person\/records$/, 'GET', () => pagina([registro(PERSONA_ID, { given_names: 'Persona', surnames: 'Ejemplo 1' })])],
    [
      /^\/metadata\/objects\/deliverable_section$/,
      'GET',
      () =>
        definicion('deliverable_section', [
          ['section_key', {}],
          ['title', {}],
          ['content', { type: 'LONG_TEXT' }],
          ['content_origin', { type: 'ENUM' }],
          ['reviewed', { type: 'BOOLEAN' }],
          ['deliverable', { type: 'RELATION' }]
        ])
    ]
  ]
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const ruta = new URL(peticion.url()).pathname.replace(/^\/api/, '')
    if (ruta === '/sgspe/deliverables/d1/draft/content')
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF' })
    const encontrada = rutas.find(([patron, metodo]) => patron.test(ruta) && metodo === peticion.method())
    if (!encontrada) return route.fallback()
    const [, metodo, cuerpo, estadoHttp] = encontrada
    if (metodo !== 'GET') escrituras.push(peticion)
    return route.fulfill({ status: estadoHttp ?? (metodo === 'POST' ? 201 : 200), contentType: 'application/json', body: JSON.stringify(cuerpo()) })
  })
  return {
    escrituras,
    terminarBorrador: () => {
      pendienteAun = false
    }
  }
}

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('la revisión ejecutiva y el cierre de un periodo con su razón', async ({ page }) => {
  const { escrituras } = await prepararF8(page)
  // desde el rediseño de UX (DD-01) el inicio es «Mi día» con la visión ejecutiva, y S51 vive en /dashboards/executive
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Visión ejecutiva' })).toBeVisible()
  await page.getByRole('link', { name: 'Ver la revisión ejecutiva' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Revisión ejecutiva' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Compromisos vencidos · Proyecto Ejemplo A' })).toHaveAttribute('href', '/projects/p1/commitments')
  // P-07 y U-11: el periodo y la fecha de cálculo bajo el título; los filtros, plegados hasta pedirlos, con fechas dd/mm/aaaa
  await expect(page.getByText(/ · todos sus proyectos · calculado /)).toBeVisible()
  await expect(page.getByLabel('Desde', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cambiar el periodo y los filtros' }).click()
  await page.getByLabel('Desde', { exact: true }).fill('01/09/2026')
  await page.getByLabel('Hasta', { exact: true }).fill('30/09/2026')
  await expect(page).toHaveURL(/periodStart=2026-09-01&periodEnd=2026-09-30/)
  await expect(page.getByText(/^Setiembre de 2026 · todos sus proyectos · calculado /)).toBeVisible()
  // P-07 (i): barras de color sólido, sin el relleno con trama (un patrón url() del decal de ECharts)
  const interacciones = page.getByRole('group', { name: 'Interacciones realizadas' })
  await expect(interacciones.locator('svg path[d$="Z"][fill^="#"]').first()).toBeVisible()
  await expect(page.locator('main svg [fill^="url("]')).toHaveCount(0)
  await page.goto('/dashboards/monitoring?project=p1&month=2026-09')
  await page.getByRole('button', { name: 'Cerrar periodo…' }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByRole('button', { name: 'Cerrar periodo', exact: true }).click()
  await expect(dialogo.getByText(/leen la postura/)).toBeVisible()
  const cierre = escrituras.find((r) => r.url().endsWith('/api/sgspe/indicators/i-stk06/measurements'))!
  expect(cierre.postDataJSON()).toEqual({ project: 'p1', attributes: { period_start_date: '2026-09-01', period_end_date: '2026-09-30' } })
  expect(await cierre.headerValue('idempotency-key')).toBeTruthy()
})

test('una sección se edita en el navegador con una mención y se guarda', async ({ page }) => {
  const { escrituras } = await prepararF8(page)
  await page.goto('/reports/deliverables/d1?seccion=antecedentes')
  // los tipos de entregable dan la guía de redacción y ofrecen la IA en las secciones asistidas
  await expect(page.getByText('Describa el contexto del periodo.')).toBeVisible()
  await expect(page.getByText('Guía de redacción')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sugerir con IA' })).toBeVisible()
  const editor = page.getByRole('textbox', { name: 'Texto de la sección' })
  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Con acta de ')
  await page.getByRole('searchbox', { name: 'Buscar una persona' }).fill('Pers')
  await page.getByRole('button', { name: 'Persona Ejemplo 1' }).click()
  await expect(editor).toContainText('@Persona Ejemplo 1')
  await page.getByRole('button', { name: 'Guardar sección' }).click()
  await expect.poll(() => escrituras.filter((r) => r.method() === 'PUT').length).toBe(1)
  const cambio = escrituras.find((r) => r.method() === 'PUT')!
  const contenido = String(cambio.postDataJSON().attributes.content)
  expect(contenido).toContain('La comunidad pidió una reunión. Con acta de')
  expect(contenido).toContain(`[[person:${PERSONA_ID}]]`)
  expect(await cambio.headerValue('if-match')).toBe('"2026-10-05T15:00:00Z"')
})

test('el borrador se sondea y se ve en el navegador sin violar la CSP', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { violaciones: string[] }
    w.violaciones = []
    document.addEventListener('securitypolicyviolation', (e) => {
      // el <style> en línea del bloqueo de scroll de los diálogos modales (react-remove-scroll, por react-style-singleton, dentro de
      // Radix) no se puede configurar sin un nonce: se admite solo ese y solo con un modal abierto; se sigue en wasichai-ui. cualquier otra
      // violación (frame-src, estilos de tiptap, lo nuevo) falla
      if (e.effectiveDirective === 'style-src-elem' && e.blockedURI === 'inline' && document.querySelector('[role="dialog"]')) return
      w.violaciones.push(`${e.effectiveDirective} ${e.blockedURI} ${e.sourceFile}`)
    })
  })
  await page.clock.install({ time: new Date('2026-10-16T15:00:00Z') })
  const { terminarBorrador } = await prepararF8(page, { pendiente: true })
  await page.goto('/reports/deliverables/d1?seccion=antecedentes')
  // el editor con injectCSS: false monta sin el <style> de tiptap que style-src 'self' bloquearía
  await expect(page.getByRole('textbox', { name: 'Texto de la sección' })).toBeVisible()
  await expect(page.getByText('Se prepara el borrador: el estado se consulta cada 5 segundos.')).toBeVisible()
  terminarBorrador()
  await page.clock.runFor(5000)
  await expect(page.getByText('Estado del borrador: Listo')).toBeVisible()
  await page.getByRole('button', { name: 'Ver el PDF «Interno»' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Borrador «Interno» (con la marca BORRADOR)' })
  await expect(dialogo.locator('iframe')).toBeVisible()
  await expect(dialogo.locator('iframe')).toHaveAttribute('src', /^blob:/)
  const violaciones = await page.evaluate(() => (window as unknown as { violaciones: string[] }).violaciones)
  expect(violaciones).toEqual([])
})

test('emite con la lista EXTERNO y el SHA-256 revisado', async ({ page }) => {
  const { escrituras } = await prepararF8(page, { estado: 'approved' })
  await page.goto('/reports/deliverables/d1')
  await page.getByRole('button', { name: 'Emitir…' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Emitir el entregable' })
  await expect(dialogo.getByText(SHA_MODELO)).toBeVisible()
  for (const casilla of await dialogo.getByRole('checkbox').all()) await casilla.check()
  await dialogo.getByLabel('Motivo (obligatorio)').fill('Entrega al cliente')
  await dialogo.getByRole('button', { name: 'Emitir', exact: true }).click()
  await expect(page.getByText('Entregable emitido en su revisión 0.')).toBeVisible()
  const emision = escrituras.find((r) => r.url().endsWith('/api/sgspe/deliverables/d1/issue'))!
  expect(emision.postDataJSON()).toEqual({ draftModelSha256: SHA_MODELO, checklistConfirmed: true })
  expect(await emision.headerValue('idempotency-key')).toBeTruthy()
  expect(await emision.headerValue('if-match')).toBe('"2026-10-05T15:00:00Z"')
  expect(await emision.headerValue('x-change-reason')).toBe("UTF-8''Entrega%20al%20cliente")
})
