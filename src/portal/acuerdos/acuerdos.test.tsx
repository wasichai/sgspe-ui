import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { Link } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeCompromisos } from '../../test/compromisos'
import { definicion, montar, pagina, registro, ubicacion, workflow } from '../../test/montar'
import { GERENCIA_SOCIAL, permisos } from '../../test/portal'
import { listaDelServidor } from '../../test/listaDelServidor'
import { espiarRed, problema, type Red } from '../../test/red'
import { AcuerdosPage } from './AcuerdosPage'
import { FichaAcuerdoPage } from './FichaAcuerdoPage'
import { abrirCamino, estadosDeLaFicha } from '../../test/fichas'

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
  // revisión de UX, etapa 3: el total en el encabezado, crear desde lo global y ?nuevo=1 abre el alta
  it('dice cuántos hay, ofrece el alta en lo global y ?nuevo=1 abre el formulario en el proyecto', async () => {
    fetch = mockFetch(rutas())
    const global = montar(<AcuerdosPage />, { ruta: '/agreements', camino: '/agreements', usuario: GERENCIA_SOCIAL, permisos: EQUIPO })
    await screen.findByRole('table', { name: 'Acuerdos' })
    expect(screen.getByRole('button', { name: 'Nuevo acuerdo' })).toBeInTheDocument()
    expect(screen.getByText(/^\d+ acuerdos?$/)).toBeInTheDocument()
    global.unmount()
    montar(<AcuerdosPage />, { ruta: '/projects/p1/agreements?nuevo=1', camino: '/projects/:projectId/agreements', usuario: GERENCIA_SOCIAL, permisos: EQUIPO })
    expect(await within(await screen.findByRole('dialog')).findByLabelText('Motivo del registro o del cambio (obligatorio)')).toBeInTheDocument()
  })

  it('la lista global se pagina en el servidor: el total es el del conteo y la segunda página se pide con page=1', async () => {
    const muchos = Array.from({ length: 27 }, (_, i) => registro(`ag${i + 10}`, { ...SERVIDUMBRE.attributes, code: `A-${100 + i}`, title: `Acuerdo ${i}` }))
    fetch = mockFetch(rutas())
    red = espiarRed([listaDelServidor('agreement', muchos)])
    montar(<AcuerdosPage />, { ruta: '/agreements', camino: '/agreements', usuario: GERENCIA_SOCIAL, permisos: EQUIPO })
    const tabla = await screen.findByRole('table', { name: 'Acuerdos' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(26)
    expect(screen.getByText('27 acuerdos')).toBeInTheDocument()
    expect(screen.queryByText(/Se muestran los primeros/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /siguiente|next/i }))
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Acuerdos' })).getAllByRole('row')).toHaveLength(3))
    expect(red.a('GET', '/objects/agreement/records').map((l) => l.ruta)).toContain('/objects/agreement/records?sort=code&dir=asc&page=1&size=25')
  })

  // 05-especificacion §1.6 y DD-05: el código y el vencimiento se ordenan en el servidor; el orden dura la visita
  it('el acuerdo (por su código) y el vencimiento ordenan en el servidor, con aria-sort, y otro orden vuelve a la primera página', async () => {
    const muchos = Array.from({ length: 27 }, (_, i) =>
      registro(`ag${i + 10}`, {
        ...SERVIDUMBRE.attributes,
        code: `A-${100 + i}`,
        title: `Acuerdo ${i}`,
        expiry_date: `2027-01-${String(27 - i).padStart(2, '0')}`
      })
    )
    fetch = mockFetch(rutas())
    red = espiarRed([listaDelServidor('agreement', muchos)])
    montar(<AcuerdosPage />, { ruta: '/agreements?page=1', camino: '/agreements', usuario: GERENCIA_SOCIAL, permisos: EQUIPO })
    const tabla = () => screen.getByRole('table', { name: 'Acuerdos' })
    await screen.findByRole('table', { name: 'Acuerdos' })
    expect(within(tabla()).getByRole('columnheader', { name: 'Acuerdo' })).toHaveAttribute('aria-sort', 'ascending')
    // el tipo, desde xl (DD-05); el estado y la vigencia no se ordenan
    expect(within(tabla()).getByRole('columnheader', { name: 'Tipo' })).toHaveClass('hidden', 'xl:table-cell')
    for (const c of ['Estado', 'Vigencia']) expect(within(tabla()).queryByRole('button', { name: c })).not.toBeInTheDocument()
    const rutasPedidas = () => red!.a('GET', '/objects/agreement/records').map((l) => l.ruta)
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Vence' }))
    await waitFor(() => expect(rutasPedidas()).toContain('/objects/agreement/records?sort=expiry_date&dir=asc&page=0&size=25'))
    // el orden viaja en la URL (tercera pasada de UX, 3.6; DD-37): volver de una ficha lo conserva
    expect(ubicacion.actual).toBe('/agreements?sort=vence&dir=asc')
    await waitFor(() => expect(within(tabla()).getAllByRole('row')).toHaveLength(26))
    expect(within(tabla()).getAllByRole('row')[1]).toHaveTextContent('A-126')
    expect(within(tabla()).getByRole('columnheader', { name: 'Vence' })).toHaveAttribute('aria-sort', 'ascending')
    expect(within(tabla()).getByRole('columnheader', { name: 'Acuerdo' })).not.toHaveAttribute('aria-sort')
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Acuerdo' }))
    await waitFor(() => expect(rutasPedidas()).toContain('/objects/agreement/records?sort=code&dir=asc&page=0&size=25'))
    await waitFor(() => expect(within(tabla()).getAllByRole('row')[1]).toHaveTextContent('A-100'))
  })

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

  // revisión de UX, etapa 4: la anatomía común (camino del flujo, panel de decisión con la vigencia, trazabilidad)
  it('la ficha dice el camino del flujo, su vigencia en el panel de decisión y los tres grupos de trazabilidad', async () => {
    fetch = mockFetch(rutas())
    montar(<FichaAcuerdoPage />, {
      ruta: '/projects/p1/agreements/ag1',
      camino: '/projects/:projectId/agreements/:agreementId',
      usuario: GERENCIA_SOCIAL,
      permisos: EQUIPO
    })
    expect(await abrirCamino()).toBeInTheDocument()
    expect(estadosDeLaFicha()).toHaveLength(1)
    expect(screen.getByRole('group', { name: 'Vencimiento' })).toBeInTheDocument()
    const panel = screen.getByRole('complementary', { name: 'Trazabilidad' })
    expect(
      within(panel)
        .getAllByRole('region')
        .map((r) => r.getAttribute('aria-label'))
    ).toEqual(['De dónde viene', 'Qué generó', 'Lo sustenta'])
    expect(screen.queryByRole('link', { name: 'Acuerdos del proyecto' })).not.toBeInTheDocument()
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

// P-09 del rediseño de UX (DD-02 y DD-06; U-03, U-25, U-26 y U-27): el antetítulo en sans, el estado una sola vez (en el panel
// de decisión), una sola primaria, terminar en «Más acciones» y lo acordado y la vigencia en sus secciones, con lo vacío plegado
describe('S33 · cabecera y cuerpo de la ficha (P-09)', () => {
  it('una sola primaria, terminar en «Más acciones», el estado una sola vez y las fechas sin dato plegadas', async () => {
    fetch = mockFetch(
      rutas([
        { path: '/objects/agreement/records/ag1', body: { ...SERVIDUMBRE, attributes: { ...SERVIDUMBRE.attributes, expiry_date: null } } },
        {
          path: '/objects/agreement/records/ag1/transitions',
          body: [
            { name: 'terminate', label: 'Terminar', to: 'terminated', toLabel: 'Terminado', allowed: true, reason: null },
            { name: 'activate', label: 'Registrar vigencia', to: 'active', toLabel: 'Vigente', allowed: true, reason: null }
          ]
        }
      ])
    )
    montar(<FichaAcuerdoPage />, { ruta: '/projects/p1/agreements/ag1', ...FICHA })
    const titulo = await screen.findByRole('heading', { name: 'Servidumbre del acceso norte', level: 1 })
    const cabecera = titulo.parentElement!
    expect(within(cabecera).getByText(/^Acuerdo · A-001/)).not.toHaveClass('font-sg-mono')
    expect(within(cabecera).queryByText('En negociación')).not.toBeInTheDocument()
    const acciones = await screen.findByRole('group', { name: 'Acciones del registro' })
    expect(await within(acciones).findByRole('button', { name: 'Registrar vigencia' })).toHaveAttribute('data-variant', 'primary')
    // a la vista, una sola primaria: «Vincular» confirma el formulario plegado de un predio
    expect([...document.querySelectorAll('[data-variant="primary"]')].filter((b) => !b.closest('details:not([open])'))).toHaveLength(1)
    expect(within(acciones).queryByRole('button', { name: /^Terminar/ })).not.toBeInTheDocument()
    await userEvent.click(within(acciones).getByRole('button', { name: 'Más acciones' }))
    expect(within(screen.getByRole('group', { name: 'Más acciones' })).getByRole('button', { name: /^Terminar/ })).toBeInTheDocument()
    expect(await screen.findAllByText('En negociación', { selector: '[data-estado]' })).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Qué se acordó' })).toHaveTextContent('Paso por el predio comunal')
    const vigencia = screen.getByRole('region', { name: 'Vigencia' })
    expect(within(vigencia).getByText('Firmado')).toBeInTheDocument()
    expect(within(vigencia).queryByText('Hasta')).not.toBeInTheDocument()
    await userEvent.click(within(vigencia).getByRole('button', { name: /^Mostrar (el campo|los \d+ campos) sin dato$/ }))
    expect(within(vigencia).getByText('Hasta')).toBeInTheDocument()
  })
})
