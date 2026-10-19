import { screen, within } from '@testing-library/react'
import type { FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pagina, registro } from '../../test/montar'
import { abrirPortal } from '../../test/pantalla'
import { permisos, RELACIONISTA } from '../../test/portal'

// el inicio de quien no ve la revisión ejecutiva (ASM-078 sin nombres de rol): lo que tiene a su cargo, por permisos
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('su trabajo', () => {
  it('dice sus tareas abiertas y sus compromisos a cargo, los vencidos primero, con enlace a su ficha', async () => {
    fetch = abrirPortal('/', RELACIONISTA, permisos({ task: ['READ'], commitment: ['READ'] }), [
      {
        path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/,
        body: pagina([
          registro('t1', { title: 'Redactar el acta', project: 'p1', due_date: '2026-10-30', deadline_status: 'AL DIA' }, { state: 'open' }),
          registro('t2', { title: 'Tarea hecha', project: 'p1' }, { state: 'done' })
        ])
      },
      {
        path: /^\/objects\/commitment\/records\?.*owner_user_id=u-relacionista/,
        body: pagina([
          registro('c1', { code: 'C-001', title: 'Mejora del canal', project: 'p1', deadline_status: 'AL DIA' }, { state: 'in_progress' }),
          registro('c2', { code: 'C-002', title: 'Taller', project: 'p1', deadline_status: 'VENCIDO' }, { state: 'approved' }),
          registro('c3', { code: 'C-003', title: 'Cerrado', project: 'p1' }, { state: 'closed' })
        ])
      }
    ])
    const trabajo = await screen.findByRole('region', { name: 'Su trabajo' })
    const tareas = await within(trabajo).findByRole('group', { name: '1 tarea abierta' })
    expect(within(tareas).getByRole('link', { name: /Redactar el acta/ })).toHaveAttribute('href', '/projects/p1/tasks?task=t1')
    const compromisos = await within(trabajo).findByRole('group', { name: '2 compromisos a su cargo' })
    expect(
      within(compromisos)
        .getAllByRole('link')
        .map((a) => a.textContent)
    ).toEqual([expect.stringContaining('C-002'), expect.stringContaining('C-001')])
    // no pide lo que la cuenta no lee
    expect(within(trabajo).queryByRole('group', { name: /QCS/ })).not.toBeInTheDocument()
  })

  it('sin nada a su cargo, lo dice', async () => {
    fetch = abrirPortal('/', RELACIONISTA, permisos({ task: ['READ'] }), [{ path: /^\/objects\/task\/records\?/, body: pagina([]) }])
    const trabajo = await screen.findByRole('region', { name: 'Su trabajo' })
    expect(await within(trabajo).findByText('Nada pendiente a su cargo.')).toBeInTheDocument()
  })
})
