import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { Link } from 'react-router'
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

// otra ficha: una autorización de asamblea sin su asamblea y con un predio sin código
const AUTORIZACION = registro(
  'ag2',
  { project: 'p1', code: 'A-002', title: 'Autorización del acceso sur', agreement_type: 'AUTORIZACION DE ASAMBLEA', community: 'cm1' },
  { state: 'in_negotiation', updatedAt: '2026-10-02T15:00:00Z' }
)
const rutasDeLaAutorizacion: MockRoute[] = [
  { path: '/objects/agreement/records/ag2', body: AUTORIZACION },
  { path: '/objects/agreement/records/ag2/related/agreement_land_parcel', body: pagina([registro('lp2', {})]) },
  { path: '/objects/agreement/records/ag2/related/evidence_agreement', body: pagina([]) },
  { path: '/objects/agreement/records/ag2/history', body: [] },
  {
    path: '/objects/agreement/records/ag2/transitions',
    body: [{ name: 'activate', label: 'Registrar vigencia', to: 'active', toLabel: 'Vigente', allowed: true, reason: null }]
  }
]
const FICHA = { camino: '/projects/:projectId/agreements/:agreementId', usuario: GERENCIA_SOCIAL, permisos: EQUIPO }

describe('S33 · acuerdos', () => {
  it('lista el acuerdo con su vigencia y lo registra con el proyecto fijo y el motivo', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/objects/agreement/records', status: 201, body: registro('ag9', { project: 'p1' }) }]))
    red = espiarRed()
    montar(<AcuerdosPage />, { ruta: '/projects/p1/agreements', camino: '/projects/:projectId/agreements', usuario: GERENCIA_SOCIAL, permisos: EQUIPO })
    const tabla = await screen.findByRole('table', { name: 'Acuerdos' })
    expect(within(tabla).getByLabelText('Situación de vigencia: Vigente')).toBeInTheDocument()
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
    // elegir el siguiente predio quita el aviso del vínculo anterior
    await userEvent.type(screen.getByLabelText('Buscar el predio por código'), 'PR')
    await userEvent.click(await screen.findByRole('button', { name: 'PR-001' }))
    expect(screen.queryByText('Predio vinculado.')).not.toBeInTheDocument()
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

  it('pasar a otro acuerdo ya leído no arrastra el motivo ni el predio elegido en el anterior', async () => {
    fetch = mockFetch(rutas(rutasDeLaAutorizacion))
    montar(
      <>
        <FichaAcuerdoPage />
        <Link to="/projects/p1/agreements/ag1">Ir a la servidumbre</Link>
        <Link to="/projects/p1/agreements/ag2">Ir a la autorización</Link>
      </>,
      { ruta: '/projects/p1/agreements/ag2', ...FICHA }
    )
    expect(await screen.findByRole('heading', { name: 'Autorización del acceso sur', level: 1 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Ir a la servidumbre' }))
    expect(await screen.findByRole('heading', { name: 'Servidumbre del acceso norte', level: 1 })).toBeInTheDocument()
    await userEvent.click(await screen.findByText('Vincular un predio'))
    await userEvent.type(screen.getByLabelText('Buscar el predio por código'), 'PR')
    await userEvent.click(await screen.findByRole('button', { name: 'PR-001' }))
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Predio del acceso')
    // la autorización ya está en la caché: se dibuja sin pasar por «Cargando»
    await userEvent.click(screen.getByRole('link', { name: 'Ir a la autorización' }))
    expect(await screen.findByRole('heading', { name: 'Autorización del acceso sur', level: 1 })).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo (obligatorio)')).toHaveValue('')
    expect(screen.queryByText('PR-001')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Buscar el predio por código')).toBeInTheDocument()
    // el predio sin código se nombra con un texto neutro, nunca con su identificador
    expect(await screen.findByText('Predio sin código')).toBeInTheDocument()
    expect(screen.queryByText('lp2')).not.toBeInTheDocument()
  })

  it('una autorización de asamblea sin su asamblea lo avisa y el diálogo no registra su vigencia', async () => {
    fetch = mockFetch(
      rutas([
        ...rutasDeLaAutorizacion,
        {
          method: 'POST',
          path: '/sgspe/transition-checks',
          body: {
            allowed: false,
            blocking: [{ code: 'ASSEMBLY_REQUIRED', message: 'Falta la asamblea que autoriza', field: 'assembly_engagement' }],
            warnings: []
          }
        }
      ])
    )
    montar(<FichaAcuerdoPage />, { ruta: '/projects/p1/agreements/ag2', ...FICHA })
    expect(await screen.findByText('Sin asamblea')).toBeInTheDocument()
    expect(screen.getByText('Una autorización de asamblea necesita la asamblea que la autoriza para registrar su vigencia.')).toBeInTheDocument()
    const vigencia = await screen.findByRole('button', { name: 'Registrar vigencia' })
    await waitFor(() => expect(vigencia).toBeDisabled())
    expect(vigencia).toHaveAccessibleDescription('Falta la asamblea que autoriza')
  })

  it('una cláusula nueva queda en su acuerdo', async () => {
    fetch = mockFetch(
      rutas([
        { path: '/metadata/objects/agreement_clause', body: definicion('agreement_clause', ['agreement', 'clause_number', 'clause_text']) },
        { method: 'POST', path: '/objects/agreement_clause/records', status: 201, body: registro('cl3', { agreement: 'ag1', clause_number: '3' }) }
      ])
    )
    red = espiarRed()
    montar(<FichaAcuerdoPage />, { ruta: '/projects/p1/agreements/ag1', ...FICHA })
    await userEvent.click(await screen.findByRole('button', { name: '+ Cláusula' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.type(await within(panel).findByLabelText(/^clause_number/), '3')
    await userEvent.type(within(panel).getByLabelText(/^clause_text/), 'La empresa contrata mano de obra local')
    await userEvent.click(within(panel).getByRole('button', { name: /Guardar|Save/ }))
    await waitFor(() => expect(red!.a('POST', '/objects/agreement_clause/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/agreement_clause/records')[0].cuerpo).toMatchObject({
      attributes: { agreement: 'ag1', clause_number: '3', clause_text: 'La empresa contrata mano de obra local' }
    })
  })

  it('editar el acuerdo manda el motivo con el cambio', async () => {
    fetch = mockFetch(rutas([{ method: 'PUT', path: '/objects/agreement/records/ag1', body: SERVIDUMBRE }]))
    red = espiarRed()
    montar(<FichaAcuerdoPage />, { ruta: '/projects/p1/agreements/ag1', ...FICHA })
    await userEvent.click(await screen.findByRole('button', { name: 'Editar el acuerdo' }))
    const panel = await screen.findByRole('dialog')
    expect(within(panel).getByText('Un acuerdo exige un motivo en cada registro o cambio.')).toBeInTheDocument()
    await userEvent.type(within(panel).getByLabelText('Motivo del registro o del cambio (obligatorio)'), 'Corrige el título')
    const titulo = await within(panel).findByLabelText(/^title/)
    await userEvent.clear(titulo)
    await userEvent.type(titulo, 'Servidumbre del acceso norte y sur')
    await userEvent.click(within(panel).getByRole('button', { name: /Guardar|Save/ }))
    await waitFor(() => expect(red!.a('PUT', '/objects/agreement/records/ag1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/agreement/records/ag1')
    expect(cambio.cuerpo).toMatchObject({ attributes: { title: 'Servidumbre del acceso norte y sur' } })
    expect(cambio.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Corrige%20el%20t%C3%ADtulo")
  })
})
