import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { componentesDeFicha, type Indicador } from '../datos/indicadores'
import {
  CALIDAD_INVALIDAS,
  COMUNIDAD,
  FICHA_LOCALIDAD,
  KPI_TER_01,
  KPI_TER_01_SIN_POSTURA,
  LAZO,
  PREDIOS_AFECTADOS,
  PUNTO,
  REVISION_LAZO,
  UBICADOS
} from '../../test/sig'
import {
  fichaDe,
  filasDe,
  useAnalisis,
  useCalidad,
  useConcentracion,
  useFichaTerritorial,
  useRegistrosDeLaZona,
  useRevisarGeometria,
  useUbicar
} from './consultas'

// el contrato de F6 que lee el portal (spec §3.1 a §3.6, api.md §4): cada hook pide su ruta con sus parámetros y no pide
// nada sin lo que exige (un id, un objeto, un punto)
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

// las llamadas a la API de SGSPE: montar también lee las preferencias de la sesión (/auth/me/preferences)
const consultas = () => red!.llamadas.filter((l) => l.ruta.startsWith('/sgspe/'))

function Sonda({ usar }: { usar: () => { data?: unknown; isPending?: boolean } }) {
  const r = usar()
  return <pre data-testid="datos">{r.data === undefined ? 'sin datos' : JSON.stringify(r.data)}</pre>
}

