import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock, MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirPortal, rutaActual } from '../../test/pantalla'
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
const capas = () => screen.findByRole('region', { name: 'Capas' })

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
    await userEvent.click(screen.getByRole('checkbox', { name: /Límites administrativos/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tesela que falla LYR-01' })).toBeInTheDocument())
    expect(red.a('GET', '/sgspe/territory/layers/LYR-01')).toEqual([])
  })

  it('un 503 de una tesela apaga el WMS y vuelve al GeoJSON, con el aviso y «Reintentar»', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas())
    red = espiarRed([capacidades])
    await listaWms()
    await userEvent.click(screen.getByRole('checkbox', { name: /Límites administrativos/ }))
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
    await within(filtros).findByRole('option', { name: 'PRJ-01 · Proyecto Ejemplo A' })
    await userEvent.selectOptions(within(filtros).getByLabelText('Proyecto del mapa'), 'p1')
    await waitFor(() => expect(rutaActual()).toBe('/territory?project=p1'))
    await waitFor(() => expect(red!.a('GET', '/sgspe/territory/layers/LYR-05').some((l) => l.ruta.includes('project=p1'))).toBe(true))
    await userEvent.type(within(filtros).getByLabelText('Desde'), '2026-07-01')
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
      await userEvent.type(within(filtros).getByLabelText('Desde'), '2026-07-01')
      expect(await within(filtros).findByRole('alert')).toHaveTextContent('La fecha de inicio no puede ser posterior a la de fin.')
      expect(rutaActual()).toBe('/territory?periodEnd=2026-06-30')
      await userEvent.clear(within(filtros).getByLabelText('Desde'))
      await userEvent.type(within(filtros).getByLabelText('Desde'), '2021-06-30')
      expect(await within(filtros).findByRole('alert')).toHaveTextContent('El periodo no puede pasar de 5 años.')
      expect(rutaActual()).toBe('/territory?periodEnd=2026-06-30')
      await userEvent.clear(within(filtros).getByLabelText('Desde'))
      await userEvent.type(within(filtros).getByLabelText('Desde'), '2021-07-01')
      await waitFor(() => expect(rutaActual()).toBe('/territory?periodEnd=2026-06-30&periodStart=2021-07-01'))
      expect(within(filtros).queryByRole('alert')).not.toBeInTheDocument()
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
      await userEvent.type(within(filtros).getByLabelText('Desde'), '2026-07-01')
      expect(await within(filtros).findByRole('alert')).toBeInTheDocument()
      act(() => {
        window.history.pushState({}, '', '/territory?periodStart=2026-01-01&periodEnd=2026-03-31')
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
      await waitFor(() => expect(within(filtros).getByLabelText('Desde')).toHaveValue('2026-01-01'))
      expect(within(filtros).getByLabelText('Hasta')).toHaveValue('2026-03-31')
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
      await userEvent.type(within(filtros).getByLabelText('Desde'), '2026-10-13')
      expect(await within(filtros).findByRole('alert')).toHaveTextContent('La fecha de inicio no puede ser posterior a la de fin.')
      expect(rutaActual()).toBe('/territory')
    } finally {
      vi.useRealTimers()
    }
  })

  it('la leyenda dice las capas encendidas; Gestión no se ofrece sin contenido; «Capturar PNG» está a mano', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas(...sinGestion()))
    const leyenda = await screen.findByRole('region', { name: 'Leyenda' })
    expect(
      within(leyenda)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['Centros poblados y localidades', 'Territorio comunal'])
    expect(screen.getByRole('checkbox', { name: /Concesiones mineras/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Capturar PNG' })).toBeInTheDocument()
    await waitFor(() => expect(fetch!.calls.filter((l) => l.path.startsWith('/sgspe/territory/layers/LYR-19')).length).toBe(1))
    expect(within(await capas()).queryByRole('group', { name: 'Gestión' })).not.toBeInTheDocument()
  })
})

describe('S12 · capas de gestión (LYR-17 a LYR-24)', () => {
  it('un backend sin el plan 6.2c (404 LAYER_NOT_FOUND en la sonda) no ofrece ninguna, sin aviso', async () => {
    fetch = abrirPortal('/territory', ANALISTA_SIG, EQUIPO_SIG, rutas(...sinGestion()))
    await waitFor(() => expect(fetch!.calls.some((l) => l.path.startsWith('/sgspe/territory/layers/LYR-19'))).toBe(true))
    await screen.findByRole('button', { name: 'Comunidad Ejemplo' })
    expect(within(await capas()).queryByRole('group', { name: 'Gestión' })).not.toBeInTheDocument()
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
    // es un lugar, nunca una persona: elegirlo lleva a la ficha de la localidad
    const punto = within(screen.getByRole('list', { name: 'Mapa territorial' }))
      .getAllByRole('button', { name: 'Localidad Ejemplo' })
      .find((b) => b.dataset.capa === 'LYR-17')!
    await userEvent.click(punto)
    await waitFor(() => expect(rutaActual()).toBe('/territory/localities/l1'))
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
    expect(await within(await capas()).findByText('El periodo elegido está fuera del rango que admite el servidor: revise las fechas.')).toBeInTheDocument()
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
