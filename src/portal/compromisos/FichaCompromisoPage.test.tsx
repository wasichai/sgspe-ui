import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { useNavigate, type NavigateFunction } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeCompromisos, C1, EQUIPO_DE_COMPROMISOS, GESTORA } from '../../test/compromisos'
import { definicion, montar, pagina, registro, workflow } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import type { Registro } from '../datos/registros'
import { FichaCompromisoPage } from './FichaCompromisoPage'

vi.mock('../documentos/exif', () => ({ leerExif: async () => ({}) }))

// S29 (flujos 9 a 11): la ficha con las transiciones del rol comprobadas antes, sus pestañas, el detalle de beneficiarios
// restringido, la trazabilidad, la edición con motivo y sin la fecha desde la aprobación, y la verificación cuando está cumplido
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const rutas = (compromiso: Registro = C1, extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  { path: '/objects/commitment/records/c1', body: compromiso },
  {
    path: '/objects/commitment/records/c1/transitions',
    body: [
      { name: 'register_fulfillment', label: 'Registrar cumplimiento', to: 'fulfilled', toLabel: 'Cumplido', allowed: true, reason: null },
      { name: 'block', label: 'Bloquear', to: 'blocked', toLabel: 'Bloqueado', allowed: true, reason: null },
      { name: 'verify', label: 'Verificar', to: 'verified', toLabel: 'Verificado', allowed: true, reason: null }
    ]
  },
  {
    method: 'POST',
    path: '/sgspe/transition-checks',
    body: { allowed: false, blocking: [{ code: 'DELIVERY_REQUIRED', message: 'Falta una entrega con conformidad', field: 'delivery' }], warnings: [] }
  },
  { path: '/objects/commitment/records/c1/related/commitment_stakeholder', body: pagina([registro('s1', { project: 'p1', organization: 'o1' })]) },
  { path: '/objects/organization/records/o1', body: registro('o1', { name: 'Junta de regantes' }) },
  { path: '/objects/engagement/records/e1', body: registro('e1', { project: 'p1', title: 'Asamblea de agosto' }) },
  { path: '/objects/commitment_candidate/records', body: pagina([]) },
  { path: '/objects/task/workflow', body: workflow('task', [['open', 'Abierta']]) },
  { path: '/objects/task/records', body: pagina([registro('t1', { project: 'p1', title: 'Ejecutar compromiso C-001', commitment: 'c1' }, { state: 'open' })]) },
  { path: '/objects/delivery/records', body: pagina([]) },
  { path: '/objects/commitment/records/c1/history', body: [] }
]
const abrir = () =>
  montar(<FichaCompromisoPage />, {
    ruta: '/projects/p1/commitments/c1',
    camino: '/projects/:projectId/commitments/:commitmentId',
    usuario: GESTORA,
    permisos: EQUIPO_DE_COMPROMISOS
  })

