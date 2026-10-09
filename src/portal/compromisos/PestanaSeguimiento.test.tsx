import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeCompromisos, C1, EQUIPO_DE_COMPROMISOS, GESTORA } from '../../test/compromisos'
import { definicion, montar, pagina, registro } from '../../test/montar'
import { permisos } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { PestanaDependencias, PestanaSeguimiento } from './PestanaSeguimiento'

// S29, pestañas Acciones e hitos y Dependencias (RF-COM-004, RF-COM-006): las altas con su compromiso fijo, completar con la
// versión leída, alcanzar un hito hoy en Lima, la dependencia bloqueante abierta avisada (D10) y el ciclo con su texto
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const ACCION = registro(
  'a1',
  { commitment: 'c1', description: 'Comprar geomembrana', action_date: '2026-10-01', completed: false },
  { updatedAt: '2026-10-02T15:00:00Z' }
)
const HITO = registro(
  'h1',
  { commitment: 'c1', description: 'Excavación lista', due_date: '2026-10-20', reached_date: null },
  { updatedAt: '2026-10-02T16:00:00Z' }
)
const OTRO = registro('c2', { project: 'p1', code: 'C-002', title: 'Acceso vehicular' }, { state: 'in_progress' })
const TERCERO = registro('c3', { project: 'p1', code: 'C-003', title: 'Canal de riego' }, { state: 'in_progress' })
const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  { path: '/objects/commitment_action/records', body: pagina([ACCION]) },
  { path: '/objects/commitment_milestone/records', body: pagina([HITO]) },
  {
    path: '/objects/commitment_dependency/records',
    body: pagina([registro('d1', { commitment: 'c1', depends_on: 'c2', blocking: true, notes: 'Sin acceso no hay obra' })])
  },
  { path: '/objects/commitment/records/c2', body: OTRO },
  { path: '/objects/commitment/records', body: pagina([OTRO]) },
  {
    path: '/metadata/objects/commitment_action',
    body: definicion('commitment_action', ['description', ['action_date', { type: 'DATE' }], ['completed', { type: 'BOOLEAN' }], 'commitment'])
  },
  {
    path: '/metadata/objects/commitment_milestone',
    body: definicion('commitment_milestone', ['description', ['due_date', { type: 'DATE' }], ['reached_date', { type: 'DATE' }], 'commitment'])
  },
  {
    path: '/metadata/objects/commitment_dependency',
    body: definicion('commitment_dependency', ['commitment', 'depends_on', ['blocking', { type: 'BOOLEAN' }], 'notes'])
  }
]

