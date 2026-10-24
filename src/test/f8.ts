import type { AuthUser } from '@wasichai/core'
import type { MockRoute } from '@wasichai/testing'
import type { EstadoDelBorrador, Presentacion } from '../portal/entregables/contrato'
import { definicion, pagina, registro, workflow } from './montar'
import { permisos } from './portal'

// los datos de las pruebas de F8 (tableros consolidados y entregables), con la forma del código de main de sgspe («Dependencias
// del backend» del plan 8.3). aquí sí se nombran roles: son datos de prueba (boundaries.test.ts deja fuera src/test). todo
// es ficticio
export const EJECUTIVA: AuthUser = {
  id: 'u-ejecutiva',
  email: 'ejecutiva@sgspe.test',
  displayName: 'Ejecutiva de prueba',
  organizationId: 'o1',
  roles: ['READ_ONLY']
}

// lo que la gerencia social (SOCIAL_MANAGER) tiene sobre F8 en roles.json: pide, aprueba, emite y descarga lo restringido
export const EQUIPO_DE_ENTREGABLES = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  deliverable: ['READ', 'CREATE', 'UPDATE', 'GENERATE', 'APPROVE', 'ISSUE', 'EXPORT', 'DOWNLOAD_RESTRICTED'],
  deliverable_section: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  deliverable_version: ['READ', 'CREATE'],
  deliverable_presentation: ['READ', 'CREATE', 'UPDATE'],
  deliverable_template: ['READ'],
  indicator: ['READ', 'UPDATE'],
  indicator_measurement: ['READ', 'CREATE'],
  export_log: ['READ', 'CREATE'],
  ai_suggestion: ['READ', 'CREATE', 'UPDATE'],
  ai_interaction: ['READ', 'CREATE'],
  person: ['READ'],
  position: ['READ'],
  stakeholder: ['READ'],
  community: ['READ'],
  study: ['READ'],
  area_of_influence: ['READ'],
  organization: ['READ']
})
// el relacionista (COMMUNITY_RELATIONS_OFFICER): redacta secciones y usa la IA, pero no pide borradores ni los descarga
export const REDACCION = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  deliverable: ['READ'],
  deliverable_section: ['READ', 'CREATE', 'UPDATE'],
  deliverable_version: ['READ'],
  deliverable_template: ['READ'],
  indicator: ['READ'],
  indicator_measurement: ['READ'],
  ai_suggestion: ['READ', 'CREATE', 'UPDATE'],
  ai_interaction: ['READ', 'CREATE'],
  person: ['READ'],
  position: ['READ'],
  stakeholder: ['READ']
})
// la ejecutiva (READ_ONLY): lee y nada más
export const SOLO_LECTURA_F8 = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  deliverable: ['READ'],
  deliverable_section: ['READ'],
  deliverable_version: ['READ'],
  deliverable_presentation: ['READ'],
  deliverable_template: ['READ'],
  indicator: ['READ'],
  indicator_measurement: ['READ']
})
// quien cierra periodos y edita metas
export const CIERRE = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  indicator: ['READ', 'UPDATE'],
  indicator_measurement: ['READ', 'CREATE']
})

export const SHA_MODELO = '0f'.repeat(32)
export const SHA_INTERNO = '1e'.repeat(32)
export const SHA_EXTERNO = '2d'.repeat(32)
export const SHA_DOCX = '3c'.repeat(32)
export const SHA_PLANTILLA = '4b'.repeat(32)

// las menciones y los marcadores de la IA llevan ids UUID, como en el backend (Mentions.TOKEN)
export const PERSONA_ID = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
export const CARGO_ID = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d'
export const GRUPO_ID = '5e4f3a2b-1c0d-4e9f-8a7b-6c5d4e3f2a1b'

export const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A', working_crs: 'EPSG:32717' }, { state: 'active' })
export const P2 = registro('p2', { code: 'PRJ-02', name: 'Proyecto Ejemplo B' }, { state: 'active' })
export const asignacion = (usuario: AuthUser, proyecto = 'p1') =>
  registro(`as-${usuario.id}-${proyecto}`, { project: proyecto, member_user_id: usuario.id, active: true })
