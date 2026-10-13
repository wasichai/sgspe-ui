import type { AuthUser } from '@wasichai/core'
import type { MockRoute } from '@wasichai/testing'
import { definicion, pagina, registro, workflow } from './montar'
import { permisos } from './portal'

// los datos de las pruebas de F7 (IA): la gerencia social (SOCIAL_MANAGER), que crea y acepta propuestas, y el análisis
// (ANALYST), que solo pregunta a los datos; un acta CONFIDENCIAL, una queja con su duplicado, las propuestas de cada fila de
// ai-architecture.md §4.2 con sus marcadores, y las respuestas de los endpoints de F7 con la forma de «Dependencias de otros
// planes». aquí sí se nombran roles: son datos de prueba (boundaries.test.ts deja fuera src/test). todo es ficticio
export const GERENCIA_IA: AuthUser = {
  id: 'u-smg',
  email: 'smg@sgspe.test',
  displayName: 'Gerencia social de prueba',
  organizationId: 'o1',
  roles: ['SOCIAL_MANAGER']
}
export const ANALISTA: AuthUser = {
  id: 'u-anl',
  email: 'anl@sgspe.test',
  displayName: 'Análisis de prueba',
  organizationId: 'o1',
  roles: ['ANALYST']
}

// quien lee y escribe todo lo de F7 (security.md §7.8 y §7.9): crea interacciones de IA y sugerencias, decide candidatos y
// sugerencias, descarga lo restringido, lee los nombres de las personas y escribe en cada destino de la lista cerrada. son los
// permisos de COMMUNITY_RELATIONS_OFFICER en model/roles.json; los de SOCIAL_MANAGER no crean person, organization ni
// stakeholder ni cambian inquiry ni media_mention. el portal no mira el rol de la cuenta, solo estos permisos
export const EQUIPO_IA = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  ai_interaction: ['READ', 'CREATE'],
  ai_suggestion: ['READ', 'CREATE', 'UPDATE'],
  commitment_candidate: ['READ', 'CREATE', 'UPDATE'],
  commitment: ['READ', 'CREATE'],
  evidence: ['READ', 'DOWNLOAD_RESTRICTED'],
  engagement: ['READ', 'UPDATE'],
  engagement_question: ['READ', 'UPDATE'],
  person: ['READ', 'CREATE'],
  position: ['READ'],
  organization: ['READ', 'CREATE', 'UPDATE'],
  stakeholder: ['READ', 'CREATE'],
  locality: ['READ'],
  community: ['READ'],
  topic: ['READ'],
  agreement: ['READ', 'UPDATE'],
  agreement_clause: ['READ', 'CREATE'],
  grievance: ['READ', 'UPDATE'],
  inquiry: ['READ', 'UPDATE'],
  stakeholder_request: ['READ', 'UPDATE'],
  media_mention: ['READ', 'UPDATE']
})
// el análisis: crea ai_interaction (pregunta a los datos) y no lee los nombres de las personas ni las propuestas
export const SOLO_ASISTENTE = permisos({ project: ['READ'], project_assignment: ['READ'], ai_interaction: ['READ', 'CREATE'] })
// quien decide propuestas sin descargar lo restringido
export const SIN_DESCARGA = permisos({ ...EQUIPO_IA.objects, evidence: ['READ'] })

// GET /api/sgspe/ai/status (api.md §4.14)
const CASOS_DE_IA = ['AI-01', 'AI-02', 'AI-03', 'AI-04', 'AI-05', 'AI-06', 'AI-07', 'AI-08']
export const ESTADO_ACTIVO = { enabled: true, providerAvailable: true, useCases: CASOS_DE_IA }
export const ESTADO_SIN_ORGANIZACION = { enabled: false, providerAvailable: true, useCases: [] }
export const ESTADO_SIN_PROVEEDOR = { enabled: true, providerAvailable: false, useCases: CASOS_DE_IA }
export const ESTADO_SOLO_DATOS = { enabled: true, providerAvailable: true, useCases: ['AI-05'] }

