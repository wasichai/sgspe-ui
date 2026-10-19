import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, pagina, registro, workflow } from '../../test/montar'
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
  'leader_user_id',
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

  // un teléfono que responde cuando la prueba lo decide: guarda las funciones y las opciones de la lectura
  const telefonoLento = () => {
    const lectura: { ok?: (p: unknown) => void; mal?: (e: unknown) => void; opciones?: PositionOptions; llamadas: number } = { llamadas: 0 }
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void, mal: (e: unknown) => void, opciones?: PositionOptions) => {
          lectura.llamadas += 1
          Object.assign(lectura, { ok, mal, opciones })
        }
      }
    })
    return lectura
  }

  it('la lectura de la ubicación lleva plazo y edad máxima, dice que espera y no se puede repetir mientras tanto', async () => {
    const telefono = telefonoLento()
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    await abrirObservacion()
    await userEvent.click(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' }))
    expect(telefono.opciones).toEqual({ timeout: 15000, maximumAge: 30000, enableHighAccuracy: true })
    expect(screen.getByText('Obteniendo ubicación…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' }))
    expect(telefono.llamadas).toBe(1)
    act(() => telefono.ok?.({ coords: { longitude: -78.2, latitude: -8.3 } }))
    expect(screen.queryByText('Obteniendo ubicación…')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Longitud')).toHaveValue('-78.2')
    expect(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' })).toBeEnabled()
  })

  it('si la ubicación vence (timeout) lo dice, deja de esperar y permite reintentar', async () => {
    const telefono = telefonoLento()
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    await abrirObservacion()
    await userEvent.click(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' }))
    act(() => telefono.mal?.({ code: 3, message: 'Timeout expired' }))
    expect(await screen.findByText('No se pudo leer la ubicación')).toBeInTheDocument()
    expect(screen.queryByText('Obteniendo ubicación…')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' }))
    expect(telefono.llamadas).toBe(2)
  })

  it('una ubicación que llega tarde no pisa las coordenadas que la persona escribió mientras esperaba', async () => {
    const telefono = telefonoLento()
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    await abrirObservacion()
    await userEvent.click(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' }))
    await userEvent.type(screen.getByLabelText('Longitud'), '-77,5')
    await userEvent.type(screen.getByLabelText('Latitud'), '-9')
    expect(screen.queryByText('Obteniendo ubicación…')).not.toBeInTheDocument()
    act(() => telefono.ok?.({ coords: { longitude: -78.2, latitude: -8.3 } }))
    expect(screen.getByLabelText('Longitud')).toHaveValue('-77,5')
    expect(screen.getByLabelText('Latitud')).toHaveValue('-9')
  })

  it('el aviso de validación y el error de guardado se van al corregir lo escrito', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed([{ method: 'POST', path: '/objects/field_observation/records', responder: () => problema(400, 'La observación no es válida') }])
    await abrirObservacion()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Escriba la observación')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Observaciones' }), 'Derrumbe')
    expect(screen.queryByText('Escriba la observación')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Longitud'), '-200')
    await userEvent.type(screen.getByLabelText('Latitud'), '-8')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/Indique la longitud/)).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Longitud'))
    expect(screen.queryByText(/Indique la longitud/)).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Longitud'), '-78')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('La observación no es válida')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Observaciones' }), '!')
    expect(screen.queryByText('La observación no es válida')).not.toBeInTheDocument()
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

  it('el resumen del resultado se guarda con la versión leída; un 412 ofrece recargar, conserva lo escrito y guarda con la versión nueva', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, rutas())
    let intentos = 0
    let lecturas = 0
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/field_visit/records/v1',
        responder: () => (++intentos === 1 ? problema(412, 'La visita cambió') : jsonResponse(VISITA))
      },
      {
        // la primera lectura es la carga de la pantalla; las siguientes traen la visita que otra persona cambió
        path: '/objects/field_visit/records/v1',
        responder: () => jsonResponse(++lecturas === 1 ? VISITA : { ...VISITA, updatedAt: '2026-10-06T09:30:00Z' })
      }
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar el resultado' }))
    await userEvent.type(await screen.findByRole('textbox', { name: 'Resumen del resultado' }), 'Se acordó la asamblea')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(red.a('PUT', '/objects/field_visit/records/v1')[0].cabeceras.get('If-Match')).toBe('"2026-10-05T15:00:00Z"')
    expect(screen.getByRole('textbox', { name: 'Resumen del resultado' })).toHaveValue('Se acordó la asamblea')
    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(lecturas).toBeGreaterThan(1))
    expect(screen.queryByText(/Otra persona cambió este registro/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/field_visit/records/v1')).toHaveLength(2))
    const [, segundo] = red.a('PUT', '/objects/field_visit/records/v1')
    // la versión que otra persona dejó, no la que se leyó al abrir
    expect(segundo.cabeceras.get('If-Match')).toBe('"2026-10-06T09:30:00Z"')
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

  it('«Editar el resultado» exige poder escribir el resumen: con otros campos escribibles pero no ese, no se ofrece', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, [
      {
        path: '/metadata/objects/field_visit',
        body: definicion('field_visit', ['project', 'title', 'objective', ['outcome_summary', { editable: false }]])
      },
      ...rutas()
    ])
    await screen.findByRole('button', { name: 'Concluir' })
    // la definición llega después que la visita: se espera a que haya dejado de ser desconocida
    await waitFor(() => expect(fetch!.calls.some((c) => c.path.includes('/metadata/objects/field_visit'))).toBe(true))
    expect(screen.queryByRole('button', { name: 'Editar el resultado' })).not.toBeInTheDocument()
  })

  it('una visita cancelada no resalta ningún paso del camino y lo dice con su estado', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/v1', RELACIONISTA, EQUIPO, [
      { path: '/objects/field_visit/records/v1', body: { ...VISITA, state: 'cancelled' } },
      {
        path: '/objects/field_visit/workflow',
        body: workflow('field_visit', [
          ['planned', 'Planificada'],
          ['in_progress', 'En curso'],
          ['cancelled', 'Cancelada']
        ])
      },
      ...rutas()
    ])
    // el camino del flujo común (revisión de UX, etapa 4): la cancelada no es un paso del camino, se dice como el estado actual
    const camino = await screen.findByRole('list', { name: 'Camino del flujo' })
    expect(within(camino).getByText('Cancelada').closest('li')).toHaveAttribute('aria-current', 'step')
    expect((await screen.findAllByText('Cancelada')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Agregar observación aquí' })).not.toBeInTheDocument()
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

  const EQUIPO_DEL_PROYECTO = (miembros: [string, string, string][]): MockRoute => ({
    path: /^\/objects\/project_assignment\/records\?.*project=p1/,
    body: pagina(
      miembros.map(([id, email, rol]) => registro(`as-${id}`, { project: 'p1', member_user_id: id, member_user_email: email, role_name: rol, active: true }))
    )
  })

  it('el líder se elige del equipo del proyecto y viajan su identificador y su correo juntos', async () => {
    fetch = abrirPortal(
      '/projects/p1/field-visits/new',
      RELACIONISTA,
      EQUIPO,
      nueva([
        EQUIPO_DEL_PROYECTO([
          ['u1', 'pad@sgspe.test', 'PROJECT_ADMIN'],
          ['u2', 'smg@sgspe.test', 'SOCIAL_MANAGER']
        ])
      ])
    )
    red = espiarRed()
    await userEvent.type(await screen.findByRole('textbox', { name: /title/ }), 'Nueva')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Líder de la visita' }), 'u2')
    expect(screen.queryByLabelText('Correo del líder')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(red!.a('POST', '/objects/field_visit/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/field_visit/records')[0].cuerpo).toMatchObject({
      attributes: { project: 'p1', title: 'Nueva', leader_user_id: 'u2', leader_user_email: 'smg@sgspe.test' }
    })
  })

  it('sin elegir líder no viaja ninguno de sus dos datos', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/new', RELACIONISTA, EQUIPO, nueva([EQUIPO_DEL_PROYECTO([['u1', 'pad@sgspe.test', 'PROJECT_ADMIN']])]))
    red = espiarRed()
    await userEvent.type(await screen.findByRole('textbox', { name: /title/ }), 'Nueva')
    await screen.findByRole('combobox', { name: 'Líder de la visita' })
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(red!.a('POST', '/objects/field_visit/records')).toHaveLength(1))
    const atributos = (red.a('POST', '/objects/field_visit/records')[0].cuerpo as { attributes: object }).attributes
    // el formulario manda vacíos (null) los campos que no se llenan; el líder no se inventa
    expect((atributos as Record<string, unknown>).leader_user_id ?? null).toBeNull()
    expect((atributos as Record<string, unknown>).leader_user_email ?? null).toBeNull()
  })

  it('si el equipo no se lee, el líder se escribe a mano como alternativa', async () => {
    fetch = abrirPortal(
      '/projects/p1/field-visits/new',
      RELACIONISTA,
      EQUIPO,
      nueva([{ path: /^\/objects\/project_assignment\/records\?.*project=p1/, status: 403, body: ERROR(403) }])
    )
    red = espiarRed()
    await userEvent.type(await screen.findByRole('textbox', { name: /title/ }), 'Nueva')
    await userEvent.type(await screen.findByLabelText('Identificador del usuario líder'), 'u7')
    await userEvent.type(screen.getByLabelText('Correo del líder'), 'lider@sgspe.test')
    expect(screen.queryByRole('combobox', { name: 'Líder de la visita' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(red!.a('POST', '/objects/field_visit/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/field_visit/records')[0].cuerpo).toMatchObject({
      attributes: { leader_user_id: 'u7', leader_user_email: 'lider@sgspe.test' }
    })
  })

  it('sin asignación vigente al proyecto dice por qué y no ofrece el formulario', async () => {
    fetch = abrirPortal('/projects/p1/field-visits/new', RELACIONISTA, EQUIPO, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
      ...nueva()
    ])
    expect(await screen.findByText(/No tiene una asignación vigente a este proyecto/)).toBeInTheDocument()
    expect(screen.getByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /title/ })).not.toBeInTheDocument()
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

  it('dentro de un proyecto lista solo las visitas de ese proyecto, sin la columna Proyecto', async () => {
    fetch = abrirPortal('/projects/p1/field-visits', RELACIONISTA, EQUIPO, lista())
    red = espiarRed()
    const tabla = await screen.findByRole('table', { name: 'Visitas de campo' })
    expect(within(tabla).getByRole('link', { name: 'Segunda salida' })).toHaveAttribute('href', '/projects/p1/field-visits/v2')
    expect(within(tabla).queryByRole('columnheader', { name: 'Proyecto' })).not.toBeInTheDocument()
    expect(red.a('GET', '/objects/field_visit/records')[0].ruta).toContain('project=p1')
  })

  it('el enlace de Relacionamiento dentro de un proyecto lleva a las visitas de ese proyecto', async () => {
    fetch = abrirPortal('/projects/p1/engagements', RELACIONISTA, EQUIPO, lista())
    expect(await screen.findByRole('link', { name: 'Visitas de campo' })).toHaveAttribute('href', '/projects/p1/field-visits')
  })

  it('sin permiso de lectura sobre las visitas de campo, Relacionamiento no ofrece el enlace', async () => {
    const { field_visit: _sin, ...sinVisitas } = EQUIPO.objects
    fetch = abrirPortal('/engagements', RELACIONISTA, permisos(sinVisitas), lista())
    await screen.findByRole('heading', { name: 'Relacionamiento' })
    expect(screen.queryByRole('link', { name: 'Visitas de campo' })).not.toBeInTheDocument()
  })

  it('Relacionamiento enlaza a las visitas de campo', async () => {
    fetch = abrirPortal('/engagements', RELACIONISTA, EQUIPO, lista())
    const enlace = await screen.findByRole('link', { name: 'Visitas de campo' })
    expect(enlace).toHaveAttribute('href', '/field-visits')
  })
})
