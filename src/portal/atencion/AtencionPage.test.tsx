import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  baseDeAtencion,
  CANALES,
  CONSULTA,
  DEF_CONSULTA,
  DEF_QUEJA,
  DEF_SOLICITUD,
  EQUIPO_DE_QUEJAS,
  GESTORA_DE_QUEJAS,
  QUEJA,
  SOLICITUD,
  sinPersona
} from '../../test/atencion'
import { P1 } from '../../test/compromisos'
import { montar, pagina, registro, ubicacion } from '../../test/montar'
import { permisos } from '../../test/portal'
import { AtencionPage } from './AtencionPage'
import { colaDelServidor } from '../../test/colaDeAtencion'
import { espiarRed, type Red, type RutaEspecial } from '../../test/red'
import type { ObjetoDeQcs } from '../datos/atencion'
import type { Registro } from '../datos/registros'
import { rotuloDeOpcion } from '../datos/opciones'

vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

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

// la cola es una sola tabla agrupada por plazo (S11): las filas de un grupo son las que siguen a su fila de grupo
const TABLA = 'Quejas, consultas y solicitudes'
const filasDelGrupo = (nombre: RegExp) => {
  const encabezado = within(screen.getByRole('table', { name: TABLA })).getByRole('rowheader', { name: nombre })
  return within(encabezado.closest('tbody')!)
    .getAllByRole('row')
    .filter((f) => !f.contains(encabezado) && !f.hasAttribute('data-detalle'))
}
const grupo = (nombre: RegExp) => {
  const tbody = within(screen.getByRole('table', { name: TABLA }))
    .getByRole('rowheader', { name: nombre })
    .closest('tbody')!
  return within(tbody)
}