export const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' }, { state: 'active' })
// una persona registrada con sus nombres, y otra cuyos nombres la cuenta no lee pero tiene un cargo vigente
export const PERSONA = registro('pe1', { given_names: 'Ana', surnames: 'Ejemplo' })
export const PERSONA_SIN_NOMBRE = registro('pe2', { residence_locality: 'l1' })
export const CARGO = registro('po1', { person: 'pe2', organization: 'o1', position_title: 'Presidencia comunal', position_status: 'VIGENTE' })
// el acta de la asamblea, CONFIDENCIAL: la cita solo para quien la descarga
export const EVIDENCIA_ACTA = registro('ev1', {
  project: 'p1',
  title: 'Acta de la asamblea de agosto',
  evidence_type: 'ACTA',
  classification: 'CONFIDENCIAL',
  file: { id: 'f1', name: 'acta.pdf', contentType: 'application/pdf', size: 2048 }
})
// las interacciones de IA: la fuente de cada propuesta sale de su input_reference (ai-architecture.md §9.2)
export const INTERACCION_IA = registro('ai1', {
  project: 'p1',
  use_case: 'AI-03',
  model: 'claude-ejemplo',
  prompt_version: 'ai-03@1',
  input_reference: 'evidence:ev1 sha256:0f3a'
})
export const INTERACCION_DE_QUEJA = registro('ai2', {
  project: 'p1',
  use_case: 'AI-08',
  model: 'claude-haiku-4-5',
  prompt_version: 'ai-08@1',
  input_reference: 'grievance:g1'
})
export const QUEJA = registro('g1', { project: 'p1', code: 'Q-001', description: 'Falta agua en el anexo', category: 'OTRO' }, { state: 'received' })
export const QUEJA_2 = registro('g2', { project: 'p1', code: 'Q-002', description: 'Falta agua en el anexo', category: 'OTRO' }, { state: 'received' })
export const INTERACCION = registro(
  'e1',
  { project: 'p1', title: 'Asamblea de agosto', engagement_type: 'ASAMBLEA', minutes: '## Desarrollo\nSe habló del agua.' },
  { state: 'minutes_drafted' }
)

// un candidato de AI-03 sobre el acta, con una persona registrada en el texto y en la cita
export const CANDIDATO_IA = registro(
  'k1',
  {
    project: 'p1',
    proposed_text: 'Construir un reservorio pedido por [PERSONA:pe1]',
    evidence_quote: '[PERSONA:pe1] pidió un reservorio para el anexo',
    ai_generated: true,
    confidence: 0.91,
    source_evidence: 'ev1',
    ai_interaction: 'ai1'
  },
  { state: 'proposed', createdAt: '2026-10-08T15:00:00Z', updatedAt: '2026-10-08T15:00:00Z' }
)

