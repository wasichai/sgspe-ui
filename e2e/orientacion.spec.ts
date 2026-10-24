import { expect, test } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// el rediseño de UX (2026-10-20) en un navegador de verdad: desde la ficha de una queja dentro de su proyecto se sabe dónde se
// está (las migas nombran QCS y su pestaña queda marcada), la acción principal está a la vista y las demás en «Más acciones», y
// las migas devuelven a la lista. una ruta que no existe dice cómo seguir en lugar de quedar en blanco
const QUEJA = registro(
  'g1',
  { project: 'p1', code: 'Q-001', channel: 'PRESENCIAL', category: 'AGUA Y MEDIO AMBIENTE', description: 'El canal de riego quedó turbio' },
  'acknowledged'
)
const flujo = (objeto: string, estados: [string, string][]) => ({
  id: objeto,
  objectName: objeto,
  name: objeto,
  label: objeto,
  enabled: true,
  definition: { states: estados.map(([name, label]) => ({ name, label, type: 'INTERMEDIATE' })), transitions: [] }
})
const transicion = (name: string, label: string, to: string) => ({ name, label, to, toLabel: to, allowed: true, reason: null })

test.beforeEach(async ({ page }) => {
  await prepararApi(page)
  const rutas: [RegExp, unknown][] = [
    [/^\/auth\/me\/permissions$/, { admin: false, objects: { project: ['READ'], project_assignment: ['READ'], grievance: ['READ', 'UPDATE'] } }],
    [/^\/objects\/project_assignment\/records$/, pagina([registro('as', { project: 'p1', member_user_id: 'u-smg', active: true })])],
    [
      /^\/objects\/grievance\/workflow$/,
      flujo('grievance', [
        ['acknowledged', 'Acusada'],
        ['in_assessment', 'En evaluación'],
        ['rejected', 'Rechazada']
      ])
    ],
    [/^\/metadata\/objects\/grievance$/, { id: 'grievance', name: 'grievance', fields: [] }],
    [/^\/objects\/grievance\/records\/g1$/, QUEJA],
    [/^\/objects\/grievance\/records\/g1\/transitions$/, [transicion('reject', 'Rechazar', 'rejected'), transicion('assess', 'Evaluar', 'in_assessment')]],
    [/^\/objects\/[a-z_]+\/records\/[a-z0-9]+\/(transitions|history)$/, []],
    [/^\/objects\/[a-z_]+\/records\/[a-z0-9]+\/related\//, pagina([])],
    [/^\/objects\/grievance\/records$/, pagina([QUEJA])],
    [/^\/sgspe\/transition-checks$/, { allowed: true, blocking: [], warnings: [] }]
  ]
  await page.route('**/api/**', async (route) => {
    const ruta = new URL(route.request().url()).pathname.replace(/^\/api/, '')
    const encontrada = rutas.find(([patron]) => patron.test(ruta))
    if (!encontrada || (route.request().method() !== 'GET' && !ruta.startsWith('/sgspe/transition-checks'))) return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(encontrada[1]) })
  })
})

test('la ficha de una queja dice dónde se está, ofrece una primaria y vuelve a la lista por las migas', async ({ page }) => {
  await page.goto('/projects/p1/grievances/g1')
  // con CabeceraDeFicha (DD-02 y DD-06 del rediseño), el título dice lo que se planteó y el código va en el antetítulo
  await expect(page.getByRole('heading', { name: 'El canal de riego quedó turbio', level: 1 })).toBeVisible()
  await expect(page.getByText(/^Queja · Q-001/)).toBeVisible()
  const migas = page.getByRole('navigation', { name: 'Ubicación' })
  await expect(migas.getByRole('link', { name: 'Quejas, consultas y solicitudes' })).toHaveAttribute('href', '/projects/p1/attention')
  await expect(migas).not.toContainText('grievances')
  await expect(page.getByRole('navigation', { name: 'Secciones del proyecto' }).getByRole('link', { name: 'Quejas, consultas y solicitudes' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  // la primaria es la del camino; «Rechazar», destructiva, espera en «Más acciones»
  const acciones = page.getByRole('group', { name: 'Acciones del registro' })
  await expect(acciones.getByRole('button', { name: 'Evaluar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rechazar' })).toHaveCount(0)
  const mas = acciones.getByRole('button', { name: 'Más acciones' })
  await mas.click()
  await page.getByRole('button', { name: 'Rechazar' }).click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  // el foco vuelve al menú que abrió el diálogo
  await expect(mas).toBeFocused()
  await migas.getByRole('link', { name: 'Quejas, consultas y solicitudes' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/attention$/)
})

test('una ruta que no existe dice cómo seguir y lleva a su sección', async ({ page }) => {
  await page.goto('/attention/no-es-una-ruta')
  await expect(page.getByText('Esta página no existe')).toBeVisible()
  await page.getByRole('link', { name: 'Ir a Quejas, consultas y solicitudes' }).click()
  await expect(page).toHaveURL(/\/attention$/)
})
