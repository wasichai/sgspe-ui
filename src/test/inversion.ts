import type { AuthUser } from '@wasichai/core'
import type { MockRoute } from '@wasichai/testing'
import { P1 } from './compromisos'
import { definicion, pagina, registro, workflow } from './montar'
import { permisos } from './portal'

// los datos de las pruebas de F5 (programas e inversión social): la gestión de inversión social (SOCIAL_INVESTMENT_MANAGER) y la
// aprobación (APPROVER), un aporte en requested con dos ítems, una campaña con tope, un programa en ejecución con sus hijos, los
// workflows WF-G y WF-P y las definiciones del plan 5.1. aquí sí se nombran roles: son datos de prueba (boundaries.test.ts deja
// fuera src/test). todo es ficticio
export const INVERSION: AuthUser = {
  id: 'u-sim',
  email: 'sim@sgspe.test',
  displayName: 'Inversión social de prueba',
  organizationId: 'o1',
  roles: ['SOCIAL_INVESTMENT_MANAGER']
}
export const APROBACION_DE_APORTES: AuthUser = {
  id: 'u-apr',
  email: 'apr@sgspe.test',
  displayName: 'Aprobación de prueba',
  organizationId: 'o1',
  roles: ['APPROVER']
}

// security.md §7.7 con la elección 15 de la spec F5: SIM es dueño de los datos del programa y registra aportes y entregas
export const EQUIPO_DE_INVERSION = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  exploration_campaign: ['READ'],
  organization: ['READ'],
  stakeholder: ['READ'],
  locality: ['READ'],
  community: ['READ'],
  festivity: ['READ'],
  topic: ['READ'],
  agreement: ['READ'],
  agreement_party: ['READ'],
  commitment: ['READ'],
  stakeholder_request: ['READ', 'UPDATE'],
  social_contribution: ['READ', 'CREATE', 'UPDATE'],
  contribution_item: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  receipt: ['READ', 'CREATE', 'UPDATE'],
  delivery: ['READ', 'CREATE', 'UPDATE'],
  social_program: ['READ', 'CREATE', 'UPDATE'],
  social_initiative: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  beneficiary_group: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  program_budget: ['READ', 'CREATE', 'UPDATE'],
  program_indicator: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  program_measurement: ['READ', 'CREATE'],
  program_milestone: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  evidence: ['READ', 'CREATE', 'UPDATE', 'EDIT_ANY', 'DOWNLOAD_RESTRICTED'],
  task: ['READ', 'CREATE', 'UPDATE']
})

// APPROVER: lee BC-10 y aprueba aportes y programas (Ru con APPROVE); no escribe sus datos
export const PERMISOS_DE_APROBACION = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  exploration_campaign: ['READ'],
  organization: ['READ'],
  topic: ['READ'],
  agreement: ['READ'],
  social_contribution: ['READ', 'UPDATE', 'APPROVE'],
  contribution_item: ['READ'],
  receipt: ['READ'],
  delivery: ['READ'],
  social_program: ['READ', 'UPDATE', 'APPROVE'],
  social_initiative: ['READ'],
  beneficiary_group: ['READ'],
  program_budget: ['READ'],
  program_indicator: ['READ'],
  program_measurement: ['READ'],
  program_milestone: ['READ'],
  evidence: ['READ']
})

export const ASOCIACION = registro('o2', { name: 'Asociación Ejemplo' })
export const EMPRESA = registro('o3', { name: 'Empresa Ejemplo S.A.' })
export const ACUERDO = registro(
  'ag1',
  { project: 'p1', code: 'AC-001', title: 'Convenio de sinergia de ejemplo', validity_status: 'VIGENTE' },
  { state: 'active' }
)
export const CAMPANA = registro('camp1', {
  project: 'p1',
  name: 'Campaña Ejemplo 2026',
  social_support_cap: '50000',
  currency: 'PEN',
  executed_social_amount: '12000',
  other_currency_items_count: 0
})

