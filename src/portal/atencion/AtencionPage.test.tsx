import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeAtencion, CANALES, CONSULTA, EQUIPO_DE_QUEJAS, GESTORA_DE_QUEJAS, QUEJA, SOLICITUD } from '../../test/atencion'
import { P1 } from '../../test/compromisos'
import { montar, pagina, registro } from '../../test/montar'
import { permisos } from '../../test/portal'
import { AtencionPage, enVista, grupoDe } from './AtencionPage'

// S35 (screens.md §8): las tres QCS unidas por plazo, cada una con el estado de su workflow y el plazo que corre en él; las vistas,
// los filtros, «anónima» en lugar de la persona, las cifras con la nota de confidenciales y nunca un vacío mientras carga
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const VENCIDA = registro(
  'g2',
  { ...QUEJA.attributes, code: 'Q-002', severity: 'MEDIA', deadline_status: 'VENCIDO', ack_due_date: '2026-10-05', owner_user_id: 'u-otro', anonymous: true },
  { state: 'received' }
)
const CERRADA = registro('g3', { ...QUEJA.attributes, code: 'Q-003', deadline_status: null }, { state: 'closed' })
const POR_VENCER = registro('i2', { ...CONSULTA.attributes, code: 'C-002', deadline_status: 'POR VENCER' }, { state: 'received' })

const indicador = (code: string, value: number, extra: Record<string, unknown> = {}) => ({
  path: `/sgspe/dashboards/indicators/${code}`,
  body: { code, label: '', available: true, value, ...extra }
})

const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeAtencion(),
  { path: '/objects/grievance/records', body: pagina([QUEJA, VENCIDA, CERRADA]) },
  { path: '/objects/inquiry/records', body: pagina([CONSULTA, POR_VENCER]) },
  { path: '/objects/stakeholder_request/records', body: pagina([SOLICITUD]) },
  { path: '/objects/project/records', body: pagina([P1]) },
  indicador('KPI-GRV-02', 4),
  indicador('KPI-GRV-06', 1),
  indicador('KPI-GRV-07', 2, { confidentialHidden: true })
]

const abrir = (p = EQUIPO_DE_QUEJAS, ruta = '/projects/p1/attention') =>
  montar(<AtencionPage />, { ruta, camino: '/projects/:projectId/attention', usuario: GESTORA_DE_QUEJAS, permisos: p })

