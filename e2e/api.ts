import type { Page, Route } from '@playwright/test'

// la API de SGSPE simulada en el navegador: cada prueba abre una sesión y contesta /api/** desde estas tablas, con la
// forma de wasichai (api.md §2). una ruta sin respuesta es un 404 problem+json, como el mockFetch de las pruebas unitarias
export const USUARIO = { id: 'u-smg', email: 'smg@sgspe.test', displayName: 'Gerencia social de prueba', organizationId: 'o1', roles: ['SOCIAL_MANAGER'] }

const ahora = '2026-10-05T15:00:00Z'
export const registro = (id: string, attributes: Record<string, unknown>, state?: string) => ({
  id,
  createdAt: ahora,
  updatedAt: ahora,
  state,
  attributes,
  geometries: {}
})
export const pagina = (content: unknown[]) => ({ content, page: 0, size: content.length, totalElements: content.length, totalPages: 1, nextCursor: null })
const workflow = (objeto: string, estados: [string, string][]) => ({
  id: objeto,
  objectName: objeto,
  name: objeto,
  label: objeto,
  enabled: true,
  definition: { states: estados.map(([name, label]) => ({ name, label, type: 'INTERMEDIATE' })), transitions: [] }
})

export const PROYECTOS = [
  registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa', inactivity_days: 90 }, 'active'),
  registro('p2', { code: 'PRJ-02', name: 'Qorihuasi' }, 'draft')
]
export const COMUNIDAD = registro('c1', { name: 'CC Tunas Pampa', community_type: 'COMUNIDAD CAMPESINA' })
export const ORGANIZACION = registro('o1', { name: 'Junta directiva comunal', community: 'c1' })
export const GRUPO = registro(
  's1',
  { project: 'p1', organization: 'o1', locality: 'l1', stakeholder_type: 'ORGANIZACION COMUNAL', influence_group: 'ESTRATEGICO' },
  'assessed'
)
export const INTERACCION = registro(
  'e1',
  { project: 'p1', title: 'Asamblea de agosto', engagement_type: 'ASAMBLEA', held_at: '2026-08-20T15:00:00Z', attendees_total_count: 40 },
  'minutes_approved'
)

// una interacción cancelada del calendario de octubre de 2026 (el motivo se ve al enfocar su enlace)
export const CANCELADA = registro(
  'e2',
  { project: 'p1', title: 'Taller de agua', engagement_type: 'TALLER', scheduled_at: '2026-10-14T15:00:00Z', cancel_reason: 'Lluvias intensas en la zona' },
  'cancelled'
)

// el tablero de grupos de interés: KPI-STK-02 con NEUTRAL entre A FAVOR y EN CONTRA (api.md §4.11)
const indicador = (code: string, label: string, extra: Record<string, unknown> = {}) => ({ code, label, available: true, ...extra })
export const TABLERO_GRUPOS = {
  dashboard: 'stakeholders',
  computedAt: ahora,
  filters: {},
  indicators: [
    indicador('KPI-STK-01', 'Grupos de interés por clasificación', {
      value: 10,
      breakdowns: [
        {
          by: 'influence_group',
          rows: [
            { key: 'ESTRATEGICO', value: 6 },
            { key: 'SIN EVALUAR', value: 4 }
          ]
        }
      ]
    }),
    indicador('KPI-STK-02', 'Distribución de posturas', {
      value: 10,
      breakdowns: [
        {
          by: 'stance',
          rows: [
            { key: 'A FAVOR', value: 3 },
            { key: 'NEUTRAL', value: 4 },
            { key: 'EN CONTRA PERO ABIERTO A ESCUCHAR', value: 2 },
            { key: 'EN CONTRA', value: 1 }
          ]
        }
      ]
    }),
    indicador('KPI-STK-03', 'Evaluados', { numerator: 6, denominator: 10 }),
    indicador('KPI-STK-06', 'Cambio de postura de la oposición', {
      value: 50,
      unit: '%',
      breakdowns: [{ by: 'direction', rows: [{ key: 'MORE_FAVORABLE', value: 1 }] }]
    }),
    indicador('KPI-STK-08', 'Confianza', {
      series: [
        { period: '2026-09', value: 3.2 },
        { period: '2026-10', value: 3.5 }
      ]
    })
  ]
}

const coleccion = (elementos: [string, string, string][]) => ({
  type: 'FeatureCollection',
  features: elementos.map(([id, objeto, name]) => ({
    type: 'Feature',
    id: `${id}:g`,
    geometry: { type: 'Point', coordinates: [-78.4, -8.1] },
    properties: { __id: id, __object: objeto, name }
  }))
})

