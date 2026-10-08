import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FetchMock } from '@wasichai/testing'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pagina, registro, workflow } from '../../test/montar'
import { abrirPortal, rutaActual } from '../../test/pantalla'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'

// el doble del mapa, más lo que el mapa real informa: la vista (que acota las capas con un bbox) y el cursor
const doble = vi.hoisted(() => ({
  vista: null as [number, number, number, number] | null,
  moverCursor: null as ((punto: [number, number] | null) => void) | null
}))
vi.mock('../mapa/Mapa', async () => {
  const { Mapa: Falso } = await import('../../test/mapaFalso')
  return {
    Mapa: (props: Parameters<typeof Falso>[0]) => {
      const { alMoverVista, alMoverCursor } = props
      useEffect(() => {
        doble.moverCursor = alMoverCursor ?? null
        if (doble.vista) alMoverVista?.(doble.vista)
      }, [alMoverVista, alMoverCursor])
      return <Falso {...props} />
    }
  }
})

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  doble.vista = doble.moverCursor = null
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const coleccion = (objeto: string, elementos: [string, Record<string, unknown>][]) => ({
  type: 'FeatureCollection',
  features: elementos.map(([id, props]) => ({
    type: 'Feature',
    id: `${id}:location`,
    geometry: { type: 'Point', coordinates: [-78.1, -8.1] },
    properties: { __id: id, __object: objeto, ...props }
  }))
})

const rutas = () => [
  { path: '/objects/project/records/p1', body: registro('p1', { code: 'PRJ-01', name: 'Pukaqaqa', working_crs: 'EPSG 32717' }, { state: 'active' }) },
  { path: '/objects/project/workflow', body: workflow('project', [['active', 'Activo']]) },
  { path: '/objects/area_of_influence/workflow', body: workflow('area_of_influence', [['approved', 'Aprobada']]) },
  { path: '/objects/project_assignment/records', body: pagina([]) },
  { path: '/sgspe/territory/layers/LYR-10', body: coleccion('project_component', [['pc1', { code: 'SDJ-001' }]]) },
  { path: '/sgspe/territory/layers/LYR-14', status: 403, body: { title: 'Forbidden', status: 403 } },
  { path: /^\/sgspe\/territory\/layers\/LYR-\d\d/, body: coleccion('x', []) },
  {
    path: '/objects/project_component/records',
    body: pagina([
      registro('pc1', { code: 'SDJ-001', component_type: 'SONDAJE', version_number: 2 }),
      registro('pc0', { code: 'SDJ-001', component_type: 'SONDAJE', version_number: 1, superseded: true })
    ])
  },
  {
    path: '/objects/area_of_influence/records',
    body: pagina([registro('a1', { area_type: 'AIDS', version_number: 1, calculated_area_ha: 1520.5 }, { state: 'approved' })])
  }
]