describe('S35 · lista unificada de QCS', () => {
  it('agrupa las abiertas por su situación de plazo, con el plazo que corre en su estado y el registro para quien escribe', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const vencidas = await screen.findByRole('table', { name: 'Quejas, consultas y solicitudes: Vencidas' })
    expect(within(vencidas).getByRole('link', { name: 'Q-002' })).toHaveAttribute('href', '/projects/p1/grievances/g2')
    expect(within(vencidas).getByText('anónima')).toBeInTheDocument()
    expect(within(vencidas).getByLabelText('Situación de plazo: VENCIDO')).toBeInTheDocument()
    const porVencer = screen.getByRole('table', { name: 'Quejas, consultas y solicitudes: Por vencer' })
    expect(within(porVencer).getByRole('link', { name: 'C-002' })).toHaveAttribute('href', '/projects/p1/inquiries/i2')
    const alDia = screen.getByRole('table', { name: 'Quejas, consultas y solicitudes: Al día o sin plazo' })
    expect(within(alDia).getByRole('link', { name: 'S-001' })).toHaveAttribute('href', '/projects/p1/requests/r1')
    expect(within(alDia).getByText('Sin plazo')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Q-003' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar QCS' })).toHaveAttribute('href', '/projects/p1/attention/new')
  })

  it('las cifras salen de los indicadores y «por vencer» de la lista; con confidencialidad excluida lo dice', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const cifras = await screen.findByRole('region', { name: 'Indicadores' })
    expect(await within(cifras).findByRole('region', { name: 'Por vencer' })).toHaveTextContent('1')
    expect(await within(cifras).findByRole('region', { name: 'Abiertas' })).toHaveTextContent('4')
    expect(await within(cifras).findByRole('note')).toHaveTextContent('no incluye las QCS confidenciales')
  })

  it('las vistas por tipo y «Mis QCS», y los filtros de búsqueda y severidad', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await screen.findByRole('link', { name: 'Q-001' })
    await userEvent.click(screen.getByRole('tab', { name: 'Consultas' }))
    expect(screen.queryByRole('link', { name: 'Q-001' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'C-001' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Mis QCS' }))
    expect(screen.getByRole('link', { name: 'Q-001' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Q-002' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Todas' }))
    expect(screen.getByRole('link', { name: 'Q-003' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Buscar por código o descripción'), 'turbio')
    expect(screen.getAllByRole('link', { name: /^[QCS]-\d+$/ }).map((l) => l.textContent)).toEqual(['Q-002', 'Q-001', 'Q-003'])
    await userEvent.selectOptions(screen.getByLabelText('Severidad'), 'MEDIA')
    expect(screen.getAllByRole('link', { name: /^[QCS]-\d+$/ }).map((l) => l.textContent)).toEqual(['Q-002'])
  })

  it('solo lee los tipos que la cuenta lee y, mientras carga, no dice que no hay QCS', async () => {
    fetch = mockFetch(rutas())
    abrir(permisos({ project: ['READ'], project_assignment: ['READ'], inquiry: ['READ'] }))
    expect(screen.queryByText('No hay quejas, consultas ni solicitudes en esta vista.')).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'C-001' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Q-001' })).not.toBeInTheDocument()
    expect(fetch.calls.some((c) => c.url.includes('/objects/grievance/records'))).toBe(false)
    expect(screen.queryByRole('link', { name: 'Registrar QCS' })).not.toBeInTheDocument()
  })

  it('los filtros salen de la definición de un tipo que la cuenta lee; «Severidad» solo para quien lee quejas', async () => {
    fetch = mockFetch(rutas())
    abrir(permisos({ project: ['READ'], project_assignment: ['READ'], inquiry: ['READ'] }))
    await screen.findByRole('link', { name: 'C-001' })
    const canal = screen.getByLabelText('Canal')
    expect(within(canal).getByRole('option', { name: CANALES[0] })).toBeInTheDocument()
    expect(screen.queryByLabelText('Severidad')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Severidad' })).not.toBeInTheDocument()
    expect(fetch.calls.some((c) => c.url.includes('/metadata/objects/grievance'))).toBe(false)
  })

  it('sin ninguna QCS legible «Por vencer» dice «No disponible», no cero', async () => {
    fetch = mockFetch(rutas())
    abrir(permisos({ project: ['READ'], project_assignment: ['READ'] }))
    const porVencer = await within(await screen.findByRole('region', { name: 'Indicadores' })).findByRole('region', { name: 'Por vencer' })
    expect(porVencer).toHaveTextContent('No disponible')
    expect(porVencer).not.toHaveTextContent('0')
  })

  it('un fallo de lectura se dice con su reintento, no como una lista vacía', async () => {
    fetch = mockFetch(rutas([{ path: '/objects/inquiry/records', status: 500, body: { title: 'Error', status: 500, detail: 'caído' } }]))
    abrir()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('No hay quejas, consultas ni solicitudes en esta vista.')).not.toBeInTheDocument()
  })

  it('una QCS cerrada no está en Atención y un plazo solo cuenta en su estado', () => {
    expect(enVista('atencion', { objeto: 'grievance', registro: CERRADA }, 'u-gvm')).toBe(false)
    expect(grupoDe({ objeto: 'grievance', registro: registro('x', { deadline_status: 'VENCIDO' }, { state: 'resolved' }) })).toBe('alDia')
  })
})
