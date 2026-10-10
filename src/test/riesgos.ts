import type { AuthUser } from '@wasichai/core'
import type { MockRoute } from '@wasichai/testing'
import { P1 } from './compromisos'
import { definicion, pagina, registro, workflow } from './montar'
import { permisos } from './portal'

// los datos de las pruebas de F4 de riesgos y alerta temprana: la gestión de riesgos (SOCIAL_RISK_MANAGER, con CONFIRM_ALERT), un
// riesgo crítico en mitigación, una alerta en triaje, un incidente en respuesta, los workflows WF-F, WF-J y WF-M y las
// definiciones del plan 4.1. aquí sí se nombran roles: son datos de prueba (boundaries.test.ts deja fuera src/test)
export const GESTOR_DE_RIESGOS: AuthUser = {
  id: 'u-srm',
  email: 'srm@sgspe.test',
  displayName: 'Gestión de riesgos de prueba',
  organizationId: 'o1',
  roles: ['SOCIAL_RISK_MANAGER']
}

// security.md §7.6: SOCIAL_RISK_MANAGER escribe los riesgos, sus medidas, impactos y reglas, y confirma o descarta alertas
export const EQUIPO_DE_RIESGOS = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  social_risk: ['READ', 'CREATE', 'UPDATE', 'EXPORT'],
  risk_assessment: ['READ', 'CREATE'],
  mitigation_measure: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  potential_impact: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  incident: ['READ', 'CREATE', 'UPDATE'],
  media_mention: ['READ', 'CREATE', 'UPDATE'],
  early_warning_signal: ['READ', 'CREATE', 'UPDATE'],
  early_warning_rule: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  early_warning: ['READ', 'CREATE', 'UPDATE', 'CONFIRM_ALERT'],
  grievance: ['READ'],
  stakeholder: ['READ'],
  locality: ['READ'],
  community: ['READ'],
  commitment: ['READ'],
  organization: ['READ'],
  topic: ['READ'],
  evidence: ['READ', 'CREATE', 'UPDATE'],
  task: ['READ', 'UPDATE']
})

// COMMUNITY_RELATIONS_OFFICER: lee los riesgos, registra incidentes, menciones y señales, e inicia el triaje sin confirmar
export const RELACIONES_EN_RIESGOS = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  social_risk: ['READ'],
  risk_assessment: ['READ'],
  mitigation_measure: ['READ'],
  potential_impact: ['READ'],
  incident: ['READ', 'CREATE', 'UPDATE'],
  media_mention: ['READ', 'CREATE', 'UPDATE'],
  early_warning_signal: ['READ', 'CREATE', 'UPDATE'],
  early_warning_rule: ['READ'],
  early_warning: ['READ', 'UPDATE']
})

export const RIESGO = registro(
  'k1',
  {
    project: 'p1',
    code: 'R-001',
    title: 'Bloqueo de la vía de acceso por la comunidad',
    risk_source: 'Expectativas de empleo local no atendidas',
    category: 'EXPECTATIVAS Y BENEFICIOS',
    impact_type: 'SOCIAL',
    impact_nature: 'REAL',
    probability: 4,
    impact: 4,
    score: 16,
    risk_level: 'CRITICO',
    treatment_decision: 'MITIGAR',
    next_review_date: '2026-10-12',
    review_status: 'AL DIA',
    owner_user_id: 'u-srm',
    owner_user_email: 'srm@sgspe.test'
  },
  { state: 'mitigating' }
)

export const ALERTA = registro(
  'w1',
  {
    project: 'p1',
    title: 'Señales de conflicto: CONTEO DE SEÑALES',
    detected_at: '2026-10-05T13:00:00Z',
    severity: 'ALTO',
    trigger_description: '4 señales en 7 días (umbral 3)',
    ai_detected: false,
    early_warning_rule: 'rg1',
    generator_key: 'warning_rule:rg1:p1:2026-10-05'
  },
  { state: 'in_triage' }
)

export const INCIDENTE = registro(
  'n1',
  {
    project: 'p1',
    code: 'I-001',
    incident_type: 'BLOQUEO DE VIA',
    occurred_at: '2026-10-04T12:00:00Z',
    place: 'Km 12 de la vía de acceso',
    description: 'Un grupo de comuneros bloqueó la vía durante cuatro horas'
  },
  { state: 'responding' }
)

export const REGLA = registro('rg1', {
  project: 'p1',
  name: 'Señales de conflicto',
  rule_kind: 'CONTEO DE SEÑALES',
  threshold: 3,
  window_days: 7,
  severity: 'ALTO',
  enabled: true
})

