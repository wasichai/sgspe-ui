import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, ubicacion } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { ANALISTA_SIG, CALIDAD_INVALIDAS, EQUIPO_SIG, PROYECTO_UTM } from '../../test/sig'
import { CalidadPage } from './CalidadPage'

// S63 (spec F6 §3.6, gis.md §8): una pestaña por revisión, filtros de objeto y proyecto, y el enlace a cada registro
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const abrir = (ruta = '/territory/quality') => montar(<CalidadPage />, { ruta, usuario: ANALISTA_SIG, permisos: EQUIPO_SIG })
const rutas = () => [
  { path: '/objects/project/records', body: pagina([PROYECTO_UTM]) },
  { path: '/sgspe/territory/data-quality', body: CALIDAD_INVALIDAS }
]

describe('S63 · calidad de datos', () => {
  it('lista las geometrías inválidas con su detalle y enlaza el registro que tiene ficha', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir()
    expect(await screen.findByRole('heading', { name: 'Calidad de datos', level: 1 })).toBeInTheDocument()
    const tabla = await screen.findByRole('table', { name: 'Geometrías inválidas' })
    const [, comunidad, predio] = within(tabla).getAllByRole('row')
    expect(within(comunidad).getByRole('link', { name: 'Comunidad Ejemplo' })).toHaveAttribute('href', '/r/community/c1')
    expect(comunidad).toHaveTextContent('autointersección')
    expect(within(predio).queryByRole('link')).not.toBeInTheDocument()
    expect(predio).toHaveTextContent('PR-009')
    expect(red.llamadas[red.llamadas.length - 1].ruta).toBe('/sgspe/territory/data-quality?check=INVALID&page=0&size=50')
  })

  it('cambiar de revisión y de objeto viaja en la URL y en la consulta', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: 'Sin relación territorial' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/territory/quality?check=NO_TERRITORY'))
    await waitFor(() => expect(red!.llamadas.some((l) => l.ruta.includes('check=NO_TERRITORY'))).toBe(true))
    await userEvent.selectOptions(screen.getByLabelText('Tipo de registro'), 'grievance')
    await waitFor(() => expect(red!.llamadas.some((l) => l.ruta.includes('check=NO_TERRITORY&object=grievance'))).toBe(true))
  })

  it('sin permiso dice «No disponible»', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([PROYECTO_UTM]) },
      { path: '/sgspe/territory/data-quality', status: 403, body: { title: 'Forbidden', status: 403 } }
    ])
    abrir()
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
  })

  it('el selector de objeto solo ofrece los de la revisión, y con proyecto solo los que lo tienen', async () => {
    fetch = mockFetch(rutas())
    abrir('/territory/quality?check=NO_GEOMETRY')
    const selector = await screen.findByLabelText('Tipo de registro')
    expect(
      within(selector)
        .getAllByRole('option')
        .map((o) => o.getAttribute('value'))
    ).toEqual(['', 'locality', 'community'])
    await userEvent.click(screen.getByRole('tab', { name: 'Áreas desactualizadas' }))
    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Tipo de registro'))
          .getAllByRole('option')
          .map((o) => o.getAttribute('value'))
      ).toEqual(['', 'area_of_influence', 'community', 'land_parcel', 'mining_concession'])
    )
    await userEvent.selectOptions(screen.getByLabelText('Proyecto'), PROYECTO_UTM.id)
    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Tipo de registro'))
          .getAllByRole('option')
          .map((o) => o.getAttribute('value'))
      ).toEqual(['', 'area_of_influence'])
    )
  })

  it('Siguiente se habilita con hasNext', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([PROYECTO_UTM]) },
      { path: '/sgspe/territory/data-quality', body: { ...CALIDAD_INVALIDAS, hasNext: true } }
    ])
    red = espiarRed()
    abrir()
    const siguiente = await screen.findByRole('button', { name: 'Siguiente' })
    await userEvent.click(siguiente)
    await waitFor(() => expect(red!.llamadas.some((l) => l.ruta.includes('page=1'))).toBe(true))
  })

  // revisión final del plan 6.3, m4: una revisión puede tardar segundos; volver a ella no la relanza y otra página no vacía la tabla
  it('volver a una revisión ya vista no la pide de nuevo, y «Siguiente» deja la página anterior mientras llega la otra', async () => {
    let liberar: (() => void) | null = null
    fetch = mockFetch([{ path: '/objects/project/records', body: pagina([PROYECTO_UTM]) }])
    red = espiarRed([
      {
        path: '/sgspe/territory/data-quality',
        responder: async (l) => {
          if (l.ruta.includes('page=1')) await new Promise<void>((r) => (liberar = r))
          return Response.json({ ...CALIDAD_INVALIDAS, check: l.ruta.includes('NO_TERRITORY') ? 'NO_TERRITORY' : 'INVALID', hasNext: true })
        }
      }
    ])
    abrir()
    const pedidas = (check: string) => red!.a('GET', '/sgspe/territory/data-quality').filter((l) => l.ruta.includes(`check=${check}`))
    await screen.findByRole('table', { name: 'Geometrías inválidas' })
    await userEvent.click(screen.getByRole('tab', { name: 'Sin relación territorial' }))
    await screen.findByRole('table', { name: 'Sin relación territorial' })
    // otra revisión no muestra las filas de la anterior como si fueran suyas
    await userEvent.click(screen.getByRole('tab', { name: 'Geometrías inválidas' }))
    await screen.findByRole('table', { name: 'Geometrías inválidas' })
    expect(pedidas('INVALID')).toHaveLength(1)
    expect(pedidas('NO_TERRITORY')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(liberar).not.toBeNull())
    expect(screen.getByRole('status')).toHaveTextContent('Actualizando…')
    expect(screen.getByRole('table', { name: 'Geometrías inválidas' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('link', { name: 'Comunidad Ejemplo' })).toBeInTheDocument()
    liberar!()
    await waitFor(() => expect(screen.queryByText('Actualizando…')).not.toBeInTheDocument())
  })

  // m6 y m7: la lista vacía se dice entre lo que la cuenta ve, y un registro sin etiqueta no muestra su id
  it('sin filas lo dice entre lo que la cuenta puede ver; un registro sin etiqueta se nombra con un texto', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([PROYECTO_UTM]) },
      { path: '/sgspe/territory/data-quality', body: { ...CALIDAD_INVALIDAS, content: [] } }
    ])
    abrir()
    expect(await screen.findByText('No hay registros con este problema entre los que su cuenta puede ver.')).toBeInTheDocument()
    fetch.restore()
    cleanup()
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([PROYECTO_UTM]) },
      {
        path: '/sgspe/territory/data-quality',
        body: {
          ...CALIDAD_INVALIDAS,
          content: [{ object: 'community', id: '5c7e0d4b-0000-4000-8000-000000000001', label: null, field: 'territory', detail: null }]
        }
      }
    ])
    abrir()
    expect(await screen.findByRole('link', { name: 'Registro sin nombre' })).toHaveAttribute('href', '/r/community/5c7e0d4b-0000-4000-8000-000000000001')
    expect(screen.queryByText(/5c7e0d4b/)).not.toBeInTheDocument()
  })
})
