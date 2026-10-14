import { expect, test, type Page, type Request } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// los recorridos de F7 en un navegador de verdad: el asistente pregunta a los datos, la bandeja acepta con corrección y motivo, y
// la ficha de un acta corre AI-03. la API se simula como en f5.spec.ts; estas rutas se registran después y ganan a las comunes
const ESTADO = { enabled: true, providerAvailable: true, useCases: ['AI-01', 'AI-02', 'AI-03', 'AI-04', 'AI-05', 'AI-06', 'AI-07', 'AI-08'] }
const QUEJA = registro('g1', { project: 'p1', code: 'Q-001', description: 'Falta agua en el anexo', category: 'OTRO' }, 'received')
const INTERACCION_IA = registro('ai2', {
  project: 'p1',
  use_case: 'AI-08',
  model: 'claude-haiku-4-5',
  prompt_version: 'ai-08@1',
  input_reference: 'grievance:g1'
})
const SUGERENCIA = {
  ...registro(
    's1',
    {
      project: 'p1',
      suggestion_kind: 'CLASIFICACION',
      target_object: 'grievance',
      target_record_id: 'g1',
      suggested_value: '{"field":"category","value":"AGUA Y MEDIO AMBIENTE"}',
      evidence_quote: 'Falta agua en el anexo',
      confidence: 0.74,
      model: 'claude-haiku-4-5',
      ai_interaction: 'ai2'
    },
    'proposed'
  ),
  updatedAt: '2026-10-09T15:00:00Z'
}
const ACTA = registro('ev1', {
  project: 'p1',
  title: 'Acta de la asamblea de agosto',
  evidence_type: 'ACTA',
  classification: 'CONFIDENCIAL',
  file: { id: 'f1', name: 'acta.pdf', contentType: 'application/pdf', size: 2048 }
})
const CANDIDATO = registro(
  'k1',
  { project: 'p1', proposed_text: 'Construir un reservorio', ai_generated: true, confidence: 0.91, source_evidence: 'ev1', ai_interaction: 'ai1' },
  'proposed'
)
const definicion = (objeto: string, campos: [string, Record<string, unknown>][]) => ({
  id: objeto,
  name: objeto,
  fields: campos.map(([name, extra]) => ({ name, label: name, type: 'TEXT', editable: true, visible: true, ...extra }))
})

