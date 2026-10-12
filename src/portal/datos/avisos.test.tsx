import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import {
  esperaDeReconexion,
  eventosSse,
  sinLeer,
  useAccionDeAviso,
  useFlujoDeAvisos,
  useResumenDeAvisos,
  type Aviso,
  type Programar,
  type ResumenDeAvisos
} from './avisos'
import { destinoDeAviso, rutaDeFicha } from './fichas'

// wasichai-notifications (WAS-ADR-0046 y 0047): el resumen en vivo por SSE leído con fetch (el token en Authorization), sin
// reintentar si el módulo no está; la bandeja por REST; y a dónde lleva cada aviso
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const texto = new TextEncoder()
const flujo = (...partes: string[]) =>
  new ReadableStream<Uint8Array>({
    start(control) {
      for (const parte of partes) control.enqueue(texto.encode(parte))
      control.close()
    }
  })

const resumen = (accion: number, aviso = 0): ResumenDeAvisos => ({
  kinds: {
    ACTION: { active: accion, unread: accion, overdue: 0 },
    WARNING: { active: aviso, unread: aviso, overdue: 0 },
    INFO: { active: 0, unread: 0, overdue: 0 }
  },
  latest: null
})

function Contador({ programar }: { programar: Programar }) {
  useFlujoDeAvisos(true, programar)
  const r = useResumenDeAvisos()
  return <p>sin leer: {r.data ? sinLeer(r.data) : '…'}</p>
}

describe('flujo SSE', () => {
  it('lee los eventos aunque lleguen partidos, con varias líneas de datos y sin los comentarios de latido', async () => {
    const eventos = []
    for await (const e of eventosSse(flujo(': ping\n\nevent: summ', 'ary\ndata: {"a":\ndata: 1}\n\n', 'data: x\r\n\r\n'))) eventos.push(e)
    expect(eventos).toEqual([
      { evento: 'summary', datos: '{"a":\n1}' },
      { evento: 'message', datos: 'x' }
    ])
  })

  it('cada resumen del flujo reemplaza el de la caché, el token va en Authorization y al cortarse se reconecta', async () => {
    localStorage.setItem('sgspe.token', 't')
    fetch = mockFetch([{ path: '/auth/me/notifications/summary', body: resumen(1) }])
    red = espiarRed([
      {
        path: '/auth/me/notifications/stream',
        responder: () => new Response(flujo(`event: summary\ndata: ${JSON.stringify(resumen(3, 1))}\n\n`), { headers: { 'Content-Type': 'text/event-stream' } })
      }
    ])
    const programar = vi.fn<Programar>(() => () => {})
    montar(<Contador programar={programar} />)
    expect(await screen.findByText('sin leer: 4')).toBeInTheDocument()
    const [abierto] = red.a('GET', '/auth/me/notifications/stream')
    expect(abierto.cabeceras.get('Authorization')).toBe('Bearer t')
    expect(abierto.ruta).not.toContain('t=')
    await waitFor(() => expect(programar).toHaveBeenCalledWith(expect.any(Function), 5000))
  })

  it('sin el módulo (404) no reintenta ni muestra un error', async () => {
    fetch = mockFetch([{ path: '/auth/me/notifications/summary', status: 404, body: { title: 'Not found' } }])
    red = espiarRed([{ path: '/auth/me/notifications/stream', responder: () => problema(404, 'no') }])
    const programar = vi.fn<Programar>(() => () => {})
    montar(<Contador programar={programar} />)
    await waitFor(() => expect(red!.a('GET', '/auth/me/notifications/stream')).toHaveLength(1))
    expect(programar).not.toHaveBeenCalled()
  })

  it('una cuenta de servicio (403) no reintenta; un 401 cierra la sesión y tampoco', async () => {
    localStorage.setItem('sgspe.token', 't')
    fetch = mockFetch([{ path: '/auth/me/notifications/summary', body: resumen(1) }])
    const respuestas = [() => problema(403, 'no'), () => problema(401, 'vencido')]
    red = espiarRed([{ path: '/auth/me/notifications/stream', responder: () => respuestas.shift()!() }])
    const programar = vi.fn<Programar>(() => () => {})
    const vista = montar(<Contador programar={programar} />)
    await waitFor(() => expect(red!.a('GET', '/auth/me/notifications/stream')).toHaveLength(1))
    vista.unmount()
    localStorage.setItem('sgspe.token', 't')
    montar(<Contador programar={programar} />)
    await waitFor(() => expect(red!.a('GET', '/auth/me/notifications/stream')).toHaveLength(2))
    await waitFor(() => expect(localStorage.getItem('sgspe.token')).toBeNull())
    expect(programar).not.toHaveBeenCalled()
  })

  it('reconectar vuelve a abrir el flujo, y si falla la espera crece', async () => {
    fetch = mockFetch([{ path: '/auth/me/notifications/summary', body: resumen(1) }])
    const respuestas = [
      () => new Response(flujo(`event: summary\ndata: ${JSON.stringify(resumen(2))}\n\n`), { headers: { 'Content-Type': 'text/event-stream' } }),
      () => problema(500, 'caído')
    ]
    red = espiarRed([{ path: '/auth/me/notifications/stream', responder: () => respuestas.shift()!() }])
    const tareas: (() => void)[] = []
    const programar = vi.fn<Programar>((tarea) => {
      tareas.push(tarea)
      return () => {}
    })
    montar(<Contador programar={programar} />)
    await waitFor(() => expect(programar).toHaveBeenCalledTimes(1))
    expect(programar).toHaveBeenLastCalledWith(expect.any(Function), 5000)
    tareas[0]()
    await waitFor(() => expect(red!.a('GET', '/auth/me/notifications/stream')).toHaveLength(2))
    await waitFor(() => expect(programar).toHaveBeenCalledTimes(2))
    expect(programar).toHaveBeenLastCalledWith(expect.any(Function), 10000)
  })

  // la lectura inicial del resumen llega después del primer evento del flujo: sin cancelarla, pisaría el resumen más nuevo
  it('una lectura inicial lenta no pisa el resumen que ya trajo el flujo', async () => {
    let responderLectura: () => void = () => {}
    const lectura = new Promise<Response>((resolver) => {
      responderLectura = () => resolver(new Response(JSON.stringify(resumen(1)), { headers: { 'Content-Type': 'application/json' } }))
    })
    fetch = mockFetch([])
    red = espiarRed([
      { path: '/auth/me/notifications/summary', responder: () => lectura },
      {
        path: '/auth/me/notifications/stream',
        responder: () => new Response(flujo(`event: summary\ndata: ${JSON.stringify(resumen(3, 1))}\n\n`), { headers: { 'Content-Type': 'text/event-stream' } })
      }
    ])
    montar(<Contador programar={() => () => {}} />)
    expect(await screen.findByText('sin leer: 4')).toBeInTheDocument()
    responderLectura()
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByText('sin leer: 4')).toBeInTheDocument()
  })

  it('la espera de reconexión crece hasta un minuto', () => {
    expect([0, 1, 2, 3, 9].map(esperaDeReconexion)).toEqual([5000, 10000, 20000, 40000, 60000])
  })
})

