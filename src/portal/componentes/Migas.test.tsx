import { screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, registro, workflow } from '../../test/montar'
import { Migas, MigasDelProyecto, MigasGlobales } from './Migas'

// ux-architecture.md §8.1: las migas dicen dónde vive el registro (Proyectos / PRJ-01 · Pukaqaqa / Compromisos /
// COM-2026-031) y no cambian con el recorrido, que es el rastro
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const P1 = registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' }, { state: 'active' })
// el texto de cada paso es el de su enlace o su etiqueta: el estado del proyecto va al lado, fuera del enlace
const pasos = () =>
  within(screen.getByRole('navigation', { name: 'Ubicación' }))
    .getAllByRole('listitem')
    .map((li) => {
      const enlace = within(li).queryByRole('link')
      const etiqueta = li.querySelector('[data-miga]')?.textContent?.trim()
      return enlace ? `${etiqueta} → ${enlace.getAttribute('href')}` : `${etiqueta} (aquí)`
    })

describe('Migas', () => {
  it('enlaza cada nivel y marca el último como la página actual', () => {
    montar(<Migas pasos={[{ etiqueta: 'Proyectos', ruta: '/projects' }, { etiqueta: 'Riesgos', ruta: '/risks' }, { etiqueta: 'RSK-01' }]} />)
    expect(pasos()).toEqual(['Proyectos → /projects', 'Riesgos → /risks', 'RSK-01 (aquí)'])
    expect(screen.getByText('RSK-01')).toHaveAttribute('aria-current', 'page')
  })

  it('sin pasos no dibuja nada', () => {
    const { container } = montar(<Migas pasos={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

// fuera de un proyecto, derivadas de la ruta: Inicio, la sección y el registro que declara la ficha
describe('MigasGlobales', () => {
  it('en el inicio, solo «Inicio» como la página actual', () => {
    fetch = mockFetch([])
    montar(<MigasGlobales />, { ruta: '/' })
    expect(pasos()).toEqual(['Inicio (aquí)'])
  })

  it('en una sección, Inicio y la sección actual', () => {
    fetch = mockFetch([])
    montar(<MigasGlobales />, { ruta: '/commitments' })
    expect(pasos()).toEqual(['Inicio → /', 'Compromisos (aquí)'])
  })

  it('dentro de una sección, la sección enlazada y el registro abierto', () => {
    fetch = mockFetch([])
    montar(<MigasGlobales registro="CC Tunas Pampa" />, { ruta: '/territory/communities/c1' })
    expect(pasos()).toEqual(['Inicio → /', 'Territorio → /territory', 'CC Tunas Pampa (aquí)'])
  })
})

describe('MigasDelProyecto', () => {
  it('derivadas de la ruta: proyectos, el proyecto, su pestaña y el registro abierto', async () => {
    fetch = mockFetch([{ path: '/objects/project/records/p1', body: P1 }])
    montar(<MigasDelProyecto registro="COM-2026-031" />, {
      ruta: '/projects/p1/commitments/c1',
      camino: '/projects/:projectId/commitments/:commitmentId'
    })
    expect(await screen.findByRole('link', { name: 'PRJ-01 · Proyecto Ejemplo A' })).toBeInTheDocument()
    expect(pasos()).toEqual([
      'Inicio → /',
      'Proyectos → /projects',
      'PRJ-01 · Proyecto Ejemplo A → /projects/p1/overview',
      'Compromisos → /projects/p1/commitments',
      'COM-2026-031 (aquí)'
    ])
  })

  it('sin registro, la pestaña es la página actual; la pestaña puede darse cuando la ruta no la nombra', async () => {
    fetch = mockFetch([{ path: '/objects/project/records/p1', body: P1 }])
    montar(<MigasDelProyecto pestana="attention" registro="QCS-2026-007" />, {
      ruta: '/projects/p1/grievances/g1',
      camino: '/projects/:projectId/grievances/:id'
    })
    await screen.findByRole('link', { name: 'PRJ-01 · Proyecto Ejemplo A' })
    expect(pasos()).toEqual([
      'Inicio → /',
      'Proyectos → /projects',
      'PRJ-01 · Proyecto Ejemplo A → /projects/p1/overview',
      'Quejas, consultas y solicitudes → /projects/p1/attention',
      'QCS-2026-007 (aquí)'
    ])
  })

  it('una ficha fuera del segmento de su pestaña (una queja en /grievances) lleva a su pestaña', async () => {
    fetch = mockFetch([{ path: '/objects/project/records/p1', body: P1 }])
    montar(<MigasDelProyecto registro="Q-001" />, { ruta: '/projects/p1/grievances/g1', camino: '/projects/:projectId/grievances/:id' })
    await screen.findByRole('link', { name: 'PRJ-01 · Proyecto Ejemplo A' })
    expect(pasos()).toContain('Quejas, consultas y solicitudes → /projects/p1/attention')
  })

  // el estado del proyecto ya no va en las migas: va en el sello de alcance de la banda de contexto, junto al código del proyecto
  // (BarraDeContexto, contexto.test.tsx); las migas solo dicen dónde se está
  it('las migas no llevan el estado del proyecto', async () => {
    fetch = mockFetch([
      { path: '/objects/project/records/p1', body: registro('p1', { code: 'PRJ-01', name: 'Proyecto Ejemplo A' }, { state: 'draft' }) },
      { path: '/objects/project/workflow', body: workflow('project', [['draft', 'Borrador']]) }
    ])
    montar(<MigasDelProyecto registro="COM-2026-031" />, {
      ruta: '/projects/p1/commitments/c1',
      camino: '/projects/:projectId/commitments/:commitmentId'
    })
    await screen.findByRole('link', { name: 'PRJ-01 · Proyecto Ejemplo A' })
    expect(screen.getByRole('navigation', { name: 'Ubicación' })).not.toHaveTextContent('Borrador')
  })

  it('mientras el proyecto no llega, lo nombra por su id', () => {
    fetch = mockFetch([])
    montar(<MigasDelProyecto />, { ruta: '/projects/p1/risks', camino: '/projects/:projectId/risks' })
    expect(pasos()).toEqual(['Inicio → /', 'Proyectos → /projects', 'p1 → /projects/p1/overview', 'Riesgos (aquí)'])
  })
})
