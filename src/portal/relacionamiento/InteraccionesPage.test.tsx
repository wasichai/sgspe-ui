import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { ADMINISTRACION, RELACIONISTA } from '../../test/portal'
import { listaDelServidor } from '../../test/listaDelServidor'
import { espiarRed, problema, type Red } from '../../test/red'
import { E1, E2, E3, EQUIPO, base } from '../../test/relacionamiento'

vi.mock('../graficos/Grafico', () => import('../../test/graficoFalso'))
vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))

// una respuesta que llega cuando la prueba la suelta
const compuerta = () => {
  let suelta!: () => void
  const espera = new Promise<void>((resolver) => (suelta = resolver))
  return { espera, suelta }
}

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

describe('S21 y S22 · calendario y lista de interacciones', () => {
  it('ubica cada interacción en su día de Lima, marca el acta pendiente y la cancelación, y la franja de festividades del proyecto', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1, E2, E3]) }
    ])
    const calendario = await screen.findByRole('table', { name: 'Calendario de interacciones' })
    const dia1 = within(calendario).getByRole('cell', { name: '2026-10-01' })
    expect(within(dia1).getByRole('link', { name: /Asamblea comunal/ })).toHaveTextContent('Realizada sin acta')
    expect(await within(dia1).findByText('Fiesta patronal')).toBeInTheDocument()
    expect(within(calendario).queryByText('Fiesta de otro lugar')).not.toBeInTheDocument()
    expect(within(within(calendario).getByRole('cell', { name: '2026-10-15' })).getByRole('link', { name: 'Reunión con la junta' })).toHaveAttribute(
      'title',
      'Cancelada: Lluvias'
    )
    expect(within(calendario).queryByText('Llamada al teniente')).not.toBeInTheDocument()
  })

  it('el panel compara las reuniones con la meta y dice qué toca', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1, E2, E3]) }
    ])
    expect(await screen.findByText('1 de 2')).toBeInTheDocument()
    const toca = screen.getByRole('complementary').querySelector('[aria-label="Te toca"]') as HTMLElement
    // agrupado por lo que toca, con su conteo
    const actas = within(toca).getByRole('group', { name: '1 acta por redactar' })
    expect(within(actas).getByRole('link', { name: 'Asamblea comunal' })).toHaveAttribute('href', '/projects/p1/engagements/e1/minutes')
    expect(within(within(toca).getByRole('group', { name: '1 interacción postergada' })).getByRole('link', { name: 'Llamada al teniente' })).toBeInTheDocument()
  })

  it('la vista Lista muestra la misma consulta como tabla', async () => {
    fetch = abrirPortal('/projects/p1/engagements', RELACIONISTA, EQUIPO, [...base(), { path: '/objects/engagement/records', body: pagina([E1, E2]) }])
    const tabla = await screen.findByRole('table', { name: 'Relacionamiento' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(3)
    expect(within(tabla).getByText('40')).toBeInTheDocument()
  })

  it('el límite de la medianoche: 04:59Z sigue en el día de Lima y 05:00Z ya es el siguiente', async () => {
    const antes = registro('b1', { project: 'p1', title: 'Antes de medianoche', engagement_type: 'VISITA', held_at: '2026-10-05T04:59:00Z' }, { state: 'held' })
    const despues = registro(
      'b2',
      { project: 'p1', title: 'Después de medianoche', engagement_type: 'VISITA', held_at: '2026-10-05T05:00:00Z' },
      { state: 'held' }
    )
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([antes, despues]) }
    ])
    const calendario = await screen.findByRole('table', { name: 'Calendario de interacciones' })
    expect(within(within(calendario).getByRole('cell', { name: '2026-10-04' })).getByRole('link', { name: 'Antes de medianoche' })).toBeInTheDocument()
    expect(within(within(calendario).getByRole('cell', { name: '2026-10-05' })).getByRole('link', { name: 'Después de medianoche' })).toBeInTheDocument()
  })

  it('una interacción de un día de otro mes que la grilla muestra va en su celda, y la cancelada dice su motivo sin ratón', async () => {
    const septiembre = registro(
      's1',
      { project: 'p1', title: 'Cierre de septiembre', engagement_type: 'LLAMADA', held_at: '2026-09-30T16:00:00Z' },
      { state: 'held' }
    )
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([septiembre, E2]) }
    ])
    const calendario = await screen.findByRole('table', { name: 'Calendario de interacciones' })
    expect(within(within(calendario).getByRole('cell', { name: '2026-09-30' })).getByRole('link', { name: 'Cierre de septiembre' })).toBeInTheDocument()
    expect(within(calendario).getByRole('link', { name: 'Reunión con la junta' })).toHaveAccessibleDescription('Cancelada: Lluvias')
  })

  it('la vista Semana muestra los siete días del ?day= y no el resto del mes', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?view=semana&day=2026-10-15', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1, E2, E3]) }
    ])
    const calendario = await screen.findByRole('table', { name: 'Calendario de interacciones' })
    expect(within(calendario).getAllByRole('cell')).toHaveLength(7)
    expect(within(calendario).getByRole('cell', { name: '2026-10-12' })).toBeInTheDocument()
    expect(within(calendario).getByRole('link', { name: 'Reunión con la junta' })).toBeInTheDocument()
    expect(within(calendario).queryByText('Asamblea comunal')).not.toBeInTheDocument()
  })

  it('un ?month= mal escrito cae en el mes actual de Lima y lo muestra', async () => {
    // solo la fecha es falsa: los temporizadores de la red y de React siguen reales
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-03T12:00:00Z') })
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=octubre', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1]) }
    ])
    expect(await screen.findByRole('table', { name: 'Calendario de interacciones' })).toBeInTheDocument()
    expect(screen.getByText('noviembre de 2026')).toBeInTheDocument()
  })

  it('un ?view= desconocido cae en la vista de la ruta: la lista en /engagements y el mes en /engagements/calendar', async () => {
    fetch = abrirPortal('/projects/p1/engagements?view=nada', RELACIONISTA, EQUIPO, [...base(), { path: '/objects/engagement/records', body: pagina([E1]) }])
    expect(await screen.findByRole('table', { name: 'Relacionamiento' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Lista' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('table', { name: 'Calendario de interacciones' })).not.toBeInTheDocument()
  })

  it('un ?day= imposible no se usa: la semana se ancla en el primer día del mes pedido', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?view=semana&month=2000-01&day=2026-02-30', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1]) }
    ])
    const calendario = await screen.findByRole('table', { name: 'Calendario de interacciones' })
    expect(within(calendario).getAllByRole('cell')).toHaveLength(7)
    expect(within(calendario).getByRole('cell', { name: '1999-12-27' })).toBeInTheDocument()
    expect(within(calendario).getByRole('cell', { name: '2000-01-02' })).toBeInTheDocument()
  })

  // hallazgo U-18 (DD-03): Mes, Semana y Lista son el selector de vista de la barra de filtros, el mismo de toda lista, en lugar
  // de un conmutador propio; ?view= no cambia
  it('Mes, Semana y Lista van en el selector de vista de la barra y cambian ?view=', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1]) }
    ])
    await screen.findByRole('table', { name: 'Calendario de interacciones' })
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    const selector = within(screen.getByRole('group', { name: 'Filtros' })).getByRole('radiogroup', { name: 'Vista' })
    expect(within(selector).getByRole('radio', { name: 'Mes' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(selector).getByRole('radio', { name: 'Lista' }))
    expect(await screen.findByRole('table', { name: 'Relacionamiento' })).toBeInTheDocument()
    expect(rutaActual()).toBe('/projects/p1/engagements/calendar?month=2026-10&view=lista')
    expect(screen.getByRole('radio', { name: 'Lista' })).toHaveAttribute('aria-checked', 'true')
  })

  // hallazgo U-06 (DD-05): la tabla cabe a 1440 px por la prioridad de sus columnas; el título va en una línea
  it('la lista va por prioridad de columnas: el tipo desde xl, el lugar y los asistentes desde 1536 px, y lo igual en todas, a la nota', async () => {
    const otra = registro(
      'e5',
      { project: 'p1', title: 'Asamblea extraordinaria', engagement_type: 'ASAMBLEA', place: 'Local comunal', held_at: '2026-10-09T15:00:00Z' },
      { state: 'held' }
    )
    const conLugar = { ...E1, attributes: { ...E1.attributes, place: 'Local comunal' } }
    fetch = abrirPortal('/projects/p1/engagements?view=lista', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([conLugar, otra]) }
    ])
    const tabla = within(await screen.findByRole('table', { name: 'Relacionamiento' }))
    for (const c of ['Interacción', 'Estado', 'Fecha']) expect(tabla.getByRole('columnheader', { name: c })).not.toHaveClass('hidden')
    expect(tabla.getByRole('columnheader', { name: 'Asistentes' })).toHaveClass('hidden', 'min-[96rem]:table-cell')
    // el tipo y el lugar son los mismos en las dos filas: salen de la tabla y quedan en la nota
    expect(tabla.queryByRole('columnheader', { name: 'Tipo' })).not.toBeInTheDocument()
    const nota = screen.getByRole('list', { name: 'Igual en todas las filas' })
    expect(
      within(nota)
        .getAllByRole('listitem')
        .map((n) => n.textContent)
    ).toEqual(['Tipo: Asamblea', 'Lugar: Local comunal'])
    // el título toma el ancho que queda y va en una línea, con su texto completo al pasar
    expect(tabla.getByRole('columnheader', { name: 'Interacción' })).not.toHaveClass('w-full')
    expect(tabla.getAllByRole('cell')[0]).toHaveClass('w-full', 'max-w-0')
    const enlace = tabla.getByRole('link', { name: /^Asamblea extraordinaria/ })
    expect(enlace).toHaveClass('truncate')
    expect(enlace).toHaveAttribute('title', 'Asamblea extraordinaria')
  })

  it('si el tope de lectura corta la lista, lo dice, lee en orden descendente y no calla la truncación', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, base())
    red = espiarRed([
      {
        path: '/objects/engagement/records',
        responder: (llamada) => {
          const n = Number(new URLSearchParams(llamada.ruta.split('?')[1]).get('after') ?? 0)
          const content = Array.from({ length: 200 }, (_, i) =>
            registro(
              `m${n * 200 + i}`,
              {
                project: 'p1',
                title: `Visita ${n * 200 + i}`,
                engagement_type: 'VISITA',
                held_at: `2026-10-${String(2 + (i % 20)).padStart(2, '0')}T15:00:00Z`
              },
              { state: 'held' }
            )
          )
          return new Response(JSON.stringify({ ...pagina(content), nextCursor: String(n + 1) }), { headers: { 'Content-Type': 'application/json' } })
        }
      }
    ])
    const aviso = await screen.findByText(/Se leyeron solo 1.*000 interacciones de estas fechas: pueden faltar otras/)
    expect(aviso).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Calendario de interacciones' })).toBeInTheDocument()
    // el calendario pide solo los días que dibuja, por la fecha realizada o, si no, la programada (D10 de la revisión de UX)
    const lecturas = red.a('GET', '/objects/engagement/records').filter((l) => l.ruta.includes('range_field='))
    expect(lecturas).toHaveLength(5)
    expect(lecturas.every((l) => l.ruta.includes('range_field=held_at%2Cscheduled_at&range_from=2026-09-28'))).toBe(true)
  })

  it('la lista se pagina en el servidor: el total del encabezado es el del conteo y la segunda página se pide con page=1', async () => {
    const muchas = Array.from({ length: 30 }, (_, i) =>
      registro(
        `l${i}`,
        { project: 'p1', title: `Visita ${i}`, engagement_type: 'VISITA', scheduled_at: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T15:00:00Z` },
        { state: 'planned' }
      )
    )
    fetch = abrirPortal('/projects/p1/engagements?view=lista', RELACIONISTA, EQUIPO, base())
    red = espiarRed([listaDelServidor('engagement', muchas)])
    const tabla = await screen.findByRole('table', { name: 'Relacionamiento' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(26)
    expect(await screen.findByText('30 interacciones')).toBeInTheDocument()
    screen.getByRole('button', { name: /siguiente|next/i }).click()
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Relacionamiento' })).getAllByRole('row')).toHaveLength(6))
    expect(red.a('GET', '/objects/engagement/records').map((l) => l.ruta)).toContainEqual(expect.stringContaining('dir=desc&page=1&size=25'))
  })

  // 05-especificacion §1.6: el título y la fecha se ordenan en el servidor; el orden dura la visita y vuelve a la primera página
  it('el título y la fecha ordenan la lista en el servidor, con aria-sort, y otro orden vuelve a la primera página', async () => {
    const muchas = Array.from({ length: 30 }, (_, i) =>
      registro(
        `l${i}`,
        {
          project: 'p1',
          title: `Visita ${String(i).padStart(2, '0')}`,
          engagement_type: 'VISITA',
          scheduled_at: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T15:00:00Z`
        },
        { state: 'planned' }
      )
    )
    fetch = abrirPortal('/projects/p1/engagements?view=lista&page=1', RELACIONISTA, EQUIPO, base())
    red = espiarRed([listaDelServidor('engagement', muchas)])
    const tabla = () => screen.getByRole('table', { name: 'Relacionamiento' })
    await screen.findByRole('table', { name: 'Relacionamiento' })
    expect(within(tabla()).getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute('aria-sort', 'descending')
    expect(within(tabla()).getByRole('columnheader', { name: 'Interacción' })).not.toHaveAttribute('aria-sort')
    // el tipo y el estado no se ordenan: su código no dice su orden
    expect(within(tabla()).queryByRole('button', { name: 'Estado' })).not.toBeInTheDocument()
    const consultas = () => red!.a('GET', '/objects/engagement/records').map((l) => Object.fromEntries(new URLSearchParams(l.ruta.split('?')[1])))
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Fecha' }))
    await waitFor(() => expect(consultas()).toContainEqual(expect.objectContaining({ sort: 'scheduled_at', dir: 'asc', page: '0' })))
    expect(rutaActual()).toBe('/projects/p1/engagements?view=lista')
    expect(within(tabla()).getByRole('columnheader', { name: 'Fecha' })).toHaveAttribute('aria-sort', 'ascending')
    await userEvent.click(within(tabla()).getByRole('button', { name: 'Interacción' }))
    await waitFor(() => expect(consultas()).toContainEqual(expect.objectContaining({ sort: 'title', dir: 'asc', page: '0' })))
    await waitFor(() => expect(within(tabla()).getByRole('columnheader', { name: 'Interacción' })).toHaveAttribute('aria-sort', 'ascending'))
    // por el título, la página queda como la manda el servidor
    await waitFor(() => expect(within(tabla()).getAllByRole('row')[1]).toHaveTextContent('Visita 00'))
    expect(within(tabla()).getAllByRole('row')[2]).toHaveTextContent('Visita 01')
  })

  it('con todas las interacciones leídas no hay aviso de truncamiento', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1]) }
    ])
    await screen.findByRole('table', { name: 'Calendario de interacciones' })
    expect(screen.queryByText(/Se leyeron solo/)).not.toBeInTheDocument()
  })

  it('las interacciones sin fecha se avisan en el calendario y salen con guion en la lista', async () => {
    const sinFecha = registro('n1', { project: 'p1', title: 'Sin fecha aún', engagement_type: 'REUNION' }, { state: 'planned' })
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, base())
    red = espiarRed([listaDelServidor('engagement', [E1, sinFecha])])
    expect(await screen.findByText('Interacciones sin fecha, que no aparecen en el calendario: 1.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Lista' }))
    const tabla = await screen.findByRole('table', { name: 'Relacionamiento' })
    expect(within(within(tabla).getByRole('link', { name: 'Sin fecha aún' }).closest('tr') as HTMLElement).getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Interacciones sin fecha/)).not.toBeInTheDocument()
  })

  it('el calendario dice que las festividades cargan o no se pudieron leer, en lugar de callarlas', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      { path: '/objects/festivity/records', status: 403, body: { title: 'Forbidden', status: 403 } },
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1]) }
    ])
    const calendario = await screen.findByRole('table', { name: 'Calendario de interacciones' })
    expect(await screen.findByText('No se pudieron leer las festividades: el calendario no las marca.')).toBeInTheDocument()
    expect(within(calendario).queryByText('Fiesta patronal')).not.toBeInTheDocument()
  })

  it('mientras llegan las festividades el calendario lo dice', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1]) }
    ])
    // la respuesta espera a que la prueba la suelte, no un plazo de reloj (revisión final, M13)
    const { espera, suelta } = compuerta()
    red = espiarRed([
      {
        path: '/objects/festivity/records',
        responder: async () => {
          await espera
          return new Response(JSON.stringify(pagina([])), { headers: { 'Content-Type': 'application/json' } })
        }
      }
    ])
    expect((await screen.findAllByText('Cargando las festividades…')).length).toBeGreaterThan(0)
    suelta()
    await waitFor(() => expect(screen.queryByText('Cargando las festividades…')).not.toBeInTheDocument())
  })

  it('la grilla y el panel comparten la consulta de festividades: el mes visible se lee una vez', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1]) }
    ])
    red = espiarRed()
    await screen.findByRole('table', { name: 'Calendario de interacciones' })
    await within(screen.getByRole('region', { name: 'Festividades del mes' })).findByText(/Fiesta patronal/)
    const meses = red.a('GET', '/objects/festivity/records').map((l) => new URLSearchParams(l.ruta.split('?')[1]).get('month'))
    // la grilla de octubre de 2026 muestra días de septiembre, octubre y noviembre; cada mes se pide una sola vez
    expect([...meses].sort()).toEqual(['10', '11', '9'])
  })

  it('una semana que cruza de mes lleva la franja de festividades de los dos meses', async () => {
    const noviembre = registro('f3', { name: 'Día de todos', month: 11, start_day: 1, locality: 'l1' })
    fetch = abrirPortal('/projects/p1/engagements/calendar?view=semana&day=2026-10-30', RELACIONISTA, EQUIPO, [
      { path: '/objects/festivity/records', body: pagina([noviembre]) },
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1]) }
    ])
    const calendario = await screen.findByRole('table', { name: 'Calendario de interacciones' })
    expect(await within(within(calendario).getByRole('cell', { name: '2026-11-01' })).findByText('Día de todos')).toBeInTheDocument()
    expect(within(within(calendario).getByRole('cell', { name: '2026-10-31' })).queryByText('Día de todos')).not.toBeInTheDocument()
  })

  it('una cancelada sin motivo dice «Cancelada», y con motivo se ve en la lista y al enfocar el enlace del calendario', async () => {
    const sinMotivo = registro(
      'e4',
      { project: 'p1', title: 'Visita suspendida', engagement_type: 'VISITA', scheduled_at: '2026-10-20T15:00:00Z' },
      { state: 'cancelled' }
    )
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E2, sinMotivo]) }
    ])
    const calendario = await screen.findByRole('table', { name: 'Calendario de interacciones' })
    expect(within(calendario).getByRole('link', { name: 'Visita suspendida' })).toHaveAccessibleDescription('Cancelada')
    expect(within(calendario).getByText('Cancelada: Lluvias').className).toContain('group-focus-within:not-sr-only')
    await userEvent.click(screen.getByRole('radio', { name: 'Lista' }))
    const tabla = await screen.findByRole('table', { name: 'Relacionamiento' })
    expect(within(tabla).getByText('Cancelada: Lluvias').className).not.toContain('sr-only')
  })

  it('mientras llegan las interacciones dice Cargando y no dibuja un calendario vacío', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, base())
    const { espera, suelta } = compuerta()
    red = espiarRed([
      {
        path: '/objects/engagement/records',
        responder: async () => {
          await espera
          return new Response(JSON.stringify(pagina([E1])), { headers: { 'Content-Type': 'application/json' } })
        }
      }
    ])
    expect((await screen.findAllByRole('status')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('table', { name: 'Calendario de interacciones' })).not.toBeInTheDocument()
    suelta()
    expect(await screen.findByRole('table', { name: 'Calendario de interacciones' })).toBeInTheDocument()
  })

  it('un 403 de la lista de interacciones dice No disponible y no un calendario vacío ni un error de carga', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', status: 403, body: { title: 'Forbidden', status: 403 } }
    ])
    expect((await screen.findAllByText('No disponible')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('table', { name: 'Calendario de interacciones' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('otro error al leer las interacciones se dice con su texto y ofrece reintentar, no una lista vacía', async () => {
    fetch = abrirPortal('/projects/p1/engagements', RELACIONISTA, EQUIPO, base())
    red = espiarRed([{ path: '/objects/engagement/records', responder: () => problema(400, 'Consulta inválida') }])
    expect(await screen.findByText('Consulta inválida')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Reintentar' })).toHaveLength(1)
    expect(screen.queryByRole('table', { name: 'Relacionamiento' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Una interacción nace/)).not.toBeInTheDocument()
  })

  it('sin permiso para la meta o las festividades, el panel dice No disponible y no un cero ni una lista vacía', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      { path: '/sgspe/dashboards/indicators/KPI-ENG-02', status: 403, body: { title: 'Forbidden', status: 403 } },
      { path: '/objects/festivity/records', status: 403, body: { title: 'Forbidden', status: 403 } },
      { path: '/objects/engagement/records', body: pagina([E1]) },
      ...base()
    ])
    const lateral = await screen.findByRole('complementary')
    expect(await within(within(lateral).getByRole('region', { name: 'Reuniones del mes' })).findByText('No disponible')).toBeInTheDocument()
    expect(await within(within(lateral).getByRole('region', { name: 'Festividades del mes' })).findByText('No disponible')).toBeInTheDocument()
    expect(within(lateral).queryByText(/de 2/)).not.toBeInTheDocument()
  })

  it('un indicador no disponible dice por qué en lugar de la cifra', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, [
      {
        path: '/sgspe/dashboards/indicators/KPI-ENG-02',
        body: { code: 'KPI-ENG-02', label: 'x', available: false, unavailableReason: 'OBJECT_NOT_READABLE' }
      },
      { path: '/objects/engagement/records', body: pagina([E1]) },
      ...base()
    ])
    const meta = await screen.findByRole('region', { name: 'Reuniones del mes' })
    expect(await within(meta).findByText('No disponible')).toBeInTheDocument()
    expect(meta).toHaveTextContent('Su rol no puede leer los registros de esta cifra')
  })

  it('un proyecto ilegible en la lista global dice «No disponible» sin botón por fila y no ensucia el nombre de la columna', async () => {
    fetch = abrirPortal('/engagements', RELACIONISTA, EQUIPO, [...base(), { path: '/objects/engagement/records', body: pagina([E1, E2]) }])
    red = espiarRed([{ path: '/objects/project/records/p1', responder: () => problema(403, 'Sin acceso') }])
    const tabla = await screen.findByRole('table', { name: 'Relacionamiento' })
    const celdas = await within(tabla).findAllByText('No disponible')
    expect(celdas).toHaveLength(2)
    expect(within(tabla).queryByRole('button', { name: 'Por qué no se muestra' })).not.toBeInTheDocument()
    for (const celda of celdas) expect(celda).toHaveAccessibleDescription('Su cuenta no puede leer estos datos')
    // el motivo lo lleva el encabezado, pero su nombre sigue siendo el de la columna
    expect(within(tabla).getByRole('columnheader', { name: 'Proyecto' })).toBeInTheDocument()
  })

  // revisión de UX, etapa 3: el encabezado común con el total y crear desde lo global sin pasar por el selector
  it('el encabezado dice cuántas hay y ofrece registrar también en lo global; el proyecto es «código · nombre»', async () => {
    fetch = abrirPortal('/engagements', RELACIONISTA, EQUIPO, [...base(), { path: '/objects/engagement/records', body: pagina([E3, E1, E2]) }])
    const tabla = await screen.findByRole('table', { name: 'Relacionamiento' })
    expect(screen.getByText('3 interacciones')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar interacción' })).toBeInTheDocument()
    expect((await within(tabla).findAllByRole('link', { name: /^PRJ-01 · / }))[0]).toHaveAttribute('href', '/projects/p1/overview')
  })

  it('la lista global suma la columna Proyecto con su código y ordena de la más reciente a la más antigua', async () => {
    fetch = abrirPortal('/engagements', RELACIONISTA, EQUIPO, [...base(), { path: '/objects/engagement/records', body: pagina([E3, E1, E2]) }])
    const tabla = await screen.findByRole('table', { name: 'Relacionamiento' })
    expect(within(tabla).getByRole('columnheader', { name: 'Proyecto' })).toBeInTheDocument()
    expect(await within(tabla).findAllByText('PRJ-01')).toHaveLength(3)
    const filas = within(tabla).getAllByRole('row').slice(1)
    expect(filas.map((f) => within(f).getAllByRole('link')[0].textContent)).toEqual([
      'Llamada al teniente',
      'Reunión con la junta',
      expect.stringContaining('Asamblea comunal')
    ])
  })
})

// P38: solo ADMIN escribe sin asignación (revisión final, I3)
describe('S21 · escritura sin asignación', () => {
  it('ADMIN sin asignación registra interacciones y visitas', async () => {
    fetch = abrirPortal('/projects/p1/engagements', ADMINISTRACION, { admin: true, objects: EQUIPO.objects }, [
      { path: /^\/objects\/project_assignment\/records\?.*member_user_id/, body: pagina([]) },
      ...base(ADMINISTRACION),
      { path: '/objects/engagement/records', body: pagina([]) }
    ])
    expect(await screen.findByRole('link', { name: 'Registrar interacción' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nueva visita de campo' })).toBeInTheDocument()
  })
})
