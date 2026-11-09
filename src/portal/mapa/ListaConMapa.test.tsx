import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { montar, registro, ubicacion } from '../../test/montar'
import type { Registro } from '../datos/registros'
import { ListaConMapa, lugarDe, ofreceMapa } from './ListaConMapa'

vi.mock('./Mapa', () => import('../../test/mapaFalso'))

let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const punto = (id: string, objeto: string, name: string) => ({
  type: 'Feature',
  id: `${id}:location`,
  geometry: { type: 'Point', coordinates: [-78.5, -7.9] },
  properties: { __id: id, __object: objeto, name }
})
// LYR-19: los compromisos con su punto, el propio o el de su localidad o comunidad; k9 no está en la lista y no se dibuja
const LYR_19 = {
  type: 'FeatureCollection',
  truncated: false,
  features: [punto('k1', 'commitment', 'Agua'), punto('k2', 'commitment', 'Camino'), punto('k9', 'commitment', 'Otro')]
}
const compromiso = (id: string, title: string, extra: Record<string, unknown> = {}, geometries: Record<string, unknown> = {}) =>
  ({ ...registro(id, { project: 'p1', code: id.toUpperCase(), title, ...extra }), geometries }) as Registro
const COMPROMISOS = [
  compromiso('k1', 'Agua para Tunas', {}, { location: { type: 'Point', coordinates: [-78.5, -7.9] } }),
  compromiso('k2', 'Mejorar el camino', { community: 'c1' }),
  compromiso('k3', 'Taller sin lugar')
]

const montarLista = (ruta = '/commitments?view=mapa', alAbrir = vi.fn()) =>
  montar(
    <ListaConMapa
      objeto="commitment"
      etiqueta="Compromisos"
      registros={COMPROMISOS}
      proyecto="p1"
      nombreDe={(r) => String(r.attributes.title)}
      detalleDe={(r) => String(r.attributes.code)}
      accionesDe={(r) => <a href={`/commitments/${r.id}`}>Abrir {String(r.attributes.title)}</a>}
      alAbrir={alAbrir}
    />,
    { ruta }
  )

describe('la ubicación de un registro', () => {
  it('un compromiso o un riesgo se ubica por su punto, su localidad o su comunidad; un grupo, por su localidad', () => {
    expect(lugarDe('commitment', COMPROMISOS[0])).toBe('k1')
    expect(lugarDe('commitment', COMPROMISOS[1])).toBe('k2')
    expect(lugarDe('commitment', COMPROMISOS[2])).toBeNull()
    expect(lugarDe('social_risk', registro('r1', { area_of_influence: 'a1' }) as Registro)).toBe('r1')
    expect(lugarDe('grievance', registro('q1', { locality: 'l1' }) as Registro)).toBe('q1')
    // una QCS no tiene área de influencia: con solo un área, no se ubica
    expect(lugarDe('grievance', registro('q2', { area_of_influence: 'a1' }) as Registro)).toBeNull()
    expect(lugarDe('stakeholder', registro('s1', { locality: 'l1' }) as Registro)).toBe('l1')
    expect(lugarDe('stakeholder', registro('s2', {}) as Registro)).toBeNull()
    // un proyecto (LYR-09) se ubica por su punto de referencia o su área de interés
    expect(lugarDe('project', { ...registro('p1', {}), geometries: { location: { type: 'Point', coordinates: [-78, -8] } } } as Registro)).toBe('p1')
    expect(
      lugarDe('project', { ...registro('p2', {}), geometries: { location: null, interest_area: { type: 'MultiPolygon', coordinates: [] } } } as Registro)
    ).toBe('p2')
    expect(lugarDe('project', { ...registro('p3', {}), geometries: { location: null } } as Registro)).toBeNull()
    expect(lugarDe('project', registro('p4', {}) as Registro)).toBeNull()
    // un objeto sin capa de gestión que lo ubique no tiene lugar
    expect(lugarDe('engagement', COMPROMISOS[0])).toBeNull()
  })

  it('la vista se ofrece solo si algún registro trae ubicación', () => {
    expect(ofreceMapa('commitment', COMPROMISOS)).toBe(true)
    expect(ofreceMapa('commitment', [COMPROMISOS[2]])).toBe(false)
    expect(ofreceMapa('commitment', [])).toBe(false)
    expect(ofreceMapa('stakeholder', [registro('s2', {}) as Registro])).toBe(false)
  })
})

