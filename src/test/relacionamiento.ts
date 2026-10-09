import type { MockRoute } from '@wasichai/testing'
import { pagina, registro, workflow } from './montar'
import { permisos, RELACIONISTA } from './portal'

// los datos de las pruebas de relacionamiento (S21 a S26): un proyecto con su área aprobada, tres interacciones (realizada,
// cancelada y postergada), las festividades de la línea base y los permisos del equipo de relacionamiento
export const P1 = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }, { state: 'active' })
export const E1 = registro(
  'e1',
  {
    project: 'p1',
    title: 'Asamblea comunal',
    engagement_type: 'ASAMBLEA',
    held_at: '2026-10-02T03:00:00Z',
    attendees_total_count: 40,
    attendees_female_count: 18,
    attendees_male_count: 22
  },
  { state: 'held' }
)
export const E2 = registro(
  'e2',
  { project: 'p1', title: 'Reunión con la junta', engagement_type: 'REUNION', scheduled_at: '2026-10-15T15:00:00Z', cancel_reason: 'Lluvias' },
  { state: 'cancelled' }
)
export const E3 = registro(
  'e3',
  { project: 'p1', title: 'Llamada al teniente', engagement_type: 'LLAMADA', scheduled_at: '2026-11-03T15:00:00Z' },
  { state: 'postponed' }
)
export const EQUIPO = permisos({
  project: ['READ'],
  engagement: ['READ', 'CREATE', 'UPDATE'],
  engagement_participant: ['READ', 'CREATE'],
  engagement_question: ['READ', 'CREATE', 'UPDATE'],
  stakeholder: ['READ'],
  field_visit: ['READ', 'CREATE', 'UPDATE'],
  field_observation: ['READ', 'CREATE'],
  topic: ['READ'],
  festivity: ['READ']
})

export const base = (usuario = RELACIONISTA): MockRoute[] => [
  { path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  {
    path: '/objects/engagement/workflow',
    body: workflow('engagement', [
      ['planned', 'Planificada'],
      ['held', 'Realizada'],
      ['minutes_drafted', 'Acta en borrador'],
      ['cancelled', 'Cancelada'],
      ['postponed', 'Postergada']
    ])
  },
  {
    path: '/objects/field_visit/workflow',
    body: workflow('field_visit', [
      ['planned', 'Planificada'],
      ['in_progress', 'En curso']
    ])
  },
  {
    path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
    body: pagina([registro('as', { project: 'p1', member_user_id: usuario.id, active: true })])
  },
  { path: '/objects/area_of_influence/records', body: pagina([registro('a1', { project: 'p1' }, { state: 'approved' })]) },
  { path: '/objects/area_of_influence_member/records', body: pagina([registro('m1', { area_of_influence: 'a1', locality: 'l1' })]) },
  {
    path: '/objects/festivity/records',
    body: pagina([
      registro('f1', { name: 'Fiesta patronal', month: 10, start_day: 1, end_day: 2, locality: 'l1' }),
      registro('f2', { name: 'Fiesta de otro lugar', month: 10, start_day: 5, locality: 'l9' })
    ])
  },
  {
    path: '/sgspe/dashboards/indicators/KPI-ENG-02',
    body: { code: 'KPI-ENG-02', label: 'x', available: true, series: [{ period: '2026-10', value: 1, target: 2 }] }
  }
]
