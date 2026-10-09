import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, pagina, registro } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { E1, EQUIPO, base } from '../../test/relacionamiento'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))
vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

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
  vi.unstubAllGlobals()
})

const RUTA = {
  type: 'LineString',
  coordinates: [
    [-78.2, -8.3],
    [-78.1, -8.2]
  ]
}
const VISITA = registro(
  'v1',
  { project: 'p1', title: 'Salida a Tunas', objective: 'Coordinar la asamblea', outcome_summary: null },
  { state: 'in_progress', geometries: { route: RUTA } }
)
const DEFINICION_VISITA = definicion('field_visit', [
  'project',
  'title',
  'objective',
  'itinerary',
  'outcome_summary',
  'leader_user_email',
  ['planned_start_date', { type: 'DATE' }],
  ['route', { type: 'GEOMETRY' }]
])
const DEFINICION_OBSERVACION = definicion('field_observation', [
  'field_visit',
  'observation',
  ['observed_at', { type: 'DATETIME' }],
  ['location', { type: 'GEOMETRY' }]
])
const CONCLUIR = [{ name: 'complete', label: 'Concluir', to: 'completed', toLabel: 'Concluida', allowed: true, reason: null }]
const ERROR = (status: number) => ({ title: 'x', status, detail: 'x', errors: [] })

const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...base(),
  { path: '/objects/field_visit/records/v1', body: VISITA },
  { path: '/objects/field_visit/records/v1/transitions', body: CONCLUIR },
  { path: '/metadata/objects/field_visit', body: DEFINICION_VISITA },
  { path: '/metadata/objects/field_observation', body: DEFINICION_OBSERVACION },
  { path: '/objects/engagement/records', body: pagina([E1]) },
  { path: '/objects/field_observation/records', body: pagina([]) },
  { method: 'POST', path: '/objects/field_observation/records', status: 201, body: registro('o1', {}) }
]

const geolocalizacion = (longitud: number, latitud: number) =>
  vi.stubGlobal('navigator', {
    ...navigator,
    geolocation: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { longitude: longitud, latitude: latitud } }) }
  })

async function abrirObservacion() {
  await userEvent.click(await screen.findByRole('button', { name: 'Agregar observación aquí' }))
  return screen.findByRole('textbox', { name: 'Observaciones' })
}

