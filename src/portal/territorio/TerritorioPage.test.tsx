import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock, MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { pagina } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { problemaDelPeriodo } from './TerritorioPage'
import {
  ANALISTA_SIG,
  baseDeSig,
  CAPA_LYR_17,
  CAPA_LYR_17_SIN_POSTURA,
  CAPA_LYR_20,
  CAPA_LYR_23,
  CAPA_NO_ENCONTRADA,
  CAPACIDADES_WMS,
  CONCENTRACION,
  coleccion,
  EQUIPO_SIG
} from '../../test/sig'

vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

// S12 en F6 (spec §3.7): las capas públicas por WMS del proxy y el resto por GeoJSON; un 503 de una tesela vuelve al GeoJSON
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const capacidades = {
  path: '/sgspe/territory/wms',
  responder: () => new Response(CAPACIDADES_WMS, { headers: { 'Content-Type': 'application/vnd.ogc.wms_xml' } })
}
const rutas = (...antes: MockRoute[]): MockRoute[] => [
  ...antes,
  ...baseDeSig(),
  { path: '/sgspe/territory/layers/LYR-05', body: coleccion([['c1', 'community', 'Comunidad Ejemplo']]) },
  { path: '/sgspe/territory/layers/LYR-02', body: coleccion([['l1', 'locality', 'Localidad Ejemplo']]) },
  { path: /^\/sgspe\/territory\/layers\//, body: coleccion([]) }
]
// un backend sin el plan 6.2c: las capas de gestión responden 404 LAYER_NOT_FOUND
const sinGestion = (...salvo: string[]): MockRoute[] =>
  ['LYR-17', 'LYR-18', 'LYR-19', 'LYR-20', 'LYR-21', 'LYR-22', 'LYR-23', 'LYR-24']
    .filter((id) => !salvo.includes(id))
    .map((id) => ({ path: `/sgspe/territory/layers/${id}`, ...CAPA_NO_ENCONTRADA }))
const listaWms = () => screen.findByRole('list', { name: 'Mapa territorial · WMS' })
// el panel de capas con «Todas las capas» desplegado (DD-11): las que no están en el mapa van plegadas
const capas = async () => {
  const panel = await screen.findByRole('region', { name: 'Capas' })
  const todas = within(panel).getByRole('button', { name: /Todas las capas/ })
  if (todas.getAttribute('aria-expanded') === 'false') await userEvent.click(todas)
  return panel
}
// «Más acciones» de la cabecera, abierto
const masAcciones = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
  return screen.getByRole('group', { name: 'Más acciones' })
}

// revisión final del plan 6.3, m1: las capas se piden una vez con la vista que el mapa muestra, nunca sin bbox
describe('S12 · la vista inicial', () => {
  const geojson = () => red!.a('GET', /^\/sgspe\/territory\/layers\/LYR-0/)

  it('sin proyecto, el mapa abre sobre el Perú entero y las capas se piden con esa vista', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas())
    red = espiarRed()
    await waitFor(() => expect(geojson().length).toBeGreaterThan(0))
    for (const l of geojson()) expect(l.ruta).toContain('bbox=-82.000%2C-19.000%2C-68.000%2C1.000')
  })

  it('sin proyecto, abre sobre los proyectos que la cuenta lee si alguno tiene ubicación', async () => {
    const conUbicacion = (id: string, x: number, y: number) => ({
      id,
      state: 'active',
      attributes: { code: id, name: id },
      geometries: { location: { type: 'Point', coordinates: [x, y] }, interest_area: null }
    })
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, [
      { path: /^\/objects\/project\/records\?/, body: pagina([conUbicacion('p1', -78.2, -8.3), conUbicacion('p2', -77.5, -9.5)]) },
      ...rutas()
    ])
    red = espiarRed()
    await waitFor(() => expect(geojson().length).toBeGreaterThan(0))
    for (const l of geojson()) expect(l.ruta).toContain('bbox=-78.200%2C-9.500%2C-77.500%2C-8.300')
  })

  it('con proyecto, abre sobre su ubicación y su área de interés, y la sonda de gestión sigue con su encuadre vacío', async () => {
    fetch = abrirPortal('/territory?project=p1', ANALISTA_SIG, EQUIPO_SIG, [
      {
        path: '/objects/project/records/p1',
        body: {
          id: 'p1',
          state: 'active',
          attributes: { code: 'PRJ-01', name: 'Proyecto Ejemplo A', working_crs: 'EPSG 32717' },
          geometries: { location: { type: 'Point', coordinates: [-78.2, -8.3] }, interest_area: null }
        }
      },
      ...rutas()
    ])
    red = espiarRed()
    await waitFor(() => expect(geojson().length).toBeGreaterThan(0))
    for (const l of geojson()) expect(l.ruta).toMatch(/project=p1.*bbox=-78\.200%2C-8\.300%2C-78\.200%2C-8\.300/)
    await waitFor(() => expect(red!.a('GET', '/sgspe/territory/layers/LYR-19').length).toBeGreaterThan(0))
    expect(red.a('GET', '/sgspe/territory/layers/LYR-19').map((l) => l.ruta)).toEqual(['/sgspe/territory/layers/LYR-19?bbox=0%2C0%2C0%2C0'])
  })
})