describe('S09 · mapa del proyecto', () => {
  it('pide las capas iniciales con el proyecto y muestra solo la versión vigente de cada componente', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], project_component: ['READ'], area_of_influence: ['READ'] }), rutas())
    red = espiarRed()
    const tabla = await screen.findByRole('table', { name: 'Componentes' })
    await waitFor(() => expect(within(tabla).getAllByRole('row')).toHaveLength(2))
    await waitFor(() => expect(red!.a('GET', '/sgspe/territory/layers/LYR-10').length).toBeGreaterThan(0))
    expect(red.a('GET', '/sgspe/territory/layers/LYR-10')[0].ruta).toContain('project=p1')
    expect(red.a('GET', '/sgspe/territory/layers/LYR-14')).toHaveLength(0)
  })

  it('una capa sin permiso queda con candado y su razón', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), rutas())
    const predios = await screen.findByRole('checkbox', { name: /Predios de propiedad/ })
    await userEvent.click(predios)
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Predios de propiedad/ })).toBeDisabled())
    expect(screen.getByLabelText('Su cuenta no puede ver esta capa')).toBeInTheDocument()
  })

  it('elegir en el mapa o en la tabla fija ?selected= en la URL', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], project_component: ['READ'] }), rutas())
    const mapa = await screen.findByRole('list', { name: 'Mapa del proyecto' })
    await userEvent.click(await within(mapa).findByRole('button', { name: 'SDJ-001' }))
    expect(rutaActual()).toBe('/projects/p1/map?selected=project_component%3Apc1')
    expect(within(screen.getByRole('table', { name: 'Componentes' })).getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('elegir una fila de la tabla marca el elemento en el mapa y la URL, una sola vez', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], project_component: ['READ'] }), rutas())
    const tabla = await screen.findByRole('table', { name: 'Componentes' })
    const mapa = await screen.findByRole('list', { name: 'Mapa del proyecto' })
    await waitFor(() => expect(within(tabla).getAllByRole('row')).toHaveLength(2))
    await within(mapa).findByRole('button', { name: 'SDJ-001' })
    expect(mapa).toHaveAttribute('data-seleccion', '')
    const reemplazos = vi.spyOn(window.history, 'replaceState')
    await userEvent.click(within(tabla).getByRole('button', { name: 'SDJ-001' }))
    expect(reemplazos).toHaveBeenCalledTimes(1)
    reemplazos.mockRestore()
    expect(rutaActual()).toBe('/projects/p1/map?selected=project_component%3Apc1')
    await waitFor(() => expect(screen.getByRole('list', { name: 'Mapa del proyecto' })).toHaveAttribute('data-seleccion', 'pc1'))
    expect(within(tabla).getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText(/no está dibujado en el mapa/)).not.toBeInTheDocument()
  })

  it('elegir una fila que no se dibuja avisa que no está en el mapa', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], project_component: ['READ'] }), [
      {
        path: '/objects/project_component/records',
        body: pagina([
          registro('pc1', { code: 'SDJ-001', component_type: 'SONDAJE', version_number: 1 }),
          registro('pc9', { code: 'SDJ-009', component_type: 'SONDAJE', version_number: 1 })
        ])
      },
      ...rutas()
    ])
    const tabla = await screen.findByRole('table', { name: 'Componentes' })
    await within(tabla).findByRole('button', { name: 'SDJ-001' })
    expect(screen.queryByText(/no está dibujado en el mapa/)).not.toBeInTheDocument()
    await userEvent.click(await within(tabla).findByRole('button', { name: 'SDJ-009' }))
    expect(await screen.findByText(/no está dibujado en el mapa/)).toBeInTheDocument()
    await userEvent.click(within(tabla).getByRole('button', { name: 'SDJ-001' }))
    await waitFor(() => expect(screen.queryByText(/no está dibujado en el mapa/)).not.toBeInTheDocument())
  })

  // LYR-13 trae los miembros de las áreas aprobadas (api.md §4.2): elegir uno lleva al lugar que dibuja, no al miembro
  it('un miembro de un área elige su localidad y ofrece abrir su ficha', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], area_of_influence: ['READ'] }), [
      {
        path: '/sgspe/territory/layers/LYR-13',
        body: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 'm1:location',
              geometry: { type: 'Point', coordinates: [-78.1, -8.1] },
              properties: { __id: 'm1', __object: 'area_of_influence_member', __target: 'locality', __targetId: 'l1', rationale: 'Tunas' }
            }
          ]
        }
      },
      ...rutas()
    ])
    const mapa = await screen.findByRole('list', { name: 'Mapa del proyecto' })
    await userEvent.click(await within(mapa).findByRole('button', { name: 'm1' }))
    expect(rutaActual()).toBe('/projects/p1/map?selected=locality%3Al1')
    expect(await screen.findByRole('link', { name: 'Abrir la ficha' })).toHaveAttribute('href', '/territory/localities/l1?project=p1')
  })

  it('una capa recortada al tope pide acercar el mapa', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], project_component: ['READ'] }), [
      { path: '/sgspe/territory/layers/LYR-10', body: { ...coleccion('project_component', [['pc1', { code: 'SDJ-001' }]]), truncated: true } },
      ...rutas()
    ])
    expect(await screen.findByText('Hay más elementos de los que se muestran: acerque el mapa')).toBeInTheDocument()
    expect(screen.getAllByRole('status').some((s) => s.textContent?.includes('acerque el mapa'))).toBe(true)
  })

  it('las áreas de influencia llevan a su ficha', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], area_of_influence: ['READ'] }), rutas())
    await userEvent.click(await screen.findByRole('tab', { name: 'Áreas de influencia' }))
    expect(await screen.findByRole('link', { name: 'AIDS · v1' })).toHaveAttribute('href', '/projects/p1/areas/a1')
    expect(screen.getByText('1,520.5 ha')).toBeInTheDocument()
  })

  describe('predios', () => {
    const prediales = (extra: Record<string, unknown> = {}) => [
      {
        path: '/sgspe/territory/layers/LYR-14',
        body: { ...coleccion('land_parcel', [['lp1', { code: 'PR-01', tenure_type: 'PROPIEDAD', calculated_area_ha: 12 }]]), ...extra }
      },
      ...rutas().filter((r) => !String(r.path).includes('LYR-14'))
    ]

    it('elige un predio con el teclado y lo marca en el mapa', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), prediales())
      await userEvent.click(await screen.findByRole('tab', { name: 'Predios' }))
      expect(await screen.findByText(/Predios de propiedad.*está apagada/)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('checkbox', { name: /Predios de propiedad/ }))
      const tabla = await screen.findByRole('table', { name: 'Predios' })
      const boton = await within(tabla).findByRole('button', { name: 'PR-01' })
      await waitFor(() => expect(screen.queryByText(/Predios de propiedad.*está apagada/)).not.toBeInTheDocument())
      boton.focus()
      await userEvent.keyboard('{Enter}')
      expect(rutaActual()).toBe('/projects/p1/map?selected=land_parcel%3Alp1')
      expect(within(tabla).getAllByRole('row')[1]).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('list', { name: 'Mapa del proyecto' })).toHaveAttribute('data-seleccion', 'lp1')
    })

    it('una capa recortada, bloqueada o apagada lo dice en lugar de una tabla vacía', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), prediales({ truncated: true }))
      await userEvent.click(await screen.findByRole('tab', { name: 'Predios' }))
      await userEvent.click(await screen.findByRole('checkbox', { name: /Predios de propiedad/ }))
      expect(await screen.findByText(/tiene más predios de los que se muestran/)).toBeInTheDocument()
    })

    it('una capa de predios encendida que falló lo dice en lugar de dejar solo los encabezados', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), [
        { path: '/sgspe/territory/layers/LYR-14', status: 500, body: { title: 'Error', status: 500 } },
        ...rutas().filter((r) => !String(r.path).includes('LYR-14'))
      ])
      await userEvent.click(await screen.findByRole('tab', { name: 'Predios' }))
      await userEvent.click(await screen.findByRole('checkbox', { name: /Predios de propiedad/ }))
      expect(await screen.findByText(/No se pudo leer la capa «Predios de propiedad/)).toBeInTheDocument()
      expect(screen.queryByText(/no tiene predios/)).not.toBeInTheDocument()
    })

    it('una capa de predios encendida que cargó sin predios lo dice en lugar de dejar solo los encabezados', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), [
        { path: '/sgspe/territory/layers/LYR-14', body: coleccion('land_parcel', []) },
        ...rutas().filter((r) => !String(r.path).includes('LYR-14'))
      ])
      await userEvent.click(await screen.findByRole('tab', { name: 'Predios' }))
      await userEvent.click(await screen.findByRole('checkbox', { name: /Predios de propiedad/ }))
      expect(await screen.findByText(/La capa «Predios de propiedad.*no tiene predios/)).toBeInTheDocument()
    })

    it('sin permiso para la capa de predios, la tabla dice que su cuenta no la ve', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), rutas())
      await userEvent.click(await screen.findByRole('tab', { name: 'Predios' }))
      await userEvent.click(await screen.findByRole('checkbox', { name: /Predios de propiedad/ }))
      expect(await screen.findByText(/Su cuenta no puede ver la capa «Predios de propiedad/)).toBeInTheDocument()
    })
  })

  describe('áreas', () => {
    const conMapa = () => [{ path: '/sgspe/territory/layers/LYR-13', body: coleccion('area_of_influence', [['a1', { name: 'AIDS' }]]) }, ...rutas()]

    it('elegir un área en su pestaña la marca en el mapa', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], area_of_influence: ['READ'] }), conMapa())
      await userEvent.click(await screen.findByRole('tab', { name: 'Áreas de influencia' }))
      await userEvent.click(await screen.findByRole('button', { name: /Ver en el mapa: AIDS v1/ }))
      expect(rutaActual()).toBe('/projects/p1/map?selected=area_of_influence%3Aa1')
      expect(screen.getByRole('list', { name: 'Mapa del proyecto' })).toHaveAttribute('data-seleccion', 'a1')
      expect(screen.getByRole('link', { name: 'AIDS · v1' }).closest('li')).toHaveAttribute('aria-current', 'true')
    })

    it('elegir el área en el mapa la marca en su pestaña', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'], area_of_influence: ['READ'] }), conMapa())
      const mapa = await screen.findByRole('list', { name: 'Mapa del proyecto' })
      await userEvent.click(await within(mapa).findByRole('button', { name: 'AIDS' }))
      expect(rutaActual()).toBe('/projects/p1/map?selected=area_of_influence%3Aa1')
      await userEvent.click(await screen.findByRole('tab', { name: 'Áreas de influencia' }))
      expect((await screen.findByRole('link', { name: 'AIDS · v1' })).closest('li')).toHaveAttribute('aria-current', 'true')
    })
  })

  describe('cuando el mapa no dibuja nada', () => {
    const sinCapas = () => rutas().filter((r) => !String(r.path).includes('layers'))
    const vacias = () => [{ path: /^\/sgspe\/territory\/layers\/LYR-\d\d/, body: coleccion('x', []) }, ...sinCapas()]
    const AVISOS = /aún no tiene geometrías|Todas las capas están apagadas|no puede ver ninguna|No se pudo leer ninguna|No hay elementos de las capas/

    it('un proyecto sin geometrías, con las capas sin error y sin vista acotada, dice que aún no tiene', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), vacias())
      expect(await screen.findByText(/aún no tiene geometrías/)).toBeInTheDocument()
    })

    it('una vista acotada sin elementos dice que la vista está vacía, no que el proyecto lo esté', async () => {
      doble.vista = [-70, -10, -69, -9]
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), vacias())
      red = espiarRed()
      expect(await screen.findByText('No hay elementos de las capas encendidas en esta vista.')).toBeInTheDocument()
      expect(screen.queryByText(/aún no tiene geometrías/)).not.toBeInTheDocument()
      expect(red.a('GET', '/sgspe/territory/layers/LYR-10').some((l) => l.ruta.includes('bbox='))).toBe(true)
    })

    it('si todas las capas encendidas fallan, dice que no se pudieron leer', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), [
        { path: /^\/sgspe\/territory\/layers\/LYR-\d\d/, status: 500, body: { title: 'Error', status: 500 } },
        ...sinCapas()
      ])
      expect(await screen.findByText(/No se pudo leer ninguna de las capas encendidas/)).toBeInTheDocument()
      expect(screen.queryByText(/aún no tiene geometrías/)).not.toBeInTheDocument()
    })

    it('si todas las capas encendidas responden 403, dice que su cuenta no puede verlas', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), [
        { path: /^\/sgspe\/territory\/layers\/LYR-\d\d/, status: 403, body: { title: 'Forbidden', status: 403 } },
        ...sinCapas()
      ])
      expect(await screen.findByText('Su cuenta no puede ver ninguna de las capas encendidas.')).toBeInTheDocument()
      expect(screen.queryByText(/aún no tiene geometrías/)).not.toBeInTheDocument()
    })

    it('con todas las capas apagadas, dice que las encienda y no que el proyecto está vacío', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), vacias())
      await screen.findByText(/aún no tiene geometrías/)
      for (const id of ['LYR-02', 'LYR-05', 'LYR-09', 'LYR-10', 'LYR-13']) {
        const nombre = {
          'LYR-02': /Centros poblados/,
          'LYR-05': /Territorio comunal/,
          'LYR-09': /Proyecto: ubicación/,
          'LYR-10': /Pozos programados/,
          'LYR-13': /^Áreas de influencia/
        }[id]!
        await userEvent.click(screen.getByRole('checkbox', { name: nombre }))
      }
      expect(await screen.findByText(/Todas las capas están apagadas/)).toBeInTheDocument()
      expect(screen.queryByText(/aún no tiene geometrías/)).not.toBeInTheDocument()
    })

    it('mientras una capa carga no dice nada', async () => {
      fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), rutas())
      await screen.findByRole('list', { name: 'Mapa del proyecto' })
      expect(screen.queryByText(AVISOS)).not.toBeInTheDocument()
    })
  })

  it('mover el cursor actualiza la barra de coordenadas', async () => {
    fetch = abrirPortal('/projects/p1/map', RELACIONISTA, permisos({ project: ['READ'] }), rutas())
    await screen.findByRole('list', { name: 'Mapa del proyecto' })
    await waitFor(() => expect(doble.moverCursor).not.toBeNull())
    act(() => doble.moverCursor!([-78.1, -8.1]))
    expect(await screen.findByText(/^E \d+ · N \d+ \(EPSG 32717\)$/)).toBeInTheDocument()
    act(() => doble.moverCursor!(null))
    await waitFor(() => expect(screen.queryByText(/^E \d+ · N/)).not.toBeInTheDocument())
  })
})