describe('S29 · acciones e hitos', () => {
  it('completar una acción manda el cambio con la versión leída; un 412 ofrece Recargar', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([{ method: 'PUT', path: '/objects/commitment_action/records/a1', responder: () => problema(412, 'otra') }])
    montar(<PestanaSeguimiento compromiso={C1} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar «Comprar geomembrana» como completada' }))
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    const [llamada] = red.a('PUT', '/objects/commitment_action/records/a1')
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-02T15:00:00Z"')
    expect(llamada.cuerpo).toMatchObject({ attributes: { completed: true, description: 'Comprar geomembrana' } })
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  })

  it('«Alcanzado hoy» escribe la fecha de Lima, no la de UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // las 21:00 de Lima del 20 de octubre son las 02:00 UTC del 21
    vi.setSystemTime(new Date('2026-10-21T02:00:00Z'))
    fetch = mockFetch(rutas([{ method: 'PUT', path: '/objects/commitment_milestone/records/h1', body: HITO }]))
    red = espiarRed()
    montar(<PestanaSeguimiento compromiso={C1} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar «Excavación lista» como alcanzado hoy' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/commitment_milestone/records/h1')).toHaveLength(1))
    expect(red.a('PUT', '/objects/commitment_milestone/records/h1')[0].cuerpo).toMatchObject({ attributes: { reached_date: '2026-10-20' } })
  })

  it('quien solo lee no tiene altas ni cambios', async () => {
    fetch = mockFetch(rutas())
    montar(<PestanaSeguimiento compromiso={C1} escribe={false} />, {
      permisos: permisos({ commitment: ['READ'], commitment_action: ['READ'], commitment_milestone: ['READ'] })
    })
    expect(await screen.findByRole('checkbox', { name: 'Marcar «Comprar geomembrana» como completada' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '+ Acción' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /alcanzado hoy/ })).not.toBeInTheDocument()
    expect(await screen.findByText('Pendiente')).toBeInTheDocument()
  })

  it('una acción nueva lleva su compromiso y la clave del alta', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/objects/commitment_action/records', status: 201, body: registro('a2', {}) }]))
    red = espiarRed()
    montar(<PestanaSeguimiento compromiso={C1} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByRole('button', { name: '+ Acción' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.type(await within(panel).findByLabelText(/description/), 'Coordinar con la junta')
    await userEvent.click(within(panel).getByRole('button', { name: /Guardar|Save/ }))
    await waitFor(() => expect(red!.a('POST', '/objects/commitment_action/records')).toHaveLength(1))
    const [alta] = red.a('POST', '/objects/commitment_action/records')
    expect(alta.cuerpo).toMatchObject({ attributes: { description: 'Coordinar con la junta', commitment: 'c1' } })
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })
})