export const APORTE = registro(
  'a1',
  {
    project: 'p1',
    code: 'AP-001',
    contribution_type: 'APOYO EN ESPECIE',
    occasion: 'Aniversario de la institución educativa',
    declared_purpose: 'Equipar la biblioteca escolar',
    conditions: 'Entrega en la plaza con acta firmada por la directiva',
    currency: 'PEN',
    total_amount: '1750.5000',
    beneficiaries_count: 120,
    has_institutional_synergy: false,
    payer_organization: 'o3',
    recipient_organization: 'o2',
    exploration_campaign: 'camp1',
    // el GET trae toda clave que la cuenta lee, también las vacías (atributosDeEscritura no manda una clave que no vino)
    guideline_deviation_justification: null
  },
  { state: 'requested', updatedAt: '2026-10-05T15:00:00.123456Z' }
)
export const ITEM_BIEN = registro('it1', {
  social_contribution: 'a1',
  description: 'Estantes de madera',
  item_kind: 'BIEN',
  quantity: 5,
  unit: 'unidad',
  unit_cost: '300',
  line_amount: '1500'
})
export const ITEM_SERVICIO = registro('it2', {
  social_contribution: 'a1',
  description: 'Transporte a la institución',
  item_kind: 'SERVICIO',
  quantity: 1,
  unit: 'viaje',
  unit_cost: '250.50',
  line_amount: '250.50'
})

export const PROGRAMA = registro(
  'sp1',
  {
    project: 'p1',
    code: 'PS-001',
    name: 'Programa Ejemplo de agua segura',
    description: 'Sistemas de agua segura en las localidades del área de influencia',
    start_date: '2026-01-01',
    end_date: '2027-12-31',
    currency: 'PEN',
    total_budget: '80000.0000',
    partner_organization: 'o2',
    agreement: 'ag1'
  },
  { state: 'executing', updatedAt: '2026-10-05T15:00:00Z' }
)
export const PRESUPUESTO_2026 = registro('b1', {
  social_program: 'sp1',
  budget_year: 2026,
  allocated_amount: '80000',
  executed_amount: '20000',
  currency: 'PEN'
})
export const PRESUPUESTO_USD = registro('b2', { social_program: 'sp1', budget_year: 2027, allocated_amount: '10000', currency: 'USD' })
export const INDICADOR = registro('pi1', {
  social_program: 'sp1',
  name: 'Familias con agua segura',
  unit: 'familias',
  baseline_value: 40,
  target_value: 200,
  frequency: 'Semestral'
})
export const MEDICION = registro('pm1', {
  program_indicator: 'pi1',
  period_start_date: '2026-01-01',
  period_end_date: '2026-06-30',
  measured_value: 85,
  notes: 'Medición del primer semestre'
})
export const INICIATIVA = registro('si1', { social_program: 'sp1', name: 'Reservorio de Localidad Ejemplo', start_date: '2026-03-01' })
export const GRUPO_BENEFICIARIO = registro('bg1', {
  social_program: 'sp1',
  social_initiative: 'si1',
  name: 'Familias de Localidad Ejemplo',
  target_count: 120,
  reached_count: 45
})
export const HITO = registro('ms1', { social_program: 'sp1', name: 'Reservorio terminado', planned_date: '2026-09-30' })

export const WF_APORTE = workflow('social_contribution', [
  ['requested', 'Solicitado'],
  ['approved', 'Aprobado'],
  ['procured', 'Adquirido'],
  ['delivered', 'Entregado'],
  ['closed', 'Cerrado'],
  ['rejected', 'Rechazado'],
  ['cancelled', 'Anulado']
])
export const WF_PROGRAMA = workflow('social_program', [
  ['draft', 'Borrador'],
  ['pending_approval', 'Pendiente de aprobación'],
  ['planned', 'Planificado'],
  ['executing', 'En ejecución'],
  ['monitoring', 'En monitoreo'],
  ['evaluation', 'En evaluación'],
  ['suspended', 'Suspendido'],
  ['closed', 'Cerrado'],
  ['cancelled', 'Cancelado']
])