describe('S26 · visita de campo', () => {
  it('agrega una observación con la ubicación del teléfono y lista las interacciones de la visita', async () => {
    geolocalizacion(-78.2, -8.3)
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    expect(await screen.findByRole('button', { name: 'Concluir' })).toBeInTheDocument()
    expect(screen.getByText(/Concluir no cambia las interacciones pendientes/)).toBeInTheDocument()
    expect(within(await screen.findByRole('table', { name: 'Interacciones de la visita' })).getByRole('link', { name: 'Asamblea comunal' })).toBeInTheDocument()
    await userEvent.type(await abrirObservacion(), 'Camino afectado por huaico')
    await userEvent.click(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/field_observation/records')).toHaveLength(1))
    const [alta] = red.a('POST', '/objects/field_observation/records')
    expect(alta.cuerpo).toMatchObject({
      attributes: { field_visit: 'v1', observation: 'Camino afectado por huaico' },
      geometries: { location: { type: 'Point', coordinates: [-78.2, -8.3] } }
    })
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('el punto también se captura tecleando longitud y latitud, y un valor fuera de rango se dice sin escribir nada', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await userEvent.type(await abrirObservacion(), 'Puente caído')
    await userEvent.type(screen.getByLabelText('Longitud'), '-78,25')
    await userEvent.type(screen.getByLabelText('Latitud'), '-98')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/Indique la longitud/)).toBeInTheDocument()
    expect(red.a('POST', '/objects/field_observation/records')).toHaveLength(0)
    await userEvent.clear(screen.getByLabelText('Latitud'))
    await userEvent.type(screen.getByLabelText('Latitud'), '-8.3')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/field_observation/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/field_observation/records')[0].cuerpo).toMatchObject({
      geometries: { location: { type: 'Point', coordinates: [-78.25, -8.3] } }
    })
  })

  it('una observación vacía se avisa en lugar de callarse', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await abrirObservacion()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Escriba la observación')).toBeInTheDocument()
    expect(red.a('POST', '/objects/field_observation/records')).toHaveLength(0)
  })

  it('una segunda observación lleva otra clave de idempotencia y un formulario limpio', async () => {
    geolocalizacion(-78.2, -8.3)
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await userEvent.type(await abrirObservacion(), 'Primera')
    await userEvent.click(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/field_observation/records')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Observaciones' })).not.toBeInTheDocument())
    const segundo = await abrirObservacion()
    expect(segundo).toHaveValue('')
    expect(screen.getByLabelText('Longitud')).toHaveValue('')
    await userEvent.type(segundo, 'Segunda')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/field_observation/records')).toHaveLength(2))
    const [a, b] = red.a('POST', '/objects/field_observation/records')
    expect(a.cabeceras.get('Idempotency-Key')).not.toBe(b.cabeceras.get('Idempotency-Key'))
    expect((b.cuerpo as { geometries?: unknown }).geometries).toBeUndefined()
  })

  it('un error al guardar la observación dice su texto, conserva lo escrito y reintenta con la misma clave', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    let intentos = 0
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/field_observation/records',
        responder: () =>
          ++intentos === 1 ? problema(403, 'No asignado', [{ field: 'record', message: 'NOT_ASSIGNED' }]) : jsonResponse(registro('o1', {}), 201)
      }
    ])
    await userEvent.type(await abrirObservacion(), 'Derrumbe')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/No tiene una asignación vigente/)).toBeInTheDocument()
    expect(screen.queryByText('NOT_ASSIGNED')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Observaciones' })).toHaveValue('Derrumbe')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/field_observation/records')).toHaveLength(2))
    const [a, b] = red.a('POST', '/objects/field_observation/records')
    expect(a.cabeceras.get('Idempotency-Key')).toBe(b.cabeceras.get('Idempotency-Key'))
  })

  it('sin poder escribir la ubicación no ofrece capturarla', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, [
      {
        path: '/metadata/objects/field_observation',
        body: definicion('field_observation', ['field_visit', 'observation', ['location', { type: 'GEOMETRY', editable: false }]])
      },
      ...rutas()
    ])
    await abrirObservacion()
    expect(screen.queryByRole('button', { name: 'Usar la ubicación del teléfono' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Longitud')).not.toBeInTheDocument()
  })

  it('si el teléfono no da la ubicación lo dice', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: { getCurrentPosition: (_ok: unknown, mal: () => void) => mal() }
    })
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    await abrirObservacion()
    await userEvent.click(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' }))
    expect(await screen.findByText('No se pudo leer la ubicación')).toBeInTheDocument()
  })

  it('la ruta, las interacciones y las observaciones se dibujan en el mapa y las observaciones se listan', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, [
      {
        path: '/objects/field_observation/records',
        body: pagina([
          registro(
            'o9',
            { observation: 'Camino afectado', observed_at: '2026-10-02T03:00:00Z' },
            { geometries: { location: { type: 'Point', coordinates: [-78.2, -8.3] } } }
          )
        ])
      },
      {
        path: '/objects/engagement/records',
        body: pagina([{ ...E1, geometries: { location: { type: 'Point', coordinates: [-78.1, -8.2] } } }])
      },
      ...rutas()
    ])
    const mapa = await screen.findByRole('list', { name: 'Ruta y observaciones' })
    await waitFor(() => expect(within(mapa).getByRole('button', { name: 'Camino afectado' })).toHaveAttribute('data-capa', 'observaciones'))
    expect(within(mapa).getByRole('button', { name: 'Salida a Tunas' })).toHaveAttribute('data-capa', 'ruta')
    expect(within(mapa).getByRole('button', { name: 'Asamblea comunal' })).toHaveAttribute('data-capa', 'interacciones')
    // 2026-10-02T03:00Z es el 1 de octubre en Lima
    const lista = screen.getByRole('region', { name: 'Observaciones' })
    expect(within(lista).getByText(/Camino afectado/)).toBeInTheDocument()
    expect(within(lista).getByText(/1 oct\. 2026/)).toBeInTheDocument()
  })

  it('una lectura que falla no se dibuja como una lista vacía: un 403 dice no disponible y otro error ofrece reintentar', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, [
      { path: '/objects/engagement/records', status: 403, body: ERROR(403) },
      { path: '/objects/field_observation/records', status: 404, body: ERROR(404) },
      ...rutas()
    ])
    const tabla = await screen.findByRole('region', { name: 'Interacciones de la visita' })
    expect(await within(tabla).findByText('No disponible')).toBeInTheDocument()
    expect(within(tabla).queryByRole('table')).not.toBeInTheDocument()
    const observaciones = screen.getByRole('region', { name: 'Observaciones' })
    expect(await within(observaciones).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(within(observaciones).queryByText('Aún no hay observaciones.')).not.toBeInTheDocument()
  })

  it('una visita que la cuenta no lee dice no disponible', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, [
      { path: '/objects/field_visit/records/v1', status: 403, body: ERROR(403) },
      ...rutas()
    ])
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
  })

  it('el resumen del resultado se guarda con la versión leída; un 412 ofrece recargar y conserva lo escrito', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    let intentos = 0
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/field_visit/records/v1',
        responder: () => (++intentos === 1 ? problema(412, 'La visita cambió') : jsonResponse(VISITA))
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar el resultado' }))
    await userEvent.type(await screen.findByRole('textbox', { name: 'Resumen del resultado' }), 'Se acordó la asamblea')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Resumen del resultado' })).toHaveValue('Se acordó la asamblea')
    const lecturas = () => red!.a('GET', '/objects/field_visit/records/v1').length
    const antes = lecturas()
    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(lecturas()).toBeGreaterThan(antes))
    expect(screen.queryByText(/Otra persona cambió este registro/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/field_visit/records/v1')).toHaveLength(2))
    const [, segundo] = red.a('PUT', '/objects/field_visit/records/v1')
    expect(segundo.cabeceras.get('If-Match')).toBe('"2026-10-05T15:00:00Z"')
    expect(segundo.cuerpo).toMatchObject({ attributes: { outcome_summary: 'Se acordó la asamblea', title: 'Salida a Tunas' } })
    // lo que el GET no trajo y las geometrías no viajan
    expect(Object.keys((segundo.cuerpo as { attributes: object }).attributes)).not.toContain('itinerary')
    expect((segundo.cuerpo as { geometries?: unknown }).geometries).toBeUndefined()
  })

  it('un rol con "u" (sin campos escribibles) no recibe el formulario de resultado', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, [
      {
        path: '/metadata/objects/field_visit',
        body: definicion('field_visit', [
          ['project', { editable: false }],
          ['title', { editable: false }],
          ['outcome_summary', { editable: false }]
        ])
      },
      ...rutas()
    ])
    await screen.findByRole('button', { name: 'Concluir' })
    expect(screen.queryByRole('button', { name: 'Editar el resultado' })).not.toBeInTheDocument()
  })

  it('sin asignación vigente al proyecto no se ofrece escribir, pero la visita se lee', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
      ...rutas()
    ])
    expect(await screen.findByRole('heading', { name: 'Salida a Tunas' })).toBeInTheDocument()
    await screen.findByRole('table', { name: 'Interacciones de la visita' })
    expect(screen.queryByRole('button', { name: 'Agregar observación aquí' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrar interacción de la visita' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar el resultado' })).not.toBeInTheDocument()
  })

  it('registrar una interacción de la visita lleva la visita en la ruta', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    const enlace = await screen.findByRole('link', { name: 'Registrar interacción de la visita' })
    expect(enlace).toHaveAttribute('href', '/projects/p1/engagements/new?field_visit=v1')
  })
})

