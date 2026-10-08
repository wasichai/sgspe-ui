import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro, ubicacion, workflow } from '../../test/montar'
import { RELACIONISTA } from '../../test/portal'
import { BarraDeContexto } from './BarraDeContexto'
import { ProyectoLayout } from './ProyectoLayout'
import { filtroDeTerritorio, rutaEquivalente } from './rutas'
import { SelectorDeProyecto } from './SelectorDeProyecto'

let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const LEE_PROYECTOS = { admin: false, objects: { project: ['READ'], project_assignment: ['READ'] } }
const P1 = registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa' }, { state: 'active' })
const P2 = registro('p2', { code: 'PRJ-02', name: 'Qorihuasi' }, { state: 'draft' })
const MI_ASIGNACION = registro('a1', { project: 'p2', member_user_id: RELACIONISTA.id, role_name: 'X', active: true })

// ASM-076: la misma página con otro alcance; entre proyectos se conserva la sección, no los registros
describe('rutaEquivalente', () => {
  it.each([
    ['/stakeholders', 'p1', '/projects/p1/stakeholders'],
    ['/stakeholders/dashboard', 'p1', '/projects/p1/stakeholders/dashboard'],
    ['/engagements/calendar?month=2026-10', 'p1', '/projects/p1/engagements/calendar'],
    ['/territory/communities/c1', 'p1', '/projects/p1/map'],
    ['/reports', 'p1', '/projects/p1/reports'],
    ['/projects', 'p1', '/projects/p1/overview'],
    ['/', 'p1', '/projects/p1/overview'],
    ['/projects/p1/stakeholders/s9', 'p2', '/projects/p2/stakeholders'],
    ['/projects/p1/stakeholders/matrix', 'p2', '/projects/p2/stakeholders/matrix'],
    ['/projects/p1/engagements/e1/minutes', 'p2', '/projects/p2/engagements'],
    ['/projects/p1/areas/a1', 'p2', '/projects/p2/map'],
    ['/projects/p1/settings', 'p2', '/projects/p2/settings'],
    ['/projects/p1/stakeholders/s9', null, '/stakeholders'],
    ['/projects/p1/engagements/calendar', null, '/engagements/calendar'],
    ['/projects/p1/field-visits/v1', null, '/engagements'],
    ['/projects/p1/map', null, '/territory'],
    ['/projects/p1/overview', null, '/projects'],
    ['/stakeholders', null, '/stakeholders']
  ])('%s con %s va a %s', (desde, proyecto, hacia) => {
    expect(rutaEquivalente(desde.split('?')[0], proyecto)).toBe(hacia)
  })
})

describe('filtroDeTerritorio', () => {
  it('aplica el chip si la lista tiene la relación y avisa si no', () => {
    expect(filtroDeTerritorio({ kind: 'locality', id: 'l1' }, { locality: 'locality' })).toEqual({ locality: 'l1' })
    expect(filtroDeTerritorio({ kind: 'community', id: 'c1' }, { locality: 'locality' })).toBeNull()
    expect(filtroDeTerritorio(null, {})).toEqual({})
  })
})

describe('selector de proyecto', () => {
  it('lista primero los proyectos de la persona y lleva a la misma sección del proyecto elegido', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records', body: pagina([P1, P2]) },
      { path: '/objects/project_assignment/records', body: pagina([MI_ASIGNACION]) }
    ])
    montar(<SelectorDeProyecto />, { ruta: '/stakeholders', permisos: LEE_PROYECTOS })
    const selector = await screen.findByRole('combobox', { name: 'Proyecto' })
    await waitFor(() =>
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos mis proyectos', 'PRJ-02 · Qorihuasi', 'PRJ-01 · Pukaqaqa'])
    )
    await userEvent.selectOptions(selector, 'p1')
    expect(ubicacion.actual).toBe('/projects/p1/stakeholders')
  })

  it('sin READ sobre project no se dibuja', () => {
    fetch = mockFetch([])
    montar(<SelectorDeProyecto />, { permisos: { admin: false, objects: {} } })
    expect(screen.queryByRole('combobox', { name: 'Proyecto' })).not.toBeInTheDocument()
  })
})

describe('barra de contexto y Project 360', () => {
  it('muestra el proyecto con su estado y quita el chip de territorio sin cambiar de pantalla', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records/p1', body: P1 },
      { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
      { path: '/objects/community/records/c1', body: registro('c1', { name: 'CC Tunas Pampa' }) }
    ])
    montar(<BarraDeContexto />, { ruta: '/projects/p1/stakeholders?territory=community:c1' })
    expect(await screen.findByText('PRJ-01 · Pukaqaqa')).toBeInTheDocument()
    expect(await screen.findByText('Activo')).toBeInTheDocument()
    expect(await screen.findByText('Territorio: Comunidad CC Tunas Pampa')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar el filtro de territorio' }))
    expect(ubicacion.actual).toBe('/projects/p1/stakeholders')
  })

  it('sin asignación al proyecto avisa que es de solo lectura', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records/p1', body: P1 },
      { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
      { path: '/objects/project_assignment/records', body: pagina([MI_ASIGNACION]) }
    ])
    montar(
      <Routes>
        <Route path="/projects/:projectId" element={<ProyectoLayout />}>
          <Route path="overview" element={<p>Resumen</p>} />
        </Route>
      </Routes>,
      { ruta: '/projects/p1/overview' }
    )
    expect(await screen.findByText('No está asignado a este proyecto: puede leerlo, pero no cambiarlo.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resumen' })).toHaveAttribute('aria-current', 'page')
  })
})
