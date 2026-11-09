import type { Page } from '@playwright/test'
import { pagina, prepararApi, prepararFichaDeCompromiso, registro, USUARIO } from '../api'

// el escenario de las capturas del rediseño (wasichai/sgspe-ui#88): una organización con datos en cada pantalla representativa,
// sobre la API simulada de e2e/api.ts. reúne lo que los specs simulan cada uno por su lado (f4, f5, f6, f8, listasF4,
// compromisos, proyecto360), con la misma forma. se registra después de prepararApi y prepararFichaDeCompromiso y gana a sus
// respuestas; lo que no contesta pasa a ellas. el WMS (/sgspe/territory/wms) no se simula: su 404 deja las capas por GeoJSON, sin
// aviso (mapa/wms.ts), y el mapa dibuja los lugares de e2e/api.ts. no es una prueba: solo deja cada pantalla con contenido para fotografiarla

export type Tema = 'light' | 'dark'
export type Idioma = 'es' | 'en'

const ahora = '2026-10-16T15:00:00Z'
const HOY = new Date('2026-10-16T12:00:00-05:00')
const ind = (code: string, label: string, value: number | null, unit = '') => ({ code, label, available: true, value, unit })
const flujo = (objeto: string, estados: [string, string][]) => ({
  id: objeto,
  objectName: objeto,
  name: objeto,
  label: objeto,
  enabled: true,
  definition: { states: estados.map(([name, label]) => ({ name, label, type: 'INTERMEDIATE' })), transitions: [] }
})

const OBJETOS = [
  'project',
  'project_assignment',
  'locality',
  'community',
  'organization',
  'position',
  'person',
  'stakeholder',
  'stakeholder_assessment',
  'engagement',
  'engagement_participant',
  'engagement_question',
  'field_visit',
  'area_of_influence',
  'area_of_influence_member',
  'community_sector',
  'administrative_unit',
  'topic',
  'commitment',
  'agreement',
  'delivery',
  'evidence',
  'task',
  'grievance',
  'inquiry',
  'stakeholder_request',
  'social_risk',
  'early_warning',
  'early_warning_rule',
  'social_program',
  'social_contribution',
  'deliverable',
  'deliverable_section',
  'deliverable_version',
  'deliverable_template',
  'indicator',
  'indicator_measurement'
]
export const permisos = (admin = false) => ({ admin, objects: Object.fromEntries(OBJETOS.map((o) => [o, ['READ']])) })