describe('S29 · ficha de compromiso', () => {
  it('dice el estado, la situación y el monto; el cumplimiento sin entrega sale deshabilitado con su razón', async () => {
    fetch = mockFetch(rutas())
    abrir()
    expect(await screen.findByRole('heading', { name: 'Reservorio de agua para Tunas Pampa', level: 1 })).toBeInTheDocument()
    expect(screen.getByLabelText('Situación de plazo: Al día')).toBeInTheDocument()
    const cumplimiento = await screen.findByRole('button', { name: 'Registrar cumplimiento' })
    await waitFor(() => expect(cumplimiento).toBeDisabled())
    expect(cumplimiento).toHaveAccessibleDescription('Falta una entrega con conformidad')
    expect(screen.getByRole('button', { name: 'Bloquear' })).toBeEnabled()
  })

  it('approve_direct en un proyecto con aprobación interna sale deshabilitado con INTERNAL_APPROVAL_REQUIRED, la primera regla (P53)', async () => {
    fetch = mockFetch(
      rutas({ ...C1, state: 'draft' }, [
        {
          path: '/objects/commitment/records/c1/transitions',
          body: [{ name: 'approve_direct', label: 'Aprobar directamente', to: 'approved', toLabel: 'Aprobado', allowed: true, reason: null }]
        },
        {
          method: 'POST',
          path: '/sgspe/transition-checks',
          body: {
            allowed: false,
            blocking: [{ code: 'INTERNAL_APPROVAL_REQUIRED', message: 'El proyecto exige la aprobación interna: envíelo a aprobación', field: 'project' }],
            warnings: []
          }
        }
      ])
    )
    abrir()
    const directa = await screen.findByRole('button', { name: 'Aprobar directamente' })
    await waitFor(() => expect(directa).toBeDisabled())
    expect(directa).toHaveAccessibleDescription('El proyecto exige la aprobación interna: envíelo a aprobación')
  })

  it('el resumen dice los solicitantes y «Restringido» en el detalle que no lee; la trazabilidad enlaza origen y tareas', async () => {
    fetch = mockFetch(rutas())
    abrir()
    expect(await screen.findByRole('link', { name: 'Junta de regantes' })).toHaveAttribute('href', '/projects/p1/stakeholders/s1')
    expect(screen.getByText('Restringido')).toBeInTheDocument()
    expect(screen.getByText('Ejecutado: S/ 10,000.00 de S/ 25,000.00')).toBeInTheDocument()
    // las opciones del resumen se ven con su rótulo, no en mayúsculas
    expect(screen.getByText('Formal')).toBeInTheDocument()
    expect(screen.getByText('Social')).toBeInTheDocument()
    const deDonde = screen.getByRole('region', { name: 'De dónde viene' })
    expect(await within(deDonde).findByRole('link', { name: 'Asamblea de agosto' })).toHaveAttribute('href', '/projects/p1/engagements/e1')
    const genero = screen.getByRole('region', { name: 'Qué generó' })
    expect(await within(genero).findByRole('link', { name: 'Ejecutar compromiso C-001' })).toHaveAttribute('href', '/projects/p1/tasks?task=t1')
  })

  it('la queja de origen que la cuenta no lee (confidencial) es «Registro reservado»; el riesgo que atiende se enlaza', async () => {
    fetch = mockFetch(
      rutas({ ...C1, attributes: { ...C1.attributes, origin_engagement: null, origin_grievance: 'g9', social_risk: 'k1' } }, [
        { path: '/objects/grievance/records/g9', status: 404, body: { title: 'Not Found', status: 404 } },
        { path: '/objects/social_risk/records/k1', body: registro('k1', { project: 'p1', code: 'R-001', title: 'Bloqueo de la vía' }) }
      ])
    )
    abrir()
    const deDonde = await screen.findByRole('region', { name: 'De dónde viene' })
    expect(await within(deDonde).findByText('Registro reservado')).toBeInTheDocument()
    expect(within(deDonde).queryByText('Registrado directamente.')).not.toBeInTheDocument()
    expect(await within(deDonde).findByRole('link', { name: 'R-001 · Bloqueo de la vía' })).toHaveAttribute('href', '/projects/p1/risks/k1')
  })

  it('un compromiso que la cuenta no lee dice «No disponible», sin reintento', async () => {
    fetch = mockFetch(rutas(C1, [{ path: '/objects/commitment/records/c1', status: 403, body: { title: 'Forbidden', status: 403, detail: 'NOT_ASSIGNED' } }]))
    abrir()
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('un compromiso que no existe lo dice con su texto, sin reintento', async () => {
    fetch = mockFetch(rutas(C1, [{ path: '/objects/commitment/records/c1', status: 404, body: { title: 'Not Found', status: 404 } }]))
    abrir()
    expect(await screen.findByText('Este compromiso no existe o no es de sus proyectos.')).toBeInTheDocument()
    expect(screen.queryByText('No se pudo cargar esta información. Los filtros se conservan.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compromisos del proyecto' })).toHaveAttribute('href', '/projects/p1/commitments')
  })

  it('una lectura de la trazabilidad que falla lo dice, junto a lo que no se pudo leer', async () => {
    fetch = mockFetch(
      rutas({ ...C1, attributes: { ...C1.attributes, origin_engagement: null, agreement: 'ag1', agreement_clause: 'cl1' } }, [
        { path: '/objects/agreement/records/ag1', body: registro('ag1', { project: 'p1', code: 'A-001', title: 'Convenio de agua' }) },
        { path: '/objects/agreement_clause/records/cl1', status: 403, body: { title: 'Forbidden', status: 403, detail: 'OBJECT_NOT_READABLE' } },
        { path: '/objects/commitment_candidate/records', status: 500, body: { title: 'Error', status: 500 } },
        { path: '/objects/delivery/records', status: 500, body: { title: 'Error', status: 500 } }
      ])
    )
    abrir()
    const deDonde = await screen.findByRole('region', { name: 'De dónde viene' })
    expect(await within(deDonde).findByRole('link', { name: 'A-001 · Convenio de agua' })).toBeInTheDocument()
    const clausula = await within(deDonde).findByText('Cláusula:')
    expect(within(clausula.parentElement!).getByText('No disponible')).toBeInTheDocument()
    const candidato = within(deDonde).getByText('Candidato aceptado:')
    expect(within(candidato.parentElement!).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    // sin los candidatos no se sabe si se registró directamente
    expect(within(deDonde).queryByText('Registrado directamente.')).not.toBeInTheDocument()
    const genero = screen.getByRole('region', { name: 'Qué generó' })
    const entregas = await within(genero).findByText('Entregas:')
    expect(within(entregas.parentElement!).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('el detalle de beneficiarios que se lee y viene vacío es «—»; el que no se lee, «Restringido»', async () => {
    fetch = mockFetch(rutas({ ...C1, attributes: { ...C1.attributes, beneficiaries_detail: null } }))
    const vista = abrir()
    const vacio = await screen.findByText('Detalle de beneficiarios')
    expect(vacio.nextElementSibling).toHaveTextContent(/^—$/)
    expect(screen.queryByText('Restringido')).not.toBeInTheDocument()
    vista.unmount()
    fetch.restore()
    fetch = mockFetch(rutas())
    abrir()
    const restringido = await screen.findByText('Detalle de beneficiarios')
    expect(within(restringido.parentElement!).getByText('Restringido')).toBeInTheDocument()
  })

  it('editar un compromiso aprobado no ofrece la fecha y manda el motivo', async () => {
    fetch = mockFetch(
      rutas(C1, [
        { path: '/metadata/objects/commitment', body: definicion('commitment', ['title', ['due_date', { type: 'DATE' }], 'description']) },
        { method: 'PUT', path: '/objects/commitment/records/c1', body: C1 }
      ])
    )
    red = espiarRed()
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar el compromiso' }))
    const panel = await screen.findByRole('dialog')
    expect(within(panel).getByText('Desde la aprobación, la fecha de vencimiento solo cambia con una reprogramación.')).toBeInTheDocument()
    expect(await within(panel).findByLabelText(/^title/)).toBeInTheDocument()
    expect(within(panel).queryByLabelText(/^due_date/)).not.toBeInTheDocument()
    await userEvent.type(within(panel).getByLabelText('Motivo del cambio (obligatorio)'), 'Título más claro')
    await userEvent.clear(within(panel).getByLabelText(/^title/))
    await userEvent.type(within(panel).getByLabelText(/^title/), 'Reservorio de Tunas Pampa')
    await userEvent.click(within(panel).getByRole('button', { name: /Guardar|Save/ }))
    await waitFor(() => expect(red!.a('PUT', '/objects/commitment/records/c1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/commitment/records/c1')
    expect(cambio.cabeceras.get('X-Change-Reason')).toBe("UTF-8''T%C3%ADtulo%20m%C3%A1s%20claro")
    expect(cambio.cabeceras.get('If-Match')).toBe('"2026-10-05T15:00:00.123456Z"')
  })

  it('cumplido, muestra el panel de verificación', async () => {
    fetch = mockFetch(rutas({ ...C1, state: 'fulfilled' }))
    abrir()
    expect(await screen.findByRole('region', { name: 'Verificación' })).toBeInTheDocument()
    expect(screen.getByText('Usted es responsable de este compromiso: otra persona lo verifica.')).toBeInTheDocument()
  })

  it('las pestañas montan acciones, entregas y reprogramaciones del compromiso', async () => {
    fetch = mockFetch(
      rutas(C1, [
        { path: '/objects/commitment_action/records', body: pagina([]) },
        { path: '/objects/commitment_milestone/records', body: pagina([]) },
        { path: '/objects/commitment_reschedule/records', body: pagina([]) }
      ])
    )
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: 'Entregas' }))
    expect(await screen.findByText('Todavía no hay entregas registradas.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Reprogramaciones' }))
    expect(await screen.findByText('Este compromiso no se ha reprogramado.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Acciones e hitos' }))
    expect(await screen.findByText('Todavía no hay acciones registradas.')).toBeInTheDocument()
  })

  // P63: al pasar entre dos compromisos ya leídos (en caché, sin «Cargando» de por medio) nada de uno queda en el otro: ni el
  // drawer abierto con su motivo tecleado ni la pestaña elegida
  it('al pasar a otro compromiso ya leído no arrastra el drawer, el motivo ni la pestaña del anterior (P63)', async () => {
    const C2 = registro(
      'c2',
      { ...C1.attributes, code: 'C-002', title: 'Canal de riego de Tunas Pampa', origin_engagement: null },
      { state: 'in_progress', updatedAt: '2026-10-06T15:00:00Z' }
    )
    fetch = mockFetch(
      rutas(C1, [
        { path: '/metadata/objects/commitment', body: definicion('commitment', ['title', 'description']) },
        { path: '/objects/commitment/records/c2', body: C2 },
        { path: '/objects/commitment/records/c2/transitions', body: [] },
        { path: '/objects/commitment/records/c2/related/commitment_stakeholder', body: pagina([]) },
        { path: '/objects/commitment/records/c2/history', body: [] },
        { path: '/objects/commitment_reschedule/records', body: pagina([]) }
      ])
    )
    let ir: NavigateFunction = () => undefined
    function Navegador() {
      ir = useNavigate()
      return null
    }
    montar(
      <>
        <Navegador />
        <FichaCompromisoPage />
      </>,
      { ruta: '/projects/p1/commitments/c1', camino: '/projects/:projectId/commitments/:commitmentId', usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS }
    )
    expect(await screen.findByRole('heading', { name: 'Reservorio de agua para Tunas Pampa', level: 1 })).toBeInTheDocument()
    act(() => void ir('/projects/p1/commitments/c2'))
    expect(await screen.findByRole('heading', { name: 'Canal de riego de Tunas Pampa', level: 1 })).toBeInTheDocument()
    act(() => void ir('/projects/p1/commitments/c1'))
    // c1 ya está en la caché: se dibuja en el acto
    expect(screen.getByRole('heading', { name: 'Reservorio de agua para Tunas Pampa', level: 1 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Reprogramaciones' }))
    expect(screen.getByRole('tab', { name: 'Reprogramaciones' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Editar el compromiso' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.type(within(panel).getByLabelText('Motivo del cambio (obligatorio)'), 'Motivo de C-001')
    act(() => void ir('/projects/p1/commitments/c2'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Canal de riego de Tunas Pampa', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Editar el compromiso' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Motivo del cambio (obligatorio)')).toHaveValue('')
  })
})
