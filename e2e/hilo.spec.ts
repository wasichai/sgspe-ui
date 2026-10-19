import { expect, test } from '@playwright/test'
import { pagina, prepararApi, registro } from './api'

// el hilo de contexto (ux-architecture.md §8, flujo 17): del lugar en el mapa a sus grupos de interés, a la interacción,
// sin perder el proyecto ni el territorio, y con vuelta atrás por el rastro (ASM-066)
test.beforeEach(async ({ page }) => {
  await prepararApi(page)
})

test('del mapa territorial a la interacción, con el chip de territorio y el rastro', async ({ page }) => {
  await page.goto('/territory?project=p1')
  const lugares = page.getByRole('navigation', { name: 'Lugares visibles' })
  await lugares.getByRole('link', { name: 'CC Tunas Pampa' }).click()
  await expect(page).toHaveURL(/\/territory\/communities\/c1\?project=p1$/)
  await expect(page.getByRole('heading', { name: 'CC Tunas Pampa', level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Recorrido' }).getByRole('link', { name: 'Mapa territorial' })).toBeVisible()

  await page.getByRole('link', { name: 'Trabajar en el proyecto con este lugar' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/stakeholders\?territory=community%3Ac1$/)
  const contexto = page.getByRole('navigation', { name: 'Contexto' })
  await expect(contexto.getByText('PRJ-01 · Pukaqaqa')).toBeVisible()
  await expect(contexto.getByText('Territorio: Comunidad CC Tunas Pampa')).toBeVisible()

  await page.goto('/projects/p1/stakeholders/s1')
  await expect(page.getByRole('heading', { name: 'Junta directiva comunal', level: 1 })).toBeVisible()
  await page.getByRole('complementary', { name: 'Qué generó' }).getByRole('link', { name: 'Asamblea de agosto' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/engagements\/e1$/)
  await expect(page.getByRole('heading', { name: 'Asamblea de agosto', level: 1 })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Contexto' }).getByText('PRJ-01 · Pukaqaqa')).toBeVisible()
})

test('quitar el chip de territorio devuelve el proyecto entero sin cambiar de pantalla', async ({ page }) => {
  await page.goto('/projects/p1/stakeholders?territory=community:c1')
  await page.getByRole('button', { name: 'Quitar el filtro de territorio' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/stakeholders$/)
  await expect(page.getByRole('table', { name: 'Grupos de interés' })).toBeVisible()
})

test('el selector de proyecto monta la misma sección con el otro alcance (ASM-076)', async ({ page }) => {
  await page.goto('/stakeholders')
  await expect(page.getByRole('columnheader', { name: 'Proyecto' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Proyecto' }).selectOption('p1')
  await expect(page).toHaveURL(/\/projects\/p1\/stakeholders$/)
  await expect(page.getByRole('columnheader', { name: 'Proyecto' })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Proyecto' }).selectOption('')
  await expect(page).toHaveURL(/\/stakeholders$/)
})

test('el mapa territorial dibuja con MapLibre sin pedir teselas externas', async ({ page, baseURL }) => {
  const externas: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith(baseURL!)) externas.push(r.url())
  })
  await page.goto('/territory')
  const mapa = page.getByRole('region', { name: 'Mapa territorial' })
  await expect(mapa.locator('canvas')).toBeVisible()
  // MapLibre pide teselas y fuentes después del primer dibujo: se espera a que el mapa quede en reposo (su evento idle, que
  // MapaImpl deja en data-reposo) y la red también, en lugar de un plazo fijo que depende de la carga (revisión final, M13)
  await expect(mapa).toHaveAttribute('data-reposo', 'si')
  await page.waitForLoadState('networkidle')
  expect(externas).toEqual([])
})

// etapa 6 de la revisión de UX: el recorrido de referencia de ux-architecture.md §8.3 entero, del mapa a la evidencia en el drawer
// y de vuelta por el rastro a la lista con su territorio, sin perder el proyecto
test('del mapa a la evidencia en el drawer y de vuelta por el rastro, con el proyecto y el territorio', async ({ page }) => {
  const compromiso = registro(
    'k1',
    { project: 'p1', code: 'C-001', title: 'Reservorio de agua', origin_engagement: 'e1', community: 'c1', due_date: '2026-11-30' },
    'in_progress'
  )
  const acta = registro('ev1', { project: 'p1', title: 'Acta firmada', evidence_type: 'ACTA DE ENTREGA', classification: 'INTERNA' })
  const permisos = Object.fromEntries(
    [
      'project',
      'project_assignment',
      'locality',
      'community',
      'organization',
      'stakeholder',
      'stakeholder_assessment',
      'engagement',
      'engagement_participant',
      'engagement_question',
      'area_of_influence',
      'area_of_influence_member',
      'topic',
      'commitment',
      'evidence'
    ].map((o) => [o, ['READ']])
  )
  const rutas: [RegExp, unknown][] = [
    [/^\/auth\/me\/permissions$/, { admin: false, objects: permisos }],
    [/^\/objects\/commitment\/records\/k1$/, compromiso],
    [/^\/objects\/commitment\/records\/k1\/related\/evidence_commitment$/, pagina([acta])],
    [/^\/objects\/commitment\/records\/k1\/related\//, pagina([])],
    [/^\/objects\/commitment\/records\/k1\/(transitions|history)$/, []],
    [/^\/objects\/commitment\/records$/, pagina([compromiso])],
    [
      /^\/objects\/commitment\/workflow$/,
      {
        id: 'w',
        objectName: 'commitment',
        name: 'commitment',
        label: 'commitment',
        enabled: true,
        definition: { states: [{ name: 'in_progress', label: 'En ejecución', type: 'INTERMEDIATE' }], transitions: [] }
      }
    ],
    [/^\/objects\/evidence\/records\/ev1$/, acta],
    [/^\/objects\/evidence\/records\/ev1\/transitions$/, []],
    [
      /^\/objects\/(delivery|task|commitment_candidate|commitment_action|commitment_milestone|commitment_reschedule|commitment_dependency)\/records$/,
      pagina([])
    ]
  ]
  await page.route('**/api/**', async (route) => {
    const ruta = new URL(route.request().url()).pathname.replace(/^\/api/, '')
    const encontrada = rutas.find(([patron]) => patron.test(ruta))
    if (!encontrada || route.request().method() !== 'GET') return route.fallback()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(encontrada[1]) })
  })

  // 1. el mapa del proyecto: la comunidad
  await page.goto('/territory?project=p1')
  await page.getByRole('navigation', { name: 'Lugares visibles' }).getByRole('link', { name: 'CC Tunas Pampa' }).click()
  await expect(page.getByRole('heading', { name: 'CC Tunas Pampa', level: 1 })).toBeVisible()
  // 2. sus grupos de interés, con el chip de territorio
  await page.getByRole('link', { name: 'Trabajar en el proyecto con este lugar' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/stakeholders\?territory=community%3Ac1$/)
  await page.getByRole('table', { name: 'Grupos de interés' }).getByRole('link', { name: 'Junta directiva comunal', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Junta directiva comunal', level: 1 })).toBeVisible()
  // 3. la interacción
  await page.getByRole('complementary', { name: 'Qué generó' }).getByRole('link', { name: 'Asamblea de agosto' }).click()
  await expect(page.getByRole('heading', { name: 'Asamblea de agosto', level: 1 })).toBeVisible()
  // 4. el compromiso que generó
  await page.getByRole('complementary', { name: 'Trazabilidad' }).getByRole('region', { name: 'Qué generó' }).getByRole('link', { name: /C-001/ }).click()
  await expect(page.getByRole('heading', { name: 'Reservorio de agua', level: 1 })).toBeVisible()
  // 5. la evidencia, en el drawer sobre el compromiso
  await page
    .getByRole('complementary', { name: 'Trazabilidad' })
    .getByRole('region', { name: 'Lo sustenta' })
    .getByRole('link', { name: 'Acta firmada' })
    .click()
  await expect(page).toHaveURL(/\/projects\/p1\/commitments\/k1\?peek=evidence%3Aev1$/)
  const drawer = page.getByRole('dialog', { name: 'Acta firmada' })
  await expect(drawer.getByRole('link', { name: 'Abrir ficha' })).toHaveAttribute('href', '/projects/p1/documents/ev1')
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/projects\/p1\/commitments\/k1$/)

  // el rastro lleva cada paso; volver a la lista la devuelve con su territorio, en el mismo proyecto
  const rastro = page.getByRole('navigation', { name: 'Recorrido' })
  await expect(rastro.getByRole('link')).toHaveText([
    'Mapa territorial',
    'CC Tunas Pampa',
    'Grupos de interés',
    'Junta directiva comunal',
    'Asamblea de agosto'
  ])
  await rastro.getByRole('link', { name: 'Grupos de interés' }).click()
  await expect(page).toHaveURL(/\/projects\/p1\/stakeholders\?territory=community%3Ac1$/)
  const contexto = page.getByRole('navigation', { name: 'Contexto' })
  await expect(contexto.getByText('PRJ-01 · Pukaqaqa')).toBeVisible()
  await expect(contexto.getByText('Territorio: Comunidad CC Tunas Pampa')).toBeVisible()
})