// el mapa primero (DD-11, P-06): el lienzo a todo el ancho, con las capas y su leyenda en un panel plegable a la izquierda y los
// lugares en otro a la derecha; la cabecera, con una sola primaria y lo demás en «Más acciones»
describe('S12 · el mapa primero', () => {
  it('las capas elegidas van arriba, con su leyenda, y el resto queda plegado tras «Todas las capas»', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas(...sinGestion()))
    const panel = await screen.findByRole('region', { name: 'Capas' })
    const elegidas = within(panel).getByRole('region', { name: 'Capas en el mapa' })
    expect(
      within(elegidas)
        .getAllByRole('checkbox')
        .map((c) => c.closest('label')!.textContent)
    ).toEqual(['Centros poblados y localidades', 'Territorio comunal'])
    expect(
      within(elegidas)
        .getAllByRole('checkbox')
        .every((c) => (c as HTMLInputElement).checked)
    ).toBe(true)
    // la muestra de cada capa es la de la paleta compartida: la leyenda va con la capa
    expect(elegidas.querySelectorAll('[data-color]')).toHaveLength(2)
    expect(within(panel).queryByRole('checkbox', { name: /Concesiones mineras/ })).not.toBeInTheDocument()
    const todas = within(panel).getByRole('button', { name: /Todas las capas/ })
    expect(todas).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(todas)
    expect(todas).toHaveAttribute('aria-expanded', 'true')
    // encender una capa la deja donde está mientras el panel sigue abierto: el foco no salta
    const mineras = within(panel).getByRole('checkbox', { name: /Concesiones mineras/ })
    await userEvent.click(mineras)
    expect(mineras).toBeChecked()
    expect(mineras).toHaveFocus()
  })

  it('el panel de capas se cierra y se abre con su botón sin perder lo elegido, y su estado va en la URL', async () => {
    fetch = abrirPortal('/territory?project=p1', ANALISTA_SIG, EQUIPO_SIG, rutas(...sinGestion()))
    const boton = await screen.findByRole('button', { name: 'Capas (2)' })
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    expect(boton).toHaveAttribute('aria-controls', screen.getByRole('region', { name: 'Capas' }).id)
    await userEvent.click(within(screen.getByRole('region', { name: 'Capas' })).getByRole('checkbox', { name: /Territorio comunal/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Capas (1)' }))
    expect(screen.queryByRole('region', { name: 'Capas' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Capas (1)' })).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(rutaActual()).toBe('/territory?project=p1&hide=layers'))
    await userEvent.click(screen.getByRole('button', { name: 'Capas (1)' }))
    const elegidas = within(await screen.findByRole('region', { name: 'Capas' })).getByRole('region', { name: 'Capas en el mapa' })
    expect(
      within(elegidas)
        .getAllByRole('checkbox')
        .map((c) => c.closest('label')!.textContent)
    ).toEqual(['Centros poblados y localidades'])
    await waitFor(() => expect(rutaActual()).toBe('/territory?project=p1'))
  })

  it('la lista de lugares es un panel plegable; elegir un lugar en el mapa lo vuelve a abrir con su ficha', async () => {
    fetch = abrirPortal('/territory?hide=places', ANALISTA_SIG, EQUIPO_SIG, rutas(...sinGestion()))
    const boton = await screen.findByRole('button', { name: /^Lugares/ })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'Lugares visibles' })).not.toBeInTheDocument()
    await userEvent.click(boton)
    expect(await screen.findByRole('navigation', { name: 'Lugares visibles' })).toBeInTheDocument()
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(boton)
    await waitFor(() => expect(rutaActual()).toBe('/territory?hide=places'))
    await userEvent.click(await screen.findByRole('button', { name: 'Localidad Ejemplo' }))
    expect(await screen.findByRole('complementary', { name: 'Ficha del lugar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Lugares/ })).toHaveAttribute('aria-expanded', 'true')
    expect(rutaActual()).toBe('/territory?selected=locality%3Al1')
  })

  it('la cabecera tiene una sola primaria y las demás acciones van en «Más acciones»', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas(...sinGestion()))
    const titulo = await screen.findByRole('heading', { name: 'Mapa territorial', level: 1 })
    const cabecera = titulo.closest('div')!.parentElement!
    expect(within(cabecera).getByRole('button', { name: 'Nueva comunidad' })).toBeInTheDocument()
    expect(within(cabecera).queryByRole('button', { name: 'Capturar PNG' })).not.toBeInTheDocument()
    expect(within(cabecera).queryByRole('link', { name: 'Calidad de datos' })).not.toBeInTheDocument()
    await userEvent.click(within(cabecera).getByRole('button', { name: 'Más acciones' }))
    const menu = within(cabecera).getByRole('group', { name: 'Más acciones' })
    expect(within(menu).getByRole('link', { name: 'Calidad de datos' })).toHaveAttribute('href', '/territory/quality')
    expect(within(menu).getByRole('button', { name: 'Capturar PNG' })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: 'Exportar' })).toBeInTheDocument()
    expect(within(menu).queryByRole('button', { name: 'Nueva comunidad' })).not.toBeInTheDocument()
  })
})

