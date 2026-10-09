import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APROBADORA, baseDeCompromisos, C1 } from '../../test/compromisos'
import { montar, pagina, registro, ubicacion } from '../../test/montar'
import { permisos } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import type { Aviso } from '../datos/avisos'
import { AprobacionesPage } from './AprobacionesPage'
import { AprobacionPage } from './AprobacionPage'

// S48 y S31 (flujo 8): la bandeja sale de los avisos de aprobación pendiente; «¿Puede decidir?» dice siempre por qué no (D4,
// D5, D7); la decisión pide motivo, se comprueba con transition-checks y se aplica con la versión leída
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const PENDIENTE = { ...C1, state: 'pending_approval', updatedAt: '2026-10-08T15:00:00Z' }
const OTRO = registro('c7', { project: 'p1', code: 'C-007', title: 'Botiquín', amount: 800, currency: 'PEN' }, { state: 'pending_approval' })
const aviso = (id: string, objeto: string, registroId: string, fuente = 'sgspe.approvals'): Aviso => ({
  id,
  kind: 'ACTION',
  title: `Pendiente ${registroId}`,
  body: null,
  link: { type: 'RECORD', object: objeto, recordId: registroId },
  publishAt: '2026-10-06T15:00:00Z',
  expiresAt: null,
  dueAt: null,
  overdue: false,
  source: fuente,
  read: false,
  snoozedUntil: null,
  dismissible: false
})
const APROBAR = { name: 'approve', label: 'Aprobar', to: 'approved', toLabel: 'Aprobado', allowed: true, reason: null }
const DEVOLVER = { name: 'return_to_draft', label: 'Devolver a borrador', to: 'draft', toLabel: 'Borrador', allowed: true, reason: null }
const SEGREGACION = { code: 'SEGREGATION_OF_DUTIES', message: 'Usted registró este compromiso: lo aprueba otra persona (D4)', field: 'record' }

const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(APROBADORA),
  {
    path: '/auth/me/notifications',
    body: {
      content: [aviso('n1', 'commitment', 'c1'), aviso('n2', 'commitment', 'c7'), aviso('n3', 'commitment', 'c1', 'sgspe.deadlines')],
      page: 0,
      size: 200,
      totalElements: 3,
      totalPages: 1
    }
  },
  { path: '/objects/commitment/records/c1', body: PENDIENTE },
  { path: '/objects/commitment/records/c7', body: OTRO },
  { path: /^\/objects\/commitment\/records\/c\d\/transitions/, body: [APROBAR, DEVOLVER] },
  { path: '/objects/engagement/records/e1', body: registro('e1', { title: 'Mesa de diálogo de agosto', engagement_type: 'MESA DE DIALOGO' }) },
  { path: '/objects/exploration_campaign/records/camp1', body: registro('camp1', { name: 'Campaña 2026' }) }
]
// D4 bloquea la aprobación de c1; devolver no tiene reglas
const reglas = () =>
  espiarRed([
    {
      method: 'POST',
      path: '/sgspe/transition-checks',
      responder: (l) => {
        const { recordId, transition } = l.cuerpo as { recordId: string; transition: string }
        return jsonResponse(
          recordId === 'c1' && transition === 'approve'
            ? { allowed: false, blocking: [SEGREGACION], warnings: [] }
            : { allowed: true, blocking: [], warnings: [] }
        )
      }
    }
  ])
const APROBACION = permisos({
  project: ['READ'],
  project_assignment: ['READ'],
  commitment: ['READ', 'UPDATE', 'APPROVE'],
  engagement: ['READ'],
  exploration_campaign: ['READ']
})

