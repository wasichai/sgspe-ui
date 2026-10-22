import { screen, waitFor, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { Agenda } from './Agenda'

// P-01 «Agenda de la semana» (rediseño de UX, DD-01): las visitas de campo que la persona lidera y las interacciones programadas
// en sus proyectos con asignación vigente, de hoy a siete días, en el orden en que ocurren
let fetch: FetchMock | null = null
beforeEach(() => {
  // solo el reloj: las promesas y los temporizadores de TanStack Query siguen siendo los de verdad
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-20T13:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  fetch?.restore()
  fetch = null
})

const asignacion = (id: string, proyecto: string, extra: Record<string, unknown> = {}) =>
  registro(id, { project: proyecto, member_user_id: RELACIONISTA.id, active: true, start_date: '2026-01-01', ...extra })
const parametros = (objeto: string) => {
  const llamada = fetch?.calls.find((c) => c.path.startsWith(`/objects/${objeto}/records`))
  return new URLSearchParams(llamada?.path.split('?')[1])
}

describe('Agenda de la semana', () => {
  it('sus visitas y las interacciones de sus proyectos de los próximos siete días, por fecha', async () => {
    fetch = mockFetch([
      { path: /^\/objects\/project_assignment\/records/, body: pagina([asignacion('a1', 'p1'), asignacion('a2', 'p2', { active: false })]) },
      {
        path: /^\/objects\/field_visit\/records/,
        body: pagina([registro('v1', { title: 'Visita al canal principal', project: 'p1', planned_start_date: '2026-10-23' }, { state: 'planned' })])
      },
      {
        path: /^\/objects\/engagement\/records/,
        body: pagina([
          registro(
            'e1',
            { title: 'Asamblea comunal de Llamapampa', project: 'p1', scheduled_at: '2026-10-21T15:00:00Z', place: 'Local comunal' },
            { state: 'scheduled' }
          )
        ])
      }
    ])
    montar(<Agenda />, { usuario: RELACIONISTA, permisos: permisos({ field_visit: ['READ'], engagement: ['READ'] }) })
    const region = await screen.findByRole('region', { name: 'Agenda de la semana' })
    await waitFor(() => expect(within(region).getAllByRole('listitem')).toHaveLength(2))
    expect(
      within(region)
        .getAllByRole('link')
        .map((a) => `${a.textContent} → ${a.getAttribute('href')}`)
    ).toEqual(['Asamblea comunal de Llamapampa → /projects/p1/engagements/e1', 'Visita al canal principal → /projects/p1/field-visits/v1'])
    expect(within(region).getByText('Interacción · 10:00 · Local comunal')).toBeInTheDocument()
    expect(within(region).getByText('Visita de campo')).toBeInTheDocument()
    // la visita es la que lidera; la interacción, de sus proyectos vigentes; las dos de hoy a siete días
    const visitas = parametros('field_visit')
    expect(visitas.get('leader_user_id')).toBe('u-relacionista')
    expect([visitas.get('range_field'), visitas.get('range_from'), visitas.get('range_to')]).toEqual(['planned_start_date', '2026-10-20', '2026-10-27'])
    const interacciones = parametros('engagement')
    expect(interacciones.getAll('project')).toEqual(['p1'])
    expect([interacciones.get('range_field'), interacciones.get('range_from'), interacciones.get('range_to')]).toEqual([
      'scheduled_at',
      '2026-10-20',
      '2026-10-27'
    ])
  })

  it('sin lectura de visitas ni de interacciones no pide nada ni se dibuja', async () => {
    fetch = mockFetch([{ path: /^\/objects\/project_assignment\/records/, body: pagina([asignacion('a1', 'p1')]) }])
    const { container } = montar(<Agenda />, { usuario: RELACIONISTA, permisos: permisos({}) })
    await waitFor(() => expect(fetch?.calls.some((c) => c.path.startsWith('/objects/project_assignment'))).toBe(true))
    expect(fetch.calls.some((c) => /^\/objects\/(field_visit|engagement)\//.test(c.path))).toBe(false)
    expect(container).toBeEmptyDOMElement()
  })

  it('sin nada en la semana, no se dibuja', async () => {
    fetch = mockFetch([
      { path: /^\/objects\/project_assignment\/records/, body: pagina([]) },
      { path: /^\/objects\/field_visit\/records/, body: pagina([]) }
    ])
    const { container } = montar(<Agenda />, { usuario: RELACIONISTA, permisos: permisos({ field_visit: ['READ'], engagement: ['READ'] }) })
    await waitFor(() => expect(fetch?.calls.some((c) => c.path.startsWith('/objects/field_visit'))).toBe(true))
    // sin proyectos vigentes no se piden interacciones
    expect(fetch.calls.some((c) => c.path.startsWith('/objects/engagement'))).toBe(false)
    expect(container).toBeEmptyDOMElement()
  })
})