describe('S12 · capas por WMS', () => {
  it('las capas públicas van por WMS y los lugares con ficha se siguen eligiendo sobre la tesela', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas())
    red = espiarRed([capacidades])
    await listaWms()
    expect(screen.getByRole('button', { name: 'Tesela que falla LYR-05' }).closest('li')).toHaveAttribute(
      'data-url',
      expect.stringContaining('/api/sgspe/territory/wms?service=WMS&version=1.1.1&request=GetMap&layers=t_community__territory&styles=sgspe-lyr-05')
    )
    expect(await screen.findByRole('button', { name: 'Comunidad Ejemplo' })).toHaveAttribute('data-invisible', 'si')
    await userEvent.click(within(await capas()).getByRole('checkbox', { name: /Límites administrativos/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tesela que falla LYR-01' })).toBeInTheDocument())
    expect(red.a('GET', '/sgspe/territory/layers/LYR-01')).toEqual([])
  })

  it('un 503 de una tesela apaga el WMS y vuelve al GeoJSON, con el aviso y «Reintentar»', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas())
    red = espiarRed([capacidades])
    await listaWms()
    await userEvent.click(within(await capas()).getByRole('checkbox', { name: /Límites administrativos/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Tesela que falla LYR-01' }))
    expect(await screen.findByText(/El servicio de mapas de referencia no responde/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Mapa territorial · WMS' })).not.toBeInTheDocument()
    await waitFor(() => expect(red!.a('GET', '/sgspe/territory/layers/LYR-01').length).toBeGreaterThan(0))
    expect(await screen.findByRole('button', { name: 'Comunidad Ejemplo' })).toHaveAttribute('data-invisible', 'no')
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await listaWms()).toBeInTheDocument()
    expect(screen.queryByText(/El servicio de mapas de referencia no responde/)).not.toBeInTheDocument()
  })

  it('un 503 del GetCapabilities empieza con el aviso y todo por GeoJSON; «Reintentar» vuelve a pedirlo', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas())
    let veces = 0
    red = espiarRed([
      {
        path: '/sgspe/territory/wms',
        responder: () =>
          ++veces === 1 ? problema(503, 'GeoServer no responde', [{ field: 'wms', message: 'GEOSERVER_UNAVAILABLE' }]) : capacidades.responder()
      }
    ])
    expect(await screen.findByText(/El servicio de mapas de referencia no responde/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Comunidad Ejemplo' })).toHaveAttribute('data-invisible', 'no')
    expect(screen.queryByRole('list', { name: 'Mapa territorial · WMS' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await listaWms()).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/El servicio de mapas de referencia no responde/)).not.toBeInTheDocument())
    expect(red.a('GET', '/sgspe/territory/wms')).toHaveLength(2)
  })

  it('sin GetCapabilities (backend sin F6) todo va por GeoJSON, sin aviso', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas())
    expect(await screen.findByRole('button', { name: 'Comunidad Ejemplo' })).toHaveAttribute('data-invisible', 'no')
    expect(screen.queryByRole('list', { name: 'Mapa territorial · WMS' })).not.toBeInTheDocument()
    expect(screen.queryByText(/El servicio de mapas de referencia no responde/)).not.toBeInTheDocument()
  })
})