export const PERSONA = registro(PERSONA_ID, { given_names: 'Persona', surnames: 'Ejemplo 1' })
export const CARGO = registro(CARGO_ID, { person: PERSONA_ID, position_title: 'Presidencia comunal', position_status: 'VIGENTE' })
export const GRUPO = registro(GRUPO_ID, { project: 'p1', organization: 'o1' })
export const COMUNIDAD = registro('c1', { name: 'Comunidad Ejemplo' })

// un T2 en borrador con su último borrador LISTO (congelado el 10 de octubre a las 15:00 UTC)
const ATRIBUTOS_DEL_ENTREGABLE = {
  project: 'p1',
  document_code: 'INF-001',
  title: 'Informe de campo de la Comunidad Ejemplo',
  deliverable_type: 'INFORME DE CAMPO Y AVANCE',
  period_start_date: '2026-09-01',
  period_end_date: '2026-09-30',
  community: 'c1',
  template_key: null,
  draft_generation_status: 'LISTO',
  draft_generated_at: '2026-10-10T15:00:00Z',
  draft_model_sha256: SHA_MODELO,
  draft_revision: 'A',
  current_revision: null,
  current_version: null
}
export const ENTREGABLE = registro('d1', ATRIBUTOS_DEL_ENTREGABLE, { state: 'draft', updatedAt: '2026-10-10T15:05:00Z' })
export const entregableEn = (estado: string, extra: Record<string, unknown> = {}) =>
  registro('d1', { ...ATRIBUTOS_DEL_ENTREGABLE, ...extra }, { state: estado, updatedAt: '2026-10-10T15:05:00Z' })

const seccion = (id: string, attributes: Record<string, unknown>, updatedAt = '2026-10-09T15:00:00Z') =>
  registro(id, { deliverable: 'd1', reviewed: false, ai_suggestion: null, ...attributes }, { updatedAt })
export const SECCION_PORTADA = seccion('sec-portada', {
  section_key: 'portada',
  title: 'Portada',
  sort_order: 1,
  section_kind: 'CALCULADA',
  content_origin: 'CALCULADO',
  content: null
})
export const SECCION_ANTECEDENTES = seccion('sec-antecedentes', {
  section_key: 'antecedentes',
  title: 'Antecedentes',
  sort_order: 2,
  section_kind: 'MIXTA',
  content_origin: 'HUMANO',
  content: 'La comunidad pidió una reunión en agosto.'
})
// una sección que el tipo no marca con IA
export const SECCION_REDES = seccion('sec-redes', {
  section_key: 'redes',
  title: 'Identificación de redes comunitarias',
  sort_order: 6,
  section_kind: 'MIXTA',
  content_origin: 'HUMANO',
  content: ''
})
// asistida por IA y cambiada después del borrador (16:00 > 15:00)
export const SECCION_CONCLUSIONES = seccion(
  'sec-conclusiones',
  {
    section_key: 'conclusiones',
    title: 'Conclusiones',
    sort_order: 10,
    section_kind: 'NARRATIVA',
    content_origin: 'ASISTIDO POR IA',
    content: `1. Se contactó a [[person:${PERSONA_ID}]].`,
    reviewed: true,
    ai_suggestion: 'sug0'
  },
  '2026-10-10T16:00:00Z'
)
export const SECCIONES = [SECCION_PORTADA, SECCION_ANTECEDENTES, SECCION_REDES, SECCION_CONCLUSIONES]

const sugerencia = (id: string, attributes: Record<string, unknown>, createdAt: string) =>
  registro(id, { project: 'p1', model: 'claude-ejemplo', ai_interaction: 'ai1', ...attributes }, { state: 'proposed', createdAt, updatedAt: createdAt })
