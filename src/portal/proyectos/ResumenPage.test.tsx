import { screen, waitFor, within } from '@testing-library/react'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, pagina, registro, workflow } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { GERENCIA_SOCIAL, permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'

vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)
const P1 = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa', stage: 'EXPLORACION', inactivity_days: 90 }, { state: 'active' })
const indicador = (code: string, extra: Record<string, unknown>) => ({
  path: `/sgspe/dashboards/indicators/${code}`,
  body: { code, label: code, available: true, ...extra }
})
const SIN_STANCE = {
  code: 'KPI-STK-02',
  label: 'Distribución de posturas',
  available: false,
  unavailableReason: 'FIELD_NOT_READABLE',
  missingFields: ['stakeholder.stance']
}

const rutas = (postura: unknown) => [
  { path: '/objects/project/records/p1', body: P1 },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/project/records/p1/transitions', body: [] },
  { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
  { path: /^\/objects\/project_assignment\/records\?.*role_name/, body: pagina([registro('a1', { member_user_email: 'jefa@sgspe.test' })]) },
  { path: '/objects/area_of_influence/records', body: pagina([registro('ai', { area_type: 'AIDS', version_number: 2 }, { state: 'approved' })]) },
  {
    path: '/objects/engagement/records',
    body: pagina([
      registro('e1', { title: 'Asamblea de agosto', engagement_type: 'ASAMBLEA' }, { state: 'held' }),
      registro('e2', { title: 'Llamada', engagement_type: 'LLAMADA' }, { state: 'held' })
    ])
  },
  { path: '/objects/stakeholder/records', body: pagina([registro('s1', { organization: 'o1', last_contact_date: hace(120) }, { state: 'profiled' })]) },
  { path: '/objects/organization/records/o1', body: registro('o1', { name: 'Ronda campesina Tunas' }) },
  {
    path: '/objects/project/records/p1/history',
    body: [{ id: 'h1', userEmail: 'pad@sgspe.test', operation: 'UPDATE', occurredAt: '2026-10-05T15:00:00Z', reason: 'cambio de etapa', changes: [] }]
  },
  { path: /^\/sgspe\/territory\/layers\//, body: { type: 'FeatureCollection', features: [] } },
  indicador('KPI-STK-01', { value: 42, unit: 'grupos de interés' }),
  indicador('KPI-ENG-01', { value: 7, unit: 'interacciones' }),
  indicador('KPI-STK-03', {
    value: 30,
    numerator: 30,
    denominator: 42,
    breakdowns: [{ by: 'stakeholder', rows: [{ key: 's1', value: 6, interest: 3.5, power: 2.5 }] }]
  }),
  // un indicador disponible trae siempre value (api.md §4.11), aunque la pantalla dibuje su serie
  indicador('KPI-ENG-02', {
    value: 3,
    series: [
      { period: '2026-09', value: 1, target: 2 },
      { period: '2026-10', value: 3, target: 2 }
    ]
  }),
  { path: '/sgspe/dashboards/indicators/KPI-STK-02', body: postura }
]

const LECTOR = permisos({ project: ['READ'], stakeholder: ['READ'], engagement: ['READ'], area_of_influence: ['READ'], project_assignment: ['READ'] })

describe('S08 · Project 360, resumen', () => {
  it('muestra la jefatura, las cifras de F2 con el proyecto y dice cuándo llegan las demás', async () => {
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, rutas(SIN_STANCE))
    red = espiarRed()
    expect(await screen.findByText(/jefa@sgspe.test/)).toBeInTheDocument()
    const salud = screen.getByRole('region', { name: 'Salud del proyecto' })
    expect(await within(salud).findByText('42')).toBeInTheDocument()
    expect(await within(salud).findByText('7')).toBeInTheDocument()
    expect(within(salud).getAllByText(/Llega en F[34]/)).toHaveLength(3)
    await waitFor(() => expect(red!.a('GET', '/sgspe/dashboards/indicators/KPI-STK-01').length).toBeGreaterThan(0))
    expect(red.a('GET', '/sgspe/dashboards/indicators/KPI-STK-01')[0].ruta).toContain('project=p1')
    expect(screen.getByText('12 sin evaluar')).toBeInTheDocument()
  })

  it('sin permiso para la postura no dibuja la barra; con él, sí', async () => {
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, rutas(SIN_STANCE))
    await screen.findByRole('region', { name: 'Paisaje de grupos de interés' })
    expect(screen.queryByText('Posturas')).not.toBeInTheDocument()
    fetch.restore()
    document.body.innerHTML = ''
    fetch = abrirPortal(
      '/projects/p1/overview',
      GERENCIA_SOCIAL,
      LECTOR,
      rutas({
        code: 'KPI-STK-02',
        label: 'x',
        available: true,
        value: 7,
        breakdowns: [
          {
            by: 'stance',
            rows: [
              { key: 'A FAVOR', value: 5 },
              { key: 'EN CONTRA', value: 2 }
            ]
          }
        ]
      })
    )
    expect(await screen.findByText('A FAVOR: 5')).toBeInTheDocument()
    expect(screen.getByText('EN CONTRA: 2')).toBeInTheDocument()
  })

  it('"Atención requerida" lista las actas por redactar de reuniones formales y los grupos sin contacto', async () => {
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, rutas(SIN_STANCE))
    const atencion = await screen.findByRole('region', { name: 'Atención requerida' })
    expect(await within(atencion).findByRole('link', { name: 'Asamblea de agosto: acta por redactar' })).toHaveAttribute('href', '/projects/p1/engagements/e1')
    expect(within(atencion).queryByText(/Llamada/)).not.toBeInTheDocument()
    expect(await within(atencion).findByRole('link', { name: 'Ronda campesina Tunas: sin contacto hace más de 90 días' })).toBeInTheDocument()
  })

  it('un borrador ofrece completarse solo a quien puede escribir algún campo del proyecto, no a un rol con "u"', async () => {
    const BORRADOR = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }, { state: 'draft' })
    const conCambio = permisos({ ...LECTOR.objects, project: ['READ', 'UPDATE'] })
    const rutasCon = (editable: boolean) => [
      { path: '/objects/project/records/p1', body: BORRADOR },
      {
        path: '/metadata/objects/project',
        body: definicion('project', [
          ['code', { editable }],
          ['name', { editable }]
        ])
      },
      ...rutas(SIN_STANCE)
    ]
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, conCambio, rutasCon(true))
    expect(await screen.findByRole('link', { name: 'Completar proyecto' })).toHaveAttribute('href', '/projects/new?draft=p1')
    fetch.restore()
    document.body.innerHTML = ''
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, conCambio, rutasCon(false))
    red = espiarRed()
    await screen.findByRole('region', { name: 'Paisaje de grupos de interés' })
    await waitFor(() => expect(red!.a('GET', '/metadata/objects/project').length).toBeGreaterThan(0))
    expect(screen.queryByRole('link', { name: 'Completar proyecto' })).not.toBeInTheDocument()
  })

  it('las reuniones del mes se comparan con la meta y la actividad trae el motivo', async () => {
    fetch = abrirPortal('/projects/p1/overview', RELACIONISTA, LECTOR, rutas(SIN_STANCE))
    expect(await screen.findByText('2026-10: 3 de 2')).toBeInTheDocument()
    expect(await screen.findByText(/cambio de etapa/)).toBeInTheDocument()
  })
})
