import { screen, waitFor, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { ANALISTA_SIG, baseDeSig, EQUIPO_SIG, TABLERO_TERRITORIAL, TABLERO_TERRITORIAL_COMPLETO, TABLERO_TERRITORIAL_CON_PERIODO } from '../../test/sig'
import { TerritorioPage } from './TerritorioPage'

vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

// el tablero territorial (dashboards.md §5.9): KPI-TER-02 a 04 de GET /api/sgspe/dashboards/territory, que exige un proyecto
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const capas = { path: /^\/sgspe\/territory\/layers\//, body: { type: 'FeatureCollection', features: [] } }
const abrir = (ruta: string) => montar(<TerritorioPage modo="tablero" />, { ruta, usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })

describe('tablero territorial', () => {
  it('sin proyecto lo pide y no llama al tablero', async () => {
    fetch = mockFetch([...baseDeSig(), capas])
    red = espiarRed()
    abrir('/territory/dashboard')
    expect(await screen.findByRole('heading', { name: 'Tablero territorial', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Elija un proyecto en los filtros del mapa para ver sus cifras territoriales.')).toBeInTheDocument()
    expect(red.a('GET', '/sgspe/dashboards/territory')).toEqual([])
  })

  it('con proyecto muestra KPI-TER-02 a 04 con sus desgloses, los rótulos y los avisos', async () => {
    fetch = mockFetch([...baseDeSig(), capas, { path: '/sgspe/dashboards/territory', body: TABLERO_TERRITORIAL_COMPLETO }])
    red = espiarRed()
    abrir('/territory/dashboard?project=p1')
    const superficie = await screen.findByRole('region', { name: 'Superficie del área de influencia' })
    expect(within(superficie).getByText('1,234.5 ha')).toBeInTheDocument()
    // la fila del área se rotula con su tipo y versión, nunca con el id
    expect(within(within(superficie).getByRole('table')).getByRole('row', { name: 'AIDS · v1 1,234.5' })).toBeInTheDocument()
    expect(within(superficie).queryByText('ai0')).not.toBeInTheDocument()
    expect(
      within(within(superficie).getByLabelText('Avisos sobre esta cifra')).getByText('Una versión del área no tiene superficie y no se sumó.')
    ).toBeInTheDocument()
    const miembros = screen.getByRole('region', { name: 'Miembros por tipo de área' })
    expect(within(miembros).getByRole('row', { name: 'Localidades 5' })).toBeInTheDocument()
    expect(within(miembros).getByRole('row', { name: 'Comunidades 2' })).toBeInTheDocument()
    const componentes = screen.getByRole('region', { name: 'Componentes sobre tierras comunales o privadas' })
    expect(within(componentes).getByRole('row', { name: 'Sin tenencia 1' })).toBeInTheDocument()
    expect(within(componentes).getByRole('row', { name: 'Comunal 2' })).toBeInTheDocument()
    expect(within(componentes).getByRole('row', { name: 'Sin dato 1' })).toBeInTheDocument()
    expect(within(componentes).queryByText(/EMPRESA/)).not.toBeInTheDocument()
    expect(screen.getByText(/Calculado el .*2026/)).toBeInTheDocument()
    expect(red.a('GET', '/sgspe/dashboards/territory')).toHaveLength(1)
  })

  it('dice «No disponible» donde falta un permiso', async () => {
    fetch = mockFetch([...baseDeSig(), capas, { path: '/sgspe/dashboards/territory', body: TABLERO_TERRITORIAL }])
    abrir('/territory/dashboard?project=p1')
    const componentes = await screen.findByRole('region', { name: 'Componentes sobre tierras comunales o privadas' })
    expect(within(componentes).getByText('No disponible')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Miembros por tipo de área' })).getByRole('row', { name: 'Localidades 5' })).toBeInTheDocument()
  })

  it('con periodo lo manda, dice que las cifras no lo aplican y lo muestra en es-PE', async () => {
    fetch = mockFetch([...baseDeSig(), capas, { path: '/sgspe/dashboards/territory', body: TABLERO_TERRITORIAL_CON_PERIODO }])
    red = espiarRed()
    abrir('/territory/dashboard?project=p1&periodStart=2026-07-01')
    const superficie = await screen.findByRole('region', { name: 'Superficie del área de influencia' })
    expect(within(superficie).getByRole('note')).toHaveTextContent('Esta cifra no aplica el filtro de inicio del periodo, fin del periodo')
    expect(screen.getByText(/Periodo pedido: desde 1 jul.? 2026/)).toBeInTheDocument()
    expect(screen.queryByText(/2026-07-01/)).not.toBeInTheDocument()
    await waitFor(() => expect(red!.a('GET', '/sgspe/dashboards/territory')).toHaveLength(1))
    expect(red.a('GET', '/sgspe/dashboards/territory')[0].ruta).toBe('/sgspe/dashboards/territory?project=p1&periodStart=2026-07-01')
  })
})