describe('S29 · dependencias', () => {
  it('una dependencia bloqueante abierta se avisa; un ciclo se dice con su texto', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/commitment_dependency/records',
        responder: () => problema(409, 'ciclo', [{ field: 'depends_on', message: 'DEPENDENCY_CYCLE' }])
      }
    ])
    montar(<PestanaDependencias compromiso={C1} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByText(/Una dependencia bloqueante sigue abierta/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'C-002 · Acceso vehicular' })).toHaveAttribute('href', '/projects/p1/commitments/c2')
    await userEvent.click(screen.getByText('+ Dependencia'))
    await userEvent.click(screen.getByRole('button', { name: 'Agregar la dependencia' }))
    expect(await screen.findByText('Elija el compromiso del que depende')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Buscar el compromiso del que depende'), 'Ac')
    await userEvent.click(await screen.findByRole('button', { name: 'C-002 · Acceso vehicular' }))
    await userEvent.click(screen.getByRole('button', { name: 'Agregar la dependencia' }))
    expect(await screen.findByText('Esa dependencia cerraría un ciclo entre compromisos.')).toBeInTheDocument()
    expect(red.a('POST', '/objects/commitment_dependency/records')[0].cuerpo).toEqual({ attributes: { commitment: 'c1', depends_on: 'c2', blocking: true } })
  })
  it.each([
    ['DEPENDENCY_SELF', 'Un compromiso no depende de sí mismo.'],
    ['DEPENDENCY_CYCLE', 'Esa dependencia cerraría un ciclo entre compromisos.'],
    ['DEPENDENCY_GRAPH_TOO_LARGE', 'Hay demasiadas dependencias encadenadas para comprobar esta: simplifique la cadena.']
  ])('%s se dice con su texto, nunca con el código', async (codigo, texto) => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { method: 'POST', path: '/objects/commitment_dependency/records', responder: () => problema(409, 'rechazo', [{ field: 'depends_on', message: codigo }]) }
    ])
    montar(<PestanaDependencias compromiso={C1} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByText('+ Dependencia'))
    await userEvent.type(screen.getByLabelText('Buscar el compromiso del que depende'), 'Ac')
    await userEvent.click(await screen.findByRole('button', { name: 'C-002 · Acceso vehicular' }))
    await userEvent.click(screen.getByRole('button', { name: 'Agregar la dependencia' }))
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText(codigo)).not.toBeInTheDocument()
  })

  // P63: una clave nunca cruza acciones. otra dependencia no es un reintento de la que se rechazó
  it('otro compromiso elegido tras un rechazo lleva otra clave', async () => {
    fetch = mockFetch(rutas([{ path: '/objects/commitment/records', body: pagina([OTRO, TERCERO]) }]))
    const respuestas = [() => problema(409, 'ciclo', [{ field: 'depends_on', message: 'DEPENDENCY_CYCLE' }]), () => problema(500, 'cayó')]
    let i = 0
    red = espiarRed([{ method: 'POST', path: '/objects/commitment_dependency/records', responder: () => respuestas[i++]() }])
    montar(<PestanaDependencias compromiso={C1} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByText('+ Dependencia'))
    await userEvent.type(screen.getByLabelText('Buscar el compromiso del que depende'), 'C-')
    await userEvent.click(await screen.findByRole('button', { name: 'C-002 · Acceso vehicular' }))
    await userEvent.click(screen.getByRole('button', { name: 'Agregar la dependencia' }))
    expect(await screen.findByText('Esa dependencia cerraría un ciclo entre compromisos.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    expect(screen.queryByText('Esa dependencia cerraría un ciclo entre compromisos.')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Buscar el compromiso del que depende'), 'C-')
    await userEvent.click(await screen.findByRole('button', { name: 'C-003 · Canal de riego' }))
    await userEvent.click(screen.getByRole('button', { name: 'Agregar la dependencia' }))
    await waitFor(() => expect(i).toBe(2))
    const [a, b] = red.a('POST', '/objects/commitment_dependency/records')
    expect(b.cuerpo).toMatchObject({ attributes: { depends_on: 'c3' } })
    expect(a.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(b.cabeceras.get('Idempotency-Key')).not.toBe(a.cabeceras.get('Idempotency-Key'))
  })

  it('otro compromiso en la misma pantalla empieza el alta de cero, con otra clave', async () => {
    const C9 = registro('c9', { project: 'p1', code: 'C-009', title: 'Posta médica' }, { state: 'in_progress' })
    function Cambiante() {
      const [compromiso, setCompromiso] = useState(C1)
      return (
        <>
          <button type="button" onClick={() => setCompromiso(C9)}>
            Ir a C-009
          </button>
          <PestanaDependencias compromiso={compromiso} escribe />
        </>
      )
    }
    fetch = mockFetch(rutas())
    let i = 0
    red = espiarRed([{ method: 'POST', path: '/objects/commitment_dependency/records', responder: () => (i++, problema(500, 'cayó')) }])
    montar(<Cambiante />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByText('+ Dependencia'))
    await userEvent.type(screen.getByLabelText('Buscar el compromiso del que depende'), 'Ac')
    await userEvent.click(await screen.findByRole('button', { name: 'C-002 · Acceso vehicular' }))
    await userEvent.type(screen.getByLabelText('Notas'), 'Solo para C-001')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar la dependencia' }))
    await waitFor(() => expect(i).toBe(1))
    await userEvent.click(screen.getByRole('button', { name: 'Ir a C-009' }))
    await userEvent.click(await screen.findByText('+ Dependencia'))
    expect(screen.getByLabelText('Notas')).toHaveValue('')
    await userEvent.type(screen.getByLabelText('Buscar el compromiso del que depende'), 'Ac')
    await userEvent.click(await screen.findByRole('button', { name: 'C-002 · Acceso vehicular' }))
    await userEvent.click(screen.getByRole('button', { name: 'Agregar la dependencia' }))
    await waitFor(() => expect(i).toBe(2))
    const [a, b] = red.a('POST', '/objects/commitment_dependency/records')
    expect(b.cuerpo).toEqual({ attributes: { commitment: 'c9', depends_on: 'c2', blocking: true } })
    expect(b.cabeceras.get('Idempotency-Key')).not.toBe(a.cabeceras.get('Idempotency-Key'))
  })
})
