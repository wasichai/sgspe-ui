import { expect, test, type Page } from '@playwright/test'
import { pagina, prepararApi, registro, USUARIO } from './api'

// P-01 del rediseño de UX (DD-01, U-01 y U-13) en un navegador de verdad: el agente de campo, con permisos de campo y sin lectura
// de las cifras ejecutivas, ve en el inicio lo que le toca hoy, lo que puede tomar de su proyecto sin elegirlo en el selector y sus
// visitas de la semana, y ningún «No disponible». estas rutas se registran después de prepararApi y ganan a las comunes
const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

async function prepararAgente(page: Page): Promise<void> {
  const permisos = {
    admin: false,
    objects: {
      project: ['READ'],
      project_assignment: ['READ'],
      task: ['READ', 'UPDATE'],
      field_visit: ['READ', 'CREATE'],
      engagement: ['READ', 'CREATE']
    }
  }
  const tablero = {
    dashboard: 'executive',
    computedAt: '2026-10-20T15:00:00Z',
    filters: {},
    indicators: [
      { code: 'KPI-EXE-01', label: 'Proyectos activos', available: false, unavailableReason: 'FORBIDDEN' },
      { code: 'KPI-EXE-02', label: 'Compromisos abiertos', available: false, unavailableReason: 'FORBIDDEN' }
    ]
  }
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const ruta = url.pathname.replace(/^\/api/, '')
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (route.request().method() !== 'GET') return route.fallback()
    if (ruta === '/auth/me/permissions') return json(permisos)
    if (ruta === '/sgspe/dashboards/indicators') return json([{ code: 'KPI-EXE-01', label: 'Proyectos activos', dashboard: 'executive', available: true }])
    if (ruta === '/sgspe/dashboards/executive') return json(tablero)
    if (ruta === '/objects/task/records') {
      if (url.searchParams.get('empty') === 'assignee_user_id')
        return json(pagina([registro('q1', { title: 'Georreferenciar la nueva captación', project: 'p1', deadline_status: 'AL DIA' }, 'open')]))
      return json(
        pagina([
          registro(
            't1',
            {
              title: 'Levantar fotos del tramo con sedimento',
              project: 'p1',
              assignee_user_id: USUARIO.id,
              due_date: '2026-10-19',
              deadline_status: 'VENCIDO'
            },
            'open'
          )
        ])
      )
    }
    if (ruta === '/objects/field_visit/records')
      return json(pagina([registro('v1', { title: 'Encuesta de línea base en Rumichaca', project: 'p1', planned_start_date: manana }, 'planned')]))
    if (ruta === '/objects/engagement/records') return json(pagina([]))
    return route.fallback()
  })
}

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('el agente de campo ve lo que le toca, lo que puede tomar y sus visitas, sin ningún «No disponible»', async ({ page }) => {
  await prepararAgente(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  const hoy = page.getByRole('region', { name: 'Lo que me toca hoy' })
  await expect(hoy.getByRole('link', { name: 'Levantar fotos del tramo con sedimento' })).toBeVisible()
  await expect(hoy.getByText('Tarea · Vencido')).toBeVisible()
  // la cola compartida de sus proyectos, sin elegir uno en el selector (U-13), en una sola lectura con el proyecto de cada tarea (B-04)
  const cola = hoy.getByRole('region', { name: /^Para tomar en sus proyectos/ })
  await expect(cola.getByText(/Sin asignar · PRJ-01 · Pukaqaqa/)).toBeVisible()
  await expect(cola.getByRole('link', { name: 'Georreferenciar la nueva captación' })).toHaveAttribute('href', '/projects/p1/tasks?task=q1')
  await expect(page.getByRole('region', { name: 'Agenda de la semana' }).getByRole('link', { name: 'Encuesta de línea base en Rumichaca' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Mis proyectos' })).toBeVisible()
  // sin lectura de las cifras ejecutivas: ni el bloque ni un «No disponible»
  await expect(page.getByRole('region', { name: 'Visión ejecutiva' })).toHaveCount(0)
  await expect(page.getByText('No disponible')).toHaveCount(0)
})
