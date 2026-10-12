import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cargarMapas, Map as Falso } from '../../test/maplibre'
import { montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { destinoDe, esMiembro, useCapas, type Coleccion, type EstadoDeCapa } from './api'
import { ControlDeCapas } from './ControlDeCapas'
import { Leyenda } from './Leyenda'
import { Mapa } from './Mapa'
import { estiloDeCapa } from './paleta'

vi.mock('maplibre-gl', () => import('../../test/maplibre'))

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  Falso.todos = []
  Falso.fallar = false
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const coleccion = (n: number, extra: Partial<Coleccion> = {}): Coleccion => ({
  type: 'FeatureCollection',
  features: Array.from({ length: n }, (_, i) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-78, -8] },
    properties: { __id: `l${i}`, __object: 'locality' }
  })),
  ...extra
})

// un lector mínimo de useCapas: un botón mueve el encuadre y otro cambia de proyecto
const ENCUADRE_1: [number, number, number, number] = [-78.0004, -9.0004, -77.0004, -8.0004]
const ENCUADRE_2: [number, number, number, number] = [-77.5, -8.5, -77.2, -8.2]
function Lector() {
  const [bbox, setBbox] = useState(ENCUADRE_1)
  const [project, setProject] = useState('p1')
  const estados = useCapas(['LYR-02', 'LYR-10'], { project, bbox })
  return (
    <div>
      <button onClick={() => setBbox(ENCUADRE_2)}>mover</button>
      <button onClick={() => setProject('p2')}>otro proyecto</button>
      <ul>
        {estados.map((e) => (
          <li key={e.id}>{`${e.id}|datos:${e.datos ? e.datos.features.length : '-'}|truncada:${e.truncada}|bloqueada:${e.bloqueada}`}</li>
        ))}
      </ul>
    </div>
  )
}

describe('useCapas', () => {
  it('pide cada capa con el proyecto y el encuadre redondeado hacia afuera', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      { path: /\/sgspe\/territory\/layers\/LYR-02/, responder: () => Response.json(coleccion(2)) },
      { path: /\/sgspe\/territory\/layers\/LYR-10/, responder: () => Response.json(coleccion(1)) }
    ])
    montar(<Lector />)
    await screen.findByText('LYR-02|datos:2|truncada:false|bloqueada:false')
    const [llamada] = red.a('GET', '/sgspe/territory/layers/LYR-02')
    // mínimos hacia abajo y máximos hacia arriba: -78.0004 → -78.001 y -8.0004 → -8.000
    expect(llamada.ruta).toBe('/sgspe/territory/layers/LYR-02?project=p1&bbox=-78.001%2C-9.001%2C-77.000%2C-8.000')
  })

  it('una capa recortada al tope avisa; al mover el mapa conserva los datos y el aviso hasta que llega el nuevo encuadre', async () => {
    fetch = mockFetch([])
    let liberar: (() => void) | null = null
    let pedidos = 0
    red = espiarRed([
      {
        path: /\/sgspe\/territory\/layers\/LYR-02/,
        responder: async () => {
          if (++pedidos === 2) await new Promise<void>((r) => (liberar = r))
          return Response.json(coleccion(3, { truncated: true }))
        }
      },
      { path: /\/sgspe\/territory\/layers\/LYR-10/, responder: () => Response.json(coleccion(1)) }
    ])
    montar(<Lector />)
    await screen.findByText('LYR-02|datos:3|truncada:true|bloqueada:false')
    await userEvent.click(screen.getByRole('button', { name: 'mover' }))
    await waitFor(() => expect(pedidos).toBe(2))
    // el pedido nuevo sigue en vuelo y la capa no parpadea: mismos datos y mismo aviso
    expect(screen.getByText('LYR-02|datos:3|truncada:true|bloqueada:false')).toBeInTheDocument()
    await act(async () => liberar?.())
    await waitFor(() => expect(red?.a('GET', '/sgspe/territory/layers/LYR-02')).toHaveLength(2))
    expect(red.a('GET', '/sgspe/territory/layers/LYR-02')[1].ruta).toContain('bbox=-77.500%2C-8.500%2C-77.200%2C-8.200')
  })

  it('un 403 deja la capa bloqueada y no se vuelve a pedir al mover el mapa; al cambiar de proyecto sí', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      { path: /\/sgspe\/territory\/layers\/LYR-02/, responder: () => Response.json(coleccion(2)) },
      { path: /\/sgspe\/territory\/layers\/LYR-10/, responder: () => problema(403, 'Sin permiso') }
    ])
    montar(<Lector />)
    await screen.findByText('LYR-10|datos:-|truncada:false|bloqueada:true')
    await userEvent.click(screen.getByRole('button', { name: 'mover' }))
    await waitFor(() => expect(red?.a('GET', '/sgspe/territory/layers/LYR-02')).toHaveLength(2))
    expect(red.a('GET', '/sgspe/territory/layers/LYR-10')).toHaveLength(1)
    expect(screen.getByText('LYR-10|datos:-|truncada:false|bloqueada:true')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'otro proyecto' }))
    await waitFor(() => expect(red?.a('GET', '/sgspe/territory/layers/LYR-10')).toHaveLength(2))
  })
})