describe('ListaConMapa', () => {
  it('pide la capa de gestión del objeto con el proyecto y dibuja solo los registros de la lista', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/layers/LYR-19', body: LYR_19 }])
    montarLista()
    const mapa = await screen.findByRole('list', { name: 'Mapa de Compromisos' })
    await waitFor(() =>
      expect(
        within(mapa)
          .getAllByRole('button')
          .map((b) => b.textContent)
      ).toEqual(['Agua', 'Camino'])
    )
    const pedido = fetch.calls.find((l) => l.path.startsWith('/sgspe/territory/layers/LYR-19'))!
    expect(pedido.path).toContain('project=p1')
    expect(pedido.path).toContain('bbox=')
    // la fila sin ubicación lo dice; las demás, que están en el mapa
    const lista = screen.getByRole('listbox', { name: 'Compromisos' })
    const filas = within(lista).getAllByRole('option')
    expect(filas).toHaveLength(3)
    expect(filas[2]).toHaveTextContent('Sin ubicación')
    expect(within(filas[0]).getByLabelText('En el mapa')).toBeInTheDocument()
    expect(screen.getByText('Capa «Compromisos»: 2 en el mapa.')).toBeInTheDocument()
  })

  it('elegir una fila la marca, la lleva a ?selected= y la marca en el mapa; elegir un punto marca su fila', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/layers/LYR-19', body: LYR_19 }])
    montarLista()
    const mapa = await screen.findByRole('list', { name: 'Mapa de Compromisos' })
    await userEvent.click(screen.getByRole('option', { name: /Mejorar el camino/ }))
    expect(screen.getByRole('option', { name: /Mejorar el camino/ })).toHaveAttribute('aria-selected', 'true')
    expect(ubicacion.actual).toBe('/commitments?view=mapa&selected=commitment%3Ak2')
    expect(mapa).toHaveAttribute('data-seleccion', 'k2')
    // las acciones del elegido, bajo la lista
    expect(within(screen.getByRole('group', { name: 'Acciones de Mejorar el camino' })).getByRole('link')).toHaveTextContent('Abrir Mejorar el camino')
    await waitFor(() => expect(within(mapa).getAllByRole('button')).toHaveLength(2))
    await userEvent.click(within(mapa).getByRole('button', { name: 'Agua' }))
    expect(screen.getByRole('option', { name: /Agua para Tunas/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: /Mejorar el camino/ })).toHaveAttribute('aria-selected', 'false')
    expect(ubicacion.actual).toBe('/commitments?view=mapa&selected=commitment%3Ak1')
  })

  it('abre con la selección de la URL', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/layers/LYR-19', body: LYR_19 }])
    montarLista('/commitments?view=mapa&selected=commitment%3Ak2')
    expect(await screen.findByRole('list', { name: 'Mapa de Compromisos' })).toHaveAttribute('data-seleccion', 'k2')
    expect(screen.getByRole('option', { name: /Mejorar el camino/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('una selección de otro objeto no elige ninguna fila', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/layers/LYR-19', body: LYR_19 }])
    montarLista('/commitments?view=mapa&selected=locality%3Ak2')
    expect(await screen.findByRole('list', { name: 'Mapa de Compromisos' })).toHaveAttribute('data-seleccion', '')
    expect(screen.getAllByRole('option').every((f) => f.getAttribute('aria-selected') === 'false')).toBe(true)
  })

  it('con el teclado: una sola fila en el orden de tabulación, las flechas eligen, Home y End van a los extremos y Enter abre', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/layers/LYR-19', body: LYR_19 }])
    const abrir = vi.fn()
    montarLista('/commitments?view=mapa', abrir)
    await screen.findByRole('list', { name: 'Mapa de Compromisos' })
    const filas = screen.getAllByRole('option')
    expect(filas.map((f) => f.tabIndex)).toEqual([0, -1, -1])
    await userEvent.tab()
    expect(filas[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('option')[1]).toHaveFocus()
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    expect(ubicacion.actual).toContain('selected=commitment%3Ak2')
    await userEvent.keyboard('{End}')
    expect(screen.getAllByRole('option')[2]).toHaveFocus()
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Home}')
    expect(screen.getAllByRole('option')[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getAllByRole('option')[0]).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(abrir).toHaveBeenCalledWith(COMPROMISOS[0])
    // la fila elegida es la que entra en el orden de tabulación
    expect(screen.getAllByRole('option').map((f) => f.tabIndex)).toEqual([0, -1, -1])
  })

  it('sin permiso sobre la capa, la lista sigue entera y lo dice; un error de la capa también', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/layers/LYR-19', status: 403, body: { title: 'Forbidden', status: 403 } }])
    montarLista()
    expect(await screen.findByText('Su cuenta no puede ver la capa «Compromisos»: la lista sigue completa, sin el mapa.')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('un error de la capa no deja la lista vacía', async () => {
    fetch = mockFetch([{ path: '/sgspe/territory/layers/LYR-19', status: 500, body: { title: 'Error', status: 500 } }])
    montarLista()
    expect(await screen.findByText('No se pudo leer la capa «Compromisos»: la lista sigue completa, sin el mapa.')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('un proyecto se dibuja una sola vez, en su punto si lo tiene, aunque LYR-09 traiga también su área de interés', async () => {
    const proyectos = [
      { ...registro('p1', { name: 'Pukaqaqa' }), geometries: { location: { type: 'Point', coordinates: [-78.5, -7.9] } } },
      { ...registro('p2', { name: 'Qorihuasi' }), geometries: { interest_area: { type: 'MultiPolygon', coordinates: [] } } }
    ] as Registro[]
    const area = (id: string, name: string) => ({
      type: 'Feature',
      id: `${id}:interest_area`,
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-78, -8],
              [-77.9, -8],
              [-77.9, -7.9],
              [-78, -8]
            ]
          ]
        ]
      },
      properties: { __id: id, __object: 'project', name: `Área de ${name}` }
    })
    fetch = mockFetch([
      {
        path: '/sgspe/territory/layers/LYR-09',
        body: { type: 'FeatureCollection', features: [punto('p1', 'project', 'Pukaqaqa'), area('p1', 'Pukaqaqa'), area('p2', 'Qorihuasi')] }
      }
    ])
    montar(<ListaConMapa objeto="project" etiqueta="Proyectos" registros={proyectos} nombreDe={(r) => String(r.attributes.name)} />, {
      ruta: '/projects?view=mapa'
    })
    const mapa = await screen.findByRole('list', { name: 'Mapa de Proyectos' })
    await waitFor(() =>
      expect(
        within(mapa)
          .getAllByRole('button')
          .map((b) => b.textContent)
      ).toEqual(['Pukaqaqa', 'Área de Qorihuasi'])
    )
    // el portafolio no es de un proyecto: la capa se pide sin él
    expect(fetch.calls.find((l) => l.path.startsWith('/sgspe/territory/layers/LYR-09'))!.path).not.toContain('project=')
    expect(screen.getByText('Capa «Proyecto: ubicación y área de interés»: 2 en el mapa.')).toBeInTheDocument()
  })

  it('un grupo de interés se dibuja en su localidad: elegir la localidad marca la primera fila que está en ella', async () => {
    const grupos = [
      registro('s1', { name: 'Junta de usuarios', locality: 'l1' }),
      registro('s2', { name: 'Comité de vaso de leche', locality: 'l1' }),
      registro('s3', { name: 'Asociación sin lugar' })
    ] as Registro[]
    fetch = mockFetch([
      {
        path: '/sgspe/territory/layers/LYR-17',
        body: {
          type: 'FeatureCollection',
          features: [
            { ...punto('l1', 'locality', 'Tunas'), properties: { __id: 'l1', __object: 'locality', name: 'Tunas', __aggregate: 'stakeholder', total: 2 } }
          ]
        }
      }
    ])
    montar(<ListaConMapa objeto="stakeholder" etiqueta="Grupos de interés" registros={grupos} nombreDe={(r) => String(r.attributes.name)} />, {
      ruta: '/stakeholders?view=mapa&selected=stakeholder%3As2'
    })
    const mapa = await screen.findByRole('list', { name: 'Mapa de Grupos de interés' })
    expect(mapa).toHaveAttribute('data-seleccion', 'l1')
    await userEvent.click(await within(mapa).findByRole('button', { name: 'Tunas' }))
    expect(screen.getByRole('option', { name: /Junta de usuarios/ })).toHaveAttribute('aria-selected', 'true')
  })
})