const EJECUTIVO = {
  dashboard: 'executive',
  computedAt: ahora,
  filters: {},
  indicators: [
    ind('KPI-EXE-01', 'Proyectos activos', 1, 'proyectos'),
    ind('KPI-COM-02', 'Compromisos abiertos', 12, 'compromisos'),
    ind('KPI-COM-03', 'Compromisos vencidos', 3, 'compromisos'),
    ind('KPI-GRV-02', 'QCS abiertas', 4, 'QCS'),
    ind('KPI-RSK-01', 'Riesgos altos', 1, 'riesgos'),
    ind('KPI-ENG-01', 'Interacciones realizadas', 22, 'interacciones'),
    ind('KPI-EXE-02', 'Alertas activas', 1, 'alertas'),
    {
      ...ind('KPI-EXE-03', 'Tendencia mensual', null),
      series: [
        { period: '2026-07', engagements: 4, grievancesReceived: 3, grievancesClosed: 1, overdueCommitments: 1 },
        { period: '2026-08', engagements: 6, grievancesReceived: 2, grievancesClosed: 2, overdueCommitments: 2 },
        { period: '2026-09', engagements: 5, grievancesReceived: 2, grievancesClosed: 1, overdueCommitments: 2 },
        { period: '2026-10', engagements: 7, grievancesReceived: 1, grievancesClosed: 2, overdueCommitments: 3 }
      ]
    }
  ],
  byProject: [{ project: 'p1', code: 'PRJ-01', name: 'Pukaqaqa', indicators: [ind('KPI-COM-03', 'Compromisos vencidos', 3)] }]
}
const DEL_PROYECTO = {
  dashboard: 'project',
  computedAt: ahora,
  filters: { project: ['p1'] },
  indicators: [
    ind('KPI-STK-01', 'Grupos de interés vigentes', 42, 'grupos de interés'),
    ind('KPI-ENG-01', 'Interacciones', 7, 'interacciones'),
    ind('KPI-COM-02', 'Compromisos abiertos', 6, 'compromisos'),
    ind('KPI-COM-03', 'Compromisos vencidos', 3, 'compromisos'),
    ind('KPI-COM-04', 'Compromisos por vencer', 2, 'compromisos'),
    ind('KPI-COM-06', 'Compromisos cumplidos', 1, 'compromisos'),
    ind('KPI-GRV-01', 'QCS recibidas', 5, 'QCS'),
    ind('KPI-GRV-02', 'QCS abiertas', 4, 'quejas'),
    ind('KPI-GRV-06', 'QCS fuera de plazo', 1, 'QCS'),
    ind('KPI-RSK-01', 'Riesgos altos', 0, 'riesgos'),
    // fase 6 (S05): la postura, la matriz interés × poder y las reuniones frente a la meta, para que el resumen no se vea vacío
    {
      ...ind('KPI-STK-02', 'Distribución de posturas', 42, 'grupos de interés'),
      breakdowns: [
        {
          by: 'stance',
          rows: [
            { key: 'A FAVOR', value: 15 },
            { key: 'NEUTRAL', value: 14 },
            { key: 'EN CONTRA PERO ABIERTO A ESCUCHAR', value: 8 },
            { key: 'EN CONTRA', value: 5 }
          ]
        }
      ]
    },
    {
      ...ind('KPI-STK-03', 'Interés × poder', 36, 'grupos de interés'),
      numerator: 36,
      denominator: 42,
      breakdowns: [
        {
          by: 'stakeholder',
          rows: Array.from({ length: 36 }, (_, n) => ({ key: `s${n}`, value: 1, interest: 1 + (n % 5), power: 1 + ((n * 3) % 5) }))
        }
      ]
    },
    {
      ...ind('KPI-ENG-02', 'Reuniones frente a la meta', 3, 'reuniones'),
      numerator: 3,
      denominator: 4,
      series: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((period, n) => ({ period, value: [3, 4, 2, 4, 3, 1][n], target: 4 }))
    }
  ]
}
const AREAS = ['AIDS', 'AIDI', 'AIS', 'AII'].map((tipo, n) =>
  registro(`a${n}`, { project: 'p1', area_type: tipo, version_number: n + 1 }, n === 3 ? 'draft' : 'approved')
)