describe('ControlDeCapas', () => {
  const estado = (id: string, extra: Partial<EstadoDeCapa> = {}): EstadoDeCapa => ({
    id,
    datos: null,
    bloqueada: false,
    truncada: false,
    cargando: false,
    error: null,
    ...extra
  })
  const ids = ['LYR-02', 'LYR-10', 'LYR-14']

  it('una capa sin permiso queda deshabilitada, con candado y con su razón', () => {
    montar(<ControlDeCapas ids={ids} encendidas={new Set(['LYR-02', 'LYR-10'])} estados={[estado('LYR-10', { bloqueada: true })]} alCambiar={() => {}} />)
    const casilla = screen.getByRole('checkbox', { name: /Instituciones|Pozos programados/ })
    expect(casilla).toBeDisabled()
    expect(casilla).not.toBeChecked()
    expect(within(casilla.closest('label') as HTMLElement).getByLabelText('Su cuenta no puede ver esta capa')).toBeInTheDocument()
    // una sensible que sí se ve lleva el candado de capa sensible
    expect(
      within(screen.getByText('Predios de propiedad, posesión y comunales').closest('label') as HTMLElement).getByLabelText('Capa sensible')
    ).toBeInTheDocument()
  })

  it('la capa recortada al tope pide acercar el mapa solo mientras está encendida', () => {
    const { rerender } = montar(
      <ControlDeCapas ids={ids} encendidas={new Set(['LYR-02'])} estados={[estado('LYR-02', { truncada: true })]} alCambiar={() => {}} />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Hay más elementos de los que se muestran: acerque el mapa')
    rerender(<ControlDeCapas ids={ids} encendidas={new Set()} estados={[estado('LYR-02', { truncada: true })]} alCambiar={() => {}} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('dice cuándo una capa encendida carga o falla, y avisa al encender', async () => {
    const cambiar = vi.fn()
    montar(
      <ControlDeCapas
        ids={ids}
        encendidas={new Set(['LYR-02', 'LYR-10'])}
        estados={[estado('LYR-02', { cargando: true }), estado('LYR-10', { error: new Error('red') })]}
        alCambiar={cambiar}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Cargando la capa…')
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo leer la capa')
    await userEvent.click(screen.getByRole('checkbox', { name: /Predios de propiedad/ }))
    expect(cambiar).toHaveBeenCalledWith('LYR-14', true)
  })
})

describe('destinoDe', () => {
  it('un registro lleva a sí mismo y un miembro de LYR-13 lleva al lugar que dibuja', () => {
    expect(destinoDe({ __id: 'l1', __object: 'locality' })).toEqual({ id: 'l1', objeto: 'locality' })
    const miembro = { __id: 'm1', __object: 'area_of_influence_member', __target: 'community', __targetId: 'c9' }
    expect(esMiembro(miembro)).toBe(true)
    expect(esMiembro({ __object: 'locality' })).toBe(false)
    expect(destinoDe(miembro)).toEqual({ id: 'c9', objeto: 'community' })
    expect(destinoDe({ __id: 'm2', __object: 'area_of_influence_member' })).toBeNull()
    expect(destinoDe(null)).toBeNull()
  })
})

describe('Mapa', () => {
  it('baja MapaImpl bajo demanda y dibuja el mapa', async () => {
    montar(<Mapa etiqueta="Mapa del proyecto" capas={[]} />)
    expect(screen.getByText('Cargando el mapa…')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Mapa del proyecto' })).toBeInTheDocument()
    await act(async () => cargarMapas())
    expect(Falso.todos).toHaveLength(1)
  })

  it('sin WebGL dice que no se pudo mostrar el mapa en lugar de tirar la pantalla', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    Falso.fallar = true
    try {
      render(<p>fuera</p>)
      montar(<Mapa etiqueta="Mapa" capas={[]} />)
      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo mostrar el mapa')
    } finally {
      error.mockRestore()
    }
  })
})

describe('Leyenda', () => {
  it('dice cada capa encendida con su nombre y su color de la paleta; sin capas no se dibuja', () => {
    const { rerender } = montar(<Leyenda ids={['LYR-05', 'LYR-01']} />)
    const leyenda = screen.getByRole('region', { name: 'Leyenda' })
    expect(
      within(leyenda)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['Territorio comunal', 'Límites administrativos'])
    expect(within(leyenda).getAllByRole('listitem')[0].querySelector('[data-color]')).toHaveAttribute('data-color', estiloDeCapa('LYR-05').color)
    rerender(<Leyenda ids={[]} />)
    expect(screen.queryByRole('region', { name: 'Leyenda' })).not.toBeInTheDocument()
  })
})