describe('S12 · filtros, leyenda y captura', () => {
  it('el proyecto y el periodo viajan en la URL y las capas se piden con el proyecto', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas())
    red = espiarRed()
    const filtros = await screen.findByRole('group', { name: 'Filtros del mapa' })
    // un solo control de proyecto (A24): el de la barra es el lente del mapa, y la pantalla no tiene uno propio
    expect(within(filtros).queryByLabelText('Proyecto del mapa')).not.toBeInTheDocument()
    const barra = within(screen.getByRole('banner'))
    await userEvent.click(await barra.findByRole('combobox', { name: 'Proyecto' }))
    await userEvent.click(await barra.findByRole('option', { name: 'PRJ-01 · Proyecto Ejemplo A' }))
    await waitFor(() => expect(rutaActual()).toBe('/territory?project=p1'))
    await waitFor(() => expect(red!.a('GET', '/sgspe/territory/layers/LYR-05').some((l) => l.ruta.includes('project=p1'))).toBe(true))
    await userEvent.type(within(filtros).getByLabelText('Desde'), '01/07/2026')
    await waitFor(() => expect(rutaActual()).toContain('periodStart=2026-07-01'))
    // el periodo no filtra las capas de referencia (Layers.kt): no se les manda
    expect(red.a('GET', '/sgspe/territory/layers/LYR-05').some((l) => l.ruta.includes('periodStart'))).toBe(false)
    expect(within(filtros).getByText(/las capas de referencia no tienen fecha/)).toBeInTheDocument()
  })

  it('un periodo al revés o de más de 5 años se dice y no llega a la URL', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T15:00:00Z'))
    try {
      fetch = abrirPortal('/territory?periodEnd=2026-06-30', ANALISTA_SIG, EQUIPO_SIG, rutas())
      const filtros = await screen.findByRole('group', { name: 'Filtros del mapa' })
      await userEvent.type(within(filtros).getByLabelText('Desde'), '01/07/2026')
      expect(await within(filtros).findByRole('alert')).toHaveTextContent('La fecha de inicio no puede ser posterior a la de fin.')
      expect(rutaActual()).toBe('/territory?periodEnd=2026-06-30')
      await userEvent.clear(within(filtros).getByLabelText('Desde'))
      await userEvent.type(within(filtros).getByLabelText('Desde'), '30/06/2021')
      expect(await within(filtros).findByRole('alert')).toHaveTextContent('El periodo no puede pasar de 5 años.')
      expect(rutaActual()).toBe('/territory?periodEnd=2026-06-30')
      await userEvent.clear(within(filtros).getByLabelText('Desde'))
      await userEvent.type(within(filtros).getByLabelText('Desde'), '01/07/2021')
      await waitFor(() => expect(rutaActual()).toBe('/territory?periodEnd=2026-06-30&periodStart=2021-07-01'))
      expect(within(filtros).queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  // design-system.md §5: los atajos llenan las dos fechas con el día de Lima y quitan un periodo tecleado que no valía
  it('un atajo de periodo escribe las dos fechas en la URL y quita el aviso del periodo tecleado', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T15:00:00Z'))
    try {
      fetch = abrirPortal('/territory?periodEnd=2026-06-30', ANALISTA_SIG, EQUIPO_SIG, rutas())
      const filtros = await screen.findByRole('group', { name: 'Filtros del mapa' })
      await userEvent.type(within(filtros).getByLabelText('Desde'), '01/07/2026')
      expect(await within(filtros).findByRole('alert')).toBeInTheDocument()
      const atajos = within(filtros).getByRole('group', { name: 'Atajos de periodo' })
      await userEvent.click(within(atajos).getByRole('button', { name: 'Año pasado' }))
      await waitFor(() => expect(rutaActual()).toBe('/territory?periodEnd=2025-12-31&periodStart=2025-01-01'))
      expect(within(filtros).queryByRole('alert')).not.toBeInTheDocument()
      expect(within(filtros).getByLabelText('Desde')).toHaveValue('01/01/2025')
      expect(within(atajos).getByRole('button', { name: 'Año pasado' })).toHaveAttribute('aria-pressed', 'true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('las fechas inválidas tecleadas ceden a la URL si el periodo cambia por otro camino (atrás, un enlace)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T15:00:00Z'))
    try {
      fetch = abrirPortal('/territory?periodEnd=2026-06-30', ANALISTA_SIG, EQUIPO_SIG, rutas())
      const filtros = await screen.findByRole('group', { name: 'Filtros del mapa' })
      await userEvent.type(within(filtros).getByLabelText('Desde'), '01/07/2026')
      expect(await within(filtros).findByRole('alert')).toBeInTheDocument()
      act(() => {
        window.history.pushState({}, '', '/territory?periodStart=2026-01-01&periodEnd=2026-03-31')
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
      await waitFor(() => expect(within(filtros).getByLabelText('Desde')).toHaveValue('01/01/2026'))
      expect(within(filtros).getByLabelText('Hasta')).toHaveValue('31/03/2026')
      expect(within(filtros).queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('el periodo sigue la regla del servidor: menos de 5 años, el 29 de febrero cae al 28, sin inicio son 12 meses', () => {
    expect(problemaDelPeriodo('', '')).toBeNull()
    expect(problemaDelPeriodo('2024-02-29', '2029-02-27', '2026-10-12')).toBeNull()
    expect(problemaDelPeriodo('2024-02-29', '2029-02-28', '2026-10-12')).toBe('periodoLargo')
    expect(problemaDelPeriodo('', '2026-06-30', '2026-10-12')).toBeNull()
    expect(problemaDelPeriodo('2021-10-13', '', '2026-10-12')).toBeNull()
    expect(problemaDelPeriodo('2021-10-12', '', '2026-10-12')).toBe('periodoLargo')
    expect(problemaDelPeriodo('2026-10-12', '', '2026-10-12')).toBeNull()
    expect(problemaDelPeriodo('2026-10-12', '2026-10-11', '2026-10-12')).toBe('periodoAlReves')
  })

  it('sin fin, el periodo termina hoy en Lima: un inicio futuro se rechaza', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T15:00:00Z'))
    try {
      fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas())
      const filtros = await screen.findByRole('group', { name: 'Filtros del mapa' })
      await userEvent.type(within(filtros).getByLabelText('Desde'), '13/10/2026')
      expect(await within(filtros).findByRole('alert')).toHaveTextContent('La fecha de inicio no puede ser posterior a la de fin.')
      expect(rutaActual()).toBe('/territory')
    } finally {
      vi.useRealTimers()
    }
  })

  // la leyenda ya no es un panel aparte: las capas en el mapa llevan su muestra de la paleta, arriba del panel (DD-11); «Capturar
  // PNG» pasa a «Más acciones»
  it('arriba van las capas encendidas con su leyenda; Gestión solo ofrece el calor sin capas; «Capturar PNG» está en el menú', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas(...sinGestion()))
    const panel = await capas()
    const enElMapa = within(panel).getByRole('region', { name: 'Capas en el mapa' })
    expect(
      within(enElMapa)
        .getAllByRole('checkbox')
        .map((c) => c.closest('label')!.textContent)
    ).toEqual(['Centros poblados y localidades', 'Territorio comunal'])
    expect(within(panel).getByRole('checkbox', { name: /Concesiones mineras/ })).toBeInTheDocument()
    expect(within(await masAcciones()).getByRole('button', { name: 'Capturar PNG' })).toBeInTheDocument()
    await waitFor(() => expect(fetch!.calls.filter((l) => l.path.startsWith('/sgspe/territory/layers/LYR-19')).length).toBe(1))
    expect(within(await within(await capas()).findByRole('group', { name: 'Gestión' })).queryAllByRole('checkbox')).toEqual([])
  })
  it('«Exportar» abre el diálogo con el territorio comunal y el proyecto del filtro (spec §3.5)', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fetch = abrirPortal('/territory?project=p1', ANALISTA_SIG, EQUIPO_SIG, rutas(...sinGestion()))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/territory/exports',
        responder: () => new Response('{}', { headers: { 'Content-Disposition': 'attachment; filename="community-interno.gpkg"' } })
      }
    ])
    await userEvent.click(within(await masAcciones()).getByRole('button', { name: 'Exportar' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Exportar una capa' })
    expect(within(dialogo).getByRole('combobox', { name: 'Capa' })).toHaveValue('LYR-05')
    await userEvent.selectOptions(within(dialogo).getByRole('combobox', { name: 'Formato' }), 'gpkg')
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'UTM del proyecto' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Exportar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/territory/exports')).toHaveLength(1))
    expect(red.a('POST', '/sgspe/territory/exports')[0].cuerpo).toMatchObject({ object: 'community', coordinates: 'UTM', filters: { project: ['p1'] } })
    await waitFor(() => expect(clic).toHaveBeenCalled())
    clic.mockRestore()
  })
})

describe('S12 · capas de gestión (LYR-17 a LYR-24)', () => {
  it('un backend sin el plan 6.2c (404 LAYER_NOT_FOUND en la sonda) no ofrece ninguna, sin aviso', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas(...sinGestion()))
    await waitFor(() => expect(fetch!.calls.some((l) => l.path.startsWith('/sgspe/territory/layers/LYR-19'))).toBe(true))
    await screen.findByRole('button', { name: 'Comunidad Ejemplo' })
    expect(within(await within(await capas()).findByRole('group', { name: 'Gestión' })).queryAllByRole('checkbox')).toEqual([])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('con 6.2c se listan las ocho tras una sola sonda barata, de registros y no de un agregado', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas())
    const gestion = await within(await capas()).findByRole('group', { name: 'Gestión' })
    expect(
      within(gestion)
        .getAllByRole('checkbox')
        .map((c) => c.closest('label')!.textContent)
    ).toEqual([
      'Grupos de interés por localidad',
      'Interacciones, visitas y observaciones',
      'Compromisos',
      'Quejas, consultas y solicitudes',
      'Riesgos sociales',
      'Incidentes, señales y alertas',
      'Inversión social: iniciativas, aportes y entregas',
      'Evidencias geolocalizadas'
    ])
    // un encuadre sin lugares, sin proyecto ni periodo, sobre los compromisos; ninguna otra capa de gestión se pide apagada
    expect(fetch.calls.filter((l) => /^\/sgspe\/territory\/layers\/LYR-(1[7-9]|2\d)/.test(l.path)).map((l) => l.path)).toEqual([
      '/sgspe/territory/layers/LYR-19?bbox=0%2C0%2C0%2C0'
    ])
  })

  it('un 403 de la sonda deja la lista: la capa sin permiso se bloquea al encenderla', async () => {
    fetch = abrirPortal(
      '/territory',
      ANALISTA_SIG,
      EQUIPO_SIG,
      rutas({ path: '/sgspe/territory/layers/LYR-19', status: 403, body: { title: 'Forbidden', status: 403, detail: 'Sin permiso' } })
    )
    const gestion = await within(await capas()).findByRole('group', { name: 'Gestión' })
    await userEvent.click(within(gestion).getByRole('checkbox', { name: /Compromisos/ }))
    await waitFor(() => expect(within(gestion).getByRole('checkbox', { name: /Compromisos/ })).toBeDisabled())
    expect(within(gestion).getByRole('checkbox', { name: /Riesgos sociales/ })).toBeEnabled()
  })

  it('LYR-17 dibuja un punto por localidad con sus grupos de interés por postura, y lleva el periodo', async () => {
    fetch = abrirPortal('/territory?periodStart=2026-01-01', ANALISTA_SIG, EQUIPO_SIG, rutas({ path: '/sgspe/territory/layers/LYR-17', body: CAPA_LYR_17 }))
    red = espiarRed()
    await userEvent.click(await within(await capas()).findByRole('checkbox', { name: /Grupos de interés por localidad/ }))
    const resumen = await screen.findByRole('region', { name: 'Grupos de interés por localidad' })
    expect(within(resumen).getByRole('listitem')).toHaveTextContent('Localidad Ejemplo · 6 grupos de interés · A FAVOR: 3 · NEUTRAL: 1 · Sin dato: 2')
    await waitFor(() => expect(red!.a('GET', '/sgspe/territory/layers/LYR-17').some((l) => l.ruta.includes('periodStart=2026-01-01'))).toBe(true))
    // es un lugar, nunca una persona: elegirlo abre la ficha contextual de la localidad (decisión 11)
    const punto = within(screen.getByRole('list', { name: 'Mapa territorial' }))
      .getAllByRole('button', { name: 'Localidad Ejemplo' })
      .find((b) => b.dataset.capa === 'LYR-17')!
    await userEvent.click(punto)
    await waitFor(() => expect(rutaActual()).toBe('/territory?periodStart=2026-01-01&selected=locality%3Al1'))
    expect(await screen.findByRole('complementary', { name: 'Ficha del lugar' })).toBeInTheDocument()
  })

  it('sin la postura, LYR-17 dice «No disponible» en la postura y deja el total', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas({ path: '/sgspe/territory/layers/LYR-17', body: CAPA_LYR_17_SIN_POSTURA }))
    await userEvent.click(await within(await capas()).findByRole('checkbox', { name: /Grupos de interés por localidad/ }))
    const resumen = await screen.findByRole('region', { name: 'Grupos de interés por localidad' })
    expect(within(resumen).getByRole('listitem')).toHaveTextContent('Localidad Ejemplo · 6 grupos de interés · Postura: No disponible')
    expect(within(await capas()).getByText('Su cuenta no puede leer parte de los datos de esta capa.')).toBeInTheDocument()
  })

  it('sin total, LYR-17 dice «No disponible» y nunca un cero', async () => {
    const sinTotal = {
      ...CAPA_LYR_17,
      features: CAPA_LYR_17.features.map((f) => ({ ...f, properties: { ...f.properties, total: undefined } }))
    }
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas({ path: '/sgspe/territory/layers/LYR-17', body: sinTotal }))
    await userEvent.click(await within(await capas()).findByRole('checkbox', { name: /Grupos de interés por localidad/ }))
    const resumen = await screen.findByRole('region', { name: 'Grupos de interés por localidad' })
    expect(within(resumen).getByRole('listitem')).toHaveTextContent('Localidad Ejemplo · Grupos de interés: No disponible · A FAVOR: 3')
    expect(within(resumen).getByRole('listitem')).not.toHaveTextContent(/\b0 grupos/)
  })

  it('LYR-23 suma los aportes por localidad y moneda, sin mezclar monedas', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas({ path: '/sgspe/territory/layers/LYR-23', body: CAPA_LYR_23 }))
    await userEvent.click(await within(await capas()).findByRole('checkbox', { name: /Inversión social/ }))
    const resumen = await screen.findByRole('region', { name: 'Inversión social: iniciativas, aportes y entregas' })
    expect(within(resumen).getByRole('listitem')).toHaveTextContent('Otra Localidad Ejemplo · S/ 1,500.00 (3 aportes) · USD 200.00 (1 aporte)')
    expect(screen.getByRole('button', { name: 'Iniciativa Ejemplo' })).toBeInTheDocument()
  })

  it('LYR-20 avisa que hay QCS confidenciales ocultas y elegir una lleva a su ficha', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas({ path: '/sgspe/territory/layers/LYR-20', body: CAPA_LYR_20 }))
    await userEvent.click(await within(await capas()).findByRole('checkbox', { name: /Quejas, consultas y solicitudes/ }))
    expect(await within(await capas()).findByText(/confidenciales que su cuenta no ve/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'QJ-001' }))
    await waitFor(() => expect(rutaActual()).toBe('/r/grievance/g1'))
  })

  it('un periodo fuera de rango que el servidor rechaza se dice con su texto en la capa', async () => {
    fetch = abrirPortal(
      '/territory?periodStart=2026-01-01&periodEnd=2026-06-30',
      ANALISTA_SIG,
      EQUIPO_SIG,
      rutas({
        path: /^\/sgspe\/territory\/layers\/LYR-18\?.*period/,
        status: 400,
        body: { title: 'Bad Request', status: 400, detail: 'Fuera de rango', errors: [{ field: 'periodEnd', message: 'OUT_OF_RANGE' }] }
      })
    )
    await userEvent.click(await within(await capas()).findByRole('checkbox', { name: /Interacciones, visitas y observaciones/ }))
    expect(await within(await capas()).findByText('El periodo elegido está fuera del rango permitido: revise las fechas.')).toBeInTheDocument()
  })

  it('una fecha ilegible que el servidor rechaza (INVALID_VALUE) no se dice como «fuera de rango»', async () => {
    fetch = abrirPortal(
      '/territory?periodStart=2026-13-45',
      ANALISTA_SIG,
      EQUIPO_SIG,
      rutas({
        path: /^\/sgspe\/territory\/layers\/LYR-18\?.*period/,
        status: 400,
        body: { title: 'Bad Request', status: 400, detail: 'No es una fecha', errors: [{ field: 'periodStart', message: 'INVALID_VALUE' }] }
      })
    )
    await userEvent.click(await within(await capas()).findByRole('checkbox', { name: /Interacciones, visitas y observaciones/ }))
    expect(await within(await capas()).findByText('Una fecha del periodo no es válida: revise las fechas.')).toBeInTheDocument()
    expect(within(await capas()).queryByText(/fuera del rango/)).not.toBeInTheDocument()
  })
})