const enumeracion = (opciones: string[]) => ({ type: 'ENUM', enumOptions: opciones })
// el formulario de wasichai exige un UUID en un campo RELATION y los ids de prueba no lo son (decisión 29 del plan 4.3): las
// relaciones se declaran como texto, con su destino en relationTarget. las pantallas nombran el objeto de cada vínculo en su código
// (RegistroVinculado), no lo leen de la metadata
const relacion = (destino: string) => ({ relationTarget: destino })
const MONEDAS = enumeracion(['PEN', 'USD'])

export const DEF_APORTE = definicion('social_contribution', [
  ['code', { required: true }],
  ['contribution_type', enumeracion(['DONACION', 'APOYO EN ESPECIE'])],
  'occasion',
  ['declared_purpose', { type: 'LONG_TEXT', required: true }],
  ['conditions', { type: 'LONG_TEXT', required: true }],
  ['total_amount', { type: 'DECIMAL' }],
  ['currency', { ...MONEDAS, required: true }],
  ['beneficiaries_count', { type: 'INTEGER' }],
  ['has_institutional_synergy', { type: 'BOOLEAN' }],
  ['guideline_deviation_justification', { type: 'LONG_TEXT' }],
  ['project', relacion('project')],
  ['exploration_campaign', relacion('exploration_campaign')],
  ['payer_organization', { ...relacion('organization'), required: true }],
  ['recipient_organization', relacion('organization')],
  ['stakeholder', relacion('stakeholder')],
  ['locality', relacion('locality')],
  ['festivity', relacion('festivity')],
  ['commitment', relacion('commitment')],
  ['agreement', relacion('agreement')],
  ['topic', relacion('topic')]
])
export const DEF_ITEM = definicion('contribution_item', [
  ['description', { required: true }],
  ['item_kind', { ...enumeracion(['BIEN', 'SERVICIO', 'DINERO', 'MANO DE OBRA']), required: true }],
  ['quantity', { type: 'DECIMAL' }],
  'unit',
  ['unit_cost', { type: 'DECIMAL' }],
  ['line_amount', { type: 'DECIMAL', required: true }],
  ['social_contribution', relacion('social_contribution')]
])
export const DEF_COMPROBANTE = definicion('receipt', [
  ['receipt_type', enumeracion(['BOLETA DE VENTA', 'FACTURA', 'RECIBO'])],
  'receipt_number',
  'issuer_name',
  'issued_to_name',
  ['issue_date', { type: 'DATE' }],
  ['amount', { type: 'DECIMAL', required: true }],
  ['currency', { ...MONEDAS, required: true }],
  ['social_contribution', relacion('social_contribution')]
])
// la entrega para quien lee todo: en un aporte, delivered_amount va vacío (FIELD_NOT_ALLOWED) y el portal no lo pide
export const DEF_ENTREGA_DE_APORTE = definicion('delivery', [
  ['delivery_date', { type: 'DATE', required: true }],
  'place',
  ['delivered_items', { type: 'LONG_TEXT' }],
  ['delivered_amount', { type: 'DECIMAL' }],
  ['recipients', { type: 'LONG_TEXT' }],
  ['conformity_given', { type: 'BOOLEAN' }],
  ['conformity_by', { type: 'LONG_TEXT' }],
  ['commitment', relacion('commitment')],
  ['social_contribution', relacion('social_contribution')]
])
export const DEF_PROGRAMA = definicion('social_program', [
  ['code', { required: true }],
  ['name', { required: true }],
  ['description', { type: 'LONG_TEXT' }],
  ['start_date', { type: 'DATE' }],
  ['end_date', { type: 'DATE' }],
  ['total_budget', { type: 'DECIMAL' }],
  ['currency', MONEDAS],
  ['project', relacion('project')],
  ['topic', relacion('topic')],
  ['partner_organization', relacion('organization')],
  ['agreement', relacion('agreement')]
])
export const DEF_PRESUPUESTO = definicion('program_budget', [
  ['budget_year', { type: 'INTEGER', required: true }],
  ['allocated_amount', { type: 'DECIMAL', required: true }],
  ['executed_amount', { type: 'DECIMAL' }],
  ['currency', { ...MONEDAS, required: true }],
  ['social_program', relacion('social_program')]
])
export const DEF_INDICADOR = definicion('program_indicator', [
  ['name', { required: true }],
  ['definition', { type: 'LONG_TEXT' }],
  'unit',
  ['baseline_value', { type: 'DECIMAL' }],
  ['target_value', { type: 'DECIMAL' }],
  'frequency',
  ['social_program', relacion('social_program')]
])
export const DEF_MEDICION = definicion('program_measurement', [
  ['period_start_date', { type: 'DATE', required: true }],
  ['period_end_date', { type: 'DATE', required: true }],
  ['measured_value', { type: 'DECIMAL', required: true }],
  ['notes', { type: 'LONG_TEXT' }],
  ['program_indicator', relacion('program_indicator')]
])
export const DEF_INICIATIVA = definicion('social_initiative', [
  ['name', { required: true }],
  ['description', { type: 'LONG_TEXT' }],
  ['start_date', { type: 'DATE' }],
  ['end_date', { type: 'DATE' }],
  ['social_program', relacion('social_program')],
  ['locality', relacion('locality')],
  ['community', relacion('community')],
  ['counterpart_organization', relacion('organization')]
])
export const DEF_GRUPO_BENEFICIARIO = definicion('beneficiary_group', [
  ['name', { required: true }],
  ['description', { type: 'LONG_TEXT' }],
  ['target_count', { type: 'INTEGER' }],
  ['reached_count', { type: 'INTEGER' }],
  ['social_program', relacion('social_program')],
  ['social_initiative', relacion('social_initiative')],
  ['locality', relacion('locality')]
])
export const DEF_HITO = definicion('program_milestone', [
  ['name', { required: true }],
  ['planned_date', { type: 'DATE' }],
  ['reached_date', { type: 'DATE' }],
  ['notes', { type: 'LONG_TEXT' }],
  ['social_program', relacion('social_program')]
])

