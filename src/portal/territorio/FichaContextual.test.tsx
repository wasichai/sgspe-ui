import { screen, waitFor, within } from '@testing-library/react'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar, pagina } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { ANALISTA_SIG, COMUNIDAD, EQUIPO_SIG, FICHA_LOCALIDAD, KPI_TER_01, KPI_TER_01_SIN_POSTURA, LEE_SIN_POSTURA, PROYECTO_UTM } from '../../test/sig'
import { FichaContextual } from './FichaContextual'

// la ficha contextual de S12 (spec F6 §3.2 y §3.7, dashboards.md §4.8): la parte territorial de …/card y las cifras de
// KPI-TER-01, cada una con su «No disponible»; nunca un cero por un permiso que falta (RQ-DSH-032)
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const ficha = (permisos = EQUIPO_SIG, objeto: 'locality' | 'community' = 'locality', id = 'l1') =>
  montar(<FichaContextual objeto={objeto} id={id} proyecto="p1" periodo={{ periodStart: '2026-07-01' }} alCerrar={vi.fn()} />, {
    usuario: ANALISTA_SIG,
    permisos
  })

const PROYECTOS: MockRoute = { path: '/objects/project/records', body: pagina([PROYECTO_UTM]) }
const kpiCon = (filas: Record<string, unknown>[]) => ({ ...KPI_TER_01, breakdowns: [{ by: 'components', rows: filas }] })
const filas = () => KPI_TER_01.breakdowns[0].rows