const COMPROMISOS = [
  registro(
    'k1',
    {
      project: 'p1',
      code: 'C-001',
      title: 'Reservorio de agua',
      origin_engagement: 'e1',
      community: 'c1',
      due_date: '2026-11-30',
      deadline_status: 'AL DIA',
      owner_user_id: USUARIO.id,
      owner_user_email: USUARIO.email
    },
    'in_progress'
  ),
  registro(
    'k2',
    {
      project: 'p1',
      code: 'C-002',
      title: 'Mantenimiento del camino vecinal a la parte alta',
      community: 'c1',
      due_date: '2026-10-01',
      deadline_status: 'VENCIDO',
      owner_user_email: 'cmm@sgspe.test'
    },
    'in_progress'
  ),
  registro(
    'k3',
    {
      project: 'p1',
      code: 'C-003',
      title: 'Capacitación en crianza de cuyes',
      due_date: '2026-10-25',
      deadline_status: 'POR VENCER',
      owner_user_email: 'rel@sgspe.test'
    },
    'agreed'
  )
]

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
const COLA = {
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
const RIESGOS = [
  registro(
    'r1',
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
    'r2',
    {
      project: 'p1',
      code: 'R-002',
      title: 'Desinformación sobre el uso del agua',
      category: 'AGUA',
      probability: 3,
      impact: 2,
      score: 6,
      risk_level: 'MEDIO',
      owner_user_email: 'rel@sgspe.test'
    },
    'identified'
  )
]
const ALERTA = registro(
  'w1',
  { project: 'p1', title: 'Asamblea de protesta anunciada en la radio local', detected_at: '2026-10-03T13:00:00Z', severity: 'ALTO' },
  'detected'
)
const PROGRAMAS = [
  registro('sp1', { project: 'p1', code: 'PS-001', name: 'Programa de agua segura para las comunidades de la cuenca alta' }, 'executing'),
  registro('sp2', { project: 'p1', code: 'PS-002', name: 'Fortalecimiento de capacidades productivas' }, 'approved')
]
const APORTE = registro(
  'ap1',
  { project: 'p1', code: 'AP-001', contribution_type: 'DONACION', total_amount: '1750.5', currency: 'PEN', recipient_organization: 'o1' },
  'requested'
)

const SHA_MODELO = '0f'.repeat(32)
const ENTREGABLES = [
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
    'draft'
  ),
  registro(
    'd2',
    {
      project: 'p1',
      document_code: 'DSO-001',
      title: 'Diagnóstico social del área de influencia',
      deliverable_type: 'DIAGNOSTICO SOCIAL',
      period_start_date: '2026-01-01',
      period_end_date: '2026-06-30'
    },
    'issued'
  )
]
const SECCIONES = [
  registro('sec-resumen', {
    deliverable: 'd1',
    section_key: 'resumen',
    title: 'Resumen',
    sort_order: 1,
    section_kind: 'NARRATIVA',
    content_origin: 'HUMANO',
    content: 'En setiembre se realizaron cinco reuniones con la comunidad.',
    reviewed: true
  }),
  registro('sec-antecedentes', {
    deliverable: 'd1',
    section_key: 'antecedentes',
    title: 'Antecedentes',
    sort_order: 2,
    section_kind: 'MIXTA',
    content_origin: 'HUMANO',
    content: 'La comunidad pidió una reunión para revisar el avance del reservorio.',
    reviewed: false
  })
]
const BORRADOR = {
  status: 'LISTO',
  requestedAt: '2026-10-16T14:59:00Z',
  generatedAt: ahora,
  revision: 'A',
  modelSha256: SHA_MODELO,
  pending: false,
  levels: [
    { level: 'INTERNO', candidateSha256: '1e'.repeat(32) },
    { level: 'EXTERNO', candidateSha256: '2d'.repeat(32) }
  ],
  warnings: []
}
const TIPOS = [
  { type: 'DIAGNOSTICO SOCIAL', version: 1, sections: [] },
  {
    type: 'INFORME DE CAMPO Y AVANCE',
    version: 1,
    sections: [
      { key: 'resumen', title: 'Resumen', order: 1, kind: 'NARRATIVA', required: true, assisted: false, guide: 'Lo principal del periodo.' },
      { key: 'antecedentes', title: 'Antecedentes', order: 2, kind: 'MIXTA', required: true, assisted: true, guide: 'Describa el contexto del periodo.' }
    ]
  }
]

const TAREAS = [
  registro(
    't1',
    { title: 'Levantar fotos del tramo con sedimento', project: 'p1', assignee_user_id: USUARIO.id, due_date: '2026-10-19', deadline_status: 'VENCIDO' },
    'open'
  )
]

// grupos de interés y relacionamiento de S06 y S07 (fase 7 de wasichai/sgspe-ui#88): organizaciones ficticias, una persona sin
// nombres legibles, posturas, prioridades, índices y contactos; interacciones de la semana del 12 al 18 de octubre de 2026 con sus
// asistentes por sexo y una festividad local en la tira
const ORGANIZACIONES = [
  'Comunidad campesina de Tunas Pampa',
  'Junta de usuarios de riego de Ccollpa',
  'Comité de regantes del canal alto',
  'Municipalidad distrital de prueba',
  'Asociación de artesanas de Pukaqaqa',
  'Ronda campesina de Tunas',
  'APAFA de la escuela de Tunas'
].map((name, n) => registro(`o${n + 1}`, { name, community: 'c1' }))
const grupo = (n: number, extra: Record<string, unknown>, estado = 'assessed') =>
  registro(`s${n}`, { project: 'p1', locality: 'l1', owner_user_email: 'rel@sgspe.test', ...extra }, estado)
