import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro, ubicacion } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { Atajos, SinAsignacion } from './Atajos'

// S02 «Mi día» (revisión de UX, etapa 2): los atajos de creación según los permisos, sin depender del selector de proyecto
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})
const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' })
const ASIGNACION = registro('a1', { project: 'p1', member_user_id: RELACIONISTA.id, active: true, start_date: '2026-01-01' })
const rutas = [
  { path: '/objects/project/records', body: pagina([P1]) },
  { path: '/objects/project_assignment/records', body: pagina([ASIGNACION]) }
]

describe('atajos de creación', () => {
  it('ofrece lo que la cuenta crea, y QCS con cualquiera de sus tres objetos', async () => {
    fetch = mockFetch(rutas)
    montar(<Atajos />, {
      usuario: RELACIONISTA,
      permisos: permisos({ engagement: ['CREATE'], inquiry: ['CREATE'], project: ['READ'], project_assignment: ['READ'] })
    })
    const atajos = screen.getByRole('region', { name: 'Registrar' })
    expect(
      within(atajos)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['Registrar interacción', 'Registrar QCS'])
    expect(within(atajos).queryByRole('link', { name: 'Nuevo proyecto' })).not.toBeInTheDocument()
  })

  it('con un solo proyecto donde escribe, el atajo lleva directo a su alta', async () => {
    fetch = mockFetch(rutas)
    montar(<Atajos />, { usuario: RELACIONISTA, permisos: permisos({ engagement: ['CREATE'], project: ['READ'], project_assignment: ['READ'] }) })
    const boton = screen.getByRole('button', { name: 'Registrar interacción' })
    await waitFor(() => expect(boton).toBeEnabled())
    await userEvent.click(boton)
    expect(ubicacion.actual).toBe('/projects/p1/engagements/new')
  })

  // tercera pasada de UX, 3.1: sin asignación vigente no hay dónde registrar; el inicio dice a quién pedirla
  it('sin una asignación vigente no ofrece atajos de alta y dice a quién pedirla', async () => {
    const vencida = registro('a1', { project: 'p1', member_user_id: RELACIONISTA.id, active: true, start_date: '2026-01-01', end_date: '2026-02-01' })
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([P1]) },
      { path: '/objects/project_assignment/records', body: pagina([vencida]) }
    ])
    montar(
      <>
        <SinAsignacion />
        <Atajos />
      </>,
      { usuario: RELACIONISTA, permisos: permisos({ engagement: ['CREATE'], project: ['READ'], project_assignment: ['READ'] }) }
    )
    const aviso = await screen.findByRole('region', { name: 'Todavía no tiene un proyecto asignado' })
    expect(aviso).toHaveTextContent('pídala a la administración del proyecto')
    expect(screen.queryByRole('button', { name: 'Registrar interacción' })).not.toBeInTheDocument()
  })

  it('sin nada que crear, no se dibuja', () => {
    fetch = mockFetch(rutas)
    const { container } = montar(<Atajos />, { usuario: RELACIONISTA, permisos: permisos({ project: ['READ'] }) })
    expect(container).toBeEmptyDOMElement()
  })
})