// las propuestas de cada fila de la lista cerrada (ai-architecture.md §4.2); suggested_value es texto JSON o Markdown
const sugerencia = (id: string, attributes: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  registro(id, { project: 'p1', model: 'claude-ejemplo', ...attributes }, { state: 'proposed', ...extra })
export const SUG_CLASIFICACION = sugerencia(
  's1',
  {
    suggestion_kind: 'CLASIFICACION',
    target_object: 'grievance',
    target_record_id: 'g1',
    suggested_value: '{"field":"category","value":"AGUA Y MEDIO AMBIENTE"}',
    evidence_quote: 'Falta agua en el anexo',
    confidence: 0.74,
    model: 'claude-haiku-4-5',
    ai_interaction: 'ai2'
  },
  { createdAt: '2026-10-09T15:00:00Z', updatedAt: '2026-10-09T15:00:00Z' }
)
export const SUG_ACTOR = sugerencia(
  's2',
  {
    suggestion_kind: 'EXTRACCION',
    target_object: 'person',
    target_record_id: null,
    suggested_value: '{"item":"actor","kind":"person","name":"[PERSONA]","residence_locality":"l1"}',
    evidence_quote: '[PERSONA], con teléfono [TELEFONO], pidió el reservorio',
    confidence: 0.55,
    ai_interaction: 'ai1'
  },
  { createdAt: '2026-10-07T15:00:00Z', updatedAt: '2026-10-07T15:00:00Z' }
)
export const SUG_DUPLICADO = sugerencia(
  's3',
  {
    suggestion_kind: 'DUPLICADO',
    target_object: 'grievance',
    target_record_id: 'g1',
    suggested_value: '{"other_record_id":"g2","reasons":["Mismo anexo y misma fecha"]}',
    confidence: 0.8,
    model: 'claude-haiku-4-5',
    ai_interaction: 'ai2'
  },
  { updatedAt: '2026-10-09T16:00:00Z' }
)
export const SUG_BORRADOR = sugerencia(
  's4',
  {
    suggestion_kind: 'BORRADOR DE ACTA',
    target_object: 'engagement',
    target_record_id: 'e1',
    suggested_value: '## Acuerdos\n- [PERSONA:pe1] pidió el reservorio',
    confidence: 0.7,
    ai_interaction: 'ai1'
  },
  { createdAt: '2026-10-09T17:00:00Z', updatedAt: '2026-10-09T17:00:00Z' }
)
export const SUG_RESUMEN = sugerencia(
  's5',
  {
    suggestion_kind: 'RESUMEN EJECUTIVO',
    target_object: 'project',
    target_record_id: 'p1',
    suggested_value: '## Resumen\nEl proyecto tuvo cuatro interacciones en el periodo.',
    ai_interaction: 'ai1'
  },
  { createdAt: '2026-10-10T15:00:00Z' }
)
// una propuesta cuyo valor no es JSON: solo se puede rechazar
export const SUG_ILEGIBLE = sugerencia('s6', {
  suggestion_kind: 'EXTRACCION',
  target_object: 'engagement',
  target_record_id: 'e1',
  suggested_value: 'no es json',
  confidence: 0.3,
  ai_interaction: 'ai1'
})

export const WF_SUGERENCIA = workflow('ai_suggestion', [
  ['proposed', 'Propuesta'],
  ['accepted', 'Aceptada'],
  ['rejected', 'Rechazada'],
  ['duplicate', 'Duplicada']
])
export const TRANSICIONES_DE_SUGERENCIA = [
  { name: 'accept', label: 'Aceptar', to: 'accepted', toLabel: 'Aceptada', allowed: true, reason: null },
  { name: 'reject', label: 'Rechazar', to: 'rejected', toLabel: 'Rechazada', allowed: true, reason: null },
  { name: 'mark_duplicate', label: 'Marcar como duplicada', to: 'duplicate', toLabel: 'Duplicada', allowed: true, reason: null }
]
export const DEF_QUEJA_IA = definicion('grievance', [
  'code',
  'description',
  ['category', { label: 'Categoría', type: 'ENUM', enumOptions: ['AGUA Y MEDIO AMBIENTE', 'EMPLEO', 'OTRO'] }],
  ['priority', { label: 'Prioridad', type: 'ENUM', enumOptions: ['ALTA', 'MEDIA', 'BAJA'] }],
  ['topic', { label: 'Tema', type: 'RELATION', relationTarget: 'topic' }]
])
export const DEF_PERSONA = definicion('person', [
  ['given_names', { label: 'Nombres' }],
  ['surnames', { label: 'Apellidos' }],
  ['sex', { label: 'Sexo', type: 'ENUM', enumOptions: ['FEMENINO', 'MASCULINO'] }],
  ['residence_locality', { label: 'Localidad de residencia', type: 'RELATION', relationTarget: 'locality' }]
])
export const DEF_INTERACCION = definicion('engagement', ['title', 'minutes'])

// POST /api/sgspe/ai/assistant/questions: la respuesta restaurada, con sus pasos (api.md §4.14; AgentStep de wasichai-agent)
export const RESPUESTA_DATOS = {
  answer: '## Vencidos\nHay 2 compromisos vencidos en la Comunidad Ejemplo.',
  steps: [
    { tool: 'query_records', input: { object: 'commitment', filters: { deadline_status: 'VENCIDO' } }, summary: '2 registros de [PERSONA_1]' },
    { tool: 'get_record', input: { object: 'commitment', id: 'c1' }, summary: 'C-001' }
  ],
  truncated: false,
  interaction: 'ai9'
}
// POST /api/sgspe/ai/knowledge/questions: la respuesta con citas seudonimizadas
export const RESPUESTA_DOCUMENTOS = {
  answer: 'El acta registra que [PERSONA:pe1] pidió un reservorio.',
  citations: [{ evidenceId: 'ev1', chunkIndex: 2, quote: '[PERSONA:pe1] pidió un reservorio para el anexo' }],
  interaction: 'ai10'
}
export const SIN_EVIDENCIA = { answer: 'No hay evidencia.', citations: [], interaction: null }
// POST /api/sgspe/ai/runs de AI-03 sobre el acta
export const CORRIDA_AI03 = { interaction: INTERACCION_IA, suggestions: [], candidates: [CANDIDATO_IA] }

// lo que toda pantalla de F7 pregunta: el estado de la IA, el proyecto y su asignación vigente, el workflow de WF-K, las
// personas, el acta, las interacciones de IA, las quejas y sus definiciones
export const baseDeIa = (estado: unknown = ESTADO_ACTIVO): MockRoute[] => [
  { path: '/sgspe/ai/status', body: estado },
  { path: '/objects/project/records', body: pagina([P1]) },
  { path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/project_assignment/records', body: pagina([registro('as1', { project: 'p1', member_user_id: 'u-smg', active: true })]) },
  { path: '/objects/ai_suggestion/workflow', body: WF_SUGERENCIA },
  { path: '/objects/commitment_candidate/workflow', body: workflow('commitment_candidate', [['proposed', 'Propuesto']]) },
  { path: '/objects/person/records/pe1', body: PERSONA },
  { path: '/objects/person/records/pe2', body: PERSONA_SIN_NOMBRE },
  { path: '/objects/position/records', body: pagina([CARGO]) },
  { path: '/objects/evidence/records/ev1', body: EVIDENCIA_ACTA },
  { path: '/objects/ai_interaction/records/ai1', body: INTERACCION_IA },
  { path: '/objects/ai_interaction/records/ai2', body: INTERACCION_DE_QUEJA },
  { path: '/objects/grievance/records/g1', body: QUEJA },
  { path: '/objects/grievance/records/g2', body: QUEJA_2 },
  { path: '/objects/engagement/records/e1', body: INTERACCION },
  { path: '/metadata/objects/grievance', body: DEF_QUEJA_IA },
  { path: '/metadata/objects/person', body: DEF_PERSONA },
  { path: '/metadata/objects/engagement', body: DEF_INTERACCION },
  { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } },
  { path: '/sgspe/dashboards/indicators', body: [] },
  { path: '/auth/me/notifications/summary', status: 404, body: { title: 'Not Found', status: 404 } }
]
