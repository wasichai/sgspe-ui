import { act, screen, waitFor } from '@testing-library/react'
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
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
  vi.unstubAllGlobals()
})

// el autoguardado espera 1,5 s: el reloj falso avanza solo y se adelanta de golpe, así que ninguna prueba depende del tiempo real
// ni de la carga de la máquina
const conTemporizadores = () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}
const pasar = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
const ESPERA_DEL_GUARDADO = 1600
const EDITOR = 'Texto del acta (Markdown, sin HTML)'
const PUT = '/objects/engagement/records/e1'
const GET_E1 = { method: 'GET', path: PUT } as const

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
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed()
    await usuario.click(await screen.findByRole('button', { name: 'Insertar asistentes' }))
    const editor = screen.getByLabelText(EDITOR)
    await waitFor(() => expect((editor as HTMLTextAreaElement).value).toContain('- Grupo sin nombres (8 personas)'))
    expect(screen.getByRole('status')).toHaveTextContent('Cambios sin guardar')
    await pasar(ESPERA_DEL_GUARDADO)
    await waitFor(() => expect(red!.a('PUT', PUT)).toHaveLength(1))
    const [cambio] = red.a('PUT', PUT)
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
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      {
        path: PUT,
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
    await usuario.type(await screen.findByLabelText(EDITOR), ' más')
    await pasar(ESPERA_DEL_GUARDADO)
    await waitFor(() => expect(red!.a('PUT', PUT)).toHaveLength(1))
    const [cambio] = red.a('PUT', PUT)
    expect(Object.keys((cambio.cuerpo as { attributes: object }).attributes).sort()).toEqual(['minutes', 'title'])
  })

  it('un fallo de guardado no se reintenta en bucle: dice su texto y ofrece guardar a mano', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    let intentos = 0
    red = espiarRed([{ method: 'PUT', path: PUT, responder: () => (++intentos === 1 ? problema(400, 'El acta no es válida') : jsonResponse(conActa('held'))) }])
    await usuario.type(await screen.findByLabelText(EDITOR), ' más')
    await pasar(ESPERA_DEL_GUARDADO)
    expect(await screen.findByText('El acta no es válida')).toBeInTheDocument()
    await pasar(10_000)
    expect(red.a('PUT', PUT)).toHaveLength(1)
    await usuario.click(screen.getByRole('button', { name: 'Guardar el acta' }))
    await waitFor(() => expect(red!.a('PUT', PUT)).toHaveLength(2))
  })

  // el registro que el servidor devuelve en cada relectura, en orden: la primera es la carga de la pantalla
  const lecturas = (...versiones: { minutes?: string; state?: string; updatedAt: string; espera?: Promise<void> }[]) => {
    let n = 0
    return {
      ...GET_E1,
      responder: async () => {
        const v = versiones[Math.min(n++, versiones.length - 1)]
        await v.espera
        return jsonResponse(
          registro('e1', { project: 'p1', title: 'Asamblea comunal', minutes: v.minutes ?? '# Acta' }, { state: v.state ?? 'held', updatedAt: v.updatedAt })
        )
      }
    }
  }
  const V1 = { updatedAt: '2026-10-06T12:00:00Z' }
  const V2 = { updatedAt: '2026-10-06T13:00:00Z' }
  const rechazaLaPrimera = () => {
    let intentos = 0
    return { method: 'PUT', path: PUT, responder: () => (++intentos === 1 ? problema(412, 'El acta cambió') : jsonResponse(conActa('held'))) }
  }
  // llega a un 412 con el texto «# Acta mío» sin guardar
  const hastaElConflicto = async (usuario: ReturnType<typeof conTemporizadores>) => {
    await usuario.type(await screen.findByLabelText(EDITOR), ' mío')
    await pasar(ESPERA_DEL_GUARDADO)
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(screen.getByLabelText(EDITOR)).toHaveValue('# Acta mío')
    await pasar(10_000)
    expect(red!.a('PUT', PUT)).toHaveLength(1)
  }

  it('un 412 dice que otra persona cambió el registro y ofrece recargar; si el acta no cambió, guarda con la versión nueva', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed([lecturas(V1, V2), rechazaLaPrimera()])
    await hastaElConflicto(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Recargar' }))
    await pasar(ESPERA_DEL_GUARDADO)
    await waitFor(() => expect(red!.a('PUT', PUT)).toHaveLength(2))
    expect(red.a('PUT', PUT)[1].cabeceras.get('If-Match')).toBe('"2026-10-06T13:00:00Z"')
    expect(screen.getByLabelText(EDITOR)).toHaveValue('# Acta mío')
  })

  it('recargar espera la relectura: no guarda con la versión vieja mientras llega', async () => {
    const usuario = conTemporizadores()
    let llega!: () => void
    const espera = new Promise<void>((r) => (llega = r))
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed([lecturas(V1, { ...V2, espera }), rechazaLaPrimera()])
    await hastaElConflicto(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Recargar' }))
    await pasar(10_000)
    expect(red.a('PUT', PUT)).toHaveLength(1)
    llega()
    await pasar(ESPERA_DEL_GUARDADO)
    await waitFor(() => expect(red!.a('PUT', PUT)).toHaveLength(2))
    expect(red.a('PUT', PUT)[1].cabeceras.get('If-Match')).toBe('"2026-10-06T13:00:00Z"')
  })

  it('si la relectura de «Recargar» falla, el editor sigue con lo escrito y dice el fallo (revisión final, I1)', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    let lecturasDeE1 = 0
    red = espiarRed([
      { ...GET_E1, responder: () => (++lecturasDeE1 === 1 ? jsonResponse(conActa('held')) : problema(404, 'No se encontró')) },
      rechazaLaPrimera()
    ])
    await hastaElConflicto(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Recargar' }))
    expect(await screen.findByText(/No se pudo recargar; lo escrito se conserva\. El registro no existe/)).toBeInTheDocument()
    expect(screen.getByLabelText(EDITOR)).toHaveValue('# Acta mío')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  })

  it('si la otra persona cambió el acta, la muestra y deja elegir: aplicar el texto propio es explícito', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed([lecturas(V1, { ...V2, minutes: '# Acta ajena' }), rechazaLaPrimera()])
    await hastaElConflicto(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Recargar' }))
    expect(await screen.findByRole('heading', { name: 'Acta ajena' })).toBeInTheDocument()
    expect(screen.getByLabelText(EDITOR)).toHaveValue('# Acta mío')
    await pasar(10_000)
    expect(red.a('PUT', PUT)).toHaveLength(1)
    await usuario.click(screen.getByRole('button', { name: 'Aplicar mi texto sobre la versión actual' }))
    await pasar(ESPERA_DEL_GUARDADO)
    await waitFor(() => expect(red!.a('PUT', PUT)).toHaveLength(2))
    const [, segundo] = red.a('PUT', PUT)
    expect(segundo.cabeceras.get('If-Match')).toBe('"2026-10-06T13:00:00Z"')
    expect((segundo.cuerpo as { attributes: { minutes: string } }).attributes.minutes).toBe('# Acta mío')
  })

  it('conservar la versión de la otra persona reemplaza el texto local y no escribe', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed([lecturas(V1, { ...V2, minutes: '# Acta ajena' }), rechazaLaPrimera()])
    await hastaElConflicto(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Recargar' }))
    await usuario.click(await screen.findByRole('button', { name: 'Conservar la versión actual' }))
    expect(screen.getByLabelText(EDITOR)).toHaveValue('# Acta ajena')
    await pasar(10_000)
    expect(red.a('PUT', PUT)).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Guardado')
  })

  it('si al recargar el acta ya no se edita, lo dice y ofrece copiar el texto local', async () => {
    const usuario = conTemporizadores()
    const copiar = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: copiar } })
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed([lecturas(V1, { ...V2, state: 'minutes_in_review' }), rechazaLaPrimera()])
    await hastaElConflicto(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Recargar' }))
    expect(await screen.findByText(/ya no se edita: su texto no se guardó/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Copiar mi texto' }))
    expect(copiar).toHaveBeenCalledWith('# Acta mío')
    expect(await screen.findByText('Texto copiado')).toBeInTheDocument()
    await pasar(10_000)
    expect(red.a('PUT', PUT)).toHaveLength(1)
  })

  it('salir con lo tecleado en el último momento lo guarda: el PUT sale sin esperar el plazo', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed()
    await usuario.type(await screen.findByLabelText(EDITOR), ' al salir')
    expect(red.a('PUT', PUT)).toHaveLength(0)
    await usuario.click(screen.getByRole('link', { name: 'Asamblea comunal' }))
    await waitFor(() => expect(red!.a('PUT', PUT)).toHaveLength(1))
    const [cambio] = red.a('PUT', PUT)
    expect(cambio.cabeceras.get('If-Match')).toBe('"2026-10-06T12:00:00Z"')
    expect((cambio.cuerpo as { attributes: { minutes: string } }).attributes.minutes).toBe('# Acta al salir')
    expect(await screen.findByRole('tab', { name: 'Resumen' })).toBeInTheDocument()
  })

  it('con texto sin guardar y el guardado en pausa, salir por un enlace pide confirmar y deja seguir editando', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed([lecturas(V1, V2), rechazaLaPrimera()])
    await hastaElConflicto(usuario)
    await usuario.click(screen.getByRole('link', { name: 'Asamblea comunal' }))
    expect(await screen.findByText(/Si sale ahora, lo pierde/)).toBeInTheDocument()
    expect(screen.getByLabelText(EDITOR)).toHaveValue('# Acta mío')
    expect(window.location.pathname).toBe('/projects/p1/engagements/e1/minutes')
    await usuario.click(screen.getByRole('button', { name: 'Seguir editando' }))
    expect(screen.queryByText(/Si sale ahora, lo pierde/)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/projects/p1/engagements/e1/minutes')
    // elegir salir deja ir, sin escribir nada más
    await usuario.click(screen.getByRole('link', { name: 'Asamblea comunal' }))
    await usuario.click(await screen.findByRole('button', { name: 'Salir sin guardar' }))
    expect(await screen.findByRole('tab', { name: 'Resumen' })).toBeInTheDocument()
    expect(red.a('PUT', PUT)).toHaveLength(1)
  })

  it('un guardado fallido también bloquea la salida; sin texto sin guardar o con el guardado en curso normal, no', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed([{ method: 'PUT', path: PUT, responder: () => problema(400, 'El acta no es válida') }])
    await usuario.type(await screen.findByLabelText(EDITOR), ' más')
    await pasar(ESPERA_DEL_GUARDADO)
    expect(await screen.findByText('El acta no es válida')).toBeInTheDocument()
    await usuario.click(screen.getByRole('link', { name: 'Asamblea comunal' }))
    expect(await screen.findByText(/Si sale ahora, lo pierde/)).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Resumen' })).not.toBeInTheDocument()
  })

  it('si el guardado al salir falla, el texto y el error esperan al volver al acta y se recuperan', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed([{ method: 'PUT', path: PUT, responder: () => problema(400, 'El acta no es válida') }])
    await usuario.type(await screen.findByLabelText(EDITOR), ' al salir')
    await usuario.click(screen.getByRole('link', { name: 'Asamblea comunal' }))
    await waitFor(() => expect(red!.a('PUT', PUT)).toHaveLength(1))
    expect(await screen.findByRole('tab', { name: 'Resumen' })).toBeInTheDocument()
    await act(async () => window.history.back())
    expect(await screen.findByText(/el texto que tecleó no se pudo guardar: El acta no es válida/)).toBeInTheDocument()
    expect(screen.getByLabelText(EDITOR)).toHaveValue('# Acta')
    await usuario.click(screen.getByRole('button', { name: 'Recuperar mi texto' }))
    expect(screen.getByLabelText(EDITOR)).toHaveValue('# Acta al salir')
    expect(screen.queryByText(/no se pudo guardar: /)).not.toBeInTheDocument()
  })

  it('«Descartar» olvida el texto que no se guardó al salir', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed([{ method: 'PUT', path: PUT, responder: () => problema(400, 'El acta no es válida') }])
    await usuario.type(await screen.findByLabelText(EDITOR), ' al salir')
    await usuario.click(screen.getByRole('link', { name: 'Asamblea comunal' }))
    expect(await screen.findByRole('tab', { name: 'Resumen' })).toBeInTheDocument()
    await act(async () => window.history.back())
    await usuario.click(await screen.findByRole('button', { name: 'Descartar' }))
    expect(screen.queryByText(/no se pudo guardar: /)).not.toBeInTheDocument()
    expect(screen.getByLabelText(EDITOR)).toHaveValue('# Acta')
  })

  it('el vaciado al salir que sí se guarda no deja ningún aviso al volver', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed()
    await usuario.type(await screen.findByLabelText(EDITOR), ' al salir')
    await usuario.click(screen.getByRole('link', { name: 'Asamblea comunal' }))
    expect(await screen.findByRole('tab', { name: 'Resumen' })).toBeInTheDocument()
    await act(async () => window.history.back())
    await screen.findByLabelText(EDITOR)
    expect(screen.queryByText(/no se pudo guardar: /)).not.toBeInTheDocument()
  })

  it('el editor y la pestaña Actividad piden la historia con límites distintos y no comparten la caché', async () => {
    const usuario = conTemporizadores()
    let suelta!: () => void
    const espera = new Promise<void>((r) => (suelta = r))
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      { path: `${PUT}/history`, body: [...guardados(120), devolucion] },
      ...rutas('minutes_drafted')
    ])
    red = espiarRed([
      {
        path: `${PUT}/history`,
        responder: async (llamada) => {
          if (llamada.ruta.endsWith('limit=50')) await espera
          return jsonResponse([...guardados(120), devolucion])
        }
      }
    ])
    await screen.findByText('Devuelta con este motivo: Faltan los acuerdos')
    await usuario.click(screen.getByRole('link', { name: 'Asamblea comunal' }))
    await usuario.click(await screen.findByRole('tab', { name: 'Actividad' }))
    // mientras llega la de 50, la ficha no pinta las 121 entradas que el editor dejó en la caché
    await waitFor(() => expect(red!.a('GET', `${PUT}/history`).some((l) => l.ruta.endsWith('limit=50'))).toBe(true))
    expect(screen.queryAllByRole('listitem').length).toBeLessThan(50)
    suelta()
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeGreaterThan(50))
  })

  it('«Copiar mi texto» avisa cuando el portapapeles falla', async () => {
    const usuario = conTemporizadores()
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.reject(new Error('denegado')) } })
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed([lecturas(V1, { ...V2, state: 'minutes_in_review' }), rechazaLaPrimera()])
    await hastaElConflicto(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Recargar' }))
    await usuario.click(await screen.findByRole('button', { name: 'Copiar mi texto' }))
    expect(await screen.findByText(/No se pudo copiar al portapapeles/)).toBeInTheDocument()
    expect(screen.queryByText('Texto copiado')).not.toBeInTheDocument()
  })

  it('en un acta por registrar la realización no se ofrece desde el editor', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      {
        path: '/objects/engagement/records/e1/transitions',
        body: [
          { name: 'register_held', label: 'Registrar realizada', to: 'held', toLabel: 'Realizada', allowed: true, reason: null },
          { name: 'register_held_unplanned', label: 'Registrar realizada sin planificar', to: 'held', toLabel: 'Realizada', allowed: true, reason: null },
          { name: 'submit_minutes', label: 'Enviar acta', to: 'minutes_in_review', toLabel: 'Acta en revisión', allowed: true, reason: null }
        ]
      },
      ...rutas('minutes_drafted')
    ])
    expect(await screen.findByRole('button', { name: 'Enviar acta' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Registrar realizada/ })).not.toBeInTheDocument()
  })

  it('salir sin cambios no escribe', async () => {
    const usuario = conTemporizadores()
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, rutas('held'))
    red = espiarRed()
    await usuario.click(await screen.findByRole('link', { name: 'Asamblea comunal' }))
    expect(await screen.findByRole('tab', { name: 'Resumen' })).toBeInTheDocument()
    expect(red.a('PUT', PUT)).toHaveLength(0)
  })

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

  const guardados = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `u${i}`,
      userEmail: 'relacionista@sgspe.test',
      operation: 'UPDATE',
      occurredAt: `2026-10-06T${String(12 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`,
      reason: null,
      changes: [{ field: 'minutes', before: 'a', after: 'b' }]
    }))
  const devolucion = {
    id: 'dev',
    userEmail: 'smg@sgspe.test',
    operation: 'UPDATE',
    occurredAt: '2026-10-06T11:00:00Z',
    reason: 'Faltan los acuerdos',
    changes: [{ field: 'state', before: 'minutes_in_review', after: 'minutes_drafted' }]
  }

  it('el motivo de la devolución se halla aunque haya más de 50 autoguardados después: pide hasta 500 entradas', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      { path: `${PUT}/history`, body: [...guardados(120), devolucion] },
      ...rutas('minutes_drafted')
    ])
    red = espiarRed()
    expect(await screen.findByText('Devuelta con este motivo: Faltan los acuerdos')).toBeInTheDocument()
    expect(red.a('GET', `${PUT}/history`)[0].ruta).toContain('limit=500')
  })

  it('si la historia llega llena sin la devolución, dice que no pudo leer el motivo; completa y sin devolución es un borrador nuevo', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      { path: `${PUT}/history`, body: guardados(500) },
      ...rutas('minutes_drafted')
    ])
    expect(await screen.findByText('No se pudo leer el motivo de la devolución.')).toBeInTheDocument()
  })

  it('una historia completa sin devolución es un borrador nuevo: ni motivo ni aviso', async () => {
    fetch = abrirPortal('/projects/p1/engagements/e1/minutes', RELACIONISTA, EQUIPO, [
      { path: `${PUT}/history`, body: guardados(3) },
      ...rutas('minutes_drafted')
    ])
    await screen.findByLabelText(EDITOR)
    await waitFor(() => expect(fetch!.calls.some((c) => c.path.includes('/history'))).toBe(true))
    expect(screen.queryByText('No se pudo leer el motivo de la devolución.')).not.toBeInTheDocument()
    expect(screen.queryByText(/Devuelta con este motivo/)).not.toBeInTheDocument()
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
