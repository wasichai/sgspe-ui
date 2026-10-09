import type { AuthUser } from '@wasichai/core'
import type { MockRoute } from '@wasichai/testing'
import { definicion, pagina, registro, workflow } from './montar'
import { permisos } from './portal'

// los datos de las pruebas de F3 (compromisos, acuerdos, tareas y aprobaciones): el proyecto p1, un compromiso en ejecución,
// las cuentas de gestión de compromisos y de aprobación y los permisos de security.md §7.5. aquí sí se nombran roles: son
// datos de prueba (boundaries.test.ts deja fuera src/test)
export const GESTORA: AuthUser = {
  id: 'u-cmm',
  email: 'cmm@sgspe.test',
  displayName: 'Gestión de compromisos de prueba',
  organizationId: 'o1',
  roles: ['COMMITMENT_MANAGER']
}
export const APROBADORA: AuthUser = {
  id: 'u-apr',
  email: 'apr@sgspe.test',
  displayName: 'Aprobación de prueba',
  organizationId: 'o1',
  roles: ['APPROVER']
}

export const P1 = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }, { state: 'active' })

export const C1 = registro(
  'c1',
  {
    project: 'p1',
    code: 'C-001',
    title: 'Reservorio de agua para Tunas Pampa',
    description: 'Construir un reservorio de 200 m³',
    objective: 'Riego en estiaje',
    resource_type: 'MATERIAL',
    quantity: 1,
    unit: 'reservorio',
    request_medium: 'ACUERDO EN REUNION',
    agreed_date: '2026-08-20',
    due_date: '2026-11-30',
    amount: 25000,
    currency: 'PEN',
    executed_amount: 10000,
    priority: 'ALTA',
    owner_user_id: 'u-cmm',
    owner_user_email: 'cmm@sgspe.test',
    deadline_status: 'AL DIA',
    beneficiaries_count: 120,
    commitment_theme: 'SOCIAL',
    formality: 'FORMAL',
    exploration_campaign: 'camp1',
    origin_engagement: 'e1'
  },
  { state: 'in_progress', updatedAt: '2026-10-05T15:00:00.123456Z' }
)

export const WF_COMPROMISO = workflow('commitment', [
  ['draft', 'Borrador'],
  ['pending_approval', 'Pendiente de aprobación'],
  ['approved', 'Aprobado'],
  ['in_progress', 'En ejecución'],
  ['blocked', 'Bloqueado'],
  ['fulfilled', 'Cumplido'],
  ['verified', 'Verificado'],
  ['closed', 'Cerrado'],
  ['cancelled', 'Cancelado']
])

const enumeracion = (opciones: string[]) => ({ type: 'ENUM', enumOptions: opciones })

// la definición de commitment para una cuenta que lee todo (beneficiaries_detail incluido)
export const DEF_COMPROMISO = definicion('commitment', [
  'code',
  'title',
  ['description', { type: 'LONG_TEXT' }],
  ['objective', { type: 'LONG_TEXT' }],
  ['resource_type', enumeracion(['MATERIAL', 'NO MATERIAL'])],
  ['quantity', { type: 'DECIMAL' }],
  'unit',
  'execution_time',
  ['commitment_theme', enumeracion(['AMBIENTAL', 'SOCIAL'])],
  ['formality', enumeracion(['FORMAL', 'VERBAL'])],
  ['request_medium', enumeracion(['CARTA DE SOLICITUD', 'ACUERDO EN REUNION'])],
  ['agreed_date', { type: 'DATE' }],
  ['due_date', { type: 'DATE' }],
  ['amount', { type: 'DECIMAL', required: true }],
  ['currency', enumeracion(['PEN', 'USD'])],
  ['executed_amount', { type: 'DECIMAL' }],
  ['priority', enumeracion(['BAJA', 'MEDIA', 'ALTA', 'MUY ALTA'])],
  ['owner_user_id', { type: 'UUID' }],
  ['owner_user_email', { type: 'EMAIL' }],
  ['verifier_user_id', { type: 'UUID' }],
  ['verifier_user_email', { type: 'EMAIL' }],
  ['delay_risk_reported', { type: 'BOOLEAN' }],
  ['delay_risk_note', { type: 'LONG_TEXT' }],
  ['deadline_status', enumeracion(['AL DIA', 'POR VENCER', 'VENCIDO'])],
  ['beneficiaries_count', { type: 'INTEGER' }],
  ['beneficiaries_female_count', { type: 'INTEGER' }],
  ['beneficiaries_male_count', { type: 'INTEGER' }],
  ['beneficiaries_detail', { type: 'LONG_TEXT' }],
  ['origin_justification', { type: 'LONG_TEXT' }],
  ['requires_senior_approval', { type: 'BOOLEAN' }],
  ['fulfilled_date', { type: 'DATE' }],
  ['closed_date', { type: 'DATE' }],
  ['cancelled_date', { type: 'DATE' }],
  ['project', { type: 'RELATION', relationTarget: 'project' }],
  ['exploration_campaign', { type: 'RELATION', relationTarget: 'exploration_campaign' }],
  ['locality', { type: 'RELATION', relationTarget: 'locality' }],
  ['community', { type: 'RELATION', relationTarget: 'community' }],
  ['topic', { type: 'RELATION', relationTarget: 'topic' }],
  ['origin_engagement', { type: 'RELATION', relationTarget: 'engagement' }],
  ['agreement', { type: 'RELATION', relationTarget: 'agreement' }],
  ['agreement_clause', { type: 'RELATION', relationTarget: 'agreement_clause' }]
])

// security.md §7.5: COMMITMENT_MANAGER (CRU, VERIFY, EXPORT; hijos; entregas; candidatos; evidencias con DOWNLOAD_RESTRICTED)
export const EQUIPO_DE_COMPROMISOS = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  exploration_campaign: ['READ'],
  stakeholder: ['READ'],
  engagement: ['READ'],
  locality: ['READ'],
  community: ['READ'],
  topic: ['READ'],
  commitment: ['READ', 'CREATE', 'UPDATE', 'VERIFY', 'EXPORT'],
  commitment_action: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  commitment_milestone: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  commitment_reschedule: ['READ', 'CREATE'],
  commitment_dependency: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  delivery: ['READ', 'CREATE', 'UPDATE'],
  commitment_candidate: ['READ', 'CREATE', 'UPDATE'],
  agreement: ['READ'],
  agreement_party: ['READ'],
  agreement_clause: ['READ'],
  evidence: ['READ', 'CREATE', 'UPDATE', 'EDIT_ANY', 'DOWNLOAD_RESTRICTED'],
  task: ['READ', 'CREATE', 'UPDATE']
})

// lo que toda pantalla de un proyecto de F3 lee: el proyecto, los workflows, la asignación vigente de quien mira y las
// definiciones de commitment
export const baseDeCompromisos = (usuario: AuthUser = GESTORA): MockRoute[] => [
  { path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/commitment/workflow', body: WF_COMPROMISO },
  {
    path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
    body: pagina([registro('as', { project: 'p1', member_user_id: usuario.id, active: true })])
  },
  { path: '/metadata/objects/commitment', body: DEF_COMPROMISO }
]
