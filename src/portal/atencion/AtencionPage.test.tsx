import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeAtencion, CANALES, CONSULTA, EQUIPO_DE_QUEJAS, GESTORA_DE_QUEJAS, QUEJA, SOLICITUD } from '../../test/atencion'
import { P1 } from '../../test/compromisos'
import { montar, pagina, registro } from '../../test/montar'
import { permisos } from '../../test/portal'
import { AtencionPage } from './AtencionPage'
import { colaDelServidor } from '../../test/colaDeAtencion'
import { espiarRed, type Red, type RutaEspecial } from '../../test/red'
import type { ObjetoDeQcs } from '../datos/atencion'
import type { Registro } from '../datos/registros'
import { rotuloDeOpcion } from '../datos/opciones'

// S35 (screens.md §8): las tres QCS unidas por plazo, cada una con el estado de su workflow y el plazo que corre en él; las vistas,
// los filtros, «anónima» en lugar de la persona, las cifras con la nota de confidenciales y nunca un vacío mientras carga
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
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
  { path: '/objects/project/records', body: pagina([P1]) },
  indicador('KPI-GRV-02', 4),
  indicador('KPI-GRV-06', 1),
  indicador('KPI-GRV-07', 2, { confidentialHidden: true })
]

// la cola la contesta el servidor emulado (decisión 5 y D10 de la revisión de UX), con los tipos que la cuenta lee
const TODAS: Partial<Record<ObjetoDeQcs, Registro[]>> = {
  grievance: [QUEJA, VENCIDA, CERRADA],
  inquiry: [CONSULTA, POR_VENCER],
  stakeholder_request: [SOLICITUD]
}
const abrir = (
  p = EQUIPO_DE_QUEJAS,
  ruta = '/projects/p1/attention',
  {
    porTipo = TODAS,
    legibles,
    especiales = []
  }: { porTipo?: Partial<Record<ObjetoDeQcs, Registro[]>>; legibles?: ObjetoDeQcs[]; especiales?: RutaEspecial[] } = {}
) => {
  red = espiarRed([...especiales, colaDelServidor(porTipo, { legibles })])
  return montar(<AtencionPage />, { ruta, camino: '/projects/:projectId/attention', usuario: GESTORA_DE_QUEJAS, permisos: p })
}

