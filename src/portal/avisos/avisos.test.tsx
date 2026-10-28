import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar, registro, ubicacion } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import type { Aviso, ResumenDeAvisos } from '../datos/avisos'
import { AbrirRegistroPage } from './AbrirRegistroPage'
import { AvisosPage, mananaALas8 } from './AvisosPage'
import { Campana } from './Campana'

// S04 (wasichai-notifications, decisión D2): la campana con su contador vivo y los cinco últimos, la bandeja con sus filtros,
// posponer hasta mañana a las 8:00 de Lima, los ACTION de una fuente que no se descartan, las preferencias de correo y /r/…
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const aviso = (id: string, extra: Partial<Aviso> = {}): Aviso => ({
  id,
  kind: 'ACTION',
  title: `Aviso ${id}`,
  body: null,
  link: { type: 'RECORD', object: 'commitment', recordId: 'c1' },
  publishAt: '2026-10-08T15:00:00Z',
  expiresAt: null,
  dueAt: null,
  overdue: false,
  source: 'sgspe.approvals',
  read: false,
  snoozedUntil: null,
  dismissible: false,
  ...extra
})
const RESUMEN: ResumenDeAvisos = {
  kinds: { ACTION: { active: 2, unread: 2, overdue: 0 }, WARNING: { active: 1, unread: 1, overdue: 0 }, INFO: { active: 0, unread: 0, overdue: 0 } },
  latest: null
}
const pagina = (avisos: Aviso[]) => ({ content: avisos, page: 0, size: 25, totalElements: avisos.length, totalPages: 1 })
const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  { path: '/auth/me/notifications/summary', body: RESUMEN },
  { path: '/auth/me/notifications/stream', status: 404, body: { title: 'no' } },
  {
    path: '/auth/me/notifications',
    body: pagina([
      aviso('n1', { title: 'Compromiso C-001 pendiente de aprobación' }),
      aviso('n2', { kind: 'INFO', title: 'Minuta emitida', dismissible: true, source: 'manual', link: null, read: true })
    ])
  },
  { path: '/auth/me/notification-preferences', body: { email: ['ACTION', 'WARNING', 'INFO'] } }
]

describe('S04 · campana', () => {
  it('dice cuántos avisos hay sin leer; abrir uno lo marca leído y lleva a su registro', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/auth/me/notifications/n1/read', status: 204 }]))
    red = espiarRed()
    montar(<Campana />)
    await userEvent.click(await screen.findByRole('button', { name: 'Avisos, 3 sin leer' }))
    const panel = await screen.findByRole('region', { name: 'Últimos avisos' })
    expect(red.a('GET', '/auth/me/notifications').at(-1)?.ruta).toContain('size=5')
    await userEvent.click(within(panel).getByRole('button', { name: /Compromiso C-001 pendiente de aprobación/ }))
    await waitFor(() => expect(red!.a('POST', '/auth/me/notifications/n1/read')).toHaveLength(1))
    expect(ubicacion.actual).toBe('/r/commitment/c1')
    expect(screen.queryByRole('region', { name: 'Últimos avisos' })).not.toBeInTheDocument()
  })

  it('dibuja el título y el cuerpo de un aviso como texto, nunca como HTML', async () => {
    const titulo = '<img src=x onerror=alert(1)>'
    fetch = mockFetch(rutas([{ path: '/auth/me/notifications', body: pagina([aviso('n9', { title: titulo, body: '<b>negrita</b>' })]) }]))
    const { container } = montar(<Campana />)
    await userEvent.click(await screen.findByRole('button', { name: 'Avisos, 3 sin leer' }))
    const panel = await screen.findByRole('region', { name: 'Últimos avisos' })
    expect(await within(panel).findByText(titulo)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('cerrada no apunta a un panel que no existe; un clic fuera la cierra', async () => {
    fetch = mockFetch(rutas())
    montar(
      <>
        <p>afuera</p>
        <Campana />
      </>
    )
    const boton = await screen.findByRole('button', { name: 'Avisos, 3 sin leer' })
    expect(boton).not.toHaveAttribute('aria-controls')
    await userEvent.click(boton)
    const panel = await screen.findByRole('region', { name: 'Últimos avisos' })
    expect(boton).toHaveAttribute('aria-controls', panel.id)
    // un clic dentro del panel no la cierra
    await userEvent.click(within(panel).getByRole('heading', { name: 'Últimos avisos' }))
    expect(screen.getByRole('region', { name: 'Últimos avisos' })).toBeInTheDocument()
    await userEvent.click(screen.getByText('afuera'))
    expect(screen.queryByRole('region', { name: 'Últimos avisos' })).not.toBeInTheDocument()
  })

  it('«Marcar todos como leídos» que falla lo dice en el panel', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/auth/me/notifications/read-all', status: 500, body: { title: 'Error', status: 500 } }]))
    montar(<Campana />)
    await userEvent.click(await screen.findByRole('button', { name: 'Avisos, 3 sin leer' }))
    const panel = await screen.findByRole('region', { name: 'Últimos avisos' })
    await userEvent.click(within(panel).getByRole('button', { name: 'Marcar todos como leídos' }))
    expect(await within(panel).findByRole('alert')).toBeInTheDocument()
  })

  it('sin el módulo de avisos (404) no hay campana', async () => {
    fetch = mockFetch([])
    red = espiarRed()
    montar(<Campana />)
    await waitFor(() => expect(red!.a('GET', '/auth/me/notifications/summary')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Avisos/ })).not.toBeInTheDocument())
  })
})