export const SUG_SECCION = sugerencia(
  'sug1',
  {
    suggestion_kind: 'BORRADOR DE SECCION',
    target_object: 'deliverable_section',
    target_record_id: 'sec-antecedentes',
    suggested_value: `## Antecedentes\nLa directiva, con «[PERSONA:${PERSONA_ID}]», pidió una reunión.`
  },
  '2026-10-11T15:00:00Z'
)
export const SUG_CON_RESERVADO = sugerencia(
  'sug2',
  {
    suggestion_kind: 'BORRADOR DE SECCION',
    target_object: 'deliverable_section',
    target_record_id: 'sec-antecedentes',
    suggested_value: 'Habló [PERSONA], con teléfono [TELEFONO].'
  },
  '2026-10-11T16:00:00Z'
)
export const SUG_RESUMEN = sugerencia(
  'sug3',
  {
    suggestion_kind: 'RESUMEN EJECUTIVO',
    target_object: 'project',
    target_record_id: 'p1',
    suggested_value: 'El proyecto tuvo cuatro interacciones en el periodo.'
  },
  '2026-10-11T14:00:00Z'
)

const NIVELES_LISTOS = [
  { level: 'INTERNO' as const, candidateSha256: SHA_INTERNO },
  { level: 'EXTERNO' as const, candidateSha256: SHA_EXTERNO }
]
export const BORRADOR_LISTO: EstadoDelBorrador = {
  status: 'LISTO',
  requestedAt: '2026-10-10T14:59:00Z',
  generatedAt: '2026-10-10T15:00:00Z',
  revision: 'A',
  modelSha256: SHA_MODELO,
  pending: false,
  levels: NIVELES_LISTOS,
  warnings: [{ code: 'POSSIBLE_PERSONAL_DATA', section: 'antecedentes' }]
}
export const BORRADOR_EN_COLA: EstadoDelBorrador = { ...BORRADOR_LISTO, status: 'EN COLA', requestedAt: '2026-10-11T15:00:00Z', pending: true, warnings: [] }
export const BORRADOR_CON_MAPA_FALLIDO: EstadoDelBorrador = { ...BORRADOR_LISTO, warnings: [{ code: 'MAP_FAILED', section: 'portada' }] }
export const SIN_BORRADOR: EstadoDelBorrador = {
  status: null,
  requestedAt: null,
  generatedAt: null,
  revision: null,
  modelSha256: null,
  pending: false,
  levels: [
    { level: 'INTERNO', candidateSha256: null },
    { level: 'EXTERNO', candidateSha256: null }
  ],
  warnings: []
}

export const VERSION_INTERNO = registro('v1', {
  deliverable: 'd1',
  version_number: 1,
  revision: '0',
  issued_at: '2026-10-12T15:00:00Z',
  issued_by_user_email: 'smg@sgspe.test',
  disclosure_level: 'INTERNO',
  pdf_sha256: SHA_INTERNO,
  docx_sha256: SHA_DOCX,
  model_sha256: SHA_MODELO,
  ai_assisted_sections: 'conclusiones'
})
export const VERSION_EXTERNO = registro('v2', {
  deliverable: 'd1',
  version_number: 2,
  revision: '0',
  issued_at: '2026-10-12T15:00:00Z',
  issued_by_user_email: 'smg@sgspe.test',
  disclosure_level: 'EXTERNO',
  pdf_sha256: SHA_EXTERNO,
  docx_sha256: null,
  model_sha256: SHA_MODELO,
  derived_from: 'v1',
  ai_assisted_sections: 'conclusiones'
})

export const WF_ENTREGABLE = workflow('deliverable', [
  ['draft', 'Borrador'],
  ['in_review', 'En revisión'],
  ['observed', 'Observado'],
  ['approved', 'Aprobado'],
  ['issued', 'Emitido'],
  ['voided', 'Anulado']
])
export const transicion = (name: string, label: string, to: string, toLabel: string) => ({ name, label, to, toLabel, allowed: true, reason: null })

export const PLANTILLA = {
  id: 't1',
  templateKey: 'informe-base',
  name: 'Plantilla Ejemplo',
  sha256: SHA_PLANTILLA,
  createdAt: '2026-10-08T15:00:00Z',
  warnings: [{ code: 'FONT_IN_TABLE', detail: 'Calibri' }],
  hasLogo: true,
  accentColor: '1F6F5C'
}

