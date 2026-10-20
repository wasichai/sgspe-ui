import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QUEJA, WF_QUEJA } from '../../test/atencion'
import { pagina, registro, montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { ALERTA, baseDeRiesgos, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS, RELACIONES_EN_RIESGOS, RIESGO } from '../../test/riesgos'
import { RELACIONISTA } from '../../test/portal'
import { estaAtrasada, FichaRiesgoPage } from './FichaRiesgoPage'

vi.mock('../documentos/exif', () => ({ leerExif: async () => ({}) }))

// S40 (screens.md §9, flujos 14 y 15): el nivel vigente y la revisión, la nueva revisión por su endpoint con motivo y la vista
// previa del nivel, la primera sin residual, el responsable que falta, las revisiones inmutables, las medidas atrasadas y lo que
// alimenta al riesgo
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  // las 21:00 del 9 de octubre en Lima ya son el 10 en UTC: la fecha por defecto es la de Lima
  vi.setSystemTime(new Date('2026-10-10T02:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const REVISION = registro('a1', {
  social_risk: 'k1',
  assessment_date: '2026-10-05',
  probability: 4,
  impact: 4,
  score: 16,
  risk_level: 'CRITICO',
  trend: 'AUMENTA',
  residual: false,
  notes: 'Tras la protesta del 4 de octubre',
  assessor_user_email: 'srm@sgspe.test'
})
const MEDIDA_ATRASADA = registro('mm1', {
  social_risk: 'k1',
  description: 'Mesa de empleo local',
  owner_user_email: 'srm@sgspe.test',
  planned_date: '2026-10-01'
})

const rutas = (extra: MockRoute[] = [], riesgo = RIESGO, revisiones = [REVISION]): MockRoute[] => [
  ...extra,
  ...baseDeRiesgos(),
  { path: '/objects/social_risk/records/k1', body: riesgo },
  {
    path: '/objects/social_risk/records/k1/transitions',
    body: [{ name: 'start_monitoring', label: 'Pasar a monitoreo', to: 'monitoring', toLabel: 'En monitoreo', allowed: true, reason: null }]
  },
  {
    method: 'POST',
    path: '/sgspe/transition-checks',
    body: {
      allowed: false,
      blocking: [{ code: 'RESIDUAL_ASSESSMENT_REQUIRED', message: 'Falta una revisión residual', field: 'risk_assessment' }],
      warnings: []
    }
  },
  { path: '/objects/risk_assessment/records', body: pagina(revisiones) },
  { path: '/objects/mitigation_measure/records', body: pagina([MEDIDA_ATRASADA]) },
  { path: '/objects/potential_impact/records', body: pagina([]) },
  { path: '/objects/grievance/workflow', body: WF_QUEJA },
  { path: '/objects/grievance/records', body: pagina([{ ...QUEJA, attributes: { ...QUEJA.attributes, social_risk: 'k1' } }]) },
  { path: '/objects/early_warning/records', body: pagina([{ ...ALERTA, attributes: { ...ALERTA.attributes, social_risk: 'k1' } }]) },
  { path: '/objects/social_risk/records/k1/related/social_risk_stakeholder', body: pagina([]) },
  { path: '/objects/social_risk/records/k1/history', body: [] }
]
const abrir = (usuario = GESTOR_DE_RIESGOS, permisos = EQUIPO_DE_RIESGOS) =>
  montar(<FichaRiesgoPage />, { ruta: '/projects/p1/risks/k1', camino: '/projects/:projectId/risks/:riskId', usuario, permisos })

describe('S40 · ficha de riesgo', () => {
  it('dice el nivel con texto, el puntaje, la revisión y la próxima fecha; pasar a monitoreo sin residual sale bloqueado', async () => {
    fetch = mockFetch(rutas())
    abrir()
    expect(await screen.findByRole('heading', { name: 'Bloqueo de la vía de acceso por la comunidad', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByLabelText('Nivel de riesgo: Crítico').length).toBeGreaterThan(0)
    expect(screen.getAllByText('4 × 4 = 16').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Situación de revisión: Al día')).toBeInTheDocument()
    const monitoreo = await screen.findByRole('button', { name: 'Pasar a monitoreo' })
    await waitFor(() => expect(monitoreo).toBeDisabled())
    expect(monitoreo).toHaveAccessibleDescription('Falta una revisión residual')
    expect(screen.queryByRole('button', { name: 'Evaluar' })).not.toBeInTheDocument()
  })

  // el alta relacionada va en «Más acciones», con las transiciones que no son la siguiente (rediseño de UX, 2026-10-20)
  it('«Más acciones» lleva al compromiso que atiende el riesgo (revisión de UX, etapa 5)', async () => {
    fetch = mockFetch(rutas())
    abrir(GESTOR_DE_RIESGOS, { ...EQUIPO_DE_RIESGOS, objects: { ...EQUIPO_DE_RIESGOS.objects, commitment: ['READ', 'CREATE'] } })
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
    expect(screen.getByRole('link', { name: 'Registrar compromiso' })).toHaveAttribute('href', '/projects/p1/commitments/new?social_risk=k1')
  })

  it('una nueva revisión manda la fecha de Lima, P e I, el motivo y anticipa el nivel; el reintento repite la clave', async () => {
    let veces = 0
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/social-risks/k1/assessments',
        responder: () =>
          ++veces === 1
            ? problema(503, 'sin servicio')
            : jsonResponse({ assessment: REVISION, risk: { ...RIESGO, attributes: { ...RIESGO.attributes, risk_level: 'ALTO' } } }, 201)
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva revisión' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva revisión' })
    expect(within(dialogo).getByLabelText('Fecha de la revisión')).toHaveValue('2026-10-09')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Probabilidad (1 a 5)'), '3')
    expect(within(dialogo).getByText(/Puntaje 12: nivel Alto con los umbrales del proyecto/)).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar revisión' }))
    expect(within(dialogo).getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'revisión semanal')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar revisión' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/social-risks/k1/assessments')).toHaveLength(1))
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'Registrar revisión' }))
    expect(await screen.findByText('Revisión registrada: el riesgo queda en nivel Alto.')).toBeInTheDocument()
    const [primera, segunda] = red.a('POST', '/sgspe/social-risks/k1/assessments')
    expect(primera.cuerpo).toEqual({ attributes: { assessment_date: '2026-10-09', probability: 3, impact: 4, residual: false } })
    expect(segunda.cabeceras.get('Idempotency-Key')).toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  it('la primera revisión no puede ser residual, y sin responsable dice qué hacer', async () => {
    const NUEVO = registro('k1', { project: 'p1', code: 'R-009', title: 'Riesgo sin evaluar' }, { state: 'identified' })
    fetch = mockFetch(
      rutas(
        [
          {
            method: 'POST',
            path: '/sgspe/social-risks/k1/assessments',
            status: 400,
            body: { title: 'Bad Request', status: 400, detail: 'falta', errors: [{ field: 'owner_user_id', message: 'FIELD_REQUIRED' }] }
          }
        ],
        NUEVO,
        []
      )
    )
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: 'Revisiones' }))
    expect(await screen.findByText(/todavía no tiene revisiones/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Nueva revisión' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva revisión' })
    expect(within(dialogo).getByRole('checkbox', { name: /residual/ })).toBeDisabled()
    expect(within(dialogo).getByText('La primera revisión no puede ser residual.')).toBeInTheDocument()
    await userEvent.selectOptions(within(dialogo).getByLabelText('Probabilidad (1 a 5)'), '2')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Impacto (1 a 5)'), '2')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'primera')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar revisión' }))
    expect(await within(dialogo).findByText(/necesita un responsable del riesgo/)).toBeInTheDocument()
  })

  it('las revisiones se listan sin editar; una medida vencida sin completar se marca atrasada', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: 'Revisiones' }))
    const tabla = await screen.findByRole('table', { name: 'Revisiones' })
    expect(within(tabla).getByText('Aumenta')).toBeInTheDocument()
    expect(within(tabla).getByText('srm@sgspe.test')).toBeInTheDocument()
    expect(screen.getByText('Las revisiones no se editan: una se corrige con otra.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Medidas' }))
    const medidas = await screen.findByRole('table', { name: 'Medidas de mitigación' })
    expect(within(medidas).getByText('Atrasada')).toBeInTheDocument()
    expect(estaAtrasada(registro('m', { planned_date: '2026-10-01', completed: true }), '2026-10-09')).toBe(false)
  })

  // revisión de UX, etapa 4: «Lo alimentan» pasa a «De dónde viene» del panel de trazabilidad común
  it('a la derecha, las quejas y alertas que lo alimentan, en «De dónde viene»', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const lado = await screen.findByRole('region', { name: 'De dónde viene' })
    expect(await within(lado).findByRole('link', { name: /Q-001/ })).toHaveAttribute('href', '/projects/p1/grievances/g1')
    expect(await within(lado).findByRole('link', { name: /Señales de conflicto/ })).toHaveAttribute('href', '/projects/p1/risks/warnings/w1')
  })

  it('una queja o alerta que llega sin proyecto se nombra sin enlace', async () => {
    const sinProyecto = (r: typeof QUEJA) => ({ ...r, attributes: { ...r.attributes, project: null, social_risk: 'k1' } })
    fetch = mockFetch(
      rutas([
        { path: '/objects/grievance/records', body: pagina([sinProyecto(QUEJA)]) },
        { path: '/objects/early_warning/records', body: pagina([sinProyecto(ALERTA)]) }
      ])
    )
    abrir()
    const lado = await screen.findByRole('region', { name: 'De dónde viene' })
    expect(await within(lado).findByText(/Q-001/)).toBeInTheDocument()
    expect(await within(lado).findByText(/Señales de conflicto/)).toBeInTheDocument()
    expect(within(lado).queryByRole('link', { name: /Q-001/ })).not.toBeInTheDocument()
    expect(within(lado).queryByRole('link', { name: /Señales de conflicto/ })).not.toBeInTheDocument()
  })

  it('quien solo lee no ve «Nueva revisión» ni «Editar»', async () => {
    fetch = mockFetch(rutas())
    abrir(RELACIONISTA, RELACIONES_EN_RIESGOS)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva revisión' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  it('un riesgo que no existe lo dice con su texto, sin reintento', async () => {
    fetch = mockFetch(rutas([{ path: '/objects/social_risk/records/k1', status: 404, body: { title: 'Not Found', status: 404 } }]))
    abrir()
    expect(await screen.findByText('Este riesgo no existe o no es de sus proyectos.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })
})