describe('consultas de F6', () => {
  it('la ficha de una localidad lleva el proyecto y se normaliza con sus listas', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/localities/l1/card', body: FICHA_LOCALIDAD }])
    red = espiarRed()
    montar(<Sonda usar={() => useFichaTerritorial('locality', 'l1', 'p1')} />)
    await waitFor(() => expect(screen.getByTestId('datos')).toHaveTextContent('Distrito Ejemplo'))
    expect(consultas()[0].ruta).toBe('/sgspe/territory/localities/l1/card?project=p1')
    const datos = JSON.parse(screen.getByTestId('datos').textContent!)
    expect(datos.registro.id).toBe('l1')
    expect(datos.sectors).toEqual([])
    expect(datos.unavailable).toEqual([])
    expect(datos.administrativeUnit).toEqual({ id: 'au1', name: 'Distrito Ejemplo', level: 'DISTRITO' })
    expect(datos.areasOfInfluence[0].memberCondition).toBe('INCLUIDO')
  })

  it('la ficha conserva una geometría por campo, nunca una suelta', () => {
    expect(fichaDe('locality', FICHA_LOCALIDAD).geometrias).toEqual({ location: PUNTO, boundary: null })
    const comunidad = fichaDe('community', { community: COMUNIDAD, geometry: { territory: null }, unavailable: ['community_sector'] })
    expect(comunidad.geometrias).toEqual({ territory: null })
    expect(comunidad.unavailable).toEqual(['community_sector'])
    expect(comunidad.communities).toEqual([])
    expect(fichaDe('community', { community: COMUNIDAD }).geometrias).toEqual({})
  })

  it('sin id no pide la ficha; sin objeto no pide los registros de la zona ni la concentración', async () => {
    fetch = mockFetch([])
    red = espiarRed()
    montar(
      <>
        <Sonda usar={() => useFichaTerritorial('community', null)} />
        <Sonda usar={() => useRegistrosDeLaZona('locality', 'l1', null)} />
        <Sonda usar={() => useConcentracion(null, {})} />
      </>
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(consultas()).toEqual([])
  })

  it('los registros de la zona llevan of, el periodo y la página', async () => {
    fetch = mockFetch([
      {
        path: '/sgspe/territory/zones/community/c1/records',
        body: { content: [], page: 0, size: 25, totalElements: 0, totalPages: 0, available: true }
      }
    ])
    red = espiarRed()
    montar(<Sonda usar={() => useRegistrosDeLaZona('community', 'c1', 'commitment', { periodStart: '2026-07-01', page: 1 })} />)
    await waitFor(() => expect(consultas()).toHaveLength(1))
    expect(consultas()[0].ruta).toBe('/sgspe/territory/zones/community/c1/records?of=commitment&periodStart=2026-07-01&page=1&size=25')
  })

  // ZoneQueries: un grupo de interés o un riesgo no tienen fecha; con periodo, 400 PERIOD_NOT_APPLICABLE
  it('los grupos de interés y los riesgos de la zona se piden sin periodo', async () => {
    fetch = mockFetch([
      { path: /^\/sgspe\/territory\/zones\/locality\/l1\/records/, body: { content: [], page: 0, size: 25, totalElements: 0, totalPages: 0, available: true } }
    ])
    red = espiarRed()
    const periodo = { periodStart: '2026-07-01', periodEnd: '2026-09-30' }
    montar(
      <>
        <Sonda usar={() => useRegistrosDeLaZona('locality', 'l1', 'stakeholder', periodo)} />
        <Sonda usar={() => useRegistrosDeLaZona('locality', 'l1', 'social_risk', periodo)} />
      </>
    )
    await waitFor(() => expect(consultas()).toHaveLength(2))
    expect(
      consultas()
        .map((l) => l.ruta)
        .sort()
    ).toEqual(['/sgspe/territory/zones/locality/l1/records?of=social_risk&size=25', '/sgspe/territory/zones/locality/l1/records?of=stakeholder&size=25'])
  })

  it('la concentración lleva of, los proyectos y el periodo', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/concentration', body: { cells: [] } }])
    red = espiarRed()
    montar(<Sonda usar={() => useConcentracion('grievance', { project: ['p1', 'p2'], periodEnd: '2026-09-30' })} />)
    await waitFor(() => expect(consultas()).toHaveLength(1))
    expect(consultas()[0].ruta).toBe('/sgspe/territory/concentration?of=grievance&project=p1&project=p2&periodEnd=2026-09-30')
  })

  it('el análisis del proyecto normaliza rows, localities e items y dice si falta un permiso o se recortó', async () => {
    expect(filasDe(PREDIOS_AFECTADOS)).toMatchObject({ disponible: true, recortada: false })
    expect(filasDe(PREDIOS_AFECTADOS).filas).toHaveLength(2)
    expect(filasDe({ localities: [{ id: 'l1' }] }).filas).toEqual([{ id: 'l1' }])
    expect(filasDe({ rows: [], truncated: true }).recortada).toBe(true)
    const conflicto = { object: 'incident', id: 'i1', label: 'INC-001', distanceM: 2500 }
    expect(filasDe({ items: [conflicto], available: false, missingFields: ['early_warning_signal.location'] })).toEqual({
      filas: [conflicto],
      disponible: false,
      camposFaltantes: ['early_warning_signal.location'],
      recortada: false
    })
    fetch = mockFetch([{ path: '/sgspe/territory/projects/p1/buffer-localities', body: { available: true, localities: [] } }])
    red = espiarRed()
    montar(<Sonda usar={() => useAnalisis('p1', 'buffer-localities', { bufferM: 500 })} />)
    await waitFor(() => expect(consultas()).toHaveLength(1))
    expect(consultas()[0].ruta).toBe('/sgspe/territory/projects/p1/buffer-localities?bufferM=500')
  })

  it('ubicar pide el punto con seis decimales y no pide nada sin punto', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/locate', body: UBICADOS }])
    red = espiarRed()
    montar(
      <>
        <Sonda usar={() => useUbicar(null)} />
        <Sonda usar={() => useUbicar([-78.5000001, -7.9])} />
      </>
    )
    await waitFor(() => expect(consultas()).toHaveLength(1))
    expect(consultas()[0].ruta).toBe('/sgspe/territory/locate?lon=-78.500000&lat=-7.900000')
  })

  it('la revisión de una geometría manda el objeto, el campo y el proyecto, y no escribe', async () => {
    fetch = mockFetch([{ method: 'POST', path: '/sgspe/territory/geometry-checks', body: REVISION_LAZO }])
    red = espiarRed()
    function Revisar() {
      const revisar = useRevisarGeometria()
      return (
        <>
          <button onClick={() => revisar.mutate({ geometry: LAZO, object: 'community', field: 'territory', project: 'p1' })}>revisar</button>
          <pre data-testid="datos">{revisar.data ? JSON.stringify(revisar.data) : 'sin datos'}</pre>
        </>
      )
    }
    montar(<Revisar />)
    await userEvent.click(screen.getByRole('button', { name: 'revisar' }))
    await waitFor(() => expect(screen.getByTestId('datos')).toHaveTextContent('autointersección'))
    expect(red.a('POST', '/sgspe/territory/geometry-checks')[0].cuerpo).toEqual({ geometry: LAZO, object: 'community', field: 'territory', project: 'p1' })
    expect(consultas()).toHaveLength(1)
  })

  it('la calidad pide la revisión, el objeto, el proyecto y la página', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/data-quality', body: CALIDAD_INVALIDAS }])
    red = espiarRed()
    montar(<Sonda usar={() => useCalidad({ check: 'INVALID', object: 'community', project: 'p1', page: 0 })} />)
    await waitFor(() => expect(consultas()).toHaveLength(1))
    expect(consultas()[0].ruta).toBe('/sgspe/territory/data-quality?check=INVALID&object=community&project=p1&page=0&size=50')
    await waitFor(() => expect(screen.getByTestId('datos')).toHaveTextContent('hasNext'))
  })

  // KPI-TER-01 (TerritorySummary): sus cifras son las filas del desglose components, cada una con key y su available
  it('las filas de KPI-TER-01 salen del desglose components, con key en todas', () => {
    const filas = componentesDeFicha(KPI_TER_01 as Indicador)
    expect(filas.map((f) => f.key)).toEqual([
      'KPI-STK-02',
      'KPI-ENG-01',
      'KPI-COM-02',
      'KPI-COM-03',
      'KPI-GRV-02',
      'KPI-RSK-01',
      'programs',
      'KPI-INV-03',
      'lastActivity'
    ])
    expect(filas.at(-1)).toEqual({ key: 'lastActivity', available: true, value: '2026-10-03' })
    const sinPostura = componentesDeFicha(KPI_TER_01_SIN_POSTURA as Indicador)
    expect(sinPostura.filter((f) => !f.available).map((f) => [f.key, f.unavailableReason])).toEqual([
      ['KPI-STK-02', 'FIELD_NOT_READABLE'],
      ['programs', 'OBJECT_NOT_READABLE']
    ])
    expect(componentesDeFicha(undefined)).toEqual([])
  })
})