describe('S35 · lista unificada de QCS', () => {
  // 05-especificacion §1.6 y S11: en una fila enfocada, Espacio la abre con su ciclo de vida (la fila expandida reemplaza la vista
  // previa en la cola: dice el camino real del workflow de cada tipo) y Enter abre su ficha
  it('Espacio en una fila de la cola la abre con su ciclo de vida, y Enter su ficha', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await screen.findByRole('table', { name: TABLA })
    const [fila] = filasDelGrupo(/^Vencidas/)
    fila.focus()
    await userEvent.keyboard(' ')
    const boton = within(fila).getByRole('button', { name: 'Ocultar el ciclo de vida de Q-002' })
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    const detalle = document.getElementById(boton.getAttribute('aria-controls')!)!
    expect(within(detalle).getByText('Siguiente acción · Responsable')).toBeInTheDocument()
    expect(within(detalle).getByRole('link', { name: 'Abrir ficha' })).toHaveAttribute('href', '/projects/p1/grievances/g2')
    expect(ubicacion.actual).toBe('/projects/p1/attention')
    filasDelGrupo(/^Vencidas/)[0].focus()
    await userEvent.keyboard('{Enter}')
    expect(ubicacion.actual).toBe('/projects/p1/grievances/g2')
  })

  it('agrupa las abiertas por su situación de plazo en una sola tabla, con el total de cada grupo que cuenta el servidor', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await screen.findByRole('table', { name: TABLA })
    const vencidas = grupo(/^Vencidas \(1\)/)
    expect(vencidas.getByRole('link', { name: /^Q-002\b/ })).toHaveAttribute('href', '/projects/p1/grievances/g2')
    expect(vencidas.getByText('Anónima')).toBeInTheDocument()
    expect(vencidas.getByLabelText(/^Situación de plazo: Vencido · \d+ días hábiles$/)).toBeInTheDocument()
    expect(vencidas.getByLabelText('Severidad: Media')).toBeInTheDocument()
    expect(grupo(/^Por vencer/).getByRole('link', { name: /^C-002\b/ })).toHaveAttribute('href', '/projects/p1/inquiries/i2')
    const alDia = grupo(/^Al día o sin plazo/)
    expect(alDia.getByRole('link', { name: /^S-001\b/ })).toHaveAttribute('href', '/projects/p1/requests/r1')
    expect(alDia.getByText('Sin plazo')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Q-003\b/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar QCS' })).toHaveAttribute('href', '/projects/p1/attention/new')
    // los días hábiles del acuse se dicen al pie de la tabla
    expect(screen.getByText(/se cuenta en días hábiles con el calendario de feriados de Perú/)).toBeInTheDocument()
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
    await userEvent.click(screen.getByRole('radio', { name: /^Consultas\b/ }))
    expect(screen.queryByRole('link', { name: /^Q-001\b/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^C-001\b/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^Mis QCS\b/ }))
    expect(screen.getByRole('link', { name: /^Q-001\b/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Q-002\b/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /^Todas\b/ }))
    expect(screen.getByRole('link', { name: /^Q-003\b/ })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Buscar por código o descripción'), 'turbio')
    // la búsqueda llega a la consulta 300 ms después de la última tecla (05-especificacion §1.4): antes filtraba con cada tecla
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /^[QCS]-\d+\b/ }).map((l) => l.textContent?.split(' ')[0])).toEqual(['Q-002', 'Q-001', 'Q-003'])
    )
    await userEvent.selectOptions(screen.getByLabelText('Severidad'), 'MEDIA')
    expect(screen.getAllByRole('link', { name: /^[QCS]-\d+\b/ }).map((l) => l.textContent?.split(' ')[0])).toEqual(['Q-002'])
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
    expect(screen.getByRole('radio', { name: 'Atención, 0' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el filtro Contiene «nada-coincide»' }))
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

  // P-02 (DD-03, DD-04): una sola fila de pestañas; las vistas, en el selector de la barra de filtros, con su conteo y ?view=
  it('las vistas van en el selector de la barra de filtros, con su conteo, y escriben ?view=', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await screen.findByRole('link', { name: /^Q-001\b/ })
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    const barra = screen.getByRole('group', { name: 'Filtros' })
    expect(within(barra).getByRole('radiogroup', { name: 'Vistas' })).toBeInTheDocument()
    expect(within(barra).getByRole('radio', { name: /^Atención, \d+$/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(barra).getByRole('radio', { name: /^Quejas\b/ }))
    expect(ubicacion.actual).toContain('view=quejas')
  })

  // DD-04: cada filtro es un chip; quitar uno quita solo su parámetro y «Limpiar filtros» deja la vista
  it('los filtros puestos son chips; «Limpiar filtros» los quita todos y conserva la vista', async () => {
    fetch = mockFetch(rutas())
    abrir(EQUIPO_DE_QUEJAS, '/projects/p1/attention?view=todas&severity=MEDIA&q=turbio')
    const aplicados = await screen.findByRole('list', { name: 'Filtros aplicados' })
    const media = `Severidad: ${rotuloDeOpcion('MEDIA')}`
    expect(within(aplicados).getByText(media)).toBeInTheDocument()
    await userEvent.click(within(aplicados).getByRole('button', { name: `Quitar el filtro ${media}` }))
    expect(ubicacion.actual).not.toContain('severity=')
    expect(ubicacion.actual).toContain('q=turbio')
    await userEvent.click(within(screen.getByRole('group', { name: 'Filtros' })).getByRole('button', { name: 'Limpiar filtros' }))
    expect(ubicacion.actual).toBe('/projects/p1/attention?view=todas')
  })

  // U-24 y S11: las cifras de la cabecera se entienden sin conocer el modelo: nunca «0 / 4 · %». «Absueltas en 90 días» es
  // KPI-GRV-07 en los últimos 90 días de Lima: cuántas de las recibidas tienen respuesta, y el porcentaje con su base
  it('«Absueltas en 90 días» cuenta las respondidas de los últimos 90 días, con el porcentaje y su base, sin «n / N · %»', async () => {
    fetch = mockFetch(rutas([indicador('KPI-GRV-07', 50, { label: '#6 QCS absueltas', unit: '%', numerator: 2, denominator: 4 })]))
    abrir()
    const cifras = await screen.findByRole('region', { name: 'Indicadores' })
    const absueltas = await within(cifras).findByRole('region', { name: 'Absueltas en 90 días' })
    expect(absueltas).toHaveTextContent('2')
    expect(absueltas).toHaveTextContent('50 % de las 4 recibidas en los últimos 90 días tienen respuesta')
    expect(absueltas).not.toHaveTextContent('/ 4')
    expect(absueltas).not.toHaveTextContent('#6')
    const pedido = red!.a('GET', '/sgspe/dashboards/indicators/KPI-GRV-07')[0].ruta
    expect(new URLSearchParams(pedido.split('?')[1]).get('periodEnd')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(await within(cifras).findByRole('region', { name: 'Abiertas' })).toHaveTextContent('siguen en atención')
    expect(within(cifras).getByRole('region', { name: 'Vencidas' })).toHaveTextContent('abiertas con el plazo vencido')
  })

  // S11: quien la plantea es «anónima» o, sin permiso sobre la persona (un campo restringido), «Restringido»; nunca un vacío
  it('la columna de quien la plantea dice «Anónima», o «Restringido» a quien no lee la persona', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await screen.findByRole('table', { name: TABLA })
    expect(grupo(/^Vencidas/).getByText('Anónima')).toBeInTheDocument()
    // quien lee la persona y la QCS no la tiene: «—»
    expect(grupo(/^Al día o sin plazo/).queryByText('Restringido')).not.toBeInTheDocument()
  })

  it('a quien no lee la persona, quien la plantea le dice «Restringido»', async () => {
    fetch = mockFetch(
      rutas([
        { path: '/metadata/objects/grievance', body: sinPersona(DEF_QUEJA) },
        { path: '/metadata/objects/inquiry', body: sinPersona(DEF_CONSULTA) },
        { path: '/metadata/objects/stakeholder_request', body: sinPersona(DEF_SOLICITUD) }
      ])
    )
    abrir()
    await screen.findByRole('table', { name: TABLA })
    expect(grupo(/^Al día o sin plazo/).getAllByText('Restringido').length).toBeGreaterThan(0)
    expect(grupo(/^Vencidas/).getByText('Anónima')).toBeInTheDocument()
  })

  it('la tabla de cada grupo muestra primero la que vence antes', async () => {
    const antes = registro('g9', { ...VENCIDA.attributes, code: 'Q-010', ack_due_date: '2026-10-01' }, { state: 'received' })
    fetch = mockFetch(rutas())
    abrir(EQUIPO_DE_QUEJAS, undefined, { porTipo: { grievance: [VENCIDA, antes] } })
    await screen.findByRole('table', { name: TABLA })
    const codigos = grupo(/^Vencidas/)
      .getAllByRole('link', { name: /^Q-/ })
      .map((a) => a.textContent?.split(' ')[0])
    expect(codigos).toEqual(['Q-010', 'Q-002'])
  })

  // issue #160 de sgspe: el código y el plazo se ordenan en el servidor; sin pedirlo, la consulta no lleva sort (un servidor sin
  // el orden responde 422 a un sort)
  it('el código y el plazo ordenan la cola en el servidor cuando la persona lo pide, y el encabezado lo dice con aria-sort', async () => {
    const antes = registro('g9', { ...VENCIDA.attributes, code: 'Q-010', ack_due_date: '2026-10-01' }, { state: 'received' })
    fetch = mockFetch(rutas())
    abrir(EQUIPO_DE_QUEJAS, undefined, { porTipo: { grievance: [VENCIDA, antes] } })
    const tabla = () => screen.getByRole('table', { name: TABLA })
    await screen.findByRole('table', { name: TABLA })
    const consultas = () => red!.a('GET', '/sgspe/attention/queue').map((l) => Object.fromEntries(new URLSearchParams(l.ruta.split('?')[1])))
    const codigos = () =>
      within(tabla())
        .getAllByRole('link', { name: /^Q-/ })
        .map((a) => a.textContent?.split(' ')[0])
    expect(consultas().every((c) => !('sort' in c) && !('dir' in c))).toBe(true)
    expect(within(tabla()).getByRole('columnheader', { name: 'QCS' })).not.toHaveAttribute('aria-sort')
    expect(codigos()).toEqual(['Q-010', 'Q-002'])
    await userEvent.click(within(tabla()).getByRole('button', { name: 'QCS' }))
    await waitFor(() => expect(consultas()).toContainEqual(expect.objectContaining({ sort: 'code', dir: 'asc', page: '0' })))
    await waitFor(() => expect(codigos()).toEqual(['Q-002', 'Q-010']))
    expect(within(tabla()).getByRole('columnheader', { name: 'QCS' })).toHaveAttribute('aria-sort', 'ascending')
    // el orden viaja en la URL (tercera pasada de UX, 3.6; DD-37): volver de una ficha lo conserva
    expect(ubicacion.actual).toBe('/projects/p1/attention?sort=codigo&dir=asc')
    await userEvent.click(within(tabla()).getByRole('button', { name: 'QCS' }))
    await waitFor(() => expect(consultas()).toContainEqual(expect.objectContaining({ sort: 'code', dir: 'desc' })))
    await waitFor(() => expect(codigos()).toEqual(['Q-010', 'Q-002']))
    expect(within(tabla()).getByRole('columnheader', { name: 'QCS' })).toHaveAttribute('aria-sort', 'descending')
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Plazo que corre' }))
    await waitFor(() => expect(consultas()).toContainEqual(expect.objectContaining({ sort: 'due_at', dir: 'asc' })))
    expect(within(tabla()).getByRole('columnheader', { name: 'Plazo que corre' })).toHaveAttribute('aria-sort', 'ascending')
    // el canal no se ordena: su código no dice su orden
    expect(within(tabla()).queryByRole('button', { name: 'Canal' })).not.toBeInTheDocument()
  })

  it('otro orden vuelve a la primera página', async () => {
    const muchas = Array.from({ length: 26 }, (_, i) =>
      registro(`g${i + 10}`, { ...QUEJA.attributes, code: `Q-${i + 10}`, deadline_status: null }, { state: 'acknowledged' })
    )
    fetch = mockFetch(rutas())
    abrir(EQUIPO_DE_QUEJAS, '/projects/p1/attention?page=1', { porTipo: { grievance: muchas } })
    const tabla = await screen.findByRole('table', { name: TABLA })
    await userEvent.click(within(tabla).getByRole('button', { name: 'QCS' }))
    expect(ubicacion.actual).toBe('/projects/p1/attention?sort=codigo&dir=asc')
  })
})

// la vista «Lista + mapa» (design-system.md §5.3): la cola de atención junto al mapa, cada QCS en su punto o en el de su localidad o
// comunidad (LYR-20); se ofrece solo si alguna QCS de la página trae ubicación, y la cola agrupada y su fila abierta siguen igual
describe('S35 · lista + mapa', () => {
  const EN_TUNAS = { ...CONSULTA, attributes: { ...CONSULTA.attributes, locality: 'l1' } }
  const LYR_20 = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'i1:location',
        geometry: { type: 'Point', coordinates: [-78.5, -7.9] },
        properties: { __id: 'i1', __object: 'inquiry', name: 'C-001' }
      }
    ]
  }

  it('sin QCS con ubicación no se ofrece', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await screen.findByRole('link', { name: /^Q-001\b/ })
    expect(screen.queryByRole('radio', { name: 'Atención en el mapa' })).not.toBeInTheDocument()
  })

  it('con una, «Atención en el mapa» deja ?view=mapa, pide la cola de atención y elegir el punto marca su fila con su tipo', async () => {
    fetch = mockFetch(rutas([{ path: '/sgspe/territory/layers/LYR-20', body: LYR_20 }]))
    abrir(EQUIPO_DE_QUEJAS, '/projects/p1/attention', { porTipo: { ...TODAS, inquiry: [EN_TUNAS, POR_VENCER] } })
    await screen.findByRole('link', { name: /^Q-001\b/ })
    await userEvent.click(screen.getByRole('radio', { name: 'Atención en el mapa' }))
    expect(ubicacion.actual).toBe('/projects/p1/attention?view=mapa')
    const lista = await screen.findByRole('listbox', { name: 'Quejas, consultas y solicitudes' })
    expect(screen.queryByRole('table', { name: 'Quejas, consultas y solicitudes' })).not.toBeInTheDocument()
    // la cola que se pide es la de atención
    expect(red!.a('GET', '/sgspe/attention/queue').at(-1)!.ruta).toContain('view=attention')
    const mapa = screen.getByRole('list', { name: 'Mapa de Quejas, consultas y solicitudes' })
    await userEvent.click(await within(mapa).findByRole('button', { name: 'C-001' }))
    expect(within(lista).getByRole('option', { name: /^C-001/ })).toHaveAttribute('aria-selected', 'true')
    expect(ubicacion.actual).toBe('/projects/p1/attention?view=mapa&selected=inquiry%3Ai1')
    expect(
      within(lista)
        .getAllByRole('option')
        .filter((o) => o.textContent?.includes('Sin ubicación')).length
    ).toBeGreaterThan(0)
  })
})