const AVISO: Aviso = {
  id: 'n1',
  kind: 'ACTION',
  title: 'Compromiso C-1 pendiente de aprobación',
  body: null,
  link: { type: 'RECORD', object: 'commitment', recordId: 'c1' },
  publishAt: '2026-10-08T15:00:00Z',
  expiresAt: null,
  dueAt: null,
  overdue: false,
  source: 'sgspe.approvals',
  read: false,
  snoozedUntil: null,
  dismissible: false
}

function Leer() {
  const accion = useAccionDeAviso()
  return (
    <button type="button" onClick={() => accion.mutate({ aviso: AVISO, accion: 'snooze', hasta: '2026-10-10T13:00:00Z' })}>
      posponer
    </button>
  )
}

describe('bandeja y destinos', () => {
  it('posponer manda la fecha hasta la que se pospone', async () => {
    fetch = mockFetch([{ method: 'POST', path: '/auth/me/notifications/n1/snooze', status: 204 }])
    red = espiarRed()
    montar(<Leer />)
    await userEvent.click(screen.getByRole('button', { name: 'posponer' }))
    await waitFor(() => expect(red!.a('POST', '/auth/me/notifications/n1/snooze')).toHaveLength(1))
    expect(red.a('POST', '/auth/me/notifications/n1/snooze')[0].cuerpo).toEqual({ until: '2026-10-10T13:00:00Z' })
  })

  it('un aviso de registro pasa por /r/; una URL ajena o una ruta de wasichai-ui no llevan a ninguna parte', () => {
    expect(destinoDeAviso(AVISO.link)).toBe('/r/commitment/c1')
    expect(destinoDeAviso({ type: 'URL', url: '/tasks' })).toBe('/tasks')
    expect(destinoDeAviso({ type: 'URL', url: 'https://otro.example' })).toBeNull()
    expect(destinoDeAviso({ type: 'URL', url: '//otro.example' })).toBeNull()
    expect(destinoDeAviso({ type: 'ROUTE', route: 'records:detail' })).toBeNull()
    expect(destinoDeAviso(null)).toBeNull()
  })

  // un navegador trata la barra invertida como '/' y descarta tabuladores y saltos de línea de una URL: «/\otro.example» o
  // «/<tab>/otro.example» serían «//otro.example», otro sitio
  it('una URL que el navegador leería como de otro sitio no lleva a ninguna parte', () => {
    for (const url of [
      '/\\otro.example',
      '/\\/otro.example',
      '/\t/otro.example',
      '/\n/otro.example',
      '/\r/otro.example',
      '/tasks\u0000',
      '/tasks\u007f',
      ' //otro.example'
    ])
      expect(destinoDeAviso({ type: 'URL', url }), JSON.stringify(url)).toBeNull()
    expect(destinoDeAviso({ type: 'URL', url: '/projects/p1/commitments?view=mios#x' })).toBe('/projects/p1/commitments?view=mios#x')
  })

  it('un aviso de registro sin objeto o sin id no lleva a ninguna parte; el objeto y el id van codificados', () => {
    expect(destinoDeAviso({ type: 'RECORD', recordId: 'c1' })).toBeNull()
    expect(destinoDeAviso({ type: 'RECORD', object: 'commitment' })).toBeNull()
    expect(destinoDeAviso({ type: 'RECORD', object: 'commitment', recordId: 'c/1?x' })).toBe('/r/commitment/c%2F1%3Fx')
  })

  it('la ficha de un registro vive bajo su proyecto; una evidencia del tenant, en la biblioteca', () => {
    expect(rutaDeFicha('commitment', registro('c1', { project: 'p1' }))).toBe('/projects/p1/commitments/c1')
    expect(rutaDeFicha('task', registro('t1', { project: 'p1' }))).toBe('/projects/p1/tasks?task=t1')
    expect(rutaDeFicha('evidence', registro('ev1', {}))).toBe('/documents/ev1')
    expect(rutaDeFicha('project', registro('p1', {}))).toBe('/projects/p1/overview')
    expect(rutaDeFicha('commitment', registro('c1', {}))).toBeNull()
    expect(rutaDeFicha('social_program', registro('sp1', { project: 'p1' }))).toBe('/projects/p1/programs/sp1')
  })

  it.each([
    ['engagement', '/projects/p1/engagements/r1'],
    ['agreement', '/projects/p1/agreements/r1'],
    ['stakeholder', '/projects/p1/stakeholders/r1'],
    ['area_of_influence', '/projects/p1/areas/r1'],
    ['field_visit', '/projects/p1/field-visits/r1'],
    ['evidence', '/projects/p1/documents/r1']
  ])('la ficha de %s vive bajo su proyecto', (objeto, ruta) => {
    expect(rutaDeFicha(objeto, registro('r1', { project: 'p1' }))).toBe(ruta)
    if (objeto !== 'evidence') expect(rutaDeFicha(objeto, registro('r1', {}))).toBeNull()
  })

  it('el proyecto y el id de la ruta de una ficha van codificados', () => {
    expect(rutaDeFicha('commitment', registro('c/1', { project: 'p 1' }))).toBe('/projects/p%201/commitments/c%2F1')
  })
})

describe('rutaDeFicha en F6', () => {
  it('una localidad, una comunidad y un componente tienen ficha; un predio no', () => {
    expect(rutaDeFicha('locality', registro('l1', {}))).toBe('/territory/localities/l1')
    expect(rutaDeFicha('community', registro('c1', {}))).toBe('/territory/communities/c1')
    expect(rutaDeFicha('project_component', registro('pc1', { project: 'p1' }))).toBe('/projects/p1/map?selected=project_component:pc1')
    expect(rutaDeFicha('project_component', registro('pc1', {}))).toBeNull()
    expect(rutaDeFicha('land_parcel', registro('lp1', {}))).toBeNull()
  })
})