describe('S04 · bandeja', () => {
  // revisión de UX, etapa 3: las vistas dicen cuántos avisos tienen, del resumen de la bandeja
  it('«Activos» y «Solo sin leer» dicen cuántos tienen; «Pospuestos», no', async () => {
    fetch = mockFetch(rutas())
    montar(<AvisosPage />, { ruta: '/notifications', camino: '/notifications' })
    expect(await screen.findByRole('radio', { name: 'Activos, 3' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Solo sin leer, 3' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Pospuestos' })).toBeInTheDocument()
  })

  // tercera pasada de UX: sin el módulo de avisos no es «No tiene avisos.», que afirmaría que no hay nada: no está disponible
  it('sin el módulo de avisos dice que no está disponible en su organización, no que no hay avisos', async () => {
    fetch = mockFetch([
      { path: '/auth/me/notifications/summary', status: 404, body: { title: 'no' } },
      { path: '/auth/me/notifications/stream', status: 404, body: { title: 'no' } },
      { path: '/auth/me/notifications', status: 404, body: { title: 'no' } }
    ])
    montar(<AvisosPage />, { ruta: '/notifications', camino: '/notifications' })
    expect(await screen.findByText('Esta información no está disponible en su organización.')).toBeInTheDocument()
    expect(screen.queryByText('No tiene avisos.')).not.toBeInTheDocument()
  })

  // hallazgos U-18 y U-22 (DD-03, DD-04): las vistas en el selector de la barra de filtros, sin segunda fila de pestañas, y el
  // tipo como filtro de la barra, con su chip y «Limpiar filtros». ?view= y ?kind= no cambian
  it('las vistas van en el selector de la barra y el tipo es un filtro con su chip y «Limpiar filtros»', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    montar(<AvisosPage />, { ruta: '/notifications?view=sinLeer&kind=ACTION', camino: '/notifications' })
    const barra = screen.getByRole('group', { name: 'Filtros' })
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(within(within(barra).getByRole('radiogroup', { name: 'Vistas' })).getByRole('radio', { name: /^Solo sin leer\b/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(within(barra).getByRole('combobox', { name: 'Tipo' })).toHaveDisplayValue('Para hacer')
    await waitFor(() => expect(red!.a('GET', '/auth/me/notifications').at(-1)?.ruta).toContain('kind=ACTION'))
    const chips = within(barra).getByRole('list', { name: 'Filtros aplicados' })
    expect(within(chips).getByRole('listitem')).toHaveTextContent('Tipo: Para hacer')
    await userEvent.click(within(barra).getByRole('button', { name: 'Limpiar filtros' }))
    expect(ubicacion.actual).toBe('/notifications?view=sinLeer')
    await waitFor(() => expect(red!.a('GET', '/auth/me/notifications').at(-1)?.ruta).not.toContain('kind='))
    expect(within(barra).queryByRole('list', { name: 'Filtros aplicados' })).not.toBeInTheDocument()
  })

  it('filtra sin leer en el servidor; un ACTION de una fuente no se descarta y uno manual sí', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/auth/me/notifications/n2/dismiss', status: 204 }]))
    red = espiarRed()
    montar(<AvisosPage />, { ruta: '/notifications', camino: '/notifications' })
    const primero = (await screen.findByRole('heading', { name: 'Compromiso C-001 pendiente de aprobación' })).closest('li') as HTMLElement
    // la nota va una vez, sobre la lista, y no en cada aviso (tercera pasada de UX, 3.5)
    expect(screen.getByText('Los avisos que piden hacer algo no se descartan: se van solos cuando el trabajo se hace.')).toBeInTheDocument()
    expect(within(primero).queryByText('Se va solo cuando el trabajo se hace')).not.toBeInTheDocument()
    expect(within(primero).queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument()
    expect(within(primero).getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/r/commitment/c1')
    const segundo = screen.getByRole('heading', { name: 'Minuta emitida' }).closest('li') as HTMLElement
    expect(within(segundo).getByText('Este aviso no lleva a un registro que su cuenta pueda abrir.')).toBeInTheDocument()
    await userEvent.click(within(segundo).getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(red!.a('POST', '/auth/me/notifications/n2/dismiss')).toHaveLength(1))
    await userEvent.click(screen.getByRole('radio', { name: /^Solo sin leer\b/ }))
    await waitFor(() => expect(red!.a('GET', '/auth/me/notifications').at(-1)?.ruta).toContain('state=unread'))
  })

  // rediseño de UX (2026-10-20): un tipo sin avisos se puede quitar desde el vacío
  it('con un tipo elegido y ningún aviso, el vacío ofrece limpiar el filtro', async () => {
    fetch = mockFetch([{ path: /^\/auth\/me\/notifications\?.*kind=WARNING/, body: pagina([]) }, ...rutas()])
    red = espiarRed()
    montar(<AvisosPage />, { ruta: '/notifications?kind=WARNING', camino: '/notifications' })
    expect(await screen.findByText('Nada coincide con los filtros')).toBeInTheDocument()
    // el del vacío, no el de la barra de filtros
    const barra = screen.getByRole('group', { name: 'Filtros' })
    const delVacio = screen.getAllByRole('button', { name: 'Limpiar filtros' }).find((b) => !barra.contains(b))!
    await userEvent.click(delVacio)
    await waitFor(() => expect(red!.a('GET', '/auth/me/notifications').at(-1)?.ruta).not.toContain('kind='))
  })

  it('nombra las fuentes de F4: riesgos y alerta temprana; el aviso genérico de una QCS confidencial no lleva enlace', async () => {
    fetch = mockFetch(
      rutas([
        {
          path: '/auth/me/notifications',
          body: pagina([
            aviso('n4', { title: 'El riesgo R-001 subió a CRITICO', source: 'sgspe.risks', link: { type: 'RECORD', object: 'social_risk', recordId: 'k1' } }),
            aviso('n5', { title: 'Alerta nueva', source: 'sgspe.warnings', link: { type: 'RECORD', object: 'early_warning', recordId: 'w1' } }),
            aviso('n6', {
              title: 'Una QCS confidencial del proyecto Pukaqaqa superó su plazo. Pida el detalle al equipo de quejas.',
              source: 'sgspe.deadlines',
              link: null
            })
          ])
        }
      ])
    )
    montar(<AvisosPage />, { ruta: '/notifications', camino: '/notifications' })
    const riesgo = (await screen.findByRole('heading', { name: 'El riesgo R-001 subió a CRITICO' })).closest('li') as HTMLElement
    expect(within(riesgo).getByText(/Riesgos/)).toBeInTheDocument()
    expect(within(riesgo).getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/r/social_risk/k1')
    const alerta = screen.getByRole('heading', { name: 'Alerta nueva' }).closest('li') as HTMLElement
    expect(within(alerta).getByText(/Alerta temprana/)).toBeInTheDocument()
    const generico = screen.getByRole('heading', { name: /Una QCS confidencial del proyecto Pukaqaqa/ }).closest('li') as HTMLElement
    expect(within(generico).queryByRole('link', { name: 'Abrir' })).not.toBeInTheDocument()
  })

  it('dibuja el título y el cuerpo de un aviso como texto, nunca como HTML', async () => {
    const titulo = '<img src=x onerror=alert(1)>'
    const cuerpo = '<script>alert(2)</script><b>negrita</b>'
    fetch = mockFetch(rutas([{ path: '/auth/me/notifications', body: pagina([aviso('n9', { title: titulo, body: cuerpo })]) }]))
    const { container } = montar(<AvisosPage />, { ruta: '/notifications', camino: '/notifications' })
    expect(await screen.findByRole('heading', { name: titulo })).toBeInTheDocument()
    expect(screen.getByText(cuerpo)).toBeInTheDocument()
    expect(container.querySelector('img, script, b')).toBeNull()
  })

  it('«Abrir» marca leído el aviso que no lo estaba', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/auth/me/notifications/n1/read', status: 204 }]))
    red = espiarRed()
    montar(<AvisosPage />, { ruta: '/notifications', camino: '/notifications' })
    const primero = (await screen.findByRole('heading', { name: 'Compromiso C-001 pendiente de aprobación' })).closest('li') as HTMLElement
    await userEvent.click(within(primero).getByRole('link', { name: 'Abrir' }))
    await waitFor(() => expect(red!.a('POST', '/auth/me/notifications/n1/read')).toHaveLength(1))
    expect(ubicacion.actual).toBe('/r/commitment/c1')
  })

  it('posponer lo esconde hasta mañana a las 8:00 de Lima', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/auth/me/notifications/n1/snooze', status: 204 }]))
    red = espiarRed()
    montar(<AvisosPage />, { ruta: '/notifications', camino: '/notifications' })
    const primero = (await screen.findByRole('heading', { name: 'Compromiso C-001 pendiente de aprobación' })).closest('li') as HTMLElement
    await userEvent.click(within(primero).getByRole('button', { name: 'Posponer hasta mañana' }))
    await waitFor(() => expect(red!.a('POST', '/auth/me/notifications/n1/snooze')).toHaveLength(1))
    expect((red.a('POST', '/auth/me/notifications/n1/snooze')[0].cuerpo as { until: string }).until).toMatch(/T13:00:00\.000Z$/)
  })

  it('«mañana a las 8» es el día siguiente de Lima, también pasadas las 19:00', () => {
    // las 20:00 de Lima del 9 de octubre ya son el 10 en UTC: mañana sigue siendo el 10 en Lima
    expect(mananaALas8(new Date('2026-10-10T01:00:00Z'))).toBe('2026-10-10T13:00:00.000Z')
    expect(mananaALas8(new Date('2026-10-09T15:00:00Z'))).toBe('2026-10-10T13:00:00.000Z')
  })

  it('las preferencias de correo guardan los tipos elegidos', async () => {
    fetch = mockFetch(rutas([{ method: 'PUT', path: '/auth/me/notification-preferences', body: { email: ['ACTION', 'INFO'] } }]))
    red = espiarRed()
    montar(<AvisosPage />, { ruta: '/notifications', camino: '/notifications' })
    const preferencias = await screen.findByRole('region', { name: 'Avisos por correo' })
    await userEvent.click(await within(preferencias).findByRole('checkbox', { name: 'Advertencia' }))
    await userEvent.click(within(preferencias).getByRole('button', { name: 'Guardar preferencias' }))
    expect(await within(preferencias).findByText('Preferencias guardadas.')).toBeInTheDocument()
    expect(red.a('PUT', '/auth/me/notification-preferences')[0].cuerpo).toEqual({ email: ['ACTION', 'INFO'] })
  })
})

describe('/r/:object/:recordId', () => {
  it('lee el registro y salta a su ficha bajo el proyecto', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/records/c1', body: registro('c1', { project: 'p1' }) }])
    montar(<AbrirRegistroPage />, { ruta: '/r/commitment/c1', camino: '/r/:object/:recordId' })
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments/c1'))
  })
  it('un objeto sin ficha en el portal dice «No disponible» y no salta', async () => {
    fetch = mockFetch([{ path: '/objects/widget/records/w1', body: registro('w1', { project: 'p1' }) }])
    montar(<AbrirRegistroPage />, { ruta: '/r/widget/w1', camino: '/r/:object/:recordId' })
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.getByText('Este registro no tiene una ficha en el portal todavía.')).toBeInTheDocument()
    expect(ubicacion.actual).toBe('/r/widget/w1')
  })

  // la bandeja no se filtra por proyecto (spec 4.4 §3.8): un aviso viejo lleva a un registro que ya no se lee
  it('un registro que la cuenta no lee o que ya no existe (404) es «Registro reservado», sin reintento, y no salta', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/records/c1', status: 404, body: { title: 'Not Found', status: 404 } }])
    montar(<AbrirRegistroPage />, { ruta: '/r/commitment/c1', camino: '/r/:object/:recordId' })
    expect(await screen.findByText('Registro reservado')).toBeInTheDocument()
    expect(screen.getByText(/Su cuenta no lee este registro/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(ubicacion.actual).toBe('/r/commitment/c1')
  })

  it('una QCS confidencial que la cuenta no lee (404) es «Registro reservado», sin datos, y no salta', async () => {
    fetch = mockFetch([{ path: '/objects/grievance/records/g9', status: 404, body: { title: 'Not Found', status: 404 } }])
    montar(<AbrirRegistroPage />, { ruta: '/r/grievance/g9', camino: '/r/:object/:recordId' })
    expect(await screen.findByText('Registro reservado')).toBeInTheDocument()
    expect(screen.getByText(/Su cuenta no lee este registro/)).toBeInTheDocument()
    expect(ubicacion.actual).toBe('/r/grievance/g9')
  })

  it('una queja que la cuenta lee salta a su ficha de F4', async () => {
    fetch = mockFetch([{ path: '/objects/grievance/records/g1', body: registro('g1', { project: 'p1' }) }])
    montar(<AbrirRegistroPage />, { ruta: '/r/grievance/g1', camino: '/r/:object/:recordId' })
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/grievances/g1'))
  })

  it('un registro que la cuenta no lee (403) es «No disponible» y no salta', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/records/c1', status: 403, body: { title: 'Forbidden' } }])
    montar(<AbrirRegistroPage />, { ruta: '/r/commitment/c1', camino: '/r/:object/:recordId' })
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(ubicacion.actual).toBe('/r/commitment/c1')
  })
})