export const DEF_ENTREGABLE = definicion('deliverable', [
  ['document_code', { label: 'Código del documento', required: true }],
  ['title', { label: 'Título', required: true }],
  ['deliverable_type', { label: 'Tipo de entregable', type: 'ENUM', enumOptions: ['DIAGNOSTICO SOCIAL', 'INFORME DE CAMPO Y AVANCE'] }],
  ['period_start_date', { label: 'Inicio del periodo', type: 'DATE' }],
  ['period_end_date', { label: 'Fin del periodo', type: 'DATE' }],
  ['cutoff_date', { label: 'Fecha de corte', type: 'DATE' }],
  ['template_key', { label: 'Clave de la plantilla' }],
  ['project', { label: 'Proyecto', type: 'RELATION', relationTarget: 'project' }],
  ['community', { label: 'Comunidad', type: 'RELATION', relationTarget: 'community' }],
  ['study', { label: 'Estudio', type: 'RELATION', relationTarget: 'study' }],
  ['area_of_influence', { label: 'Área de influencia', type: 'RELATION', relationTarget: 'area_of_influence' }],
  ['prepared_for_organization', { label: 'Preparado para', type: 'RELATION', relationTarget: 'organization' }],
  ['prepared_by_organization', { label: 'Suscrito por', type: 'RELATION', relationTarget: 'organization' }],
  ['draft_generation_status', { label: 'Estado del borrador', type: 'ENUM', editable: false }],
  ['draft_generated_at', { label: 'Modelo congelado el', type: 'DATETIME', editable: false }],
  ['draft_model_sha256', { label: 'SHA-256 del modelo del borrador', editable: false }],
  ['draft_revision', { label: 'Revisión del borrador', editable: false }],
  ['current_revision', { label: 'Revisión vigente', editable: false }],
  ['current_version', { label: 'Versión vigente', type: 'RELATION', relationTarget: 'deliverable_version' }]
])
export const DEF_SECCION = definicion('deliverable_section', [
  'section_key',
  'title',
  ['sort_order', { type: 'INTEGER' }],
  ['section_kind', { type: 'ENUM', enumOptions: ['NARRATIVA', 'CALCULADA', 'MIXTA', 'ANEXO'] }],
  ['content', { label: 'Texto', type: 'LONG_TEXT' }],
  ['content_origin', { type: 'ENUM', enumOptions: ['HUMANO', 'CALCULADO', 'ASISTIDO POR IA'] }],
  ['reviewed', { label: 'Revisada', type: 'BOOLEAN' }],
  ['deliverable', { type: 'RELATION', relationTarget: 'deliverable' }],
  ['ai_suggestion', { type: 'RELATION', relationTarget: 'ai_suggestion' }]
])
export const DEF_INDICADOR = definicion('indicator', [
  ['code', { label: 'Código del KPI', required: true }],
  ['name', { label: 'Nombre', required: true }],
  ['definition', { label: 'Definición', type: 'LONG_TEXT' }],
  ['frequency', { label: 'Frecuencia' }],
  ['target_value', { label: 'Meta', type: 'DECIMAL' }],
  ['verification_means', { label: 'Medio de verificación', type: 'LONG_TEXT' }]
])
export const DEF_VERSION = definicion('deliverable_version', [
  ['version_number', { type: 'INTEGER' }],
  ['revision', {}],
  ['disclosure_level', { type: 'ENUM', enumOptions: ['INTERNO', 'EXTERNO', 'PUBLICO'] }]
])

export const INDICADORES_DEL_CATALOGO = [
  registro('i-stk04', {
    code: 'KPI-STK-04',
    name: 'Grupos de interés contactados',
    frequency: 'Mensual',
    target_value: null,
    verification_means: 'Reporte de cobertura'
  }),
  registro('i-stk05', {
    code: 'KPI-STK-05',
    name: 'Oposición que aceptó conversar',
    frequency: 'Mensual',
    target_value: null,
    verification_means: 'Reporte de cobertura'
  }),
  registro('i-eng02', {
    code: 'KPI-ENG-02',
    name: 'Reuniones sostenidas al mes',
    frequency: 'Mensual',
    target_value: 2,
    verification_means: 'Reporte de reuniones mensuales'
  }),
  registro('i-grv07', { code: 'KPI-GRV-07', name: 'QCS absueltas', frequency: 'Mensual', target_value: null, verification_means: 'Reporte de QCS' })
]