const GRUPOS = [
  grupo(1, {
    organization: 'o1',
    stakeholder_type: 'ORGANIZACION COMUNAL',
    influence_group: 'ESTRATEGICO',
    information_priority: 'MUY ALTA',
    stance: 'EN CONTRA PERO ABIERTO A ESCUCHAR',
    interest_index: 4.2,
    power_index: 3.8,
    trust_score: 3,
    last_assessment_date: '2026-08-14',
    last_contact_date: '2026-10-13'
  }),
  grupo(2, {
    organization: 'o2',
    stakeholder_type: 'ORGANIZACION SOCIAL',
    influence_group: 'ESTRATEGICO',
    information_priority: 'MUY ALTA',
    stance: 'A FAVOR',
    interest_index: 4,
    power_index: 3.4,
    trust_score: 4,
    last_assessment_date: '2026-09-02',
    last_contact_date: '2026-10-16'
  }),
  grupo(3, {
    organization: 'o3',
    stakeholder_type: 'ORGANIZACION DE USUARIOS',
    influence_group: 'POLITICO',
    information_priority: 'MUY ALTA',
    stance: 'EN CONTRA',
    interest_index: 2.6,
    power_index: 4.1,
    trust_score: 2,
    last_assessment_date: '2026-07-20',
    last_contact_date: '2026-10-08'
  }),
  grupo(
    4,
    {
      organization: 'o4',
      stakeholder_type: 'AUTORIDAD LOCAL',
      influence_group: 'POLITICO',
      information_priority: 'ALTA',
      stance: 'NEUTRAL',
      interest_index: 2.2,
      power_index: 4.4,
      last_assessment_date: '2026-06-11',
      last_contact_date: '2026-10-01'
    },
    'profiled'
  ),
  grupo(5, {
    organization: 'o5',
    stakeholder_type: 'ORGANIZACION SOCIAL',
    influence_group: 'PARA MONITOREO',
    information_priority: 'ALTA',
    stance: 'A FAVOR',
    interest_index: 3.4,
    power_index: 2.1,
    trust_score: 4,
    last_assessment_date: '2026-05-30',
    last_contact_date: '2026-09-25'
  }),
  grupo(6, { person: 'pe1', stakeholder_type: 'LIDER LOCAL', information_priority: 'ALTA' }, 'identified'),
  grupo(7, {
    organization: 'o6',
    stakeholder_type: 'ORGANIZACION COMUNAL',
    influence_group: 'VULNERABLE',
    information_priority: 'MEDIA',
    stance: 'NEUTRAL',
    interest_index: 2.4,
    power_index: 2,
    trust_score: 3,
    last_assessment_date: '2026-04-18',
    last_contact_date: '2026-09-30'
  }),
  grupo(8, {
    organization: 'o7',
    stakeholder_type: 'ORGANIZACION SOCIAL',
    influence_group: 'PARA MONITOREO',
    information_priority: 'MEDIA',
    stance: 'A FAVOR',
    interest_index: 3.1,
    power_index: 1.8,
    trust_score: 4,
    last_assessment_date: '2026-03-03',
    last_contact_date: '2026-08-12'
  })
]
const DEF_DE_GRUPO = {
  id: 'x',
  name: 'stakeholder',
  label: 'Grupo de interés',
  fields: [
    ['influence_group', ['ESTRATEGICO', 'POLITICO', 'PARA MONITOREO', 'VULNERABLE']],
    ['stance', ['A FAVOR', 'NEUTRAL', 'EN CONTRA PERO ABIERTO A ESCUCHAR', 'EN CONTRA']],
    ['relationship_status', ['ACTIVA', 'EN PAUSA']],
    ['stakeholder_type', ['ORGANIZACION COMUNAL', 'ORGANIZACION SOCIAL', 'AUTORIDAD LOCAL', 'LIDER LOCAL']],
    ['stakeholder_scope', ['AIDS', 'AIIS']],
    ['information_priority', ['MUY ALTA', 'ALTA', 'MEDIA']]
  ]
    .map(([name, enumOptions]) => ({ name, type: 'ENUM', enumOptions, editable: false, visible: true }))
    .concat([{ name: 'owner_user_email', type: 'EMAIL', enumOptions: [], editable: false, visible: true }])
}
const EVALUACIONES = [
  registro('ev1', {
    stakeholder: 's1',
    assessment_date: '2026-08-14',
    basis: 'ENTREVISTA',
    influence_group: 'ESTRATEGICO',
    interest_index: 4.2,
    power_index: 3.8
  }),
  registro('ev0', { stakeholder: 's1', assessment_date: '2026-03-02', basis: 'INFERIDA', influence_group: 'POLITICO', interest_index: 2.8, power_index: 3.6 })
]
const MATRIZ = {
  ...ind('KPI-STK-03', 'Matriz interés × poder', 7, 'grupos de interés'),
  numerator: 7,
  denominator: 8,
  breakdowns: [
    {
      by: 'thresholds',
      rows: [
        { key: 'interest', value: 3 },
        { key: 'power', value: 3 }
      ]
    },
    {
      by: 'stakeholder',
      rows: GRUPOS.filter((g) => typeof g.attributes.interest_index === 'number').map((g) => ({
        key: g.id,
        label: ORGANIZACIONES.find((o) => o.id === g.attributes.organization)?.attributes.name,
        value: null,
        interest: g.attributes.interest_index,
        power: g.attributes.power_index,
        influenceGroup: g.attributes.influence_group,
        overridden: g.id === 's3'
      }))
    }
  ]
}
const interaccion = (id: string, extra: Record<string, unknown>, estado: string) => registro(id, { project: 'p1', locality: 'l1', ...extra }, estado)
const INTERACCIONES = [
  interaccion(
    'e1',
    {
      title: 'Devolución de los primeros hallazgos del diagnóstico',
      engagement_type: 'TALLER',
      place: 'Local comunal de Tunas',
      held_at: '2026-10-13T20:00:00Z',
      attendees_total_count: 38,
      attendees_female_count: 21,
      attendees_male_count: 17
    },
    'minutes_in_review'
  ),
  interaccion(
    'e3',
    {
      title: 'Visita a la junta de usuarios de riego',
      engagement_type: 'VISITA',
      place: 'Caserío Ccollpa',
      held_at: '2026-10-16T12:12:00Z',
      attendees_total_count: 6,
      attendees_female_count: 4,
      attendees_male_count: 2
    },
    'held'
  ),
  interaccion(
    'e4',
    { title: 'Reunión informativa en Tunas', engagement_type: 'REUNION INFORMATIVA', place: 'Caserío Tunas', scheduled_at: '2026-10-17T15:00:00Z' },
    'scheduled'
  ),
  interaccion(
    'e5',
    {
      title: 'Primer muestreo participativo de agua',
      engagement_type: 'MONITOREO PARTICIPATIVO',
      place: 'Microcuenca alta',
      scheduled_at: '2026-10-18T13:30:00Z'
    },
    'scheduled'
  ),
  interaccion(
    'e6',
    {
      title: 'Asamblea de la comunidad campesina',
      engagement_type: 'ASAMBLEA',
      place: 'Local comunal de Tunas',
      held_at: '2026-10-12T14:00:00Z',
      attendees_total_count: 112,
      attendees_female_count: 50,
      attendees_male_count: 62
    },
    'minutes_drafted'
  ),
  interaccion(
    'e7',
    {
      title: 'Diálogo con el comité de regantes',
      engagement_type: 'REUNION',
      place: 'Caserío Ccollpa',
      held_at: '2026-10-02T16:00:00Z',
      attendees_total_count: 14,
      attendees_female_count: 5,
      attendees_male_count: 9
    },
    'minutes_approved'
  )
]
const FLUJO_DE_GRUPO = flujo('stakeholder', [
  ['identified', 'Identificado'],
  ['profiled', 'Caracterizado'],
  ['assessed', 'Evaluado'],
  ['retired', 'Retirado']
])
const FLUJO_DE_INTERACCION = flujo('engagement', [
  ['planned', 'Planificada'],
  ['scheduled', 'Programada'],
  ['held', 'Realizada'],
  ['minutes_drafted', 'Acta en borrador'],
  ['minutes_in_review', 'Acta en revisión'],
  ['minutes_approved', 'Acta aprobada'],
  ['closed', 'Cerrada'],
  ['cancelled', 'Cancelada'],
  ['postponed', 'Postergada']
])
const FESTIVIDAD = registro('f1', { name: 'Fiesta patronal de Tunas', locality: 'l1', month: 10, start_day: 15, end_day: 15 })
const MIEMBRO = registro('m1', { area_of_influence: 'a0', locality: 'l1' })

