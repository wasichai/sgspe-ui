import { screen, within } from '@testing-library/react'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { E1, E2, E3, EQUIPO, base } from '../../test/relacionamiento'
import { registro } from '../../test/montar'

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
    expect(within(toca).getByRole('link', { name: 'Asamblea comunal: acta por redactar' })).toHaveAttribute('href', '/projects/p1/engagements/e1/minutes')
    expect(within(toca).getByRole('link', { name: 'Llamada al teniente: postergada' })).toBeInTheDocument()
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

  it('un ?month= mal escrito no rompe la pantalla: cae en el mes actual', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=octubre', RELACIONISTA, EQUIPO, [
      ...base(),
      { path: '/objects/engagement/records', body: pagina([E1]) }
    ])
    expect(await screen.findByRole('table', { name: 'Calendario de interacciones' })).toBeInTheDocument()
  })

  it('mientras llegan las interacciones dice Cargando y no dibuja un calendario vacío', async () => {
    fetch = abrirPortal('/projects/p1/engagements/calendar?month=2026-10', RELACIONISTA, EQUIPO, base())
    red = espiarRed([
      {
        path: '/objects/engagement/records',
        responder: async () => {
          await new Promise((resolver) => setTimeout(resolver, 300))
          return new Response(JSON.stringify(pagina([E1])), { headers: { 'Content-Type': 'application/json' } })
        }
      }
    ])
    expect((await screen.findAllByRole('status')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('table', { name: 'Calendario de interacciones' })).not.toBeInTheDocument()
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