describe('ficha contextual', () => {
  it('dice el lugar, sus zonas y las cifras de KPI-TER-01 con el lugar, el proyecto y el periodo', async () => {
    fetch = mockFetch([
      PROYECTOS,
      { path: '/sgspe/territory/localities/l1/card', body: FICHA_LOCALIDAD },
      { path: '/sgspe/dashboards/indicators/KPI-TER-01', body: KPI_TER_01 }
    ])
    red = espiarRed()
    ficha()
    const panel = await screen.findByRole('complementary', { name: 'Ficha del lugar' })
    expect(await within(panel).findByRole('heading', { name: 'Localidad Ejemplo' })).toBeInTheDocument()
    expect(within(panel).getByText('Distrito Ejemplo')).toBeInTheDocument()
    expect(within(panel).getByText('Comunidad Ejemplo')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'AIDS · v1' })).toHaveAttribute('href', '/projects/p1/areas/ai0')
    // el área trae solo el id del proyecto: el código sale de los proyectos que la cuenta lee (hueco H9)
    expect((await within(panel).findByText(/PRJ-01/)).textContent).toBe('PRJ-01 · Incluido')
    expect(within(panel).getByRole('link', { name: 'Abrir la ficha' })).toHaveAttribute('href', '/territory/localities/l1?project=p1')
    expect(within(panel).getByRole('link', { name: 'Filtrar el proyecto por este lugar' })).toHaveAttribute(
      'href',
      '/projects/p1/overview?territory=locality%3Al1'
    )
    const vencidos = await within(panel).findByRole('region', { name: 'Compromisos vencidos' })
    expect(vencidos).toHaveTextContent('1')
    expect(within(within(panel).getByRole('region', { name: 'Riesgos altos' })).getByText('0')).toBeInTheDocument()
    // las cinco posturas, con su texto y su cifra; la que no tiene grupos dice 0, que sí es una cifra
    const posturas = within(panel).getByRole('list', { name: 'Posturas' })
    expect(posturas).toHaveTextContent('A favor3')
    expect(within(posturas).getAllByRole('listitem')).toHaveLength(5)
    // los montos por moneda, nunca sumados entre monedas (ASM-063), y los avisos del servidor
    const inversion = within(panel).getByRole('region', { name: 'Inversión ejecutada' })
    expect(
      within(within(inversion).getByRole('list', { name: 'Montos por moneda' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['S/ 1,500.00', 'USD 200.00'])
    expect(within(inversion).getByText('Los programas no tienen territorio: con un filtro de localidad no se suman')).toBeInTheDocument()
    // los programas: la cantidad y sus nombres
    const programas = within(panel).getByRole('region', { name: 'Programas' })
    expect(within(programas).getByText('1')).toBeInTheDocument()
    expect(within(programas).getByText('Programa Ejemplo')).toBeInTheDocument()
    // la última actividad es una fecha, nunca el AAAA-MM-DD del servidor
    expect(within(panel).getByRole('region', { name: 'Última actividad' })).toHaveTextContent('3 oct. 2026')
    expect(within(panel).queryByText('2026-10-03')).not.toBeInTheDocument()
    expect(within(within(panel).getByRole('region', { name: 'QCS abiertas' })).getByRole('note')).toBeInTheDocument()
    await waitFor(() => expect(red!.a('GET', '/sgspe/dashboards/indicators/KPI-TER-01')).toHaveLength(1))
    expect(red.a('GET', '/sgspe/dashboards/indicators/KPI-TER-01')[0].ruta).toBe(
      '/sgspe/dashboards/indicators/KPI-TER-01?locality=l1&project=p1&periodStart=2026-07-01'
    )
    expect(red.a('GET', '/sgspe/territory/localities/l1/card')[0].ruta).toBe('/sgspe/territory/localities/l1/card?project=p1')
  })

  it('quien no lee la postura ve «No disponible» solo en la postura y en los programas, nunca un cero', async () => {
    fetch = mockFetch([
      { path: '/sgspe/territory/localities/l1/card', body: FICHA_LOCALIDAD },
      { path: '/sgspe/dashboards/indicators/KPI-TER-01', body: KPI_TER_01_SIN_POSTURA }
    ])
    ficha(LEE_SIN_POSTURA)
    const postura = await screen.findByRole('region', { name: 'Grupos de interés por postura' })
    expect(within(postura).getByText('No disponible')).toBeInTheDocument()
    expect(within(postura).queryByRole('list', { name: 'Posturas' })).not.toBeInTheDocument()
    expect(within(postura).queryByText('0')).not.toBeInTheDocument()
    const programas = screen.getByRole('region', { name: 'Programas' })
    expect(within(programas).getByText('No disponible')).toBeInTheDocument()
    expect(within(programas).queryByText('0')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Compromisos vencidos' })).getByText('1')).toBeInTheDocument()
    expect(screen.getAllByText('No disponible')).toHaveLength(2)
  })

  it('sin territorio el indicador dice por qué', async () => {
    fetch = mockFetch([
      { path: '/sgspe/territory/localities/l1/card', body: FICHA_LOCALIDAD },
      {
        path: '/sgspe/dashboards/indicators/KPI-TER-01',
        body: { code: 'KPI-TER-01', label: 'Resumen', available: false, unavailableReason: 'TERRITORY_REQUIRED' }
      }
    ])
    ficha()
    expect(await screen.findByText('Elija una localidad o una comunidad para ver sus cifras.')).toBeInTheDocument()
  })

  it('un componente sin cifra dice «—», nunca un cero; una última actividad sin fecha lo dice', async () => {
    fetch = mockFetch([
      { path: '/sgspe/territory/localities/l1/card', body: FICHA_LOCALIDAD },
      {
        path: '/sgspe/dashboards/indicators/KPI-TER-01',
        body: kpiCon(
          filas().map((f) =>
            f.key === 'KPI-COM-02' ? { ...f, value: null } : f.key === 'lastActivity' ? { key: 'lastActivity', available: true, value: null } : f
          )
        )
      }
    ])
    ficha()
    const abiertos = await screen.findByRole('region', { name: 'Compromisos abiertos' })
    expect(within(abiertos).getByText('—')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Última actividad' })).getByText('Sin actividad registrada')).toBeInTheDocument()
  })

  it('la fecha de la última actividad es la del día en Lima, no la del día anterior', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-07T03:00:00Z'))
    fetch = mockFetch([
      { path: '/sgspe/territory/localities/l1/card', body: FICHA_LOCALIDAD },
      {
        path: '/sgspe/dashboards/indicators/KPI-TER-01',
        body: kpiCon(filas().map((f) => (f.key === 'lastActivity' ? { key: 'lastActivity', available: true, value: '2026-10-06' } : f)))
      }
    ])
    ficha()
    expect(await screen.findByRole('region', { name: 'Última actividad' })).toHaveTextContent('6 oct. 2026')
  })

  it('una ficha que responde 404 (backend sin F6) deja abrir la ficha del lugar y dice que el resumen no está disponible', async () => {
    fetch = mockFetch([])
    ficha()
    const panel = await screen.findByRole('complementary', { name: 'Ficha del lugar' })
    expect(await within(panel).findByText('El resumen territorial de este lugar no está disponible.')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Abrir la ficha' })).toHaveAttribute('href', '/territory/localities/l1?project=p1')
    expect(await within(panel).findAllByText('No disponible')).not.toHaveLength(0)
  })

  it('un 404 LOCALITY_NOT_FOUND se dice con su texto, no como un backend sin F6', async () => {
    fetch = mockFetch([
      {
        path: '/sgspe/territory/localities/l1/card',
        status: 404,
        body: { title: 'Not Found', status: 404, detail: 'La localidad no existe', errors: [{ field: 'id', message: 'LOCALITY_NOT_FOUND' }] }
      },
      { path: '/sgspe/dashboards/indicators/KPI-TER-01', body: KPI_TER_01 }
    ])
    ficha()
    const panel = await screen.findByRole('complementary', { name: 'Ficha del lugar' })
    expect(await within(panel).findByText('La localidad no existe o no está a su alcance.')).toBeInTheDocument()
    expect(within(panel).queryByText('El resumen territorial de este lugar no está disponible.')).not.toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Abrir la ficha' })).toBeInTheDocument()
  })

  it('lo que la cuenta no lee dice «No disponible», nunca «Ninguna» (unavailable de la ficha)', async () => {
    fetch = mockFetch([
      {
        path: '/sgspe/territory/localities/l1/card',
        body: {
          ...FICHA_LOCALIDAD,
          administrativeUnit: null,
          communities: [],
          areasOfInfluence: [],
          unavailable: ['community.territory', 'area_of_influence_member', 'administrative_unit', 'locality.boundary']
        }
      },
      { path: '/sgspe/dashboards/indicators/KPI-TER-01', body: KPI_TER_01 }
    ])
    ficha()
    const partes = await screen.findByRole('group', { name: 'Zonas del lugar' })
    expect(within(partes).queryByText('Ninguna')).not.toBeInTheDocument()
    expect(within(partes).getAllByText('No disponible')).toHaveLength(3)
  })

  it('sin comunidades ni áreas legibles y vacías, dice «Ninguna»', async () => {
    fetch = mockFetch([
      { path: '/sgspe/territory/localities/l1/card', body: { ...FICHA_LOCALIDAD, communities: [], areasOfInfluence: [] } },
      { path: '/sgspe/dashboards/indicators/KPI-TER-01', body: KPI_TER_01 }
    ])
    ficha()
    const partes = await screen.findByRole('group', { name: 'Zonas del lugar' })
    expect(within(partes).getAllByText('Ninguna')).toHaveLength(2)
  })

  it('la ficha de una comunidad lista sus sectores y pide KPI-TER-01 con la comunidad', async () => {
    fetch = mockFetch([
      PROYECTOS,
      {
        path: '/sgspe/territory/communities/c1/card',
        body: {
          community: COMUNIDAD,
          geometry: { territory: null },
          administrativeUnit: { id: 'au1', name: 'Distrito Ejemplo', level: 'DISTRITO' },
          sectors: [{ id: 's1', name: 'Sector Ejemplo' }],
          areasOfInfluence: [{ id: 'ai0', project: 'p9', areaType: 'AIDI', versionNumber: 2, memberCondition: 'PROVISIONAL' }],
          unavailable: []
        }
      },
      { path: '/sgspe/dashboards/indicators/KPI-TER-01', body: KPI_TER_01 }
    ])
    red = espiarRed()
    ficha(EQUIPO_SIG, 'community', 'c1')
    const panel = await screen.findByRole('complementary', { name: 'Ficha del lugar' })
    expect(await within(panel).findByRole('heading', { name: 'Comunidad Ejemplo' })).toBeInTheDocument()
    expect(within(panel).getByText('Comunidad')).toBeInTheDocument()
    expect(within(panel).getByText('Sector Ejemplo')).toBeInTheDocument()
    // un proyecto que la cuenta no lee: «Proyecto reservado», nunca su id
    expect((await within(panel).findByText(/Proyecto reservado/)).textContent).toBe('Proyecto reservado · Provisional')
    expect(within(panel).getByRole('link', { name: 'Abrir la ficha' })).toHaveAttribute('href', '/territory/communities/c1?project=p1')
    await waitFor(() => expect(red!.a('GET', '/sgspe/dashboards/indicators/KPI-TER-01')).toHaveLength(1))
    expect(red.a('GET', '/sgspe/dashboards/indicators/KPI-TER-01')[0].ruta).toContain('community=c1&project=p1')
  })
})