describe('S12 · mapa de calor', () => {
  it('elegir el objeto lo pone en la URL, pide la concentración con el proyecto y el periodo, y la dibuja y la lista', async () => {
    fetch = abrirPortal('/territory?project=p1&periodStart=2026-07-01', ANALISTA_SIG, EQUIPO_SIG, [
      ...rutas(),
      { path: '/sgspe/territory/concentration', body: { ...CONCENTRACION, confidentialHidden: true } }
    ])
    red = espiarRed()
    const control = await capas()
    const selector = within(control).getByLabelText('Mapa de calor')
    expect(within(selector).queryByRole('option', { name: 'Consultas' })).not.toBeInTheDocument()
    await userEvent.selectOptions(selector, 'grievance')
    await waitFor(() => expect(rutaActual()).toContain('heat=grievance'))
    expect(await screen.findByTestId('calor')).toHaveTextContent('2')
    expect(screen.getByTestId('calor')).toHaveAttribute('data-maximo', '5')
    expect(red.a('GET', '/sgspe/territory/concentration')[0].ruta).toBe('/sgspe/territory/concentration?of=grievance&project=p1&periodStart=2026-07-01')
    const tabla = screen.getByRole('table', { name: 'Concentración por localidad' })
    expect(
      within(tabla)
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.textContent)
    ).toEqual(['Localidad Ejemplo5', 'Otra Localidad Ejemplo2'])
    expect(screen.getByRole('note')).toHaveTextContent(/confidenciales/)
    expect(screen.getByText(/sin localidad ni comunidad no cuentan/)).toBeInTheDocument()
    // las fechas en es-PE, como el tablero (revisión final, m8)
    expect(screen.getByText(/^Periodo contado: del 11 oct.? 2025 al 10 oct.? 2026\.$/)).toBeInTheDocument()
  })

  it('sin confidentialHidden no hay nota; truncated y available:false lo dicen', async () => {
    fetch = abrirPortal('/territory?heat=grievance', ANALISTA_SIG, EQUIPO_SIG, [
      ...rutas(),
      { path: '/sgspe/territory/concentration', body: { ...CONCENTRACION, truncated: true, available: false, missingFields: ['locality.location'] } }
    ])
    expect(await screen.findByText(/Hay más lugares que los que caben/)).toBeInTheDocument()
    expect(screen.getByText(/puede estar incompleta/)).toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('sin permiso sobre el objeto la tabla dice «No disponible» y el mapa no dibuja calor', async () => {
    fetch = abrirPortal('/territory?heat=grievance', ANALISTA_SIG, EQUIPO_SIG, [
      ...rutas(),
      { path: '/sgspe/territory/concentration', status: 403, body: { title: 'Forbidden', status: 403 } }
    ])
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByTestId('calor')).not.toBeInTheDocument()
  })
})
