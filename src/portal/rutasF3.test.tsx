import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock, MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APROBADORA, baseDeCompromisos, C1, EQUIPO_DE_COMPROMISOS, GESTORA, P1 } from '../test/compromisos'
import { definicion, pagina, registro } from '../test/montar'
import { abrirPortal, rutaActual } from '../test/pantalla'
import { permisos } from '../test/portal'

vi.mock('./graficos/Grafico', () => import('../test/graficoFalso'))

// las rutas de F3 en el portal entero (ux-architecture.md §6.2): las secciones Compromisos, Documentos y Tareas con su guarda,
// las pestañas del proyecto, los avisos y el salto /r/… a la ficha de un registro
let fetch: FetchMock | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const rutas = (usuario = GESTORA): MockRoute[] => [
  ...baseDeCompromisos(usuario),
  { path: '/objects/project/records', body: pagina([P1]) },
  { path: '/objects/commitment/records/c1', body: C1 },
  { path: '/objects/commitment/records', body: pagina([C1]) },
  { path: '/objects/evidence/records', body: pagina([]) },
  { path: '/objects/task/records', body: pagina([]) },
  { path: '/objects/agreement/records', body: pagina([registro('ag1', { project: 'p1', code: 'A-001', title: 'Convenio de agua' }, { state: 'active' })]) },
  { path: '/sgspe/dashboards/indicators', body: [{ code: 'KPI-COM-01', label: 'x', dashboard: 'commitments', available: true }] },
  {
    path: '/auth/me/notifications/summary',
    body: {
      kinds: { ACTION: { active: 1, unread: 1, overdue: 0 }, WARNING: { active: 0, unread: 0, overdue: 0 }, INFO: { active: 0, unread: 0, overdue: 0 } },
      latest: null
    }
  },
  { path: '/auth/me/notifications', body: { content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 } },
  { path: '/auth/me/notification-preferences', body: { email: ['ACTION'] } }
]

