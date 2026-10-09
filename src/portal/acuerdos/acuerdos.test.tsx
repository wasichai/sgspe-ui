import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeCompromisos } from '../../test/compromisos'
import { definicion, montar, pagina, registro, ubicacion, workflow } from '../../test/montar'
import { GERENCIA_SOCIAL, permisos } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { AcuerdosPage } from './AcuerdosPage'
import { FichaAcuerdoPage } from './FichaAcuerdoPage'

// S33 (WF-I, RF-AGR-001 a RF-AGR-003): la lista con su vigencia, el alta con motivo (requiresReason), y la ficha con sus
// cláusulas y compromisos, partes, titular, asamblea y predios; registrar la vigencia de una servidumbre sin predios se avisa
// y el diálogo lo bloquea con su regla
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const SERVIDUMBRE = registro(
  'ag1',
  {
    project: 'p1',
    code: 'A-001',
    title: 'Servidumbre del acceso norte',
    agreement_type: 'SERVIDUMBRE',
    summary: 'Paso por el predio comunal',
    signed_date: '2026-09-01',
    effective_date: '2026-09-15',
    expiry_date: '2027-09-14',
    amount: 12000,
    currency: 'PEN',
    validity_status: 'VIGENTE',
    community: 'cm1'
  },
  { state: 'in_negotiation', updatedAt: '2026-10-01T15:00:00Z' }
)
const EQUIPO = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  agreement: ['READ', 'CREATE', 'UPDATE'],
  agreement_party: ['READ', 'CREATE'],
  agreement_clause: ['READ', 'CREATE'],
  commitment: ['READ', 'CREATE'],
  community: ['READ'],
  engagement: ['READ'],
  land_parcel: ['READ'],
  organization: ['READ'],
  evidence: ['READ']
})
const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(GERENCIA_SOCIAL),
  {
    path: '/objects/agreement/workflow',
    body: workflow('agreement', [
      ['in_negotiation', 'En negociación'],
      ['active', 'Vigente']
    ])
  },
  { path: '/objects/agreement/records', body: pagina([SERVIDUMBRE]) },
  { path: '/objects/agreement/records/ag1', body: SERVIDUMBRE },
  {
    path: '/metadata/objects/agreement',
    body: definicion('agreement', ['code', 'title', ['agreement_type', { type: 'ENUM', enumOptions: ['CONVENIO', 'SERVIDUMBRE'] }], 'summary', 'project'])
  },
  {
    path: '/objects/agreement_clause/records',
    body: pagina([
      registro('cl1', { agreement: 'ag1', clause_number: '1', clause_text: 'La empresa repara el camino', creates_commitment: true }),
      registro('cl2', { agreement: 'ag1', clause_number: '2', clause_text: 'La comunidad da el paso', creates_commitment: true })
    ])
  },
  {
    path: '/objects/commitment/records',
    body: pagina([
      registro('c1', { project: 'p1', code: 'C-001', title: 'Reparar el camino', agreement: 'ag1', agreement_clause: 'cl1' }, { state: 'approved' })
    ])
  },
  {
    path: '/objects/agreement_party/records',
    body: pagina([registro('pt1', { agreement: 'ag1', organization: 'o1', signatory_role: 'Presidente comunal', signed: true })])
  },
  { path: '/objects/organization/records/o1', body: registro('o1', { name: 'CC Tunas Pampa' }) },
  { path: '/objects/community/records/cm1', body: registro('cm1', { name: 'CC Tunas Pampa' }) },
  { path: '/objects/agreement/records/ag1/related/agreement_land_parcel', body: pagina([]) },
  { path: '/objects/agreement/records/ag1/related/evidence_agreement', body: pagina([]) },
  { path: '/objects/agreement/records/ag1/history', body: [] },
  {
    path: '/objects/agreement/records/ag1/transitions',
    body: [{ name: 'activate', label: 'Registrar vigencia', to: 'active', toLabel: 'Vigente', allowed: true, reason: null }]
  },
  {
    method: 'POST',
    path: '/sgspe/transition-checks',
    body: {
      allowed: false,
      blocking: [{ code: 'LAND_PARCEL_REQUIRED', message: 'Una servidumbre necesita al menos un predio', field: 'agreement_land_parcel' }],
      warnings: []
    }
  },
  { path: '/objects/land_parcel/records', body: pagina([registro('lp1', { code: 'PR-001' })]) }
]

