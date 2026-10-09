import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, pagina, registro } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { GERENCIA_SOCIAL, RELACIONISTA } from '../../test/portal'
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

describe('S23 · ficha de interacción', () => {
  const rutas = (definicionParticipante = definicion('engagement_participant', ['represented_group'])): MockRoute[] => [
    ...base(),
    { path: '/objects/engagement/records/e1', body: E1 },
    {
      path: '/objects/engagement/records/e1/transitions',
      body: [
        { name: 'draft_minutes', label: 'Redactar acta', to: 'minutes_drafted', toLabel: 'Acta en borrador', allowed: true, reason: null },
        { name: 'close_light', label: 'Cerrar sin acta', to: 'closed', toLabel: 'Cerrada', allowed: true, reason: null }
      ]
    },
    {
      method: 'POST',
      path: '/sgspe/transition-checks',
      body: {
        allowed: false,
        blocking: [{ code: 'PENDING_QUESTIONS', message: 'Hay 1 pregunta sin respuesta ni derivación', field: 'engagement_question' }],
        warnings: []
      }
    },
    { path: '/metadata/objects/engagement_participant', body: definicionParticipante },
    {
      path: '/metadata/objects/engagement_question',
      body: definicion('engagement_question', [
        'question_text',
        'answer',
        ['answered_at', { type: 'DATETIME' }],
        'raised_by_role',
        ['answered_on_site', { type: 'BOOLEAN' }]
      ])
    },
    {
      path: '/objects/engagement_participant/records',
      body: pagina([
        registro('pa1', { participant_name: 'Nombre ficticio', represented_people_count: 1, attended: true }),
        registro('pa2', { represented_people_count: 15, attended: true, represented_group: 'Comuneros' })
      ])
    },
    {
      path: '/objects/engagement_question/records',
      // el GET trae como clave cada campo legible, también los vacíos: la escritura sale de esa forma
      body: pagina([
        registro(
          'q1',
          { question_text: '¿Habrá empleo local?', raised_by_role: 'Presidente comunal', answer: null, answered_at: null, answered_on_site: false },
          { updatedAt: '2026-10-05T01:00:00Z' }
        )
      ])
    },
    { method: 'PUT', path: '/objects/engagement_question/records/q1', body: registro('q1', {}) },
    { path: '/objects/engagement_question/records/q1', body: registro('q1', { answer: 'Sí, con rotación', answered_at: '2026-10-07T15:00:00Z' }) },
    { path: '/objects/engagement/records/e1/related/engagement_stakeholder', body: pagina([]) },
    { path: '/objects/engagement/records/e1/related/engagement_topic', body: pagina([registro('t1', { name: 'Agua' })]) }
  ]

  it('"Cerrar sin acta" sale deshabilitado con la razón mientras haya preguntas pendientes', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, rutas())
    const cerrar = await screen.findByRole('button', { name: 'Cerrar sin acta' })
    await waitFor(() => expect(cerrar).toBeDisabled())
    expect(cerrar).toHaveAccessibleDescription('Hay 1 pregunta sin respuesta ni derivación')
    expect(screen.getByRole('button', { name: 'Redactar acta' })).toBeEnabled()
  })

  it('la cabecera dice la fecha con su hora de Lima, no solo el día (revisión final, M12)', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, rutas())
    // held_at 03:00Z del 2 de octubre son las 22:00 del 1 en Lima
    expect(await screen.findByText(/^1 oct\. 2026, 10:00/)).toBeInTheDocument()
  })

  it('sin acceso a los nombres de los asistentes, la fila dice Restringido; un grupo dice cuántos representa', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', GERENCIA_SOCIAL, EQUIPO, rutas())
    await userEvent.click(await screen.findByRole('tab', { name: 'Participantes' }))
    const tabla = await screen.findByRole('table', { name: 'Participantes' })
    expect(await within(tabla).findByText('Restringido')).toBeInTheDocument()
    expect(within(tabla).queryByText('Nombre ficticio')).not.toBeInTheDocument()
    expect(within(tabla).getByText('Grupo sin nombres (15 personas)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar participante' })).toBeInTheDocument()
  })

  it('responder una pregunta pendiente escribe la respuesta y su momento con la versión leída', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await userEvent.click(await screen.findByRole('tab', { name: 'Preguntas' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Responder' }))
    await userEvent.type(screen.getByLabelText('Respuesta'), 'Sí, con rotación')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/engagement_question/records/q1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/engagement_question/records/q1')
    expect(cambio.cabeceras.get('If-Match')).toBe('"2026-10-05T01:00:00Z"')
    expect(cambio.cuerpo).toMatchObject({ attributes: { answer: 'Sí, con rotación', question_text: '¿Habrá empleo local?' } })
    expect((cambio.cuerpo as { attributes: { answered_at: string } }).attributes.answered_at).toMatch(/Z$/)
  })

  it('sin poder escribir answered_at no ofrece responder: la respuesta no atendería la pregunta y el cierre seguiría bloqueado', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, [
      {
        path: '/metadata/objects/engagement_question',
        body: definicion('engagement_question', ['question_text', 'answer', ['answered_at', { type: 'DATETIME', editable: false }], 'raised_by_role'])
      },
      ...rutas()
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Preguntas' }))
    expect(await screen.findByText('¿Habrá empleo local?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument()
  })

  it('sin poder leer los participantes dice "No disponible", no una tabla vacía; un fallo de las preguntas se reintenta', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, [
      { path: '/objects/engagement_participant/records', status: 403, body: { title: 'Prohibido', status: 403, errors: [] } },
      { path: '/objects/engagement_question/records', status: 404, body: { title: 'No existe', status: 404, errors: [] } },
      ...rutas()
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Participantes' }))
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Participantes' })).not.toBeInTheDocument()
    expect(screen.queryByText('Aún no hay participantes registrados.')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Preguntas' }))
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('Esta interacción no tiene preguntas registradas.')).not.toBeInTheDocument()
  })

  it('una lista que se leyó vacía lo dice; una que se cortó en el tope lo avisa', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, [
      {
        path: '/objects/engagement_participant/records',
        body: { ...pagina(Array.from({ length: 200 }, (_, i) => registro(`x${i}`, { represented_people_count: 1, attended: true }))), nextCursor: 'mas' }
      },
      { path: '/objects/engagement_question/records', body: pagina([]) },
      ...rutas()
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Participantes' }))
    expect(await screen.findByText(/Se leyeron solo los primeros 1.*000 registros; el resto no se muestra/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Preguntas' }))
    expect(await screen.findByText('Esta interacción no tiene preguntas registradas.')).toBeInTheDocument()
  })

  it('la respuesta manda solo claves escribibles del GET, y al guardarla el cierre se vuelve a comprobar', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, [
      {
        path: '/objects/engagement_question/records',
        body: pagina([
          registro(
            'q1',
            { question_text: '¿Habrá empleo local?', answer: null, answered_at: null, answered_on_site: false, campo_ajeno: 'x' },
            { updatedAt: '2026-10-05T01:00:00Z' }
          )
        ])
      },
      ...rutas()
    ])
    red = espiarRed()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cerrar sin acta' })).toBeDisabled())
    const comprobaciones = () => red!.a('POST', '/sgspe/transition-checks').length
    const antes = comprobaciones()
    await userEvent.click(await screen.findByRole('tab', { name: 'Preguntas' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Responder' }))
    await userEvent.type(screen.getByLabelText('Respuesta'), 'Sí')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/engagement_question/records/q1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/engagement_question/records/q1')
    const claves = Object.keys((cambio.cuerpo as { attributes: object }).attributes).sort()
    // raised_by_role no vino en el GET y campo_ajeno no está en la definición: ninguno viaja
    expect(claves).toEqual(['answer', 'answered_at', 'answered_on_site', 'question_text'])
    await waitFor(() => expect(comprobaciones()).toBeGreaterThan(antes))
  })

  it('un 412 al responder dice que otra persona cambió el registro, ofrece recargar y conserva la respuesta', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, rutas())
    let intentos = 0
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/engagement_question/records/q1',
        responder: () => (++intentos === 1 ? problema(412, 'La pregunta cambió') : jsonResponse(registro('q1', {})))
      }
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Preguntas' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Responder' }))
    await userEvent.type(screen.getByLabelText('Respuesta'), 'Sí, con rotación')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(screen.getByLabelText('Respuesta')).toHaveValue('Sí, con rotación')
    const lecturas = () => red!.a('GET', '/objects/engagement_question/records').length
    const antes = lecturas()
    await userEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(lecturas()).toBeGreaterThan(antes))
    expect(screen.queryByText(/Otra persona cambió este registro/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Respuesta')).toHaveValue('Sí, con rotación')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    await waitFor(() => expect(red!.a('PUT', '/objects/engagement_question/records/q1')).toHaveLength(2))
  })

  it('un error al responder dice su texto, nunca su código', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/engagement_question/records/q1',
        responder: () => problema(403, 'Sin asignación', [{ field: 'record', message: 'NOT_ASSIGNED' }])
      }
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Preguntas' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Responder' }))
    await userEvent.type(screen.getByLabelText('Respuesta'), 'Sí')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(await screen.findByText(/asignación vigente/i)).toBeInTheDocument()
    expect(screen.queryByText('NOT_ASSIGNED')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument()
  })

  it('los conteos que no llegaron se muestran como guion, no como cero', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, [
      {
        path: '/objects/engagement/records/e1',
        body: registro('e1', { project: 'p1', title: 'Asamblea comunal', held_at: '2026-10-02T03:00:00Z' }, { state: 'held' })
      },
      ...rutas()
    ])
    expect(await screen.findByText(/Asistentes: —/)).toBeInTheDocument()
    expect(screen.queryByText(/Asistentes: 0/)).not.toBeInTheDocument()
  })

  it('agregar un participante escribe con el alta, relee la interacción (los conteos son derivados) y el siguiente formulario sale limpio', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, [
      {
        path: '/metadata/objects/engagement_participant',
        body: definicion('engagement_participant', ['engagement', 'represented_group', 'participant_name'])
      },
      { method: 'POST', path: '/objects/engagement_participant/records', body: registro('pa9', {}) },
      ...rutas()
    ])
    red = espiarRed()
    await userEvent.click(await screen.findByRole('tab', { name: 'Participantes' }))
    const interaccion = () => red!.a('GET', '/objects/engagement/records/e1').length
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar participante' }))
    await userEvent.type(await screen.findByLabelText('represented_group'), 'Ronda campesina')
    const antes = interaccion()
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(red!.a('POST', '/objects/engagement_participant/records')).toHaveLength(1))
    const [alta] = red.a('POST', '/objects/engagement_participant/records')
    expect(alta.cuerpo).toMatchObject({ attributes: { engagement: 'e1', represented_group: 'Ronda campesina' } })
    await waitFor(() => expect(interaccion()).toBeGreaterThan(antes))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Agregar participante' }))
    expect(await screen.findByLabelText('represented_group')).toHaveValue('')
  })

  it('la pestaña Acta dibuja el Markdown, sin HTML, y la actividad dice quién cambió qué', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1', RELACIONISTA, EQUIPO, [
      {
        path: '/objects/engagement/records/e1',
        body: registro('e1', { project: 'p1', title: 'Asamblea comunal', minutes: '## Acuerdos\n- Uno <b>x</b>' }, { state: 'held' })
      },
      { path: '/metadata/objects/engagement', body: definicion('engagement', ['title', 'minutes']) },
      {
        path: '/objects/engagement/records/e1/history',
        body: [
          { id: 'h1', userEmail: 'smg@sgspe.test', operation: 'UPDATE', occurredAt: '2026-10-06T11:00:00Z', reason: 'Cierre', changes: [{ field: 'state' }] }
        ]
      },
      ...rutas()
    ])
    await userEvent.click(await screen.findByRole('tab', { name: 'Acta' }))
    expect(await screen.findByRole('heading', { name: 'Acuerdos' })).toBeInTheDocument()
    expect(screen.getByText('Uno <b>x</b>')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Redactar el acta' })).toHaveAttribute('href', '/projects/p1/engagements/e1/minutes')
    await userEvent.click(screen.getByRole('tab', { name: 'Actividad' }))
    expect(await screen.findByText(/smg@sgspe.test/)).toBeInTheDocument()
    expect(screen.getByText(/Cierre/)).toBeInTheDocument()
  })
})