describe('S35 · lista unificada de QCS', () => {
  it('agrupa las abiertas por su situación de plazo, con el plazo que corre en su estado y el registro para quien escribe', async () => {
    fetch = mockFetch(rutas())
    abrir()
    const vencidas = await screen.findByRole('table', { name: 'Quejas, consultas y solicitudes: Vencidas' })
    expect(within(vencidas).getByRole('link', { name: /^Q-002\b/ })).toHaveAttribute('href', '/projects/p1/grievances/g2')
    expect(within(vencidas).getByText('Anónima')).toBeInTheDocument()
    expect(within(vencidas).getByLabelText('Situación de plazo: Vencido')).toBeInTheDocument()
    const porVencer = screen.getByRole('table', { name: 'Quejas, consultas y solicitudes: Por vencer' })
    expect(within(porVencer).getByRole('link', { name: /^C-002\b/ })).toHaveAttribute('href', '/projects/p1/inquiries/i2')
    const alDia = screen.getByRole('table', { name: 'Quejas, consultas y solicitudes: Al día o sin plazo' })
    expect(within(alDia).getByRole('link', { name: /^S-001\b/ })).toHaveAttribute('href', '/projects/p1/requests/r1')
    expect(within(alDia).getByText('Sin plazo')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Q-003\b/ })).not.toBeInTheDocument()
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
    await screen.findByRole('link', { name: /^Q-001\b/ })
    await userEvent.click(screen.getByRole('tab', { name: 'Consultas' }))
    expect(screen.queryByRole('link', { name: /^Q-001\b/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^C-001\b/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Mis QCS' }))
    expect(screen.getByRole('link', { name: /^Q-001\b/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Q-002\b/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Todas' }))
    expect(screen.getByRole('link', { name: /^Q-003\b/ })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Buscar por código o descripción'), 'turbio')
    expect(screen.getAllByRole('link', { name: /^[QCS]-\d+\b/ }).map((l) => l.textContent?.split(' ')[0])).toEqual(['Q-002', 'Q-001', 'Q-003'])
    await userEvent.selectOptions(screen.getByLabelText('Severidad'), 'MEDIA')
    expect(screen.getAllByRole('link', { name: /^[QCS]-\d+\b/ }).map((l) => l.textContent?.split(' ')[0])).toEqual(['Q-002'])
  })

  // rediseño de UX (2026-10-20): diez columnas no cabían a 1440 px y «Responsable» quedaba cortada. el tipo va en la celda de la
  // QCS y el canal bajo la categoría
  it('la tabla tiene ocho columnas en lo global: el tipo con la QCS y el canal con la categoría', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([colaDelServidor(TODAS)])
    montar(<AtencionPage />, { ruta: '/attention', camino: '/attention', usuario: GESTORA_DE_QUEJAS, permisos: EQUIPO_DE_QUEJAS })
    const [tabla] = await screen.findAllByRole('table')
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['QCS', 'Proyecto', 'Categoría y canal', 'Severidad', 'Estado', 'Plazo que corre', 'Responsable', 'Quién la plantea'])
    const fila = within(tabla).getAllByRole('row')[1]
    expect(within(fila).getAllByRole('cell')[0]).toHaveTextContent(/^(Queja|Consulta|Solicitud)/)
  })

  it('solo lee los tipos que la cuenta lee y, mientras carga, no dice que no hay QCS', async () => {
    fetch = mockFetch(rutas())
    abrir(permisos({ project: ['READ'], project_assignment: ['READ'], inquiry: ['READ'] }), undefined, { legibles: ['inquiry'] })
    expect(screen.queryByText('No hay quejas, consultas ni solicitudes en esta vista.')).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /^C-001\b/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Q-001\b/ })).not.toBeInTheDocument()
    // la cola es una sola lectura del servidor, que junta lo que la cuenta lee
    expect(red!.a('GET', '/sgspe/attention/queue')[0].ruta).toContain('project=p1&view=attention')
    expect(screen.queryByRole('link', { name: 'Registrar QCS' })).not.toBeInTheDocument()
  })

  it('los filtros salen de la definición de un tipo que la cuenta lee; «Severidad» solo para quien lee quejas', async () => {
    fetch = mockFetch(rutas())
    abrir(permisos({ project: ['READ'], project_assignment: ['READ'], inquiry: ['READ'] }), undefined, { legibles: ['inquiry'] })
    await screen.findByRole('link', { name: /^C-001\b/ })
    const canal = screen.getByLabelText('Canal')
    expect(within(canal).getByRole('option', { name: rotuloDeOpcion(CANALES[0]) })).toBeInTheDocument()
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
    fetch = mockFetch(rutas())
    abrir(EQUIPO_DE_QUEJAS, undefined, {
      especiales: [{ path: '/sgspe/attention/queue', responder: () => jsonResponse({ title: 'Error', status: 500, detail: 'caído' }, 500) }]
    })
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('No hay quejas, consultas ni solicitudes en esta vista.')).not.toBeInTheDocument()
  })

  // revisión de UX, etapa 3: el código y el asunto son el enlace; vistas con conteo; filtros como chips; vacío por filtros
  it('el código y el asunto llevan a la ficha; cada vista dice cuántas tiene; los filtros son chips con «Limpiar»', async () => {
    fetch = mockFetch(rutas())
    abrir(EQUIPO_DE_QUEJAS, '/projects/p1/attention?q=nada-coincide')
    expect(await screen.findByText('Nada coincide con los filtros')).toBeInTheDocument()
    expect(screen.getByText(/^Sin los filtros hay \d+\.$/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Atención' })).toHaveAccessibleDescription('0 registros')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Contiene «nada-coincide»' }))
    const enlace = await screen.findByRole('link', { name: /^Q-002 El canal de riego quedó turbio/ })
    expect(enlace).toHaveAttribute('href', '/projects/p1/grievances/g2')
  })

  // revisión de UX, etapa 6: las cifras de la ficha del grupo de interés llegan con ?stakeholder= puesto
  it('?stakeholder= deja las QCS de ese grupo de interés, con su chip', async () => {
    // la queja vencida es del grupo s1 (QUEJA); esta, de s2
    const delGrupo = registro('g8', { ...VENCIDA.attributes, code: 'Q-008', stakeholder: 's2' }, { state: 'received' })
    fetch = mockFetch(
      rutas([
        { path: '/objects/stakeholder/records/s2', body: registro('s2', { project: 'p1', organization: 'o2' }) },
        { path: '/objects/organization/records/o2', body: registro('o2', { name: 'Junta de regantes' }) }
      ])
    )
    abrir(EQUIPO_DE_QUEJAS, '/projects/p1/attention?stakeholder=s2', { porTipo: { grievance: [VENCIDA, delGrupo] } })
    expect(await screen.findByText('Grupo de interés: Junta de regantes')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /^Q-008/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Q-002/ })).not.toBeInTheDocument()
  })

  // D4 (revisión de UX, etapa 7): si fallan los tres indicadores, un solo aviso con «Reintentar»; si falla uno, su tarjeta lo ofrece
  it('los indicadores que fallan se dicen en una línea, con un solo aviso si fallan todos', async () => {
    const falla = (code: string) => ({ path: `/sgspe/dashboards/indicators/${code}`, status: 500, body: { title: 'Error', status: 500 } })
    fetch = mockFetch(rutas([falla('KPI-GRV-02'), falla('KPI-GRV-06'), falla('KPI-GRV-07')]))
    const { unmount } = abrir()
    const indicadores = await screen.findByRole('region', { name: 'Indicadores' })
    expect(await within(indicadores).findAllByRole('alert')).toHaveLength(1)
    // las tres tarjetas en una línea (con el detalle en title); el aviso único dice el texto entero
    expect(
      within(indicadores)
        .getAllByText(/^No se pudo cargar/)
        .filter((e) => e.hasAttribute('title'))
    ).toHaveLength(3)
    expect(within(indicadores).getAllByRole('button', { name: 'Reintentar' })).toHaveLength(1)
    unmount()
    fetch.restore()
    fetch = mockFetch(rutas([falla('KPI-GRV-06')]))
    abrir()
    const otra = await screen.findByRole('region', { name: 'Indicadores' })
    await within(otra).findByText(/^No se pudo cargar/)
    expect(within(otra).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(otra).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('la tabla de cada grupo muestra primero la que vence antes', async () => {
    const antes = registro('g9', { ...VENCIDA.attributes, code: 'Q-010', ack_due_date: '2026-10-01' }, { state: 'received' })
    fetch = mockFetch(rutas())
    abrir(EQUIPO_DE_QUEJAS, undefined, { porTipo: { grievance: [VENCIDA, antes] } })
    const vencidas = await screen.findByRole('table', { name: 'Quejas, consultas y solicitudes: Vencidas' })
    const codigos = within(vencidas)
      .getAllByRole('link', { name: /^Q-/ })
      .map((a) => a.textContent?.split(' ')[0])
    expect(codigos).toEqual(['Q-010', 'Q-002'])
  })
})
