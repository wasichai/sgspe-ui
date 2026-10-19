import { screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { AtencionRequerida } from './AtencionRequerida'

// S02 «Mi día» (revisión de UX, etapa 2): lo primero que se ve es lo vencido y lo por vencer a su cargo, lo que espera su
// decisión y los avisos que piden acción, cada uno con enlace a su registro, en ese orden
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const aviso = (id: string, fuente: string, objeto: string, recordId: string, titulo: string, read = false) => ({
  id,
  kind: 'ACTION',
  title: titulo,
  body: null,
  link: { type: 'RECORD', object: objeto, recordId },
  publishAt: '2026-10-18T15:00:00Z',
  expiresAt: null,
  dueAt: null,
  overdue: false,
  source: fuente,
  read,
  snoozedUntil: null,
  dismissible: false
})
const AVISOS = {
  content: [
    aviso('n1', 'sgspe.approvals', 'commitment', 'c9', 'Aprobar C-009 Reservorio'),
    aviso('n2', 'sgspe.deadlines', 'grievance', 'g1', 'La queja Q-001 vence hoy'),
    aviso('n3', 'sgspe.deadlines', 'grievance', 'g2', 'Ya leído', true)
  ],
  page: 0,
  size: 200,
  totalElements: 3,
  totalPages: 1
}
const LEE = permisos({ task: ['READ'], commitment: ['READ'] })

function rutas(tareas: unknown[], compromisos: unknown[], avisos: unknown = AVISOS) {
  return [
    { path: /^\/objects\/task\/records\?.*assignee_user_id=u-relacionista/, body: pagina(tareas) },
    { path: /^\/objects\/commitment\/records\?.*owner_user_id=u-relacionista/, body: pagina(compromisos) },
    { path: /^\/auth\/me\/notifications\?/, body: avisos }
  ]
}
const grupo = (nombre: string | RegExp) => within(screen.getByRole('region', { name: 'Atención requerida' })).getByRole('group', { name: nombre })
const enlaces = (nombre: string | RegExp) =>
  within(grupo(nombre))
    .getAllByRole('link')
    .map((a) => `${a.textContent} → ${a.getAttribute('href')}`)

describe('Atención requerida', () => {
  it('vencidos, por vencer, decisiones y avisos que piden acción, en ese orden y con enlace', async () => {
    fetch = mockFetch(
      rutas(
        [
          registro('t1', { title: 'Redactar el acta', project: 'p1', deadline_status: 'POR VENCER' }, { state: 'open' }),
          registro('t2', { title: 'Visitar Tunas Pampa', project: 'p1', deadline_status: 'VENCIDO' }, { state: 'in_progress' }),
          registro('t3', { title: 'Al día', project: 'p1', deadline_status: 'AL DIA' }, { state: 'open' })
        ],
        [registro('c1', { code: 'C-001', title: 'Mejora del canal', project: 'p1', deadline_status: 'VENCIDO' }, { state: 'in_progress' })]
      )
    )
    montar(<AtencionRequerida />, { usuario: RELACIONISTA, permisos: LEE })
    const region = await screen.findByRole('region', { name: 'Atención requerida' })
    await within(region).findByRole('group', { name: '2 vencidos a su cargo' })
    expect(
      within(region)
        .getAllByRole('group')
        .map((g) => g.getAttribute('aria-labelledby') && within(g).getByRole('heading').textContent)
    ).toEqual(['2 vencidos a su cargo', '1 por vencer a su cargo', '1 espera su decisión', '1 aviso que pide acción'])
    expect(enlaces('2 vencidos a su cargo')).toEqual([
      'Tarea · Visitar Tunas Pampa → /projects/p1/tasks?task=t2',
      'Compromiso · C-001 · Mejora del canal → /projects/p1/commitments/c1'
    ])
    expect(enlaces('1 por vencer a su cargo')).toEqual(['Tarea · Redactar el acta → /projects/p1/tasks?task=t1'])
    expect(enlaces('1 espera su decisión')).toEqual(['Aprobar C-009 Reservorio → /tasks/approvals/commitment/c9'])
    expect(enlaces('1 aviso que pide acción')).toEqual(['La queja Q-001 vence hoy → /r/grievance/g1'])
    expect(within(region).queryByText('Al día', { exact: false })).not.toBeInTheDocument()
  })

  it('sin nada, lo dice en una línea', async () => {
    fetch = mockFetch(rutas([], [], { content: [], page: 0, size: 200, totalElements: 0, totalPages: 0 }))
    montar(<AtencionRequerida />, { usuario: RELACIONISTA, permisos: LEE })
    expect(await screen.findByText('Nada vencido ni por vencer a su cargo, y nada espera su decisión.')).toBeInTheDocument()
  })

  it('sin la bandeja de avisos (404), sigue con lo que tiene a su cargo', async () => {
    fetch = mockFetch(
      rutas([registro('t2', { title: 'Visitar Tunas Pampa', project: 'p1', deadline_status: 'VENCIDO' }, { state: 'open' })], [], undefined).map((r) =>
        String(r.path).includes('notifications') ? { ...r, status: 404, body: { title: 'Not Found', status: 404 } } : r
      )
    )
    montar(<AtencionRequerida />, { usuario: RELACIONISTA, permisos: LEE })
    expect(await screen.findByRole('group', { name: '1 vencido a su cargo' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /decisión/ })).not.toBeInTheDocument()
  })
})