describe('S26 · nueva visita', () => {
  const nueva = (extra: MockRoute[] = []): MockRoute[] => [
    ...extra,
    ...rutas(),
    { method: 'POST', path: '/objects/field_visit/records', status: 201, body: registro('v9', { project: 'p1', title: 'Nueva' }, { state: 'planned' }) },
    { path: '/objects/field_visit/records/v9', body: registro('v9', { project: 'p1', title: 'Nueva' }, { state: 'planned' }) },
    { path: '/objects/field_visit/records/v9/transitions', body: [] }
  ]

  it('crea la visita del proyecto y abre su ficha', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/new', RELACIONISTA, EQUIPO, nueva())
    red = espiarRed()
    await userEvent.type(await screen.findByRole('textbox', { name: /title/ }), 'Nueva')
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(red!.a('POST', '/objects/field_visit/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/field_visit/records')[0].cuerpo).toMatchObject({ attributes: { project: 'p1', title: 'Nueva' } })
    expect(await screen.findByRole('heading', { name: 'Nueva' })).toBeInTheDocument()
  })

  it('sin permiso para crear dice no disponible', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/new', RELACIONISTA, permisos({ ...EQUIPO.objects, field_visit: ['READ'] }), nueva())
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /title/ })).not.toBeInTheDocument()
  })
})

describe('S26 · visitas de campo del tenant', () => {
  const lista = (extra: MockRoute[] = []): MockRoute[] => [
    ...extra,
    ...rutas(),
    {
      path: '/objects/field_visit/records',
      body: pagina([VISITA, registro('v2', { project: 'p1', title: 'Segunda salida', planned_start_date: '2026-11-03' }, { state: 'planned' })])
    }
  ]

  it('lista las visitas con su proyecto y enlaza a cada una', async () => {
    fetch = abrirPortal('/field-visits', RELACIONISTA, EQUIPO, lista())
    const tabla = await screen.findByRole('table', { name: 'Visitas de campo' })
    expect(within(tabla).getByRole('link', { name: 'Salida a Tunas' })).toHaveAttribute('href', '/projects/p1/field-visits/v1')
    expect(within(tabla).getByRole('columnheader', { name: 'Proyecto' })).toBeInTheDocument()
    expect(await within(tabla).findAllByText('PRJ-01')).toHaveLength(2)
  })

  it('una lista que falla no se dibuja vacía', async () => {
    fetch = abrirPortal('/field-visits', RELACIONISTA, EQUIPO, [{ path: '/objects/field_visit/records', status: 404, body: ERROR(404) }, ...lista()])
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Visitas de campo' })).not.toBeInTheDocument()
  })

  it('una lista sin visitas lo dice', async () => {
    fetch = abrirPortal('/field-visits', RELACIONISTA, EQUIPO, [{ path: '/objects/field_visit/records', body: pagina([]) }, ...lista()])
    expect(await screen.findByText('Aún no hay visitas de campo.')).toBeInTheDocument()
  })

  it('Relacionamiento enlaza a las visitas de campo', async () => {
    fetch = abrirPortal('/engagements', RELACIONISTA, EQUIPO, lista())
    const enlace = await screen.findByRole('link', { name: 'Visitas de campo' })
    expect(enlace).toHaveAttribute('href', '/field-visits')
  })
})
