import { vi } from 'vitest'

// jsdom tampoco tiene ResizeObserver, que el mapa usa para acompañar el tamaño de su caja
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// un doble de maplibre-gl para jsdom, que no tiene WebGL: guarda sus fuentes, capas y llamadas. las pruebas lo instalan
// con vi.mock('maplibre-gl', () => import('../../test/maplibre')) y disparan la carga con cargarMapas()
export class Map {
  static todos: Map[] = []
  // una prueba lo enciende para simular un navegador sin WebGL: MapLibre lanza al crear el mapa
  static fallar = false
  opciones: Record<string, unknown>
  fuentes = new globalThis.Map<string, { data: unknown; setData: (d: unknown) => void }>()
  capas: { id: string; type: string; paint: Record<string, unknown> }[] = []
  manejadores: Record<string, ((...args: unknown[]) => void)[]> = {}
  fitBounds = vi.fn()
  setPaintProperty = vi.fn()
  remove = vi.fn()
  constructor(opciones: Record<string, unknown>) {
    if (Map.fallar) throw new Error('Failed to initialize WebGL')
    this.opciones = opciones
    Map.todos.push(this)
  }
  on(evento: string, ...resto: unknown[]) {
    const clave = resto.length === 2 ? `${evento}:${String(resto[0])}` : evento
    const manejador = resto[resto.length - 1] as (...args: unknown[]) => void
    ;(this.manejadores[clave] ??= []).push(manejador)
  }
  emitir(clave: string, ...args: unknown[]) {
    for (const m of this.manejadores[clave] ?? []) m(...args)
  }
  addControl() {}
  addSource(id: string, fuente: { data: unknown }) {
    const registro = { data: fuente.data, setData: (d: unknown) => (registro.data = d) }
    this.fuentes.set(id, registro)
  }
  getSource(id: string) {
    return this.fuentes.get(id)
  }
  removeSource(id: string) {
    this.fuentes.delete(id)
  }
  addLayer(capa: { id: string; type: string; paint: Record<string, unknown> }) {
    this.capas.push(capa)
  }
  removeLayer(id: string) {
    this.capas = this.capas.filter((c) => c.id !== id)
  }
  getBounds() {
    return { getWest: () => -78, getSouth: () => -9, getEast: () => -77, getNorth: () => -8 }
  }
  getCanvas() {
    const lienzo = document.createElement('canvas')
    lienzo.toDataURL = () => 'data:image/png;base64,AAAA'
    return lienzo
  }
  resize() {}
}

export const setWorkerUrl = vi.fn()

export class NavigationControl {}
export class ScaleControl {}

// dispara 'load' en los mapas creados: lo que el mapa real hace al terminar de cargar el estilo
export function cargarMapas() {
  for (const mapa of Map.todos) mapa.emitir('load')
}