const ind = (code: string, label: string, extra: Record<string, unknown> = {}) => ({ code, label, available: true, value: null, ...extra })
const TENDENCIA = [
  { period: '2026-09', engagements: 5, grievancesReceived: 2, grievancesClosed: 1, overdueCommitments: 2 },
  { period: '2026-10', engagements: 7, grievancesReceived: 1, grievancesClosed: 2, overdueCommitments: 3 }
]
const delProyecto = (cifras: Record<string, number>) => [
  ind('KPI-EXE-01', 'Proyectos activos', { value: cifras['KPI-EXE-01'] ?? 1 }),
  ind('KPI-COM-02', 'Compromisos abiertos', { value: cifras['KPI-COM-02'] ?? 0 }),
  ind('KPI-COM-03', 'Compromisos vencidos', { value: cifras['KPI-COM-03'] ?? 0 }),
  ind('KPI-GRV-02', 'Quejas abiertas', { value: cifras['KPI-GRV-02'] ?? 0 }),
  ind('KPI-RSK-01', 'Riesgos altos y críticos', { value: cifras['KPI-RSK-01'] ?? 0 }),
  ind('KPI-ENG-01', 'Interacciones realizadas', { value: cifras['KPI-ENG-01'] ?? 0 }),
  ind('KPI-EXE-02', 'Alertas activas', { value: cifras['KPI-EXE-02'] ?? 0 }),
  { code: 'KPI-INV-03', label: 'Inversión ejecutada', available: false, unavailableReason: 'OBJECT_NOT_READABLE', missingFields: ['commitment.amount'] }
]
export const TABLERO_EJECUTIVO = {
  dashboard: 'executive',
  computedAt: '2026-10-16T15:00:00Z',
  filters: { project: ['p1', 'p2'] },
  indicators: [
    ind('KPI-EXE-01', 'Proyectos activos', { value: 2, unit: 'proyectos' }),
    ind('KPI-COM-02', 'Compromisos abiertos', { value: 9, unit: 'compromisos' }),
    ind('KPI-COM-03', 'Compromisos vencidos', { value: 3, unit: 'compromisos' }),
    ind('KPI-GRV-02', 'Quejas abiertas', { value: 4, unit: 'quejas' }),
    ind('KPI-RSK-01', 'Riesgos altos y críticos', { value: 1, unit: 'riesgos' }),
    ind('KPI-ENG-01', 'Interacciones realizadas', { value: 12, unit: 'interacciones' }),
    ind('KPI-EXE-02', 'Alertas activas', { value: 2, unit: 'alertas' }),
    ind('KPI-INV-03', 'Inversión ejecutada', {
      value: 15000,
      breakdowns: [
        { by: 'source', rows: [] },
        {
          by: 'project',
          rows: [
            { key: 'p1:PEN', project: 'p1', label: 'PRJ-01', currency: 'PEN', executed: '12000', budget: '30000', cap: '50000', value: null },
            { key: 'p2:PEN', project: 'p2', label: 'PRJ-02', currency: 'PEN', executed: '3000', budget: '10000', cap: null, value: null },
            { key: 'p1:USD', project: 'p1', label: 'PRJ-01', currency: 'USD', executed: '500', budget: null, cap: null, value: null }
          ]
        }
      ]
    }),
    ind('KPI-EXE-03', 'Tendencia mensual', { series: TENDENCIA })
  ],
  byProject: [
    {
      project: 'p1',
      code: 'PRJ-01',
      name: 'Proyecto Ejemplo A',
      indicators: delProyecto({ 'KPI-COM-02': 6, 'KPI-COM-03': 3, 'KPI-GRV-02': 1, 'KPI-RSK-01': 1, 'KPI-ENG-01': 8, 'KPI-EXE-02': 2 })
    },
    { project: 'p2', code: 'PRJ-02', name: 'Proyecto Ejemplo B', indicators: delProyecto({ 'KPI-COM-02': 3, 'KPI-GRV-02': 3, 'KPI-ENG-01': 4 }) }
  ]
}

