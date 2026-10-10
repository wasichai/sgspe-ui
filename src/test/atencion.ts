import type { AuthUser } from '@wasichai/core'
import type { MockRoute } from '@wasichai/testing'
import { P1 } from './compromisos'
import { definicion, pagina, registro, workflow } from './montar'
import { permisos } from './portal'

// los datos de las pruebas de F4 de quejas, consultas y solicitudes: la gestión de quejas (GRIEVANCE_MANAGER, con
// READ_CONFIDENTIAL), una queja grave en atención, una consulta recibida, una solicitud en evaluación, los workflows WF-E1 a
// WF-E3 y las definiciones del plan 4.1. aquí sí se nombran roles: son datos de prueba (boundaries.test.ts deja fuera src/test)
export const GESTORA_DE_QUEJAS: AuthUser = {
  id: 'u-gvm',
  email: 'gvm@sgspe.test',
  displayName: 'Gestión de quejas de prueba',
  organizationId: 'o1',
  roles: ['GRIEVANCE_MANAGER']
}

const qcs = ['READ', 'CREATE', 'UPDATE', 'EXPORT']

// security.md §7.6: GRIEVANCE_MANAGER crea y gestiona las tres QCS, lee las confidenciales y exporta
export const EQUIPO_DE_QUEJAS = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  grievance: [...qcs, 'READ_CONFIDENTIAL'],
  inquiry: [...qcs, 'READ_CONFIDENTIAL'],
  stakeholder_request: [...qcs, 'READ_CONFIDENTIAL'],
  stakeholder: ['READ'],
  person: ['READ'],
  locality: ['READ'],
  community: ['READ'],
  topic: ['READ'],
  engagement: ['READ'],
  engagement_question: ['READ', 'UPDATE'],
  commitment: ['READ'],
  social_risk: ['READ'],
  incident: ['READ'],
  evidence: ['READ', 'CREATE', 'UPDATE', 'DOWNLOAD_RESTRICTED'],
  task: ['READ', 'UPDATE']
})

// COMMUNITY_RELATIONS_OFFICER: registra las tres QCS y las atiende en su parte, sin leer las confidenciales ajenas
export const EQUIPO_DE_RELACIONES = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  grievance: ['READ', 'CREATE', 'UPDATE'],
  inquiry: ['READ', 'CREATE', 'UPDATE'],
  stakeholder_request: ['READ', 'CREATE', 'UPDATE'],
  stakeholder: ['READ'],
  person: ['READ'],
  engagement: ['READ', 'CREATE', 'UPDATE'],
  engagement_question: ['READ', 'CREATE', 'UPDATE'],
  evidence: ['READ', 'CREATE', 'UPDATE'],
  task: ['READ', 'UPDATE']
})

export const QUEJA = registro(
  'g1',
  {
    project: 'p1',
    code: 'Q-001',
    channel: 'PRESENCIAL',
    received_at: '2026-10-01T14:00:00Z',
    received_by_user_id: 'u-relacionista',
    received_by_user_email: 'relacionista@sgspe.test',
    anonymous: false,
    confidential: false,
    category: 'AGUA Y MEDIO AMBIENTE',
    description: 'El canal de riego quedó turbio tras la perforación',
    priority: 'ALTA',
    severity: 'ALTA',
    owner_user_id: 'u-gvm',
    owner_user_email: 'gvm@sgspe.test',
    ack_due_date: '2026-10-08',
    resolution_due_date: '2026-10-31',
    deadline_status: 'AL DIA',
    stakeholder: 's1'
  },
  { state: 'in_action' }
)

export const CONSULTA = registro(
  'i1',
  {
    project: 'p1',
    code: 'C-001',
    channel: 'REUNION',
    received_at: '2026-10-02T15:00:00Z',
    received_by_user_id: 'u-gvm',
    received_by_user_email: 'gvm@sgspe.test',
    anonymous: false,
    confidential: false,
    category: 'INFORMACION DEL PROYECTO',
    description: '¿Cuándo empieza la perforación en el sector norte?',
    response_due_date: '2026-10-17',
    deadline_status: 'AL DIA'
  },
  { state: 'received' }
)

export const SOLICITUD = registro(
  'r1',
  {
    project: 'p1',
    code: 'S-001',
    channel: 'CARTA',
    received_at: '2026-10-03T15:00:00Z',
    received_by_user_id: 'u-gvm',
    received_by_user_email: 'gvm@sgspe.test',
    anonymous: false,
    confidential: false,
    category: 'APOYO SOCIAL',
    description: 'La comunidad pide apoyo para el techo del local comunal',
    request_medium: 'CARTA DE SOLICITUD',
    requested_resource: 'Calaminas para el local comunal'
  },
  { state: 'under_evaluation' }
)

export const WF_QUEJA = workflow('grievance', [
  ['received', 'Recibida'],
  ['acknowledged', 'Acusada'],
  ['in_assessment', 'En evaluación'],
  ['in_investigation', 'En investigación'],
  ['in_action', 'En atención'],
  ['resolved', 'Resuelta'],
  ['verified', 'Verificada'],
  ['closed', 'Cerrada'],
  ['rejected', 'Rechazada'],
  ['withdrawn', 'Desistida']
])
export const WF_CONSULTA = workflow('inquiry', [
  ['received', 'Recibida'],
  ['answered', 'Respondida'],
  ['referred', 'Derivada'],
  ['closed', 'Cerrada']
])
export const WF_SOLICITUD = workflow('stakeholder_request', [
  ['received', 'Recibida'],
  ['under_evaluation', 'En evaluación'],
  ['accepted', 'Aceptada'],
  ['declined', 'Declinada'],
  ['closed', 'Cerrada']
])