describe('rutas de F3', () => {
  it('la sección Compromisos del proyecto se abre con las pestañas de F3 en Project 360', async () => {
    fetch = abrirPortal('/projects/p1/commitments', GESTORA, EQUIPO_DE_COMPROMISOS, rutas())
    expect(await screen.findByRole('heading', { name: 'Compromisos', level: 1 })).toBeInTheDocument()
    const pestanas = screen.getByRole('navigation', { name: 'Secciones del proyecto' })
    for (const nombre of ['Compromisos', 'Acuerdos', 'Documentos', 'Tareas']) expect(within(pestanas).getByRole('link', { name: nombre })).toBeInTheDocument()
    expect(within(pestanas).getByRole('link', { name: 'Acuerdos' })).toHaveAttribute('href', '/projects/p1/agreements')
    const secciones = screen.getByRole('navigation', { name: 'Secciones' })
    for (const nombre of ['Compromisos', 'Documentos', 'Tareas']) expect(within(secciones).getByRole('link', { name: nombre })).toBeInTheDocument()
  })

  it('los acuerdos de todos los proyectos viven en /agreements, con la guarda de Compromisos', async () => {
    fetch = abrirPortal('/agreements', GESTORA, EQUIPO_DE_COMPROMISOS, rutas())
    expect(await screen.findByRole('link', { name: 'Convenio de agua' })).toHaveAttribute('href', '/projects/p1/agreements/ag1')
  })

  it('sin READ sobre compromisos, la ruta lo dice y la sección no se ofrece', async () => {
    fetch = abrirPortal('/projects/p1/commitments', GESTORA, permisos({ project: ['READ'], project_assignment: ['READ'] }), rutas())
    expect(await screen.findByText('Su cuenta no puede abrir «Compromisos».')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).queryByRole('link', { name: 'Compromisos' })).not.toBeInTheDocument()
  })

  // los acuerdos viven bajo Compromisos, pero se leen con su propio permiso: la pestaña y las dos rutas piden READ sobre
  // agreement, no sobre commitment
  const sinAcuerdos = permisos({ project: ['READ'], project_assignment: ['READ'], commitment: ['READ'] })
  const soloAcuerdos = permisos({ project: ['READ'], project_assignment: ['READ'], agreement: ['READ'] })

  it('sin READ sobre acuerdos, la pestaña Acuerdos no se ofrece', async () => {
    fetch = abrirPortal('/projects/p1/commitments', GESTORA, sinAcuerdos, rutas())
    const pestanas = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    expect(await within(pestanas).findByRole('link', { name: 'Compromisos' })).toBeInTheDocument()
    expect(within(pestanas).queryByRole('link', { name: 'Acuerdos' })).not.toBeInTheDocument()
  })

  it.each(['/projects/p1/agreements', '/agreements'])('sin READ sobre acuerdos, %s lo dice y no los lee', async (ruta) => {
    fetch = abrirPortal(ruta, GESTORA, sinAcuerdos, rutas())
    expect(await screen.findByText('Su cuenta no puede abrir «Compromisos».')).toBeInTheDocument()
    expect(fetch.calls.some((c) => c.url.includes('/objects/agreement/records'))).toBe(false)
  })

  it('con READ sobre acuerdos y sin READ sobre compromisos, la pestaña Acuerdos se ofrece', async () => {
    fetch = abrirPortal('/projects/p1/overview', GESTORA, soloAcuerdos, rutas())
    const pestanas = await screen.findByRole('navigation', { name: 'Secciones del proyecto' })
    expect(await within(pestanas).findByRole('link', { name: 'Acuerdos' })).toHaveAttribute('href', '/projects/p1/agreements')
    expect(within(pestanas).queryByRole('link', { name: 'Compromisos' })).not.toBeInTheDocument()
  })

  it('con READ sobre acuerdos y sin READ sobre compromisos, /agreements se abre', async () => {
    fetch = abrirPortal('/agreements', GESTORA, soloAcuerdos, rutas())
    expect(await screen.findByRole('link', { name: 'Convenio de agua' })).toHaveAttribute('href', '/projects/p1/agreements/ag1')
  })

  it.each([
    ['/documents', 'Documentos'],
    ['/tasks', 'Tareas']
  ])('sin READ, %s lo dice y no se ofrece', async (ruta, seccion) => {
    fetch = abrirPortal(ruta, GESTORA, permisos({ project: ['READ'], project_assignment: ['READ'], commitment: ['READ'] }), rutas())
    expect(await screen.findByText(`Su cuenta no puede abrir «${seccion}».`)).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Secciones' })).queryByRole('link', { name: seccion })).not.toBeInTheDocument()
  })

  it('las aprobaciones y la decisión de un compromiso viven bajo Tareas', async () => {
    fetch = abrirPortal(
      '/tasks/approvals/commitment/c1',
      APROBADORA,
      permisos({ project: ['READ'], project_assignment: ['READ'], commitment: ['READ', 'UPDATE', 'APPROVE'], task: ['READ', 'UPDATE'] }),
      [...rutas(APROBADORA), { path: '/objects/commitment/records/c1/transitions', body: [] }]
    )
    expect(await screen.findByRole('heading', { name: 'Aprobación de compromiso', level: 1 })).toBeInTheDocument()
  })

  it('los avisos son de toda cuenta, con la campana en la barra superior', async () => {
    fetch = abrirPortal('/notifications', GESTORA, permisos({}), rutas())
    expect(await screen.findByRole('heading', { name: 'Avisos', level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Avisos, 1 sin leer' })).toBeInTheDocument()
  })

  it('/r/commitment/c1 salta a la ficha del compromiso bajo su proyecto', async () => {
    fetch = abrirPortal('/r/commitment/c1', GESTORA, EQUIPO_DE_COMPROMISOS, [
      ...rutas(),
      { path: '/objects/commitment/records/c1/transitions', body: [] },
      { path: '/objects/commitment/records/c1/related/commitment_stakeholder', body: pagina([]) },
      { path: '/objects/commitment_candidate/records', body: pagina([]) }
    ])
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/commitments/c1'))
    expect(await screen.findByRole('heading', { name: 'Reservorio de agua para Tunas Pampa', level: 1 })).toBeInTheDocument()
  })

  // una ficha ya leída (en caché) se dibuja sin pasar por «Cargando»: sin la clave del registro, volver a ella con el
  // historial arrastraría el panel abierto en la otra
  it('cada ficha se monta de nuevo por su registro: volver a otra evidencia no arrastra el panel abierto', async () => {
    const evidencia = (id: string, title: string, extra: Record<string, unknown> = {}) =>
      registro(id, { project: 'p1', title, evidence_type: 'OTRO', classification: 'INTERNA', people_identifiable: false, ...extra })
    fetch = abrirPortal('/projects/p1/documents/ev1', GESTORA, EQUIPO_DE_COMPROMISOS, [
      {
        path: '/metadata/objects/evidence',
        body: definicion('evidence', [
          ['evidence_type', { type: 'ENUM', enumOptions: ['OTRO'] }],
          ['classification', { type: 'ENUM', enumOptions: ['PUBLICA', 'INTERNA'] }],
          'title',
          ['document_date', { type: 'DATE' }],
          'author',
          ['people_identifiable', { type: 'BOOLEAN' }],
          ['photo_consent_given', { type: 'BOOLEAN' }]
        ])
      },
      { path: '/objects/evidence/records/ev1', body: evidencia('ev1', 'Acta firmada') },
      { path: '/objects/evidence/records/ev2', body: evidencia('ev2', 'Acta corregida', { replaces: 'ev1' }) },
      { path: /^\/objects\/evidence\/records\?.*replaces=ev1/, body: pagina([evidencia('ev2', 'Acta corregida', { replaces: 'ev1' })]) },
      { path: /^\/objects\/evidence\/records\/ev[12]\/related\//, body: pagina([]) },
      ...rutas()
    ])
    await userEvent.click(await screen.findByRole('link', { name: 'Reemplazada por Acta corregida' }))
    expect(await screen.findByRole('heading', { name: 'Acta corregida', level: 1 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar datos o clasificación' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    window.history.back()
    await waitFor(() => expect(rutaActual()).toBe('/projects/p1/documents/ev1'))
    expect(await screen.findByRole('heading', { name: 'Acta firmada', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Reportes se ofrece a quien exporta la matriz de compromisos', async () => {
    fetch = abrirPortal('/', GESTORA, permisos({ project: ['READ'], commitment: ['READ', 'EXPORT'] }), rutas())
    expect(await within(await screen.findByRole('navigation', { name: 'Secciones' })).findByRole('link', { name: 'Reportes' })).toBeInTheDocument()
  })
})
