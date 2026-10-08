import type { MockRoute } from '@wasichai/testing'
import { definicion, pagina, registro, workflow } from './montar'
import { permisos, RELACIONISTA } from './portal'

// los datos de las pruebas de grupos de interés (S16 a S20): un proyecto, tres grupos de interés (evaluado, identificado y
// retirado), sus actores y la historia de evaluaciones; definiciones con y sin acceso a la postura (security.md §7.9)
export const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)
export const P1 = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa', inactivity_days: 60, interest_threshold: 3, power_threshold: 3 }, { state: 'active' })
export const S1 = registro(
  's1',
  {
    project: 'p1',
    organization: 'o1',
    stakeholder_type: 'ORGANIZACION COMUNAL',
    influence_group: 'ESTRATEGICO',
    information_priority: 'MUY ALTA',
    stance: 'EN CONTRA',
    interest_index: 4,
    power_index: 3.5,
    trust_score: 2,
    last_contact_date: hace(10),
    owner_user_id: 'u-relacionista'
  },
  { state: 'assessed', updatedAt: '2026-10-04T10:00:00.25Z' }
)
export const S2 = registro('s2', { project: 'p1', person: 'pe1', stakeholder_type: 'LIDER LOCAL', last_contact_date: hace(200) }, { state: 'identified' })
export const S3 = registro('s3', { project: 'p1', organization: 'o3' }, { state: 'retired' })
export const STK_DEF = (conPostura: boolean) =>
  definicion('stakeholder', [
    // las relaciones del alta (las fija NuevoGrupo): sin estar en la definición, la escritura no las mandaría. son RELATION
    // y sus valores UUID, como en wasichai: Zod los valida aunque viajen ocultos (la prueba del alta usa UUID)
    ['project', { type: 'RELATION', relationTarget: 'project' }],
    ['organization', { type: 'RELATION', relationTarget: 'organization' }],
    ['person', { type: 'RELATION', relationTarget: 'person' }],
    ['influence_group', { type: 'ENUM', enumOptions: ['ESTRATEGICO', 'POLITICO'] }],
    ...(conPostura ? [['stance', { type: 'ENUM', enumOptions: ['A FAVOR', 'EN CONTRA'] }] as [string, Record<string, unknown>]] : []),
    ['stakeholder_scope', { type: 'ENUM', enumOptions: ['AIDS'] }],
    ['relationship_status', { type: 'ENUM', enumOptions: [] }],
    ['stakeholder_type', { type: 'ENUM', enumOptions: ['LIDER LOCAL'] }]
  ])
export const ASSESS_DEF = (conPostura: boolean) =>
  definicion('stakeholder_assessment', [
    ['basis', { type: 'ENUM', enumOptions: ['ENTREVISTA'] }],
    ['influence_group', { type: 'ENUM', enumOptions: ['ESTRATEGICO', 'POLITICO', 'PARA MONITOREO', 'VULNERABLE'] }],
    ...(conPostura
      ? ['stance', 'concerns', 'expectations', 'stance_reasons'].map(
          (c) => [c, c === 'stance' ? { type: 'ENUM', enumOptions: ['A FAVOR', 'EN CONTRA PERO ABIERTO A ESCUCHAR'] } : {}] as [string, Record<string, unknown>]
        )
      : [])
  ])

export const base = (usuario = RELACIONISTA, conPostura = false): MockRoute[] => [
  { path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  {
    path: '/objects/stakeholder/workflow',
    body: workflow('stakeholder', [
      ['identified', 'Identificado'],
      ['assessed', 'Evaluado'],
      ['retired', 'Retirado']
    ])
  },
  {
    path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
    body: pagina([registro('as', { project: 'p1', member_user_id: usuario.id, active: true })])
  },
  { path: '/metadata/objects/stakeholder', body: STK_DEF(conPostura) },
  { path: '/metadata/objects/stakeholder_assessment', body: ASSESS_DEF(conPostura) },
  { path: '/objects/stakeholder/records', body: pagina([S1, S2, S3]) },
  { path: '/objects/stakeholder/records/s1', body: S1 },
  { path: '/objects/organization/records/o1', body: registro('o1', { name: 'Ronda campesina Tunas', community: 'c1' }) },
  { path: '/objects/organization/records/o3', body: registro('o3', { name: 'APAFA' }) },
  { path: '/objects/person/records/pe1', body: registro('pe1', { sex: 'FEMENINO' }) },
  { path: '/objects/stakeholder/records/s1/transitions', body: [] },
  {
    path: '/objects/stakeholder_assessment/records',
    body: pagina([
      registro('ev2', {
        assessment_date: '2026-09-01',
        basis: 'ENTREVISTA',
        influence_group: 'ESTRATEGICO',
        interest_index: 4,
        power_index: 3.5,
        stance: 'EN CONTRA',
        concerns: 'Agua',
        affect_environment: 5,
        stance_changed: true
      }),
      registro('ev1', {
        assessment_date: '2026-03-01',
        basis: 'INFERIDA',
        influence_group: 'POLITICO',
        interest_index: 2.5,
        power_index: 3.5,
        group_overridden: true
      })
    ])
  },
  {
    path: '/objects/stakeholder/records/s1/related/engagement_stakeholder',
    body: pagina([registro('e1', { title: 'Asamblea de agosto', held_at: '2026-08-20T15:00:00Z' })])
  }
]

export const LEE = permisos({
  project: ['READ'],
  stakeholder: ['READ', 'CREATE', 'UPDATE'],
  stakeholder_assessment: ['READ', 'CREATE'],
  engagement: ['READ', 'CREATE'],
  organization: ['READ'],
  person: ['READ']
})