export const WF_RIESGO = workflow('social_risk', [
  ['identified', 'Identificado'],
  ['assessed', 'Evaluado'],
  ['mitigating', 'En mitigación'],
  ['monitoring', 'En monitoreo'],
  ['closed', 'Cerrado']
])
export const WF_ALERTA = workflow('early_warning', [
  ['detected', 'Detectada'],
  ['in_triage', 'En triaje'],
  ['confirmed', 'Confirmada'],
  ['responding', 'En respuesta'],
  ['resolved', 'Resuelta'],
  ['dismissed', 'Descartada'],
  ['closed', 'Cerrada']
])
export const WF_INCIDENTE = workflow('incident', [
  ['reported', 'Reportado'],
  ['under_review', 'En revisión'],
  ['responding', 'En respuesta'],
  ['closed', 'Cerrado']
])

const enumeracion = (opciones: string[]) => ({ type: 'ENUM', enumOptions: opciones })
const relacion = (destino: string) => ({ type: 'RELATION', relationTarget: destino })
const NIVELES = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO']

export const DEF_RIESGO = definicion('social_risk', [
  ['code', { required: true }],
  ['title', { required: true }],
  ['risk_source', { type: 'LONG_TEXT' }],
  ['category', enumeracion(['AMBIENTAL', 'EXPECTATIVAS Y BENEFICIOS', 'TIERRAS Y TERRITORIO', 'OTRO'])],
  ['impact_type', enumeracion(['AMBIENTAL', 'SOCIAL'])],
  ['impact_nature', enumeracion(['REAL', 'PERCIBIDO'])],
  ['probability', { type: 'INTEGER' }],
  ['impact', { type: 'INTEGER' }],
  ['score', { type: 'INTEGER' }],
  ['risk_level', enumeracion(NIVELES)],
  ['treatment_decision', enumeracion(['MITIGAR', 'MONITOREAR', 'ACEPTAR'])],
  ['treatment_rationale', { type: 'LONG_TEXT' }],
  ['current_controls', { type: 'LONG_TEXT' }],
  ['monitoring_sources', { type: 'LONG_TEXT' }],
  ['controls_adequate', { type: 'BOOLEAN' }],
  ['residual_probability', { type: 'INTEGER' }],
  ['residual_impact', { type: 'INTEGER' }],
  ['residual_score', { type: 'INTEGER' }],
  ['residual_level', enumeracion(NIVELES)],
  ['review_every_days', { type: 'INTEGER' }],
  ['next_review_date', { type: 'DATE' }],
  ['review_status', enumeracion(['AL DIA', 'POR REVISAR', 'REVISION VENCIDA'])],
  ['owner_user_id', { type: 'UUID' }],
  ['owner_user_email', { type: 'EMAIL' }],
  ['close_reason', { type: 'LONG_TEXT' }],
  ['project', relacion('project')],
  ['key_theme', relacion('key_theme')],
  ['local_conflict', relacion('local_conflict')],
  ['origin_incident', relacion('incident')],
  ['locality', relacion('locality')],
  ['community', relacion('community')],
  ['area_of_influence', relacion('area_of_influence')]
])
export const DEF_REVISION = definicion('risk_assessment', [
  ['assessment_date', { type: 'DATE', required: true }],
  ['probability', { type: 'INTEGER', required: true }],
  ['impact', { type: 'INTEGER', required: true }],
  ['score', { type: 'INTEGER' }],
  ['risk_level', enumeracion(NIVELES)],
  ['residual', { type: 'BOOLEAN' }],
  ['trend', enumeracion(['AUMENTA', 'SE MANTIENE', 'DISMINUYE'])],
  ['notes', { type: 'LONG_TEXT' }],
  ['assessor_user_email', { type: 'EMAIL' }],
  ['social_risk', relacion('social_risk')]
])
export const DEF_MEDIDA = definicion('mitigation_measure', [
  ['description', { type: 'LONG_TEXT', required: true }],
  ['owner_user_id', { type: 'UUID' }],
  ['owner_user_email', { type: 'EMAIL' }],
  ['planned_date', { type: 'DATE' }],
  ['completed_date', { type: 'DATE' }],
  ['completed', { type: 'BOOLEAN' }],
  ['social_risk', relacion('social_risk')]
])
export const DEF_IMPACTO = definicion('potential_impact', [
  'activity_type',
  ['description', { type: 'LONG_TEXT', required: true }],
  ['impact_type', enumeracion(['AMBIENTAL', 'SOCIAL'])],
  ['impact_nature', enumeracion(['REAL', 'PERCIBIDO'])],
  ['impact_sign', enumeracion(['POSITIVO', 'NEGATIVO'])],
  ['project', relacion('project')],
  ['social_risk', relacion('social_risk')]
])
export const DEF_INCIDENTE = definicion('incident', [
  ['code', { required: true }],
  ['incident_type', enumeracion(['EXPULSION', 'BLOQUEO DE VIA', 'PROTESTA', 'AMENAZA', 'OTRO'])],
  ['occurred_at', { type: 'DATETIME', required: true }],
  'place',
  ['description', { type: 'LONG_TEXT', required: true }],
  ['immediate_response', { type: 'LONG_TEXT' }],
  ['consequences', { type: 'LONG_TEXT' }],
  ['project', relacion('project')],
  ['locality', relacion('locality')],
  ['community', relacion('community')]
])
export const DEF_MENCION = definicion('media_mention', [
  'outlet_name',
  ['published_date', { type: 'DATE', required: true }],
  ['url', { type: 'URL' }],
  ['headline', { required: true }],
  ['summary', { type: 'LONG_TEXT' }],
  ['tone', enumeracion(['POSITIVO', 'NEGATIVO', 'NEUTRO'])],
  ['reports_fulfilled_commitment', { type: 'BOOLEAN' }],
  ['project', relacion('project')],
  ['outlet', relacion('organization')],
  ['topic', relacion('topic')],
  ['commitment', relacion('commitment')]
])
export const DEF_SENAL = definicion('early_warning_signal', [
  ['source_type', enumeracion(['MEDIOS LOCALES', 'EQUIPO SOCIAL', 'CONTRATISTA', 'OTRO'])],
  ['received_at', { type: 'DATETIME', required: true }],
  ['description', { type: 'LONG_TEXT', required: true }],
  'reported_via',
  ['project', relacion('project')],
  ['locality', relacion('locality')],
  ['community', relacion('community')],
  ['media_mention', relacion('media_mention')],
  ['incident', relacion('incident')],
  ['early_warning', relacion('early_warning')]
])
export const TIPOS_DE_REGLA = ['CONTEO DE SEÑALES', 'CONTEO DE QCS', 'COMPROMISOS VENCIDOS', 'MENCIONES NEGATIVAS', 'INCIDENTES', 'NIVEL DE RIESGO']
export const DEF_REGLA = definicion('early_warning_rule', [
  ['name', { required: true }],
  ['rule_kind', { ...enumeracion(TIPOS_DE_REGLA), required: true }],
  ['threshold', { type: 'DECIMAL' }],
  ['window_days', { type: 'INTEGER' }],
  ['severity', enumeracion(NIVELES)],
  ['enabled', { type: 'BOOLEAN', required: true }],
  ['description', { type: 'LONG_TEXT' }],
  ['project', relacion('project')]
])
export const DEF_ALERTA = definicion('early_warning', [
  ['title', { required: true }],
  // plan 4.2b: ya no es obligatoria al crear; la pone SGSPE en una alerta manual
  ['detected_at', { type: 'DATETIME' }],
  ['severity', enumeracion(NIVELES)],
  ['trigger_description', { type: 'LONG_TEXT' }],
  ['ai_detected', { type: 'BOOLEAN' }],
  ['owner_user_id', { type: 'UUID' }],
  ['owner_user_email', { type: 'EMAIL' }],
  ['generator_key', { editable: false }],
  ['project', relacion('project')],
  ['early_warning_rule', relacion('early_warning_rule')],
  ['locality', relacion('locality')],
  ['community', relacion('community')],
  ['social_risk', relacion('social_risk')]
])