async function prepararF7(page: Page): Promise<{ escrituras: Request[] }> {
  const escrituras: Request[] = []
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const permisos = {
    project: ['READ'],
    project_assignment: ['READ'],
    ai_interaction: ['READ', 'CREATE'],
    ai_suggestion: ['READ', 'CREATE', 'UPDATE'],
    commitment_candidate: ['READ', 'CREATE', 'UPDATE'],
    evidence: ['READ', 'CREATE', 'UPDATE', 'DOWNLOAD_RESTRICTED'],
    grievance: ['READ', 'UPDATE'],
    person: ['READ']
  }
  const transicionesDeWfK = [
    { name: 'accept', label: 'Aceptar', to: 'accepted', toLabel: 'Aceptada', allowed: true, reason: null },
    { name: 'reject', label: 'Rechazar', to: 'rejected', toLabel: 'Rechazada', allowed: true, reason: null }
  ]
  const rutas: [RegExp, string, () => unknown, number?][] = [
    [/^\/auth\/me\/permissions$/, 'GET', () => ({ admin: false, objects: permisos })],
    [/^\/sgspe\/ai\/status$/, 'GET', () => ESTADO],
    [/^\/objects\/project_assignment\/records$/, 'GET', () => pagina([registro('as', { project: 'p1', member_user_id: 'u-smg', active: true })])],
    [
      /^\/sgspe\/ai\/assistant\/questions$/,
      'POST',
      () => ({
        answer: 'Hay 2 compromisos vencidos.',
        steps: [{ tool: 'get_record', input: { object: 'commitment', id: 'c1' }, summary: 'C-001' }],
        truncated: false,
        interaction: 'ai9'
      }),
      200
    ],
    [/^\/objects\/ai_suggestion\/records$/, 'GET', () => pagina([SUGERENCIA])],
    [/^\/objects\/commitment_candidate\/records$/, 'GET', () => pagina([])],
    [/^\/objects\/ai_suggestion\/records\/s1\/transitions$/, 'GET', () => transicionesDeWfK],
    [/^\/objects\/ai_interaction\/records\/ai2$/, 'GET', () => INTERACCION_IA],
    [/^\/objects\/grievance\/records\/g1$/, 'GET', () => QUEJA],
    [
      /^\/metadata\/objects\/grievance$/,
      'GET',
      () =>
        definicion('grievance', [
          ['code', {}],
          ['description', {}],
          ['category', { label: 'Categoría', type: 'ENUM', enumOptions: ['AGUA Y MEDIO AMBIENTE', 'EMPLEO', 'OTRO'] }]
        ])
    ],
    [
      /^\/sgspe\/ai-suggestions\/s1\/accept$/,
      'POST',
      () => ({ suggestion: { ...SUGERENCIA, state: 'accepted' }, result: { ...QUEJA, attributes: { ...QUEJA.attributes, category: 'EMPLEO' } } }),
      200
    ],
    [/^\/objects\/evidence\/records\/ev1$/, 'GET', () => ACTA],
    [/^\/sgspe\/ai\/runs$/, 'POST', () => ({ interaction: 'ai1', interactions: ['ai1'], suggestions: [], candidates: [CANDIDATO] }), 201],
    [/^\/objects\/[a-z_]+\/records\/[a-z0-9]+\/(transitions|history|documents)$/, 'GET', () => []],
    [/^\/objects\/[a-z_]+\/records\/[a-z0-9]+\/related\//, 'GET', () => pagina([])],
    [/^\/objects\/[a-z_]+\/records$/, 'GET', () => pagina([])]
  ]
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const ruta = new URL(peticion.url()).pathname.replace(/^\/api/, '')
    const encontrada = rutas.find(([patron, metodo]) => patron.test(ruta) && metodo === peticion.method())
    if (!encontrada) return route.fallback()
    const [, metodo, cuerpo, estado] = encontrada
    if (metodo !== 'GET') escrituras.push(peticion)
    return route.fulfill(json(cuerpo(), estado ?? (metodo === 'POST' ? 201 : 200)))
  })
  return { escrituras }
}

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('el asistente pregunta a los datos y dice cómo lo obtuvo', async ({ page }) => {
  await prepararF7(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Preguntar' }).click()
  const panel = page.getByRole('dialog', { name: 'Asistente de IA' })
  await panel.getByLabel('Su pregunta').fill('¿Qué compromisos vencieron?')
  await panel.getByRole('button', { name: 'Preguntar' }).click()
  await expect(panel.getByText('Hay 2 compromisos vencidos.')).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Abrir el registro consultado 1' })).toHaveAttribute('href', '/r/commitment/c1')
  await panel.getByText('Cómo lo obtuvo (pasos: 1)').click()
  await expect(panel.getByText('get_record')).toBeVisible()
})

test('la bandeja acepta una clasificación con corrección y motivo, con clave, versión y motivo', async ({ page }) => {
  const { escrituras } = await prepararF7(page)
  await page.goto('/projects/p1/ai-review')
  await expect(page.getByText('Falta agua en el anexo')).toBeVisible()
  await page.getByRole('button', { name: 'Aceptar…' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Aceptar la propuesta' })
  await dialogo.getByLabel('Categoría').selectOption('EMPLEO')
  await dialogo.getByLabel('Motivo (obligatorio)').fill('La queja es de empleo')
  await dialogo.getByRole('button', { name: 'Aceptar', exact: true }).click()
  await expect(dialogo).toBeHidden()
  const aceptacion = escrituras.find((r) => r.url().endsWith('/api/sgspe/ai-suggestions/s1/accept'))!
  expect(aceptacion.postDataJSON()).toEqual({ attributes: { field: 'category', value: 'EMPLEO' } })
  expect(await aceptacion.headerValue('idempotency-key')).toBeTruthy()
  expect(await aceptacion.headerValue('if-match')).toBe('"2026-10-09T15:00:00Z"')
  expect(await aceptacion.headerValue('x-change-reason')).toBe("UTF-8''La%20queja%20es%20de%20empleo")
})

test('la ficha de un acta detecta posibles compromisos y lleva a la bandeja', async ({ page }) => {
  const { escrituras } = await prepararF7(page)
  await page.goto('/projects/p1/documents/ev1')
  const conIa = page.getByRole('region', { name: 'Con IA' })
  await conIa.getByRole('button', { name: 'Detectar posibles compromisos' }).click()
  await expect(conIa.getByText('Sugerencias por revisar: 0. Candidatos por revisar: 1.')).toBeVisible()
  await expect(conIa.getByRole('link', { name: 'Revisar en la bandeja' })).toHaveAttribute('href', '/projects/p1/ai-review')
  const corrida = escrituras.find((r) => r.url().endsWith('/api/sgspe/ai/runs'))!
  expect(corrida.postDataJSON()).toEqual({ useCase: 'AI-03', target: { object: 'evidence', recordId: 'ev1' } })
  expect(await corrida.headerValue('idempotency-key')).toBeTruthy()
})

test('con la IA ocupada la ficha lo dice y ofrece reintentar, sin decir que el proveedor no responde', async ({ page }) => {
  await prepararF7(page)
  await page.route('**/api/sgspe/ai/runs', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      headers: { 'Retry-After': '10' },
      body: JSON.stringify({ title: 'Service Unavailable', status: 503, detail: 'x', errors: [{ field: 'useCase', message: 'AI_BUSY' }] })
    })
  )
  await page.goto('/projects/p1/documents/ev1')
  const conIa = page.getByRole('region', { name: 'Con IA' })
  await conIa.getByRole('button', { name: 'Detectar posibles compromisos' }).click()
  await expect(conIa.getByText('La IA está ocupada: reintente en unos segundos.')).toBeVisible()
  await expect(conIa.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await expect(conIa.getByText(/no responde/)).toHaveCount(0)
})