// cuatro de las 13 filas de la Tabla 9.5: una con cifra oficial, una de postura no disponible, una con la meta del proyecto y
// una sin meta ni indicador en el catálogo (indicatorId null)
export const TABLERO_MONITOREO = {
  dashboard: 'monitoring',
  computedAt: '2026-10-16T15:00:00Z',
  filters: { project: ['p1'], periodStart: '2026-09-01', periodEnd: '2026-09-30' },
  indicators: [
    ind('KPI-STK-04', 'Grupos de interés contactados', { value: 14 }),
    {
      code: 'KPI-STK-05',
      label: 'Oposición que aceptó conversar',
      available: false,
      unavailableReason: 'FIELD_NOT_READABLE',
      missingFields: ['stakeholder.stance']
    },
    ind('KPI-ENG-02', 'Reuniones sostenidas al mes', { value: 3 }),
    ind('KPI-GRV-07', 'QCS absueltas', { value: 80 })
  ],
  rows: [
    {
      number: 1,
      code: 'KPI-STK-04',
      label: 'Grupos de interés contactados, por sexo, ámbito e institución',
      verificationMeans: 'Reporte de cobertura de grupos de interés contactados',
      deliverable: 'T5',
      available: true,
      value: 14,
      target: null,
      targetSource: 'NONE',
      official: { measurement: 'm1', closedAt: '2026-10-02T15:00:00Z', value: 13 },
      indicatorId: 'i-stk04'
    },
    {
      number: 2,
      code: 'KPI-STK-05',
      label: 'Porcentaje de grupos de interés de oposición que aceptaron conversar con la empresa',
      verificationMeans: 'Reporte de cobertura de grupos de interés contactados',
      deliverable: 'T5',
      available: false,
      value: null,
      target: null,
      targetSource: 'NONE',
      official: null,
      indicatorId: 'i-stk05'
    },
    {
      number: 5,
      code: 'KPI-ENG-02',
      label: 'Reuniones sostenidas al mes (al menos 2)',
      verificationMeans: 'Reporte de reuniones mensuales; minuta de reunión',
      deliverable: 'T3',
      available: true,
      value: 3,
      target: 2,
      targetSource: 'PROJECT',
      official: null,
      indicatorId: 'i-eng02'
    },
    {
      number: 6,
      code: 'KPI-GRV-07',
      label: 'Porcentaje de quejas, consultas o solicitudes absueltas',
      verificationMeans: 'Reporte de quejas, consultas y solicitudes',
      deliverable: 'T4',
      available: true,
      value: 80,
      target: null,
      targetSource: 'NONE',
      official: null,
      indicatorId: null
    }
  ]
}

// los 17 KPI del tablero project (Kpis.DASHBOARDS["project"])
export const TABLERO_PROYECTO = {
  dashboard: 'project',
  computedAt: '2026-10-16T15:00:00Z',
  filters: { project: ['p1'] },
  indicators: [
    ind('KPI-STK-01', 'Grupos de interés por clasificación', { value: 42, unit: 'grupos de interés' }),
    { code: 'KPI-STK-02', label: 'Distribución de posturas', available: false, unavailableReason: 'FIELD_NOT_READABLE', missingFields: ['stakeholder.stance'] },
    ind('KPI-STK-03', 'Matriz interés × poder', {
      value: 30,
      numerator: 30,
      denominator: 42,
      breakdowns: [{ by: 'stakeholder', rows: [{ key: 's1', value: 6, interest: 3.5, power: 2.5 }] }]
    }),
    ind('KPI-ENG-01', 'Interacciones realizadas', { value: 7, unit: 'interacciones' }),
    ind('KPI-ENG-02', 'Reuniones sostenidas al mes', {
      value: 3,
      series: [
        { period: '2026-09', value: 1, target: 2 },
        { period: '2026-10', value: 3, target: 2 }
      ]
    }),
    ind('KPI-COM-02', 'Compromisos abiertos', { value: 6, unit: 'compromisos' }),
    ind('KPI-COM-03', 'Compromisos vencidos', { value: 3, unit: 'compromisos' }),
    ind('KPI-COM-04', 'Compromisos por vencer', { value: 2, unit: 'compromisos' }),
    ind('KPI-COM-06', 'Compromisos bloqueados', { value: 1, unit: 'compromisos' }),
    ind('KPI-GRV-01', 'QCS recibidas', { value: 5, unit: 'QCS' }),
    ind('KPI-GRV-02', 'Quejas abiertas', { value: 2, unit: 'quejas' }),
    ind('KPI-GRV-06', 'QCS vencidas', { value: 1, unit: 'QCS' }),
    ind('KPI-RSK-01', 'Riesgos altos y críticos', { value: 1, unit: 'riesgos' }),
    ind('KPI-RSK-02', 'Mapa de calor', { value: 4, breakdowns: [{ by: 'cell', rows: [] }] }),
    ind('KPI-INV-02', 'Presupuesto de programas', { value: null, breakdowns: [{ by: 'program', rows: [] }] }),
    ind('KPI-INV-03', 'Inversión ejecutada', { value: 12000, breakdowns: [{ by: 'project', rows: [] }] }),
    ind('KPI-INV-04', 'Beneficiarios', { value: 0, breakdowns: [{ by: 'program', rows: [] }] })
  ]
}

