import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeAtencion, EQUIPO_DE_RELACIONES } from '../../test/atencion'
import { montar } from '../../test/montar'
import { RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { ReporteQcsPage, type ReporteDeQcs } from './ReporteQcsPage'

// el reporte unificado (api.md §4.6): los conteos por tipo con un tipo ilegible «No disponible», la nota de confidenciales
// excluidas, la lista sin texto libre ni persona, los filtros en la URL y el tope como «acote»
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const conteos = { received: 3, open: 2, closed: 1, rejected: 0, withdrawn: 0, absolved: 1, overdue: 1 }
const REPORTE: ReporteDeQcs = {
  totals: conteos,
  byType: [
    {
      type: 'grievance',
      available: true,
      ...conteos,
      byState: [{ key: 'in_action', value: 2 }],
      byChannel: [{ key: 'PRESENCIAL', value: 3 }],
      byCategory: []
    },
    { type: 'stakeholder_request', available: false }
  ],
  confidentialHidden: true,
  page: {
    items: [
      {
        type: 'grievance',
        id: 'g1',
        code: 'Q-001',
        state: 'in_action',
        channel: 'PRESENCIAL',
        category: 'EMPLEO',
        severity: 'ALTA',
        receivedAt: '2026-10-01T14:00:00Z',
        deadlineStatus: 'VENCIDO',
        dueDate: '2026-10-31',
        ownerEmail: 'gvm@sgspe.test',
        respondedAt: null,
        anonymous: true
      }
    ],
    page: 0,
    size: 25,
    totalElements: 1
  }
}

const abrir = (ruta = '/projects/p1/attention/report') =>
  montar(<ReporteQcsPage />, { ruta, camino: '/projects/:projectId/attention/report', usuario: RELACIONISTA, permisos: EQUIPO_DE_RELACIONES })

describe('reporte unificado de QCS', () => {
  it('cuenta por tipo con un tipo ilegible «No disponible», dice que excluye confidenciales y lista sin texto libre', async () => {
    fetch = mockFetch([...baseDeAtencion(RELACIONISTA), { path: '/sgspe/attention/report', body: REPORTE }])
    abrir()
    const porTipo = await screen.findByRole('table', { name: 'Por tipo' })
    expect(
      within(within(porTipo).getByRole('row', { name: /^Quejas/ }))
        .getAllByRole('cell')
        .map((c) => c.textContent)
    ).toEqual(['3', '2', '1', '0', '0', '1', '1'])
    expect(within(within(porTipo).getByRole('row', { name: /^Solicitudes/ })).getByText('No disponible')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('no incluye las QCS confidenciales')
    expect(await within(screen.getByRole('table', { name: 'Quejas: Por estado' })).findByText('En atención')).toBeInTheDocument()
    const lista = screen.getByRole('table', { name: 'Quejas, consultas y solicitudes del reporte' })
    expect(within(lista).getByRole('link', { name: 'Q-001' })).toHaveAttribute('href', '/projects/p1/grievances/g1')
    expect(within(lista).getByLabelText('Situación de plazo: Vencido')).toBeInTheDocument()
  })

  it('«Anónima» sin dato dice «—», no «No»', async () => {
    const [item] = REPORTE.page.items
    const conAnonimas = {
      ...REPORTE,
      page: { ...REPORTE.page, items: [item, { ...item, id: 'g2', code: 'Q-002', anonymous: false }, { ...item, id: 'g3', code: 'Q-003', anonymous: null }] }
    }
    fetch = mockFetch([...baseDeAtencion(RELACIONISTA), { path: '/sgspe/attention/report', body: conAnonimas }])
    abrir()
    const lista = await screen.findByRole('table', { name: 'Quejas, consultas y solicitudes del reporte' })
    const ultima = (codigo: string) =>
      within(lista)
        .getByRole('row', { name: new RegExp(codigo) })
        .querySelectorAll('td')
    const anonima = (codigo: string) => Array.from(ultima(codigo)).at(-1)?.textContent
    expect(anonima('Q-001')).toBe('Sí')
    expect(anonima('Q-002')).toBe('No')
    expect(anonima('Q-003')).toBe('—')
  })

  it('pide con el proyecto y los filtros de la URL, sin los vacíos; un filtro nuevo vuelve a la primera página', async () => {
    fetch = mockFetch([...baseDeAtencion(RELACIONISTA), { path: '/sgspe/attention/report', body: REPORTE }])
    red = espiarRed()
    abrir('/projects/p1/attention/report?type=grievance&page=2')
    await screen.findByRole('table', { name: 'Por tipo' })
    expect(red.a('GET', '/sgspe/attention/report')[0].ruta).toBe('/sgspe/attention/report?project=p1&type=grievance&page=2&size=25')
    await userEvent.selectOptions(screen.getByLabelText('Canal'), 'CARTA')
    await waitFor(() =>
      expect(red!.a('GET', '/sgspe/attention/report').at(-1)!.ruta).toBe('/sgspe/attention/report?project=p1&type=grievance&channel=CARTA&page=0&size=25')
    )
  })

  // plan 4.2a: una página más allá del final responde 200 con la lista vacía (por ejemplo, tras cerrar casos o con un enlace viejo):
  // el reporte vuelve a la última página con casos en lugar de decir que no hay ninguno
  it('una página más allá del final vuelve a la última página', async () => {
    const lleno = (pagina: number, items: ReporteDeQcs['page']['items']) => ({ ...REPORTE, page: { ...REPORTE.page, page: pagina, items, totalElements: 30 } })
    fetch = mockFetch(baseDeAtencion(RELACIONISTA))
    red = espiarRed([
      {
        path: '/sgspe/attention/report',
        responder: (llamada) => jsonResponse(llamada.ruta.includes('page=7') ? lleno(7, []) : lleno(1, REPORTE.page.items))
      }
    ])
    abrir('/projects/p1/attention/report?page=7')
    expect(await screen.findByRole('link', { name: 'Q-001' })).toBeInTheDocument()
    expect(red.a('GET', '/sgspe/attention/report').at(-1)!.ruta).toBe('/sgspe/attention/report?project=p1&page=1&size=25')
    expect(screen.queryByText('No hay quejas, consultas ni solicitudes con estos filtros.')).not.toBeInTheDocument()
  })

  it('demasiados registros pide acotar, sin conteos; mientras carga no dibuja ceros', async () => {
    fetch = mockFetch(baseDeAtencion(RELACIONISTA))
    red = espiarRed([
      { path: '/sgspe/attention/report', responder: () => problema(400, 'demasiados', [{ field: 'filters.project', message: 'TOO_MANY_RECORDS' }]) }
    ])
    abrir()
    expect(screen.queryByRole('table', { name: 'Por tipo' })).not.toBeInTheDocument()
    expect(await screen.findByText(/Hay demasiados registros para este reporte/)).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