const enumeracion = (opciones: string[]) => ({ type: 'ENUM', enumOptions: opciones })
const relacion = (destino: string) => ({ type: 'RELATION', relationTarget: destino })

export const CANALES = ['PRESENCIAL', 'CARTA', 'REUNION', 'TELEFONO', 'CORREO', 'CONTRATISTA', 'OTRO']
export const CATEGORIAS = ['AGUA Y MEDIO AMBIENTE', 'EMPLEO', 'TIERRAS', 'APOYO SOCIAL', 'INFORMACION DEL PROYECTO', 'OTRO']

// los campos comunes de las tres QCS (database-model.md §12), con person para quien la lee
const COMUNES: (string | [string, Record<string, unknown>])[] = [
  ['code', { required: true }],
  ['channel', enumeracion(CANALES)],
  ['received_at', { type: 'DATETIME', required: true }],
  ['received_by_user_id', { type: 'UUID' }],
  ['received_by_user_email', { type: 'EMAIL' }],
  ['anonymous', { type: 'BOOLEAN' }],
  ['confidential', { type: 'BOOLEAN' }],
  ['category', enumeracion(CATEGORIAS)],
  ['description', { type: 'LONG_TEXT', required: true }],
  ['priority', enumeracion(['BAJA', 'MEDIA', 'ALTA', 'MUY ALTA'])],
  ['response_due_date', { type: 'DATE' }],
  ['deadline_status', enumeracion(['AL DIA', 'POR VENCER', 'VENCIDO'])],
  ['owner_user_id', { type: 'UUID' }],
  ['owner_user_email', { type: 'EMAIL' }],
  ['response', { type: 'LONG_TEXT' }],
  ['responded_at', { type: 'DATETIME' }],
  ['closed_date', { type: 'DATE' }],
  ['project', relacion('project')],
  ['stakeholder', relacion('stakeholder')],
  ['person', relacion('person')],
  ['locality', relacion('locality')],
  ['community', relacion('community')],
  ['topic', relacion('topic')],
  ['origin_engagement', relacion('engagement')],
  ['origin_question', relacion('engagement_question')]
]

export const DEF_QUEJA = definicion('grievance', [
  ...COMUNES,
  ['severity', enumeracion(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'])],
  ['ack_due_date', { type: 'DATE' }],
  ['resolution_due_date', { type: 'DATE' }],
  ['resolved_date', { type: 'DATE' }],
  ['resolution', { type: 'LONG_TEXT' }],
  ['complainant_conformity_given', { type: 'BOOLEAN' }],
  ['social_risk', relacion('social_risk')],
  ['incident', relacion('incident')],
  ['duplicate_of', relacion('grievance')],
  ['reclassified_from_inquiry', relacion('inquiry')],
  ['reclassified_from_request', relacion('stakeholder_request')]
])
export const DEF_CONSULTA = definicion('inquiry', [
  ...COMUNES,
  ['reclassified_from_grievance', relacion('grievance')],
  ['reclassified_from_request', relacion('stakeholder_request')]
])
export const DEF_SOLICITUD = definicion('stakeholder_request', [
  ...COMUNES,
  ['request_medium', enumeracion(['CARTA DE SOLICITUD', 'ACUERDO EN REUNION'])],
  ['requested_resource', { type: 'LONG_TEXT' }],
  ['created_commitment', relacion('commitment')],
  ['reclassified_from_grievance', relacion('grievance')],
  ['reclassified_from_inquiry', relacion('inquiry')]
])

// la definición para quien no lee person (security.md §7.9): el campo no llega
export const sinPersona = <T extends { fields: { name: string }[] }>(def: T): T => ({ ...def, fields: def.fields.filter((f) => f.name !== 'person') })

export const DEFINICIONES_DE_QCS = { grievance: DEF_QUEJA, inquiry: DEF_CONSULTA, stakeholder_request: DEF_SOLICITUD }

// lo que toda pantalla de QCS de un proyecto lee: el proyecto, los workflows, la asignación vigente de quien mira y las
// definiciones de las tres QCS
export const baseDeAtencion = (usuario: AuthUser = GESTORA_DE_QUEJAS): MockRoute[] => [
  { path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/grievance/workflow', body: WF_QUEJA },
  { path: '/objects/inquiry/workflow', body: WF_CONSULTA },
  { path: '/objects/stakeholder_request/workflow', body: WF_SOLICITUD },
  {
    path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
    body: pagina([registro('as', { project: 'p1', member_user_id: usuario.id, active: true })])
  },
  { path: '/metadata/objects/grievance', body: DEF_QUEJA },
  { path: '/metadata/objects/inquiry', body: DEF_CONSULTA },
  { path: '/metadata/objects/stakeholder_request', body: DEF_SOLICITUD }
]