export const CATALOGO_F8 = [
  { code: 'KPI-EXE-01', label: 'Proyectos activos', dashboard: 'executive', available: true },
  { code: 'KPI-EXE-02', label: 'Alertas activas', dashboard: 'executive', available: true },
  { code: 'KPI-STK-04', label: 'Grupos de interés contactados', dashboard: 'monitoring', available: true }
]

// GET /api/sgspe/deliverable-types (DeliverableTypeCatalog): los tipos por nombre y sus secciones por orden. T2 entero y, de T1,
// unas pocas secciones (el backend trae 46)
const seccionDelTipo_ = (key: string, title: string, order: number, kind: string, assisted: boolean, guide: string) => ({
  key,
  title,
  order,
  kind,
  required: true,
  assisted,
  guide
})
export const TIPOS_DE_ENTREGABLE = [
  {
    type: 'DIAGNOSTICO SOCIAL',
    version: 1,
    sections: [
      seccionDelTipo_('portada', 'Portada', 1, 'CALCULADA', false, 'Título con el proyecto, preparado para, suscrito por, mes y año.'),
      seccionDelTipo_('introduccion', '1. Introducción', 3, 'NARRATIVA', true, 'Propósito del estudio y del documento.'),
      seccionDelTipo_('monitoreo', '9.3.1 Monitoreo', 37, 'CALCULADA', false, 'Tabla 9.5 con meta, valor del periodo y cifra oficial.')
    ]
  },
  {
    type: 'INFORME DE CAMPO Y AVANCE',
    version: 1,
    sections: [
      seccionDelTipo_('portada', 'Portada', 1, 'CALCULADA', false, 'Título con el proyecto, mes y año del fin del periodo y mapa de ubicación.'),
      seccionDelTipo_('antecedentes', 'Antecedentes', 2, 'MIXTA', true, 'Incidentes del proyecto y relación con los grupos de interés.'),
      seccionDelTipo_('objetivos', 'Objetivo estratégico y objetivos tácticos', 3, 'CALCULADA', false, 'Del plan de relacionamiento del proyecto.'),
      seccionDelTipo_('estrategias', 'Estrategias de intervención', 4, 'MIXTA', true, 'Ejes de acción y su justificación, en lista numerada.'),
      seccionDelTipo_('actividades', 'Actividades del periodo', 5, 'MIXTA', true, 'Viajes y reuniones del periodo, también las canceladas y su motivo.'),
      seccionDelTipo_('redes', 'Identificación de redes comunitarias', 6, 'MIXTA', false, 'Redes de la comunidad, sus integrantes y su papel.'),
      seccionDelTipo_('relaciones', 'Construcción de relaciones y penetración en redes', 7, 'MIXTA', true, 'Contactos cara a cara y cargos vigentes.'),
      seccionDelTipo_('apoyo', 'Apoyo entregado', 8, 'MIXTA', false, 'Pedido, ocasión, propósito, condiciones, ítems y entrega con su acta.'),
      seccionDelTipo_('predio', 'Identificación del predio', 9, 'CALCULADA', false, 'Concesiones, territorio comunal, caseríos y datos registrales.'),
      seccionDelTipo_('conclusiones', 'Conclusiones', 10, 'NARRATIVA', true, 'Redes identificadas, contactos logrados y pendientes, en lista numerada.'),
      seccionDelTipo_('recomendaciones', 'Recomendaciones', 11, 'NARRATIVA', true, 'Con vínculos a riesgos sociales y acuerdos, en lista numerada.')
    ]
  }
]

