import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar, pagina } from '../../test/montar'
import { permisos } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { ANALISTA_SIG, EQUIPO_SIG, FORMATOS, PROYECTO_UTM } from '../../test/sig'
import { DialogoDeExportacion } from './DialogoDeExportacion'

// el diálogo de exportación (spec F6 §3.5): solo las capas y los niveles permitidos, la lista de verificación fuera de INTERNO y
// el archivo que entrega el servidor (enmiendas 12.1 a 12.5 del plan 6.3)
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const RUTA = '/sgspe/territory/exports'
const BASE: MockRoute[] = [
  { path: '/objects/project/records', body: pagina([PROYECTO_UTM]) },
  { path: '/sgspe/territory/imports/formats', body: FORMATOS }
]

const archivo = () =>
  new Response('GPKG', {
    status: 200,
    headers: { 'Content-Type': 'application/geopackage+sqlite3', 'Content-Disposition': 'attachment; filename="land-parcel-externo.gpkg"' }
  })

const abrir = (capaInicial?: string, cuenta = EQUIPO_SIG, { sinProyecto = false } = {}) =>
  montar(<DialogoDeExportacion abierto alCerrar={vi.fn()} proyecto={sinProyecto ? undefined : 'p1'} capaInicial={capaInicial} />, {
    usuario: ANALISTA_SIG,
    permisos: cuenta
  })

const opciones = (nombre: string) =>
  within(screen.getByRole('combobox', { name: nombre }))
    .getAllByRole('option')
    .map((o) => o.getAttribute('value'))
const elegir = (nombre: string, valor: string) => userEvent.selectOptions(screen.getByRole('combobox', { name: nombre }), valor)