describe('S33 · acuerdos', () => {
  it('lista el acuerdo con su vigencia y lo registra con el proyecto fijo y el motivo', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/objects/agreement/records', status: 201, body: registro('ag9', { project: 'p1' }) }]))
    red = espiarRed()
    montar(<AcuerdosPage />, { ruta: '/projects/p1/agreements', camino: '/projects/:projectId/agreements', usuario: GERENCIA_SOCIAL, permisos: EQUIPO })
    const tabla = await screen.findByRole('table', { name: 'Acuerdos' })
    expect(within(tabla).getByLabelText('Situación de vigencia: VIGENTE')).toBeInTheDocument()
    expect(within(tabla).getByRole('link', { name: 'Servidumbre del acceso norte' })).toHaveAttribute('href', '/projects/p1/agreements/ag1')
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo acuerdo' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.type(within(panel).getByLabelText('Motivo del registro o del cambio (obligatorio)'), 'Convenio firmado en asamblea')
    await userEvent.type(await within(panel).findByLabelText(/^code/), 'A-002')
    await userEvent.type(within(panel).getByLabelText(/^title/), 'Convenio de agua')
    await userEvent.click(within(panel).getByRole('button', { name: /Guardar|Save/ }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/agreements/ag9'))
    const [alta] = red.a('POST', '/objects/agreement/records')
    expect(alta.cuerpo).toMatchObject({ attributes: { code: 'A-002', title: 'Convenio de agua', project: 'p1' } })
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Convenio%20firmado%20en%20asamblea")
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('la ficha dice qué cláusula no tiene compromiso, quién firmó y que la servidumbre sin predios no registra su vigencia', async () => {
    fetch = mockFetch(rutas())
    montar(<FichaAcuerdoPage />, {
      ruta: '/projects/p1/agreements/ag1',
      camino: '/projects/:projectId/agreements/:agreementId',
      usuario: GERENCIA_SOCIAL,
      permisos: EQUIPO
    })
    expect(await screen.findByRole('heading', { name: 'Servidumbre del acceso norte', level: 1 })).toBeInTheDocument()
    const clausulas = await screen.findByRole('table', { name: 'Cláusulas' })
    expect(await within(clausulas).findByRole('link', { name: 'C-001 · Reparar el camino' })).toBeInTheDocument()
    expect(within(clausulas).getByText('Sin compromiso registrado')).toBeInTheDocument()
    expect(await screen.findByText('CC Tunas Pampa · Presidente comunal · Firmó')).toBeInTheDocument()
    expect(await screen.findByText(/necesita al menos un predio para registrar su vigencia/)).toBeInTheDocument()
    const vigencia = await screen.findByRole('button', { name: 'Registrar vigencia' })
    await waitFor(() => expect(vigencia).toBeDisabled())
    expect(vigencia).toHaveAccessibleDescription('Una servidumbre necesita al menos un predio')
  })

  it('vincular un predio pide motivo y lo manda en el vínculo', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { method: 'POST', path: '/objects/agreement/records/ag1/related/agreement_land_parcel', responder: () => new Response(null, { status: 204 }) }
    ])
    montar(<FichaAcuerdoPage />, {
      ruta: '/projects/p1/agreements/ag1',
      camino: '/projects/:projectId/agreements/:agreementId',
      usuario: GERENCIA_SOCIAL,
      permisos: EQUIPO
    })
    await userEvent.click(await screen.findByText('Vincular un predio'))
    await userEvent.type(screen.getByLabelText('Buscar el predio por código'), 'PR')
    await userEvent.click(await screen.findByRole('button', { name: 'PR-001' }))
    await userEvent.click(screen.getByRole('button', { name: 'Vincular' }))
    expect(await screen.findByText('Escriba el motivo del cambio')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Predio del acceso')
    await userEvent.click(screen.getByRole('button', { name: 'Vincular' }))
    expect(await screen.findByText('Predio vinculado.')).toBeInTheDocument()
    const [vinculo] = red.a('POST', '/objects/agreement/records/ag1/related/agreement_land_parcel')
    expect(vinculo.cuerpo).toEqual({ otherId: 'lp1' })
    expect(vinculo.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Predio%20del%20acceso")
  })

  it('un error al vincular dice el texto de su código', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/agreement/records/ag1/related/agreement_land_parcel',
        responder: () => problema(403, 'x', [{ field: 'record', message: 'NOT_ASSIGNED' }])
      }
    ])
    montar(<FichaAcuerdoPage />, {
      ruta: '/projects/p1/agreements/ag1',
      camino: '/projects/:projectId/agreements/:agreementId',
      usuario: GERENCIA_SOCIAL,
      permisos: EQUIPO
    })
    await userEvent.click(await screen.findByText('Vincular un predio'))
    await userEvent.type(screen.getByLabelText('Buscar el predio por código'), 'PR')
    await userEvent.click(await screen.findByRole('button', { name: 'PR-001' }))
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Vincular' }))
    expect(await screen.findByText('No tiene una asignación vigente a este proyecto: pídala a la administración del proyecto.')).toBeInTheDocument()
    expect(screen.queryByText('NOT_ASSIGNED')).not.toBeInTheDocument()
  })
})
