import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, pagina, registro } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { EQUIPO, base } from '../../test/relacionamiento'

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

describe('S25 · editor de acta', () => {
  const conActa = (estado: string) =>
    registro('e1', { project: 'p1', title: 'Asamblea comunal', minutes: '# Acta' }, { state: estado, updatedAt: '2026-10-06T12:00:00Z' })
  const rutas = (estado: string): MockRoute[] => [
    ...base(),
    { path: '/objects/engagement/records/e1', body: conActa(estado) },
    { method: 'PUT', path: '/objects/engagement/records/e1', body: conActa(estado) },
    { path: '/objects/engagement/records/e1/transitions', body: [] },
    { path: '/metadata/objects/engagement', body: definicion('engagement', ['title', 'minutes']) },
    { path: '/metadata/objects/engagement_participant', body: definicion('engagement_participant', ['participant_name', 'represented_group']) },
    {
      path: '/objects/engagement_participant/records',
      body: pagina([
        registro('pa', { participant_name: 'Nombre ficticio', represented_group: 'Ronda', represented_people_count: 1, attended: true }),
        registro('pb', { represented_people_count: 8, attended: true })
      ])
    },
    { path: '/objects/engagement_question/records', body: pagina([]) },
    {
      path: '/objects/engagement/records/e1/history',
      body: [
        {
          id: 'h',
          userEmail: 'smg@sgspe.test',
          operation: 'UPDATE',
          occurredAt: '2026-10-06T11:00:00Z',
          reason: 'Faltan los acuerdos',
          changes: [{ field: 'state', before: 'minutes_in_review', after: 'minutes_drafted' }]
        }
      ]
    }
  ]

  it('inserta los asistentes y guarda solo, con la versión leída', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed()
    await userEvent.click(await screen.findByRole('button', { name: 'Insertar asistentes' }))
    const editor = screen.getByLabelText('Texto del acta (Markdown, sin HTML)')
    await waitFor(() => expect((editor as HTMLTextAreaElement).value).toContain('- Grupo sin nombres (8 personas)'))
    expect(screen.getByRole('status')).toHaveTextContent('Cambios sin guardar')
    await waitFor(() => expect(red!.a('PUT', '/objects/engagement/records/e1')).toHaveLength(1), { timeout: 10000 })
    const [cambio] = red.a('PUT', '/objects/engagement/records/e1')
    expect(cambio.cabeceras.get('If-Match')).toBe('"2026-10-06T12:00:00Z"')
    expect((cambio.cuerpo as { attributes: { minutes: string } }).attributes.minutes).toContain('## Asistentes')
  })

  it('una devolución muestra su motivo arriba del editor', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('minutes_drafted'))
    expect(await screen.findByText('Devuelta con este motivo: Faltan los acuerdos')).toBeInTheDocument()
  })

  it('un acta en revisión ya no se edita', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('minutes_in_review'))
    expect(await screen.findByText('El acta ya no se edita en este estado.')).toBeInTheDocument()
    expect(screen.getByLabelText('Texto del acta (Markdown, sin HTML)')).toHaveAttribute('readonly')
  })

  it('el PUT manda solo las claves escribibles del GET, nunca un derivado ni lo que la definición no deja escribir', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      {
        path: '/objects/engagement/records/e1',
        body: registro(
          'e1',
          { project: 'p1', title: 'Asamblea comunal', minutes: '# Acta', attendees_total_count: 9, place: 'Plaza' },
          { state: 'held', updatedAt: '2026-10-06T12:00:00Z' }
        )
      },
      {
        path: '/metadata/objects/engagement',
        body: definicion('engagement', ['title', 'minutes', ['attendees_total_count', { editable: false }], ['place', { editable: false }]])
      },
      ...rutas('held')
    ])
    red = espiarRed()
    const editor = await screen.findByLabelText('Texto del acta (Markdown, sin HTML)')
    await userEvent.type(editor, ' más')
    await waitFor(() => expect(red!.a('PUT', '/objects/engagement/records/e1')).toHaveLength(1), { timeout: 10000 })
    const [cambio] = red.a('PUT', '/objects/engagement/records/e1')
    expect(Object.keys((cambio.cuerpo as { attributes: object }).attributes).sort()).toEqual(['minutes', 'title'])
  }, 40000)

  it('un fallo de guardado no se reintenta en bucle: dice su texto y ofrece guardar a mano', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    let intentos = 0
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/engagement/records/e1',
        responder: () => (++intentos === 1 ? problema(400, 'El acta no es válida') : jsonResponse(conActa('held')))
      }
    ])
    await userEvent.type(await screen.findByLabelText('Texto del acta (Markdown, sin HTML)'), ' más')
    expect(await screen.findByText('El acta no es válida', {}, { timeout: 10000 })).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 2200))
    expect(red.a('PUT', '/objects/engagement/records/e1')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar el acta' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/engagement/records/e1')).toHaveLength(2))
  }, 40000)

  it('un 412 dice que otra persona cambió el registro, ofrece recargar y conserva el texto; al recargar guarda con la versión nueva', async () => {
    let lecturas = 0
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    let intentos = 0
    red = espiarRed([
      {
        method: 'GET',
        path: '/objects/engagement/records/e1',
        responder: () =>
          jsonResponse(
            registro(
              'e1',
              { project: 'p1', title: 'Asamblea comunal', minutes: '# Acta' },
              { state: 'held', updatedAt: ++lecturas === 1 ? '2026-10-06T12:00:00Z' : '2026-10-06T13:00:00Z' }
            )
          )
      },
      {
        method: 'PUT',
        path: '/objects/engagement/records/e1',
        responder: () => (++intentos === 1 ? problema(412, 'El acta cambió') : jsonResponse(conActa('held')))
      }
    ])
    await userEvent.type(await screen.findByLabelText('Texto del acta (Markdown, sin HTML)'), ' mío')
    expect(await screen.findByText(/Otra persona cambió este registro/, {}, { timeout: 10000 })).toBeInTheDocument()
    expect(screen.getByLabelText('Texto del acta (Markdown, sin HTML)')).toHaveValue('# Acta mío')
    await new Promise((r) => setTimeout(r, 2200))
    expect(red.a('PUT', '/objects/engagement/records/e1')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/engagement/records/e1')).toHaveLength(2), { timeout: 10000 })
    expect(red.a('PUT', '/objects/engagement/records/e1')[1].cabeceras.get('If-Match')).toBe('"2026-10-06T13:00:00Z"')
    expect(screen.getByLabelText('Texto del acta (Markdown, sin HTML)')).toHaveValue('# Acta mío')
  }, 40000)

  it('sin poder escribir el acta, el editor es de solo lectura y no guarda', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      { path: '/metadata/objects/engagement', body: definicion('engagement', ['title', ['minutes', { editable: false }]]) },
      ...rutas('held')
    ])
    red = espiarRed()
    expect(await screen.findByText('El acta ya no se edita en este estado.')).toBeInTheDocument()
    expect(screen.getByLabelText('Texto del acta (Markdown, sin HTML)')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Insertar asistentes' })).toBeDisabled()
  })

  it('sin poder leer el acta dice que no está disponible, no un editor vacío', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      { path: '/metadata/objects/engagement', body: definicion('engagement', ['title']) },
      ...rutas('held')
    ])
    expect(await screen.findByText('Su cuenta no puede leer el acta.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Texto del acta (Markdown, sin HTML)')).not.toBeInTheDocument()
  })

  it('si los asistentes no se pudieron leer, no se insertan y se dice por qué', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      { path: '/objects/engagement_participant/records', status: 403, body: { title: 'Prohibido', status: 403, errors: [] } },
      ...rutas('held')
    ])
    const insertar = await screen.findByRole('button', { name: 'Insertar asistentes' })
    await waitFor(() => expect(screen.getByText(/no se leyeron completos/)).toBeInTheDocument())
    expect(insertar).toBeDisabled()
  })

  it('si no se pudo leer el motivo de la devolución, lo dice en lugar de callarlo', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      { path: '/objects/engagement/records/e1/history', status: 404, body: { title: 'No existe', status: 404, errors: [] } },
      ...rutas('minutes_drafted')
    ])
    expect(await screen.findByText('No se pudo leer el motivo de la devolución.')).toBeInTheDocument()
  })

  it('en revisión, devolver exige el motivo y viaja con la versión leída', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      {
        path: '/objects/engagement/records/e1/transitions',
        body: [
          { name: 'approve_minutes', label: 'Aprobar acta', to: 'minutes_approved', toLabel: 'Acta aprobada', allowed: true, reason: null },
          { name: 'return_minutes', label: 'Devolver acta', to: 'minutes_drafted', toLabel: 'Acta en borrador', allowed: true, reason: null }
        ]
      },
      { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } },
      { method: 'POST', path: '/objects/engagement/records/e1/transitions/return_minutes', body: conActa('minutes_drafted') },
      ...rutas('minutes_in_review')
    ])
    red = espiarRed()
    expect(await screen.findByRole('button', { name: 'Aprobar acta' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Devolver acta' }))
    await screen.findByText('Se cumplen las reglas para este paso.')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('POST', '/objects/engagement/records/e1/transitions/return_minutes')).toHaveLength(0)
    await userEvent.type(screen.getByLabelText('Motivo (obligatorio)'), 'Faltan los acuerdos')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/engagement/records/e1/transitions/return_minutes')).toHaveLength(1))
    const [devolucion] = red.a('POST', '/objects/engagement/records/e1/transitions/return_minutes')
    expect(devolucion.cabeceras.get('If-Match')).toBe('"2026-10-06T12:00:00Z"')
    expect(decodeURIComponent(devolucion.cabeceras.get('X-Change-Reason') ?? '')).toContain('Faltan los acuerdos')
  })
})