describe('diálogo de exportación geográfica', () => {
  it('los sondajes solo se exportan en INTERNO; el territorio comunal también en PUBLICO', async () => {
    fetch = mockFetch(BASE)
    abrir('LYR-10')
    expect(await screen.findByRole('dialog', { name: 'Exportar una capa' })).toBeInTheDocument()
    expect(opciones('Nivel de divulgación')).toEqual(['INTERNO'])
    await elegir('Capa', 'LYR-05')
    expect(opciones('Nivel de divulgación')).toEqual(['INTERNO', 'EXTERNO', 'PUBLICO'])
    await elegir('Capa', 'LYR-15')
    expect(opciones('Nivel de divulgación')).toEqual(['INTERNO'])
    // ni las ciudades por separado ni las capas de gestión
    expect(opciones('Capa')).not.toContain('LYR-03')
    expect(opciones('Capa').some((c) => Number(c!.slice(4)) > 16)).toBe(false)
  })

  it('un nivel que la capa nueva no permite vuelve a INTERNO', async () => {
    fetch = mockFetch(BASE)
    abrir('LYR-05')
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    await elegir('Nivel de divulgación', 'PUBLICO')
    await elegir('Capa', 'LYR-10')
    expect(screen.getByRole('combobox', { name: 'Nivel de divulgación' })).toHaveValue('INTERNO')
  })

  it('EXTERNO pide la lista de verificación; con ella manda el pedido sin el filtro fijo y descarga el archivo', async () => {
    fetch = mockFetch(BASE)
    red = espiarRed([{ method: 'POST', path: RUTA, responder: archivo }])
    abrir('LYR-14')
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    await elegir('Formato', 'gpkg')
    await userEvent.click(screen.getByRole('radio', { name: 'UTM del proyecto' }))
    await elegir('Nivel de divulgación', 'EXTERNO')
    expect(screen.getByText(/En «Externo» solo salen los predios de propiedad, posesión y comunales/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(await screen.findByText('Confirme la lista de verificación para una salida fuera de la organización')).toBeInTheDocument()
    expect(red.a('POST', RUTA)).toEqual([])
    await userEvent.click(screen.getByRole('checkbox', { name: /Revisé que el archivo puede salir con este nivel/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    await waitFor(() => expect(red!.a('POST', RUTA)).toHaveLength(1))
    const [pedido] = red.a('POST', RUTA)
    // en EXTERNO el servidor aplica las tres tenencias por su cuenta (enmienda 12.5); con UTM va el proyecto (12.2)
    expect(pedido.cuerpo).toEqual({
      object: 'land_parcel',
      geometry: 'boundary',
      format: 'gpkg',
      coordinates: 'UTM',
      filters: { project: ['p1'] },
      disclosureLevel: 'EXTERNO',
      checklistConfirmed: true
    })
    // una exportación no crea registros de negocio: el servidor no usa la clave (enmienda 12.3)
    expect(pedido.cabeceras.get('Idempotency-Key')).toBeNull()
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled())
  })

  it('en INTERNO manda el filtro de la capa en camelCase y no manda el proyecto a una capa que no se acota por él', async () => {
    fetch = mockFetch(BASE)
    red = espiarRed([{ method: 'POST', path: RUTA, responder: archivo }])
    abrir('LYR-14')
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    await waitFor(() => expect(red!.a('POST', RUTA)).toHaveLength(1))
    expect(red.a('POST', RUTA)[0].cuerpo).toMatchObject({
      object: 'land_parcel',
      coordinates: 'LATLON',
      filters: { tenureType: ['PROPIEDAD', 'POSESION', 'COMUNAL'] },
      disclosureLevel: 'INTERNO',
      checklistConfirmed: false
    })
  })

  it('GeoJSON y KML van siempre en latitud y longitud', async () => {
    fetch = mockFetch(BASE)
    abrir('LYR-05')
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    await elegir('Formato', 'geojson')
    expect(screen.getByRole('radio', { name: 'UTM del proyecto' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Latitud y longitud (EPSG 4326)' })).toBeChecked()
  })

  it('UTM sin proyecto pide uno antes de exportar', async () => {
    fetch = mockFetch(BASE)
    abrir('LYR-05', EQUIPO_SIG, { sinProyecto: true })
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    await elegir('Formato', 'gpkg')
    await userEvent.click(screen.getByRole('radio', { name: 'UTM del proyecto' }))
    expect(screen.getByText('Las coordenadas UTM son las del CRS de trabajo de un proyecto: elija uno.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument()
    await elegir('Proyecto', 'p1')
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument()
  })

  it('pedir las ciudades exporta las localidades enteras y lo dice', async () => {
    fetch = mockFetch(BASE)
    abrir('LYR-03')
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    expect(screen.getByRole('combobox', { name: 'Capa' })).toHaveValue('LYR-02')
    expect(screen.getByRole('option', { name: 'Centros poblados, localidades y ciudades' })).toBeInTheDocument()
    expect(screen.getByText(/salen todas las localidades, con las ciudades/)).toBeInTheDocument()
  })

  it('un formato que el servidor no tiene se ofrece deshabilitado; sin la lista, todos', async () => {
    const sinKml = { formats: FORMATOS.formats.map((f) => (f.format === 'kml' ? { ...f, available: false } : f)) }
    fetch = mockFetch([BASE[0], { path: '/sgspe/territory/imports/formats', body: sinKml }])
    abrir('LYR-05')
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    await waitFor(() => expect(screen.getByRole('option', { name: /^KML/ })).toBeDisabled())
    expect(screen.getByRole('option', { name: 'GeoPackage' })).toBeEnabled()
  })

  it('sin la lista de formatos ofrece todos', async () => {
    fetch = mockFetch([BASE[0]])
    abrir('LYR-05')
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    expect(opciones('Formato')).toEqual(['geojson', 'kml', 'gpkg', 'shp', 'csv', 'xlsx'])
    for (const o of within(screen.getByRole('combobox', { name: 'Formato' })).getAllByRole('option')) expect(o).toBeEnabled()
  })

  it('un DISCLOSURE_NOT_ALLOWED del servidor se dice con su texto', async () => {
    fetch = mockFetch(BASE)
    red = espiarRed([
      {
        method: 'POST',
        path: RUTA,
        responder: () => problema(403, 'Disclosure not allowed', [{ field: 'disclosureLevel', message: 'DISCLOSURE_NOT_ALLOWED' }])
      }
    ])
    abrir('LYR-05')
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(await screen.findByText('Esa capa o ese filtro no se puede exportar con el nivel de divulgación elegido.')).toBeInTheDocument()
  })

  it('un EXPORT_FAILED se dice con su texto y ofrece reintentar', async () => {
    let veces = 0
    fetch = mockFetch(BASE)
    red = espiarRed([
      {
        method: 'POST',
        path: RUTA,
        responder: () => (++veces === 1 ? problema(500, 'Export failed', [{ field: 'format', message: 'EXPORT_FAILED' }]) : archivo())
      }
    ])
    abrir('LYR-05')
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(await screen.findByText('No se pudo generar el archivo. Inténtelo de nuevo o elija otro formato.')).toBeInTheDocument()
    expect(screen.getByText(/corr-123/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(red!.a('POST', RUTA)).toHaveLength(2))
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled())
  })

  it('un FORMAT_UNAVAILABLE dice que ese formato no se puede escribir y sugiere los que siempre están', async () => {
    fetch = mockFetch(BASE)
    red = espiarRed([
      { method: 'POST', path: RUTA, responder: () => problema(422, 'Format unavailable', [{ field: 'format', message: 'FORMAT_UNAVAILABLE' }]) }
    ])
    abrir('LYR-05')
    await screen.findByRole('dialog', { name: 'Exportar una capa' })
    await elegir('Formato', 'shp')
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(await screen.findByText('El servidor no puede escribir ese formato todavía: elija GeoJSON, CSV o XLSX.')).toBeInTheDocument()
  })

  it('sin ninguna capa exportable dice por qué', async () => {
    fetch = mockFetch(BASE)
    abrir(undefined, permisos({ community: ['READ'] }))
    expect(await screen.findByText('Su cuenta no puede exportar ninguna capa del mapa.')).toBeInTheDocument()
  })
})
