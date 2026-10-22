import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar, pagina, registro } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { UBICADOS } from '../../test/sig'
import { EQUIPO, base } from '../../test/relacionamiento'
import { useGuardarInteraccion } from './guardarInteraccion'

// lo que se teclea es la hora del reloj del navegador: el huso se fija para que el instante UTC sea el mismo en cualquier máquina
process.env.TZ = 'America/Lima'

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
  vi.useRealTimers()
})

describe('S24 · registrar interacción', () => {
  const rutas = (): MockRoute[] => [
    ...base(),
    {
      path: '/metadata/objects/engagement',
      body: definicion('engagement', [
        ['engagement_type', { type: 'ENUM', enumOptions: ['ASAMBLEA', 'LLAMADA'] }],
        'project',
        'title',
        'objective',
        'description',
        'held_at',
        'scheduled_at',
        'place',
        'locality',
        'community',
        'convener',
        'field_visit',
        ['location', { type: 'GEOMETRY' }]
      ])
    },
    {
      path: '/metadata/objects/engagement_participant',
      body: definicion('engagement_participant', [
        ['sex', { type: 'ENUM', enumOptions: ['FEMENINO', 'MASCULINO'] }],
        ['participant_scope', { type: 'ENUM', enumOptions: ['AIDS'] }],
        'engagement',
        'participant_name',
        'represented_group',
        'represented_people_count',
        'attended',
        'stakeholder'
      ])
    },
    {
      path: '/metadata/objects/engagement_question',
      body: definicion('engagement_question', ['engagement', 'question_text', 'answered_on_site', 'answer', 'raised_by_role', 'topic'])
    },
    {
      path: '/objects/stakeholder/records',
      body: pagina([registro('s1', { organization: 'o1' }, { state: 'assessed' }), registro('s2', { organization: 'o2' }, { state: 'profiled' })])
    },
    { path: '/objects/organization/records/o1', body: registro('o1', { name: 'Ronda campesina' }) },
    { path: '/objects/organization/records/o2', body: registro('o2', { name: 'APAFA' }) },
    { path: '/objects/topic/records', body: pagina([registro('t1', { name: 'Agua' })]) },
    {
      method: 'POST',
      path: '/objects/engagement/records',
      status: 201,
      body: registro('e9', { title: 'Asamblea de octubre' }, { state: 'planned', updatedAt: '2026-10-07T10:00:00Z' })
    },
    { method: 'POST', path: '/objects/engagement/records/e9/related/engagement_stakeholder', status: 204 },
    { method: 'POST', path: '/objects/engagement/records/e9/related/engagement_topic', status: 204 },
    { method: 'POST', path: '/objects/engagement_participant/records', status: 201, body: registro('pa', {}) },
    { method: 'POST', path: '/objects/engagement_question/records', status: 201, body: registro('q', {}) },
    { method: 'POST', path: '/objects/engagement/records/e9/transitions/register_held_unplanned', body: registro('e9', {}, { state: 'held' }) }
  ]

  it('un clic en el mapa del paso «Lugar» propone la localidad y la comunidad, que la persona confirma', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, [
      { path: '/sgspe/territory/locate', body: UBICADOS },
      { path: '/objects/locality/records/l1', body: registro('l1', { name: 'Localidad Ejemplo' }) },
      { path: '/objects/community/records/c1', body: registro('c1', { name: 'Comunidad Ejemplo' }) },
      ...rutas()
    ])
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea de octubre')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pulsar en el mapa' }))
    expect(await screen.findByText('Comunidad Ejemplo')).toBeInTheDocument()
    expect(screen.getByText('Localidad: —')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Usar estos lugares' }))
    expect(await screen.findByText('Localidad: Localidad Ejemplo')).toBeInTheDocument()
    expect(screen.getByText('Comunidad: Comunidad Ejemplo')).toBeInTheDocument()
  })

  it('«Cancelar» con cambios pide confirmar y vuelve a la visita de campo de la que se abrió (revisión de UX, etapa 5)', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?field_visit=v1', RELACIONISTA, EQUIPO, rutas())
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea de octubre')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText('¿Salir sin terminar?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Seguir aquí' }))
    expect(rutaActual()).toBe('/projects/p1/engagements/new?field_visit=v1')
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Asamblea de octubre')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Salir' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/field-visits/v1'))
  })

  it('un grupo sin nombres representa al menos a una persona y los totales se ven en vivo', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, rutas())
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea de octubre')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar grupo sin nombres' }))
    const personas = screen.getByRole('spinbutton', { name: 'Personas' })
    await userEvent.clear(personas)
    await userEvent.type(personas, '12')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sexo' }), 'FEMENINO')
    expect(screen.getByRole('status')).toHaveTextContent('Total: 12 · Femenino 12 · Masculino 0')
    await userEvent.clear(personas)
    await userEvent.type(personas, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Un grupo representa al menos a una persona')).toBeInTheDocument()
  })

  it('guarda como realizada: la interacción, sus grupos de interés, participantes, preguntas y la transición', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?stakeholders=s1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea de octubre')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ya se realizó' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Indique la fecha')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Fecha y hora en que se realizó'), '06/10/2026')
    await userEvent.type(screen.getByLabelText('Fecha y hora en que se realizó (hora)'), '10:30')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('checkbox', { name: 'Ronda campesina' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar persona' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar otra pregunta' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Pregunta o sugerencia' }), '¿Cuándo empieza la perforación?')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Agua' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    const [alta] = red.a('POST', '/objects/engagement/records')
    expect(alta.cuerpo).toMatchObject({
      attributes: { project: 'p1', engagement_type: 'ASAMBLEA', title: 'Asamblea de octubre', held_at: '2026-10-06T15:30:00.000Z' }
    })
    expect(red.a('POST', '/objects/engagement/records/e9/related/engagement_stakeholder')[0].cuerpo).toEqual({ otherId: 's1' })
    expect(red.a('POST', '/objects/engagement/records/e9/related/engagement_topic')[0].cuerpo).toEqual({ otherId: 't1' })
    expect(red.a('POST', '/objects/engagement_participant/records')[0].cuerpo).toMatchObject({
      attributes: { engagement: 'e9', represented_people_count: 1, attended: true }
    })
    expect(red.a('POST', '/objects/engagement_question/records')[0].cuerpo).toMatchObject({
      attributes: { engagement: 'e9', question_text: '¿Cuándo empieza la perforación?', answered_on_site: false }
    })
    expect(red.a('POST', '/objects/engagement/records/e9/transitions/register_held_unplanned')[0].cabeceras.get('If-Match')).toBe('"2026-10-07T10:00:00Z"')
  })

  // hallazgo U-07 (DD-07): la fecha y la hora programadas se escriben como dd/mm/aaaa y HH:mm y viajan como el instante de Lima
  it('programa con la fecha escrita como 20/10/2026 y la hora 10:15: scheduled_at es el instante de esa hora de Lima', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?stakeholders=s1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea de octubre')
    await userEvent.type(screen.getByLabelText('Fecha y hora programadas'), '20/10/2026')
    await userEvent.type(screen.getByLabelText('Fecha y hora programadas (hora)'), '10:15')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('checkbox', { name: 'Ronda campesina' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar persona' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Programar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/engagement/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/engagement/records')[0].cuerpo).toMatchObject({ attributes: { scheduled_at: '2026-10-20T15:15:00.000Z' } })
    expect(red.a('POST', '/objects/engagement/records')[0].cuerpo).not.toHaveProperty('attributes.held_at')
  })

  // api.md §3.6: más de 500 escrituras de conteos y vínculos dejan la versión del alta fuera de la ventana del historial
  it('si la transición final responde 412, relee la versión de la interacción y la reintenta una sola vez', async () => {
    let intentos = 0
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick', RELACIONISTA, EQUIPO, [
      ...rutas(),
      {
        path: '/objects/engagement/records/e9',
        body: registro('e9', { title: 'Asamblea de octubre' }, { state: 'planned', updatedAt: '2026-10-07T10:09:00Z' })
      }
    ])
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/engagement/records/e9/transitions/register_held_unplanned',
        responder: () =>
          ++intentos === 1
            ? problema(412, 'La interacción cambió', [{ field: 'updatedAt', message: 'valor actual 2026-10-07T10:09:00Z' }])
            : new Response(JSON.stringify(registro('e9', {}, { state: 'held' })))
      }
    ])
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más Femenino · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    const transiciones = red.a('POST', '/objects/engagement/records/e9/transitions/register_held_unplanned')
    expect(transiciones.map((l) => l.cabeceras.get('If-Match'))).toEqual(['"2026-10-07T10:00:00Z"', '"2026-10-07T10:09:00Z"'])
  })

  it('el modo rápido de campo cuenta asistentes con objetivos grandes y guarda con la ubicación del teléfono', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { longitude: -78.1, latitude: -8.2 } }) }
    })
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' }))
    const mas = await screen.findByRole('button', { name: 'Más Femenino · AIDS' })
    expect(mas.className).toContain('size-11')
    await userEvent.click(mas)
    await userEvent.click(mas)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    expect(red.a('POST', '/objects/engagement/records')[0].cuerpo).toMatchObject({ geometries: { location: { type: 'Point', coordinates: [-78.1, -8.2] } } })
    expect(red.a('POST', '/objects/engagement_participant/records')[0].cuerpo).toMatchObject({
      attributes: { sex: 'FEMENINO', participant_scope: 'AIDS', represented_people_count: 2, attended: true }
    })
  })

  it('en el modo rápido la ubicación lleva plazo y edad máxima, dice que espera y descarta una respuesta tardía (revisión final, M4)', async () => {
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
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick', RELACIONISTA, EQUIPO, rutas())
    const boton = await screen.findByRole('button', { name: 'Usar la ubicación del teléfono' })
    await userEvent.click(boton)
    expect(lectura.opciones).toEqual({ timeout: 15000, maximumAge: 30000, enableHighAccuracy: true })
    expect(screen.getByText('Obteniendo ubicación…')).toBeInTheDocument()
    expect(boton).toBeDisabled()
    // vence: lo dice y deja reintentar
    const primeraOk = lectura.ok
    act(() => lectura.mal?.({ code: 3, message: 'Timeout expired' }))
    expect(await screen.findByText('No se pudo leer la ubicación')).toBeInTheDocument()
    expect(boton).toBeEnabled()
    await userEvent.click(boton)
    expect(lectura.llamadas).toBe(2)
    // la respuesta tardía de la primera lectura no cuenta; la de la segunda, sí
    act(() => primeraOk?.({ coords: { longitude: -70, latitude: -10 } }))
    expect(screen.queryByText(/-10\.00000/)).not.toBeInTheDocument()
    act(() => lectura.ok?.({ coords: { longitude: -78.1, latitude: -8.2 } }))
    expect(await screen.findByText(/-8\.20000/)).toBeInTheDocument()
    expect(screen.queryByText('Obteniendo ubicación…')).not.toBeInTheDocument()
  })

  it('en el registro rápido, «Usar estos lugares» no pisa con vacío lo que locate no propone', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { longitude: -78.1, latitude: -8.2 } }) }
    })
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick&territory=community:c9', RELACIONISTA, EQUIPO, [
      { path: '/sgspe/territory/locate', body: { ...UBICADOS, community: null } },
      ...rutas()
    ])
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Usar la ubicación del teléfono' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Usar estos lugares' }))
    await userEvent.click(screen.getByRole('button', { name: 'Más Femenino · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    expect(red.a('POST', '/objects/engagement/records')[0].cuerpo).toMatchObject({ attributes: { locality: 'l1', community: 'c9' } })
  })

  it('el punto marcado en el mapa de S24 viaja como ubicación de la interacción', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, [{ path: '/sgspe/territory/locate', body: UBICADOS }, ...rutas()])
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea de octubre')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ya se realizó' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.type(screen.getByLabelText('Fecha y hora en que se realizó'), '06/10/2026')
    await userEvent.type(screen.getByLabelText('Fecha y hora en que se realizó (hora)'), '10:30')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pulsar en el mapa' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar persona' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    expect(JSON.stringify(red.a('POST', '/objects/engagement/records')[0].cuerpo)).toContain('[-78.5,-7.9]')
  })

  const TRANSICION = '/objects/engagement/records/e9/transitions/register_held_unplanned'

  // decisión 17: la API genérica no es transaccional; lo ya escrito queda y el error lleva a completarlo
  it('si falla un vínculo, dice por qué sin mostrar el código, enlaza a la interacción creada y no ofrece guardar de nuevo', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick&stakeholders=s1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/engagement/records/e9/related/engagement_stakeholder',
        responder: () => problema(403, 'Sin asignación', [{ field: 'record', message: 'NOT_ASSIGNED' }])
      }
    ])
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más Femenino · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('La interacción se creó, pero no se pudo completar el registro.')
    expect(aviso).toHaveTextContent('No tiene una asignación vigente a este proyecto')
    expect(aviso).not.toHaveTextContent('NOT_ASSIGNED')
    expect(within(aviso).getByRole('link', { name: 'Abrir «Asamblea de octubre» para completarla' })).toHaveAttribute('href', '/projects/p1/engagements/e9')
    expect(rutaActual()).toBe('/projects/p1/engagements/new?mode=quick&stakeholders=s1')
    expect(red.a('POST', TRANSICION)).toHaveLength(0)
    // un segundo alta dejaría una interacción duplicada: lo que falta se completa desde la ficha
    expect(screen.getByRole('button', { name: 'Guardar como realizada' })).toBeDisabled()
  })

  it('si la transición responde 412 dos veces, no insiste: dice que otra persona cambió el registro y enlaza a la interacción', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick', RELACIONISTA, EQUIPO, [
      ...rutas(),
      {
        path: '/objects/engagement/records/e9',
        body: registro('e9', { title: 'Asamblea de octubre' }, { state: 'planned', updatedAt: '2026-10-07T10:09:00Z' })
      }
    ])
    red = espiarRed([{ method: 'POST', path: TRANSICION, responder: () => problema(412, 'La interacción cambió') }])
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más Femenino · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    const aviso = await screen.findByRole('alert')
    expect(aviso).toHaveTextContent('Otra persona cambió este registro')
    expect(within(aviso).getByRole('link', { name: /Asamblea de octubre/ })).toHaveAttribute('href', '/projects/p1/engagements/e9')
    expect(red.a('POST', TRANSICION)).toHaveLength(2)
  })

  it('un error de la transición que no es 412 no se reintenta', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed([
      { method: 'POST', path: TRANSICION, responder: () => problema(409, 'Estado incompatible', [{ field: 'state', message: 'STATE_MISMATCH' }]) }
    ])
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más Femenino · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    expect(await screen.findByRole('alert')).not.toHaveTextContent('STATE_MISMATCH')
    expect(red.a('POST', TRANSICION)).toHaveLength(1)
    expect(red.a('GET', '/objects/engagement/records/e9')).toHaveLength(0)
  })

  // Review Focus 5: cerca de la medianoche de Lima el día de Lima y el de UTC difieren
  it('guarda como realizada ahora con el día de Lima en el título y el instante en UTC', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    // 23:30 del 6 de octubre en Lima es 04:30 del 7 en UTC
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-07T04:30:00Z'))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más Femenino · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    expect(red.a('POST', '/objects/engagement/records')[0].cuerpo).toMatchObject({
      attributes: { title: 'ASAMBLEA · 2026-10-06', held_at: '2026-10-07T04:30:00.000Z' }
    })
  })

  it('la fecha que se teclea viaja en UTC, también cerca de la medianoche', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea tardía')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ya se realizó' }))
    await userEvent.type(screen.getByLabelText('Fecha y hora en que se realizó'), '06/10/2026')
    await userEvent.type(screen.getByLabelText('Fecha y hora en que se realizó (hora)'), '23:30')
    for (let i = 0; i < 2; i++) await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar persona' }))
    for (let i = 0; i < 2; i++) await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    // la revisión dice la fecha tecleada en es-PE, no el valor crudo del control (revisión final, M12)
    expect(await screen.findByText(/: 6 oct\. 2026, 11:30/)).toBeInTheDocument()
    expect(screen.queryByText(/2026-10-06T23:30/)).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    const { attributes } = red.a('POST', '/objects/engagement/records')[0].cuerpo as { attributes: Record<string, string> }
    expect(attributes.held_at).toBe('2026-10-07T04:30:00.000Z')
    expect(attributes).not.toHaveProperty('scheduled_at')
  })

  // la misma pantalla se abre una y otra vez en una sesión: la segunda es otra acción, con otra clave y sin lo escrito antes
  it('una segunda interacción en la misma sesión lleva otra Idempotency-Key y arranca limpia', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    for (const veces of [1, 2]) {
      await screen.findByRole('option', { name: 'Asamblea' })
      expect(screen.getByRole('combobox', { name: 'Tipo de interacción' })).toHaveValue('')
      expect(screen.getByRole('textbox', { name: 'Nota' })).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Guardar como realizada' })).toBeDisabled()
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
      await userEvent.type(screen.getByRole('textbox', { name: 'Nota' }), `nota ${veces}`)
      await userEvent.click(await screen.findByRole('button', { name: 'Más Femenino · AIDS' }))
      await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
      await waitFor(() => expect(red!.a('POST', '/objects/engagement/records')).toHaveLength(veces))
      await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
      if (veces === 1) {
        window.history.back()
        await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/new?mode=quick'))
      }
    }
    const altas = red.a('POST', '/objects/engagement/records')
    const claves = altas.map((a) => a.cabeceras.get('Idempotency-Key'))
    expect(claves[0]).toBeTruthy()
    expect(claves[1]).toBeTruthy()
    expect(claves[0]).not.toBe(claves[1])
    expect(altas.map((a) => (a.cuerpo as { attributes: { description: string } }).attributes.description)).toEqual(['nota 1', 'nota 2'])
  })

  it('el modo rápido conserva los grupos de interés y la visita de campo de la que se abrió', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick&stakeholders=s1&field_visit=v1', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    expect(await screen.findByRole('checkbox', { name: 'Ronda campesina' })).toBeChecked()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más Femenino · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    expect(red.a('POST', '/objects/engagement/records')[0].cuerpo).toMatchObject({ attributes: { field_visit: 'v1' } })
    expect(red.a('POST', '/objects/engagement/records/e9/related/engagement_stakeholder')[0].cuerpo).toEqual({ otherId: 's1' })
  })

  // RF-ENG-004: register_held_unplanned exige al menos un participante que asistió; si el servidor lo rechazara al final, la
  // interacción ya estaría creada, planificada y con held_at
  it('guardar como realizada sin ningún participante que asistió no escribe nada y dice por qué', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea de octubre')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ya se realizó' }))
    await userEvent.type(screen.getByLabelText('Fecha y hora en que se realizó'), '06/10/2026')
    await userEvent.type(screen.getByLabelText('Fecha y hora en que se realizó (hora)'), '10:30')
    for (let i = 0; i < 4; i++) await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar como realizada' }))
    expect(await screen.findByText('Para guardar como realizada, agregue al menos un participante que asistió.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Participantes' })).toBeInTheDocument()
    expect(red.llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0)
    // un participante que no asistió tampoco basta
    await userEvent.click(screen.getByRole('button', { name: 'Agregar persona' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Asistió' }))
    for (let i = 0; i < 2; i++) await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar como realizada' }))
    expect(await screen.findByText('Para guardar como realizada, agregue al menos un participante que asistió.')).toBeInTheDocument()
    expect(red.llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0)
  })

  // «Anterior» y el indicador de pasos no validan: el esquema puede invalidarse desde un paso que no se ve
  it('si el formulario es inválido al guardar, lleva al paso con el error y lo dice', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea de octubre')
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar grupo sin nombres' }))
    for (let i = 0; i < 2; i++) await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByRole('heading', { name: 'Revisión' })).toBeInTheDocument()
    // de la revisión a los participantes, se deja el grupo en cero y se salta de vuelta a la revisión sin validar
    await userEvent.click(screen.getByRole('button', { name: 'Participantes' }))
    const personas = await screen.findByRole('spinbutton', { name: 'Personas' })
    await userEvent.clear(personas)
    await userEvent.type(personas, '0')
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await userEvent.click(screen.getByRole('button', { name: /Revisión/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar y completar después' }))
    expect(await screen.findByRole('heading', { name: 'Participantes' })).toBeInTheDocument()
    expect(screen.getByText('Un grupo representa al menos a una persona')).toBeInTheDocument()
    expect(screen.getByText('Hay datos por corregir en «Participantes».')).toBeInTheDocument()
    expect(red.llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0)
  })

  it('sin una asignación vigente al proyecto no ofrece el formulario y dice por qué', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
      ...rutas()
    ])
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.getByText('No tiene una asignación vigente a este proyecto: pídala a la administración del proyecto.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Tipo de interacción' })).not.toBeInTheDocument()
  })

  // decisión 18: al crear viaja lo que el formulario trae y la definición de quien llama marca editable
  it('no manda un campo que la cuenta no puede escribir', async () => {
    const solo = rutas().filter((r) => r.path !== '/metadata/objects/engagement')
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick', RELACIONISTA, EQUIPO, [
      {
        path: '/metadata/objects/engagement',
        body: definicion('engagement', [
          ['engagement_type', { type: 'ENUM', enumOptions: ['ASAMBLEA'] }],
          'project',
          'title',
          'held_at',
          ['description', { editable: false }]
        ])
      },
      ...solo
    ])
    red = espiarRed()
    await screen.findByRole('option', { name: 'Asamblea' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Nota' }), 'una nota')
    await userEvent.click(await screen.findByRole('button', { name: 'Más Femenino · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    const { attributes } = red.a('POST', '/objects/engagement/records')[0].cuerpo as { attributes: Record<string, unknown> }
    expect(attributes).toMatchObject({ project: 'p1', engagement_type: 'ASAMBLEA' })
    expect(attributes).not.toHaveProperty('description')
    expect(attributes).not.toHaveProperty('locality')
  })

  it('los enlaces entre el asistente y el modo rápido conservan los grupos, la visita y el territorio', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?stakeholders=s1&field_visit=v1&territory=locality:l1', RELACIONISTA, EQUIPO, rutas())
    const aRapido = await screen.findByRole('link', { name: 'Modo rápido de campo' })
    const rapido = new URL(aRapido.getAttribute('href') ?? '', 'http://x')
    expect(rapido.pathname).toBe('/projects/p1/engagements/new')
    expect(Object.fromEntries(rapido.searchParams)).toEqual({ stakeholders: 's1', field_visit: 'v1', territory: 'locality:l1', mode: 'quick' })
    await userEvent.click(aRapido)
    const alAsistente = await screen.findByRole('link', { name: 'Registrar interacción' })
    const asistente = new URL(alAsistente.getAttribute('href') ?? '', 'http://x')
    expect(Object.fromEntries(asistente.searchParams)).toEqual({ stakeholders: 's1', field_visit: 'v1', territory: 'locality:l1', mode: 'full' })
  })

  it('el modo rápido sigue disponible como asistente aunque la pantalla sea angosta', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    fetch = abrirPortal('/projects/p1/engagements/new?mode=full', RELACIONISTA, EQUIPO, rutas())
    expect(await screen.findByRole('textbox', { name: 'Título' })).toBeInTheDocument()
  })

  it('tras guardar, refresca las listas, los vínculos y los tableros que cambian', async () => {
    let cliente: QueryClient | null = null
    function Sonda() {
      const c = useQueryClient()
      cliente = c
      const guardar = useGuardarInteraccion()
      return (
        <button
          type="button"
          onClick={() =>
            guardar.mutate({ proyecto: 'p1', atributos: { title: 'x' }, grupos: [], temas: [], participantes: [], preguntas: [], transicion: null })
          }
        >
          guardar
        </button>
      )
    }
    fetch = mockFetch(rutas())
    montar(<Sonda />, { permisos: EQUIPO })
    const invalidar = vi.spyOn(cliente as unknown as QueryClient, 'invalidateQueries')
    await userEvent.click(screen.getByRole('button', { name: 'guardar' }))
    await waitFor(() => expect(invalidar).toHaveBeenCalled())
    const claves = invalidar.mock.calls.map(([f]) => JSON.stringify((f as { queryKey: unknown[] }).queryKey))
    for (const esperada of [
      ['records', 'engagement'],
      ['records', 'engagement_participant'],
      ['records', 'stakeholder'],
      ['record', 'stakeholder'],
      ['related'],
      ['indicator'],
      ['dashboard']
    ])
      expect(claves).toContain(JSON.stringify(esperada))
  })

  describe('carga y errores', () => {
    const sin = (...rutasFuera: string[]) => rutas().filter((r) => !rutasFuera.includes(String(r.path)) || r.method === 'POST')

    it('mientras carga la definición no dibuja un formulario sin opciones', async () => {
      let liberar: () => void = () => {}
      const espera = new Promise<void>((resolver) => (liberar = resolver))
      const metadata = rutas().find((r) => r.path === '/metadata/objects/engagement')?.body
      fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, rutas())
      red = espiarRed([
        {
          path: '/metadata/objects/engagement',
          responder: async () => {
            await espera
            return new Response(JSON.stringify(metadata))
          }
        }
      ])
      expect(await screen.findByText('Cargando…')).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Tipo de interacción' })).not.toBeInTheDocument()
      liberar()
      expect(await screen.findByRole('option', { name: 'Asamblea' })).toBeInTheDocument()
    })

    it('un 403 sobre la definición dice «No disponible», no un formulario vacío', async () => {
      fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, [
        ...sin('/metadata/objects/engagement'),
        { path: '/metadata/objects/engagement', status: 403, body: { title: 'Error', status: 403, detail: 'Sin acceso', errors: [] } }
      ])
      expect(await screen.findByText('No disponible')).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Tipo de interacción' })).not.toBeInTheDocument()
    })

    it('otro error sobre la definición ofrece reintentar', async () => {
      fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, [
        ...sin('/metadata/objects/engagement_participant'),
        { path: '/metadata/objects/engagement_participant', status: 404, body: { title: 'Error', status: 404, detail: 'No existe', errors: [] } }
      ])
      expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Tipo de interacción' })).not.toBeInTheDocument()
    })

    it('si no se pueden leer los grupos de interés, la lista dice el error y no queda vacía', async () => {
      fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, [
        ...sin('/objects/stakeholder/records'),
        { path: '/objects/stakeholder/records', status: 404, body: { title: 'Error', status: 404, detail: 'No existe', errors: [] } }
      ])
      await screen.findByRole('option', { name: 'Asamblea' })
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
      await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea')
      await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
      expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('la localidad precargada dice que carga, que no está disponible o que falló, no «—»', async () => {
      const ir = async (localidad: MockRoute) => {
        fetch = abrirPortal('/projects/p1/engagements/new?territory=locality:l1', RELACIONISTA, EQUIPO, [localidad, ...rutas()])
        await screen.findByRole('option', { name: 'Asamblea' })
        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
        await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea')
        await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
      }
      await ir({ path: '/objects/locality/records/l1', body: registro('l1', { name: 'Pukaqaqa Alto' }) })
      expect(await screen.findByText('Localidad: Pukaqaqa Alto')).toBeInTheDocument()
      cleanup()
      fetch?.restore()
      await ir({ path: '/objects/locality/records/l1', status: 403, body: { title: 'Error', status: 403, detail: 'Sin acceso', errors: [] } })
      expect(await screen.findByText('No disponible')).toBeInTheDocument()
      expect(screen.queryByText('—')).not.toBeInTheDocument()
      cleanup()
      fetch?.restore()
      await ir({ path: '/objects/locality/records/l1', status: 404, body: { title: 'Error', status: 404, detail: 'No existe', errors: [] } })
      expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    })

    it('sin permiso para crear interacciones no ofrece el formulario', async () => {
      fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, permisos({ ...EQUIPO.objects, engagement: ['READ'] }), rutas())
      expect(await screen.findByText('No disponible')).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Tipo de interacción' })).not.toBeInTheDocument()
    })
  })
})