describe('S48 · aprobaciones', () => {
  it('lista solo las aprobaciones pendientes, con el monto, la espera y por qué no se puede decidir', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-09T15:00:00Z'))
    fetch = mockFetch(rutas())
    red = reglas()
    montar(<AprobacionesPage />, { ruta: '/tasks/approvals', camino: '/tasks/approvals', usuario: APROBADORA, permisos: APROBACION })
    const tabla = await screen.findByRole('table', { name: 'Por aprobar' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(3)
    const fila = (await within(tabla).findByText('C-001 · Reservorio de agua para Tunas Pampa')).closest('tr') as HTMLElement
    expect(within(fila).getByText('S/ 25,000.00')).toBeInTheDocument()
    expect(within(fila).getByText('3 días')).toBeInTheDocument()
    expect(await within(fila).findByText('No: Usted registró este compromiso: lo aprueba otra persona (D4)')).toBeInTheDocument()
    expect(within(fila).getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', '/tasks/approvals/commitment/c1')
    const otra = (await within(tabla).findByText('C-007 · Botiquín')).closest('tr') as HTMLElement
    expect(await within(otra).findByText('Sí')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Escalamientos' }))
    expect(await screen.findByRole('heading', { name: 'Pendiente c1' })).toBeInTheDocument()
  })

  it('sin el módulo de avisos lo dice en lugar de una bandeja vacía', async () => {
    fetch = mockFetch(rutas().filter((r) => r.path !== '/auth/me/notifications'))
    montar(<AprobacionesPage />, { ruta: '/tasks/approvals', camino: '/tasks/approvals', usuario: APROBADORA, permisos: APROBACION })
    expect(await screen.findByText(/Los avisos no están disponibles en esta instalación/)).toBeInTheDocument()
    expect(screen.queryByText('No tiene decisiones pendientes.')).not.toBeInTheDocument()
  })
})

describe('S31 · aprobación de compromiso', () => {
  it('la regla que bloquea deshabilita la decisión y dice por qué; devolver pide motivo y se aplica con la versión leída', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/objects/commitment/records/c1/transitions/return_to_draft', body: { ...PENDIENTE, state: 'draft' } }]))
    red = reglas()
    montar(<AprobacionPage />, {
      ruta: '/tasks/approvals/commitment/c1',
      camino: '/tasks/approvals/commitment/:recordId',
      usuario: APROBADORA,
      permisos: APROBACION
    })
    expect(await screen.findByRole('link', { name: 'Mesa de diálogo de agosto · MESA DE DIALOGO' })).toHaveAttribute('href', '/projects/p1/engagements/e1')
    const reglasDelPanel = screen.getByRole('complementary', { name: 'Reglas' })
    expect(await within(reglasDelPanel).findByText('Usted registró este compromiso: lo aprueba otra persona (D4)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar la decisión' })).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: 'Devolver a borrador' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar la decisión' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar la decisión' }))
    expect(await screen.findByText('Escriba el motivo del cambio')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Falta el acta firmada')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar la decisión' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/tasks/approvals'))
    const [llamada] = red.a('POST', '/objects/commitment/records/c1/transitions/return_to_draft')
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-08T15:00:00Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Falta%20el%20acta%20firmada")
  })

  it('un monto guardado inválido de la campaña es una advertencia de CAP_DATA_INVALID que se dice y no bloquea', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/transition-checks',
        responder: () =>
          jsonResponse({
            allowed: true,
            blocking: [],
            warnings: [{ code: 'CAP_DATA_INVALID', message: 'Un monto de la campaña no es válido: el tope no se verificó', field: 'exploration_campaign' }]
          })
      }
    ])
    montar(<AprobacionPage />, {
      ruta: '/tasks/approvals/commitment/c1',
      camino: '/tasks/approvals/commitment/:recordId',
      usuario: APROBADORA,
      permisos: APROBACION
    })
    const reglasDelPanel = await screen.findByRole('complementary', { name: 'Reglas' })
    expect(await within(reglasDelPanel).findByText('Un monto de la campaña no es válido: el tope no se verificó')).toBeInTheDocument()
    expect(within(reglasDelPanel).queryByText('CAP_DATA_INVALID')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar la decisión' })).toBeEnabled())
  })

  it('sin asignación vigente lee el compromiso y no decide', async () => {
    fetch = mockFetch([
      ...rutas().filter((r) => !(r.path instanceof RegExp && String(r.path).includes('project_assignment'))),
      { path: /^\/objects\/project_assignment\/records/, body: pagina([]) }
    ])
    red = reglas()
    montar(<AprobacionPage />, {
      ruta: '/tasks/approvals/commitment/c1',
      camino: '/tasks/approvals/commitment/:recordId',
      usuario: APROBADORA,
      permisos: APROBACION
    })
    expect(await screen.findByText('No tiene una asignación vigente a este proyecto: puede leer, no decidir.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})
