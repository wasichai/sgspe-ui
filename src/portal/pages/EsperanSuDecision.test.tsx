import { screen, waitFor, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { EsperanSuDecision } from './EsperanSuDecision'

// P-01 «Esperan su decisión» (rediseño de UX, DD-01): las aprobaciones que le llegaron (avisos de aprobación, como S48), las
// alertas por triar a quien puede confirmarlas y los demás avisos que piden acción, cada grupo con lo más urgente y su motivo
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const aviso = (id: string, fuente: string, objeto: string, recordId: string, titulo: string, extra: Record<string, unknown> = {}) => ({
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
  read: false,
  snoozedUntil: null,
  dismissible: false,
  ...extra
})
const bandeja = (content: unknown[]) => ({ content, page: 0, size: 200, totalElements: content.length, totalPages: 1 })
const AVISOS = bandeja([
  aviso('n1', 'sgspe.approvals', 'social_contribution', 'ap1', 'Aprobar el aporte de apoyo en especie', { body: 'Campaña de perforación' }),
  aviso('n2', 'sgspe.deadlines', 'grievance', 'g1', 'La queja vence hoy'),
  aviso('n3', 'sgspe.deadlines', 'grievance', 'g2', 'Ya leído', { read: true }),
  aviso('n4', 'sgspe.deadlines', 'grievance', 'g3', 'Solo informa', { kind: 'WARNING' })
])
const ALERTAS = pagina([
  registro('w1', { title: 'Convocatoria a bloqueo de la trocha', project: 'p1', severity: 'ALTA', detected_at: '2026-10-20T09:49:00Z' }, { state: 'detected' }),
  registro('w2', { title: 'Reclamo por polvo', project: 'p1', severity: 'MEDIA', detected_at: '2026-10-19T09:00:00Z' }, { state: 'in_triage' })
])
const region = () => screen.getByRole('region', { name: 'Esperan su decisión' })
const grupo = (nombre: RegExp) => within(region()).getByRole('region', { name: nombre })
const enlaces = (nombre: RegExp) =>
  within(grupo(nombre))
    .getAllByRole('link')
    .map((a) => `${a.textContent} → ${a.getAttribute('href')}`)

describe('Esperan su decisión', () => {
  it('aprobaciones, alertas por triar y avisos que piden acción, con su motivo y enlace', async () => {
    fetch = mockFetch([
      { path: /^\/auth\/me\/notifications\?/, body: AVISOS },
      { path: /^\/objects\/early_warning\/records\?.*state=detected%2Cin_triage/, body: ALERTAS }
    ])
    montar(<EsperanSuDecision />, { usuario: RELACIONISTA, permisos: permisos({ early_warning: ['READ', 'CONFIRM_ALERT'] }) })
    await screen.findByRole('region', { name: 'Esperan su decisión' })
    await waitFor(() => expect(grupo(/^Alertas por triar/)).toBeInTheDocument())
    expect(
      within(region())
        .getAllByRole('region')
        .map((r) => within(r).getByRole('heading').textContent)
    ).toEqual(['Aprobaciones1', 'Alertas por triar2', 'Avisos que piden acción1'])
    expect(enlaces(/^Aprobaciones/)).toEqual(['Aprobar el aporte de apoyo en especie → /r/social_contribution/ap1'])
    expect(within(grupo(/^Aprobaciones/)).getByText('Campaña de perforación')).toBeInTheDocument()
    expect(enlaces(/^Alertas por triar/)).toEqual([
      'Convocatoria a bloqueo de la trocha → /projects/p1/risks/warnings/w1',
      'Reclamo por polvo → /projects/p1/risks/warnings/w2'
    ])
    expect(within(grupo(/^Alertas por triar/)).getByText('Severidad: Alta')).toBeInTheDocument()
    expect(enlaces(/^Avisos que piden acción/)).toEqual(['La queja vence hoy → /r/grievance/g1'])
    expect(within(region()).queryByText('Ya leído')).not.toBeInTheDocument()
    expect(within(region()).queryByText('Solo informa')).not.toBeInTheDocument()
  })

  it('sin la acción de confirmar alertas no pide las alertas por triar', async () => {
    fetch = mockFetch([{ path: /^\/auth\/me\/notifications\?/, body: AVISOS }])
    montar(<EsperanSuDecision />, { usuario: RELACIONISTA, permisos: permisos({ early_warning: ['READ'] }) })
    await screen.findByRole('region', { name: /^Aprobaciones/ })
    expect(screen.queryByRole('region', { name: /^Alertas por triar/ })).not.toBeInTheDocument()
    expect(fetch.calls.some((c) => c.path.startsWith('/objects/early_warning'))).toBe(false)
  })

  it('sin nada que decidir, o sin la bandeja de avisos, el bloque no se dibuja', async () => {
    fetch = mockFetch([{ path: /^\/auth\/me\/notifications\?/, status: 404, body: { title: 'Not Found', status: 404 } }])
    const { container } = montar(<EsperanSuDecision />, { usuario: RELACIONISTA, permisos: permisos({}) })
    await waitFor(() => expect(fetch?.calls.some((c) => c.path.startsWith('/auth/me/notifications'))).toBe(true))
    expect(container).toBeEmptyDOMElement()
  })
})