// lo que toda pantalla de BC-10 de un proyecto lee: el proyecto, los workflows, la asignación vigente de quien mira, las
// definiciones y las organizaciones y la campaña que nombran sus vínculos
export const baseDeInversion = (usuario: AuthUser = INVERSION): MockRoute[] => [
  { path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/social_contribution/workflow', body: WF_APORTE },
  { path: '/objects/social_program/workflow', body: WF_PROGRAMA },
  {
    path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
    body: pagina([registro('as', { project: 'p1', member_user_id: usuario.id, active: true })])
  },
  { path: '/metadata/objects/social_contribution', body: DEF_APORTE },
  { path: '/metadata/objects/contribution_item', body: DEF_ITEM },
  { path: '/metadata/objects/receipt', body: DEF_COMPROBANTE },
  { path: '/metadata/objects/delivery', body: DEF_ENTREGA_DE_APORTE },
  { path: '/metadata/objects/social_program', body: DEF_PROGRAMA },
  { path: '/metadata/objects/program_budget', body: DEF_PRESUPUESTO },
  { path: '/metadata/objects/program_indicator', body: DEF_INDICADOR },
  { path: '/metadata/objects/program_measurement', body: DEF_MEDICION },
  { path: '/metadata/objects/social_initiative', body: DEF_INICIATIVA },
  { path: '/metadata/objects/beneficiary_group', body: DEF_GRUPO_BENEFICIARIO },
  { path: '/metadata/objects/program_milestone', body: DEF_HITO },
  { path: '/objects/organization/records/o2', body: ASOCIACION },
  { path: '/objects/organization/records/o3', body: EMPRESA },
  { path: '/objects/agreement/records/ag1', body: ACUERDO },
  { path: '/objects/exploration_campaign/records/camp1', body: CAMPANA }
]