// lo que toda pantalla de riesgos de un proyecto lee: el proyecto, los workflows, la asignación vigente de quien mira y las
// definiciones de los objetos de BC-08 y BC-09
export const baseDeRiesgos = (usuario: AuthUser = GESTOR_DE_RIESGOS): MockRoute[] => [
  { path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/social_risk/workflow', body: WF_RIESGO },
  { path: '/objects/early_warning/workflow', body: WF_ALERTA },
  { path: '/objects/incident/workflow', body: WF_INCIDENTE },
  {
    path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
    body: pagina([registro('as', { project: 'p1', member_user_id: usuario.id, active: true })])
  },
  { path: '/metadata/objects/social_risk', body: DEF_RIESGO },
  { path: '/metadata/objects/risk_assessment', body: DEF_REVISION },
  { path: '/metadata/objects/mitigation_measure', body: DEF_MEDIDA },
  { path: '/metadata/objects/potential_impact', body: DEF_IMPACTO },
  { path: '/metadata/objects/incident', body: DEF_INCIDENTE },
  { path: '/metadata/objects/media_mention', body: DEF_MENCION },
  { path: '/metadata/objects/early_warning_signal', body: DEF_SENAL },
  { path: '/metadata/objects/early_warning_rule', body: DEF_REGLA },
  { path: '/metadata/objects/early_warning', body: DEF_ALERTA }
]