export const ESTADO_IA = {
  enabled: true,
  providerAvailable: true,
  useCases: ['AI-01', 'AI-02', 'AI-03', 'AI-04', 'AI-05', 'AI-06', 'AI-07', 'AI-08']
}

// lo que toda pantalla de F8 pregunta: el proyecto y la asignación vigente de quien mira, WF-H, las definiciones, la persona
// mencionada, el estado de la IA, el catálogo de tableros, los tipos de entregable y los avisos (que no tiene)
export const baseDeF8 = (usuario: AuthUser): MockRoute[] => [
  { path: '/objects/project/records', body: pagina([P1, P2]) },
  { path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/records/p2', body: P2 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/project_assignment/records', body: pagina([asignacion(usuario)]) },
  { path: '/objects/deliverable/workflow', body: WF_ENTREGABLE },
  { path: '/objects/ai_suggestion/workflow', body: workflow('ai_suggestion', [['proposed', 'Propuesta']]) },
  { path: '/metadata/objects/deliverable', body: DEF_ENTREGABLE },
  { path: '/metadata/objects/deliverable_section', body: DEF_SECCION },
  { path: '/metadata/objects/indicator', body: DEF_INDICADOR },
  { path: '/metadata/objects/deliverable_version', body: DEF_VERSION },
  { path: `/objects/person/records/${PERSONA_ID}`, body: PERSONA },
  { path: '/objects/community/records/c1', body: COMUNIDAD },
  { path: '/sgspe/ai/status', body: ESTADO_IA },
  { path: '/sgspe/dashboards/indicators', body: CATALOGO_F8 },
  { path: '/sgspe/deliverable-types', body: TIPOS_DE_ENTREGABLE },
  { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } },
  { path: '/auth/me/notifications/summary', status: 404, body: { title: 'Not Found', status: 404 } }
]

// las presentaciones de un entregable emitido (api.md §4.12, ADR-0031), con la forma de PresentationStatus de sgspe
export const SHA_ESPECIFICACION = '5a'.repeat(32)
export const SHA_LAMINAS = '69'.repeat(32)
export const SHA_VIDEO = '78'.repeat(32)
const PRESENTACION_BASE: Presentacion = {
  id: 'pr1',
  versionNumber: 2,
  audience: 'INSTITUCIONES',
  level: 'EXTERNO',
  status: 'LISTO',
  failureCode: null,
  slideCount: 12,
  requestedAt: '2026-10-20T15:00:00Z',
  generatedAt: '2026-10-20T15:01:00Z',
  modelSha256: SHA_MODELO,
  specSha256: SHA_ESPECIFICACION,
  pdfSha256: SHA_LAMINAS,
  plannerVersion: '3',
  designVersion: '2',
  rendererVersion: '4.0.533',
  videoStatus: null,
  videoFailureCode: null,
  videoRequestedAt: null,
  videoGeneratedAt: null,
  videoSha256: null
}
export const PRESENTACION_LISTA: Presentacion = PRESENTACION_BASE
export const PRESENTACION_EN_COLA: Presentacion = {
  ...PRESENTACION_BASE,
  id: 'pr2',
  audience: 'DIRECCION',
  level: 'INTERNO',
  versionNumber: 1,
  status: 'EN COLA',
  slideCount: null,
  generatedAt: null,
  specSha256: null,
  pdfSha256: null
}
export const PRESENTACION_FALLIDA: Presentacion = {
  ...PRESENTACION_BASE,
  id: 'pr3',
  audience: 'COMUNIDAD',
  level: 'PUBLICO',
  status: 'FALLIDO',
  failureCode: 'SLIDE_OVERFLOW',
  slideCount: null,
  specSha256: null,
  pdfSha256: null
}
export const PRESENTACION_INTERNA: Presentacion = { ...PRESENTACION_BASE, id: 'pr4', audience: 'CAMPO', level: 'INTERNO', versionNumber: 1 }