// los conteos de las pestañas de Project 360 (contexto/conteos.ts): el total y lo que pide acción
const CONTEOS = {
  'stakeholders:total': 42,
  'engagements:total': 7,
  'commitments:total': 3,
  'commitments:accion': 1,
  'attention:total': 2,
  'attention:accion': 1,
  'risks:total': 2,
  'programs:total': 2,
  'documents:total': 1
}
const PERSONAS = [
  { email: USUARIO.email, displayName: USUARIO.displayName },
  { email: 'cmm@sgspe.test', displayName: 'Coordinación de compromisos' },
  { email: 'rel@sgspe.test', displayName: 'Relacionista de prueba' },
  { email: 'srm@sgspe.test', displayName: 'Responsable de riesgos' },
  { email: 'gvm@sgspe.test', displayName: 'Gestión de quejas' }
]
const AVISOS = {
  kinds: { ACTION: { active: 1, unread: 1, overdue: 0 }, WARNING: { active: 1, unread: 1, overdue: 0 }, INFO: { active: 0, unread: 0, overdue: 0 } },
  latest: null
}

type Cuerpo = unknown | ((url: URL) => unknown)
const RUTAS = (admin: boolean): [RegExp, Cuerpo][] => [
  [/^\/auth\/me\/permissions$/, permisos(admin)],
  [/^\/auth\/me$/, { userId: USUARIO.id, organizationId: 'o1', email: USUARIO.email, roles: USUARIO.roles, admin }],
  [/^\/sgspe\/dashboards\/indicators$/, [{ code: 'KPI-EXE-01', label: 'Proyectos activos', dashboard: 'executive', available: true }]],
  [/^\/sgspe\/dashboards\/executive$/, EJECUTIVO],
  [/^\/objects\/stakeholder\/records$/, pagina(GRUPOS)],
  [/^\/objects\/stakeholder\/records\/(s\d)$/, (u: URL) => GRUPOS.find((g) => u.pathname.endsWith(`/${g.id}`))],
  [/^\/objects\/organization\/records\/(o\d)$/, (u: URL) => ORGANIZACIONES.find((o) => u.pathname.endsWith(`/${o.id}`))],
  [/^\/objects\/person\/records\/pe1$/, registro('pe1', {})],
  [/^\/metadata\/objects\/stakeholder$/, DEF_DE_GRUPO],
  [/^\/objects\/stakeholder\/workflow$/, FLUJO_DE_GRUPO],
  [/^\/sgspe\/dashboards\/indicators\/KPI-STK-03$/, MATRIZ],
  [/^\/objects\/engagement\/records$/, (u: URL) => pagina(u.searchParams.has('empty') ? [] : INTERACCIONES)],
  [/^\/objects\/engagement\/records\/(e\d)$/, (u: URL) => INTERACCIONES.find((i) => u.pathname.endsWith(`/${i.id}`))],
  [/^\/objects\/engagement\/workflow$/, FLUJO_DE_INTERACCION],
  [/^\/objects\/stakeholder\/records\/s\d\/related\/engagement_stakeholder$/, pagina(INTERACCIONES.slice(0, 2))],
  [/^\/objects\/stakeholder\/records\/s\d\/related\//, pagina([])],
  [/^\/objects\/stakeholder_assessment\/records$/, pagina(EVALUACIONES)],
  [/^\/objects\/festivity\/records$/, (u: URL) => pagina(u.searchParams.get('month') === '10' ? [FESTIVIDAD] : [])],
  [/^\/objects\/area_of_influence_member\/records$/, pagina([MIEMBRO])],
  [/^\/sgspe\/dashboards\/project$/, DEL_PROYECTO],
  [/^\/objects\/area_of_influence\/records$/, pagina(AREAS)],
  [
    /^\/objects\/area_of_influence\/workflow$/,
    flujo('area_of_influence', [
      ['draft', 'Borrador'],
      ['approved', 'Aprobada']
    ])
  ],
  [/^\/objects\/task\/records$/, pagina(TAREAS)],
  [/^\/objects\/commitment\/records$/, pagina(COMPROMISOS)],
  [
    /^\/objects\/commitment\/workflow$/,
    flujo('commitment', [
      ['agreed', 'Acordado'],
      ['in_progress', 'En ejecución']
    ])
  ],
  [/^\/sgspe\/attention\/queue$/, COLA],
  [/^\/objects\/grievance\/workflow$/, flujo('grievance', [['received', 'Recibida']])],
  [/^\/objects\/inquiry\/workflow$/, flujo('inquiry', [['received', 'Recibida']])],
  [/^\/sgspe\/dashboards\/indicators\/KPI-GRV-02$/, ind('KPI-GRV-02', 'QCS abiertas', 2, 'QCS')],
  [/^\/sgspe\/dashboards\/indicators\/KPI-GRV-06$/, ind('KPI-GRV-06', 'QCS fuera de plazo', 1, 'QCS')],
  [/^\/sgspe\/dashboards\/indicators\/KPI-GRV-07$/, { ...ind('KPI-GRV-07', 'QCS absueltas', 50, '%'), numerator: 2, denominator: 4 }],
  [
    /^\/objects\/social_risk\/workflow$/,
    flujo('social_risk', [
      ['identified', 'Identificado'],
      ['mitigating', 'En mitigación']
    ])
  ],
  [/^\/objects\/social_risk\/records$/, pagina(RIESGOS)],
  [/^\/objects\/early_warning\/workflow$/, flujo('early_warning', [['detected', 'Detectada']])],
  [/^\/objects\/early_warning\/records$/, pagina([ALERTA])],
  [
    /^\/objects\/social_program\/workflow$/,
    flujo('social_program', [
      ['approved', 'Aprobado'],
      ['executing', 'En ejecución']
    ])
  ],
  [/^\/objects\/social_program\/records$/, pagina(PROGRAMAS)],
  [/^\/objects\/social_contribution\/records$/, pagina([APORTE])],
  [/^\/sgspe\/map\/settings$/, { basemap: { type: 'none' } }],
  [/^\/sgspe\/territory\/zones\/[a-z_]+\/[^/]+\/records$/, { content: [], page: 0, size: 25, totalElements: 0, totalPages: 0, available: true }],
  [/^\/sgspe\/ai\/status$/, { enabled: false, providerAvailable: false, useCases: [] }],
  [/^\/sgspe\/deliverable-types$/, TIPOS],
  [/^\/objects\/deliverable\/records$/, pagina(ENTREGABLES)],
  [/^\/objects\/deliverable\/records\/d1$/, ENTREGABLES[0]],
  [/^\/objects\/deliverable\/records\/d1\/(transitions|documents)$/, []],
  [
    /^\/objects\/deliverable\/workflow$/,
    flujo('deliverable', [
      ['draft', 'Borrador'],
      ['in_review', 'En revisión'],
      ['observed', 'Observado'],
      ['approved', 'Aprobado'],
      ['issued', 'Emitido'],
      ['voided', 'Anulado']
    ])
  ],
  [/^\/objects\/deliverable_section\/records$/, pagina(SECCIONES)],
  [/^\/objects\/deliverable_section\/records\/(sec-[a-z]+)$/, (u: URL) => SECCIONES.find((s) => u.pathname.endsWith(s.id))],
  [/^\/sgspe\/deliverables\/d1\/draft$/, BORRADOR],
  [/^\/objects\/(deliverable_version|deliverable_template|ai_suggestion)\/records$/, pagina([])],
  [/^\/sgspe\/projects\/p1\/counts$/, { counts: CONTEOS, confidentialHidden: false }],
  [/^\/sgspe\/dashboards\/investment$/, { dashboard: 'investment', computedAt: ahora, filters: {}, indicators: [] }],
  [/^\/sgspe\/dashboards\/indicators\/KPI-ENG-02$/, ind('KPI-ENG-02', 'Interacciones del mes', 7, 'interacciones')],
  [/^\/sgspe\/people$/, PERSONAS],
  [/^\/sgspe\/calendar\/holidays$/, (u: URL) => ({ year: Number(u.searchParams.get('year')), configured: true, holidays: [] })],
  [/^\/auth\/me\/notifications\/summary$/, AVISOS],
  [/^\/auth\/me\/notifications$/, { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 }],
  [/^\/roles$/, []],
  // lo demás de un objeto, vacío: su lista, su workflow sin estados, su historial y sus transiciones. los que e2e/api.ts ya
  // contesta con datos quedan fuera, para que sus respuestas sigan valiendo
  [/^\/objects\/(?!(project|project_assignment|organization|stakeholder|engagement)\/)[a-z_]+\/records$/, pagina([])],
  [/^\/objects\/(?!(project|stakeholder|engagement|commitment)\/)([a-z_]+)\/workflow$/, (u: URL) => flujo(u.pathname.split('/')[3], [])],
  [/^\/objects\/[a-z_]+\/records\/[^/]+\/(transitions|history)$/, []]
]

// abre la sesión con el tema y el idioma elegidos antes de cargar: sgspe.theme (lo lee el script de arranque de index.html) y
// sgspe.lang (createWasichaiI18n), y las preferencias del usuario dicen lo mismo para que core no los cambie al validar la sesión
export async function prepararEscenario(
  page: Page,
  { tema, idioma, sesion = true, admin = false }: { tema: Tema; idioma: Idioma; sesion?: boolean; admin?: boolean }
) {
  // un mismo día para el «antes» y el «después»: los plazos, los periodos y «calculado hace…» no cambian con la fecha de la corrida.
  // solo se fija la hora (los temporizadores siguen corriendo)
  await page.clock.setFixedTime(HOY)
  await page.addInitScript(
    ([t, i]) => {
      localStorage.setItem('sgspe.theme', t)
      localStorage.setItem('sgspe.lang', i)
    },
    [tema, idioma]
  )
  if (!sesion) {
    await page.route('**/api/**', (r) =>
      r.fulfill({ status: 401, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Unauthorized', status: 401 }) })
    )
    return
  }
  await prepararApi(page)
  await prepararFichaDeCompromiso(page)
  const rutas: [RegExp, Cuerpo][] = [[/^\/auth\/me\/preferences$/, { theme: tema, locale: idioma }], ...RUTAS(admin)]
  await page.route('**/api/**', async (route) => {
    const peticion = route.request()
    const url = new URL(peticion.url())
    const ruta = url.pathname.replace(/^\/api/, '')
    if (peticion.method() !== 'GET') return route.fallback()
    const encontrada = rutas.find(([patron]) => patron.test(ruta))
    if (!encontrada) return route.fallback()
    const cuerpo = typeof encontrada[1] === 'function' ? (encontrada[1] as (u: URL) => unknown)(url) : encontrada[1]
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) })
  })
}
