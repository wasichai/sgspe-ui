import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock, MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, pagina, registro } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { permisos, RELACIONISTA } from '../../test/portal'
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
  vi.useRealTimers()
})

describe('S24 · registrar interacción', () => {
  const rutas = (): MockRoute[] => [
    ...base(),
    { path: '/metadata/objects/engagement', body: definicion('engagement', [['engagement_type', { type: 'ENUM', enumOptions: ['ASAMBLEA', 'LLAMADA'] }]]) },
    {
      path: '/metadata/objects/engagement_participant',
      body: definicion('engagement_participant', [
        ['sex', { type: 'ENUM', enumOptions: ['FEMENINO', 'MASCULINO'] }],
        ['participant_scope', { type: 'ENUM', enumOptions: ['AIDS'] }]
      ])
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

  it('un grupo sin nombres representa al menos a una persona y los totales se ven en vivo', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, rutas())
    await screen.findByRole('option', { name: 'ASAMBLEA' })
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
    await screen.findByRole('option', { name: 'ASAMBLEA' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea de octubre')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ya se realizó' }))
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Indique la fecha')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Fecha y hora en que se realizó'), '2026-10-06T10:30')
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
      attributes: { project: 'p1', engagement_type: 'ASAMBLEA', title: 'Asamblea de octubre', held_at: new Date('2026-10-06T10:30').toISOString() }
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
    await screen.findByRole('option', { name: 'ASAMBLEA' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más FEMENINO · AIDS' }))
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
    await screen.findByRole('option', { name: 'ASAMBLEA' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(screen.getByRole('button', { name: 'Usar la ubicación del teléfono' }))
    const mas = await screen.findByRole('button', { name: 'Más FEMENINO · AIDS' })
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
    await screen.findByRole('option', { name: 'ASAMBLEA' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más FEMENINO · AIDS' }))
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
    await screen.findByRole('option', { name: 'ASAMBLEA' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más FEMENINO · AIDS' }))
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
    await screen.findByRole('option', { name: 'ASAMBLEA' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más FEMENINO · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    expect(await screen.findByRole('alert')).not.toHaveTextContent('STATE_MISMATCH')
    expect(red.a('POST', TRANSICION)).toHaveLength(1)
    expect(red.a('GET', '/objects/engagement/records/e9')).toHaveLength(0)
  })

  // Review Focus 5: cerca de la medianoche de Lima el día de Lima y el de UTC difieren
  it('guarda como realizada ahora con el día de Lima en el título y el instante en UTC', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await screen.findByRole('option', { name: 'ASAMBLEA' })
    // 23:30 del 6 de octubre en Lima es 04:30 del 7 en UTC
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-07T04:30:00Z'))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más FEMENINO · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    expect(red.a('POST', '/objects/engagement/records')[0].cuerpo).toMatchObject({
      attributes: { title: 'ASAMBLEA · 2026-10-06', held_at: '2026-10-07T04:30:00.000Z' }
    })
  })

  it('la fecha que se teclea viaja en UTC, también cerca de la medianoche', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    await screen.findByRole('option', { name: 'ASAMBLEA' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea tardía')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ya se realizó' }))
    await userEvent.type(screen.getByLabelText('Fecha y hora en que se realizó'), '2026-10-06T23:30')
    for (let i = 0; i < 4; i++) await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    const { attributes } = red.a('POST', '/objects/engagement/records')[0].cuerpo as { attributes: Record<string, string> }
    expect(attributes.held_at).toBe(new Date('2026-10-06T23:30').toISOString())
    expect(attributes).not.toHaveProperty('scheduled_at')
  })

  // la misma pantalla se abre una y otra vez en una sesión: la segunda es otra acción, con otra clave y sin lo escrito antes
  it('una segunda interacción en la misma sesión lleva otra Idempotency-Key y arranca limpia', async () => {
    fetch = abrirPortal('/projects/p1/engagements/new?mode=quick', RELACIONISTA, EQUIPO, rutas())
    red = espiarRed()
    for (const veces of [1, 2]) {
      await screen.findByRole('option', { name: 'ASAMBLEA' })
      expect(screen.getByRole('combobox', { name: 'Tipo de interacción' })).toHaveValue('')
      expect(screen.getByRole('textbox', { name: 'Nota' })).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Guardar como realizada' })).toBeDisabled()
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
      await userEvent.type(screen.getByRole('textbox', { name: 'Nota' }), `nota ${veces}`)
      await userEvent.click(await screen.findByRole('button', { name: 'Más FEMENINO · AIDS' }))
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
    await screen.findByRole('option', { name: 'ASAMBLEA' })
    expect(await screen.findByRole('checkbox', { name: 'Ronda campesina' })).toBeChecked()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
    await userEvent.click(await screen.findByRole('button', { name: 'Más FEMENINO · AIDS' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar como realizada' }))
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/engagements/e9'))
    expect(red.a('POST', '/objects/engagement/records')[0].cuerpo).toMatchObject({ attributes: { field_visit: 'v1' } })
    expect(red.a('POST', '/objects/engagement/records/e9/related/engagement_stakeholder')[0].cuerpo).toEqual({ otherId: 's1' })
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
      expect(await screen.findByRole('option', { name: 'ASAMBLEA' })).toBeInTheDocument()
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
      await screen.findByRole('option', { name: 'ASAMBLEA' })
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de interacción' }), 'ASAMBLEA')
      await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Asamblea')
      await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
      expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('sin permiso para crear interacciones no ofrece el formulario', async () => {
      fetch = abrirPortal('/projects/p1/engagements/new', RELACIONISTA, permisos({ ...EQUIPO.objects, engagement: ['READ'] }), rutas())
      expect(await screen.findByText('No disponible')).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Tipo de interacción' })).not.toBeInTheDocument()
    })
  })
})