type Respuesta = unknown | ((url: URL) => unknown)
const RESPUESTAS: [RegExp, Respuesta][] = [
  [/^\/auth\/me$/, { userId: USUARIO.id, organizationId: 'o1', email: USUARIO.email, roles: USUARIO.roles, admin: false }],
  [
    /^\/auth\/me\/permissions$/,
    {
      admin: false,
      objects: Object.fromEntries(
        [
          'project',
          'project_assignment',
          'locality',
          'community',
          'organization',
          'position',
          'stakeholder',
          'stakeholder_assessment',
          'engagement',
          'engagement_participant',
          'engagement_question',
          'area_of_influence',
          'area_of_influence_member',
          'community_sector',
          'topic'
        ].map((o) => [o, ['READ']])
      )
    }
  ],
  [/^\/auth\/me\/preferences$/, { theme: 'light', locale: null }],
  [/^\/organizations\/current$/, { id: 'o1', name: 'Organización de prueba', slug: 'prueba' }],
  [/^\/objects\/project\/records$/, pagina(PROYECTOS)],
  [/^\/objects\/project\/records\/p1$/, PROYECTOS[0]],
  [/^\/objects\/project\/records\/p2$/, PROYECTOS[1]],
  [
    /^\/objects\/project_assignment\/records$/,
    pagina([registro('a1', { project: 'p1', member_user_id: USUARIO.id, role_name: 'SOCIAL_MANAGER', active: true })])
  ],
  [
    /^\/objects\/(project|stakeholder|engagement)\/workflow$/,
    (u: URL) =>
      workflow(u.pathname.split('/')[3], [
        ['active', 'Activo'],
        ['draft', 'Borrador'],
        ['assessed', 'Evaluado'],
        ['minutes_approved', 'Acta aprobada']
      ])
  ],
  [/^\/sgspe\/territory\/layers\/LYR-05$/, coleccion([['c1', 'community', 'CC Tunas Pampa']])],
  [/^\/sgspe\/territory\/layers\/LYR-02$/, coleccion([['l1', 'locality', 'Tunas']])],
  [/^\/sgspe\/territory\/layers\//, coleccion([])],
  [/^\/objects\/community\/records\/c1$/, COMUNIDAD],
  [/^\/objects\/locality\/records\/l1$/, registro('l1', { name: 'Tunas', locality_type: 'CASERIO' })],
  [/^\/objects\/organization\/records\/o1$/, ORGANIZACION],
  [/^\/objects\/organization\/records$/, pagina([ORGANIZACION])],
  [/^\/objects\/stakeholder\/records\/s1$/, GRUPO],
  [/^\/objects\/stakeholder\/records$/, pagina([GRUPO])],
  [/^\/objects\/stakeholder\/records\/s1\/related\/engagement_stakeholder$/, pagina([INTERACCION])],
  [/^\/objects\/stakeholder\/records\/s1\/transitions$/, []],
  [/^\/objects\/engagement\/records\/e1$/, INTERACCION],
  [/^\/objects\/engagement\/records$/, pagina([INTERACCION, CANCELADA])],
  [/^\/sgspe\/dashboards\/stakeholders$/, TABLERO_GRUPOS],
  [/^\/objects\/engagement\/records\/e1\/transitions$/, []],
  [/^\/objects\/engagement\/records\/e1\/related\//, pagina([])],
  [
    /^\/objects\/(position|festivity|area_of_influence|community_sector|area_of_influence_member|stakeholder_assessment|engagement_participant|engagement_question)\/records$/,
    pagina([])
  ],
  [
    /^\/metadata\/objects\/stakeholder$/,
    { id: 'x', name: 'stakeholder', fields: [{ name: 'influence_group', type: 'ENUM', enumOptions: ['ESTRATEGICO'], editable: false, visible: true }] }
  ],
  [/^\/metadata\/objects\//, { id: 'x', name: 'x', fields: [] }],
  [/^\/sgspe\/dashboards\/indicators$/, []]
]

// abre una sesión (como la guarda core en sgspe.*) y contesta la API desde las tablas
export async function prepararApi(page: Page): Promise<void> {
  await page.addInitScript((usuario) => {
    localStorage.setItem('sgspe.token', 't-e2e')
    localStorage.setItem('sgspe.user', JSON.stringify(usuario))
  }, USUARIO)
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url())
    const ruta = url.pathname.replace(/^\/api/, '')
    const respuesta = RESPUESTAS.find(([patron]) => patron.test(ruta))?.[1]
    if (respuesta === undefined)
      return route.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Not Found', status: 404 }) })
    const cuerpo = typeof respuesta === 'function' ? (respuesta as (u: URL) => unknown)(url) : respuesta
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) })
  })
}

// el compromiso k1 del proyecto p1 (nace de la interacción e1, en la comunidad c1) con su evidencia ev1 y lo que su ficha lee:
// el hilo de contexto y las pruebas a 390 px lo abren. se registra después de prepararApi y gana a las respuestas comunes
export async function prepararFichaDeCompromiso(page: Page): Promise<void> {
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
}
