import { screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { caminoDe, CaminoDelFlujo } from './CaminoDelFlujo'

// design-system.md §6.1 (WorkflowStepper): el camino del workflow con el estado actual marcado, los pasos cumplidos y los
// pendientes, y los cierres que no son el camino (cancelado, rechazado) aparte. compacto y sin animación
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const estado = (name: string, label: string, type: 'INITIAL' | 'INTERMEDIATE' | 'FINAL' = 'INTERMEDIATE') => ({ name, label, type })
const tr = (from: string, to: string) => ({ name: `${from}-${to}`, label: to, from, to, roles: [] })
const DEFINICION = {
  states: [
    estado('cancelled', 'Cancelado', 'FINAL'),
    estado('draft', 'Borrador', 'INITIAL'),
    estado('approved', 'Aprobado'),
    estado('in_progress', 'En ejecución'),
    estado('verified', 'Verificado', 'FINAL'),
    estado('fulfilled', 'Cumplido')
  ],
  transitions: [
    tr('draft', 'cancelled'),
    tr('draft', 'approved'),
    tr('approved', 'in_progress'),
    tr('in_progress', 'fulfilled'),
    tr('fulfilled', 'verified'),
    tr('fulfilled', 'in_progress'),
    tr('in_progress', 'cancelled')
  ]
}
const WF = { id: 'wf', objectName: 'commitment', name: 'commitment', label: 'commitment', enabled: true, definition: DEFINICION }

describe('caminoDe', () => {
  it('ordena los estados desde el inicial por sus transiciones y deja aparte los cierres fuera del camino', () => {
    expect(caminoDe(DEFINICION)).toEqual({ camino: ['draft', 'approved', 'in_progress', 'fulfilled', 'verified'], otros: ['cancelled'] })
  })

  it('sin transiciones, el camino sigue el orden de los estados; los cierres van aparte', () => {
    const sinTransiciones = { states: DEFINICION.states, transitions: [] }
    expect(caminoDe(sinTransiciones)).toEqual({ camino: ['draft', 'approved', 'in_progress', 'fulfilled'], otros: ['cancelled', 'verified'] })
  })

  it('el estado actual siempre está: si el recorrido no lo alcanza, se agrega al camino', () => {
    const suelto = { states: [...DEFINICION.states, estado('blocked', 'Bloqueado')], transitions: DEFINICION.transitions }
    expect(caminoDe(suelto, undefined, 'blocked').camino).toContain('blocked')
  })

  it('un camino dado por la ficha manda; los cierres que no nombra van aparte', () => {
    expect(caminoDe(DEFINICION, ['draft', 'approved', 'verified'])).toEqual({ camino: ['draft', 'approved', 'verified'], otros: ['cancelled'] })
  })
})

describe('CaminoDelFlujo', () => {
  it('marca los pasos cumplidos, el actual y los pendientes', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    montar(<CaminoDelFlujo objeto="commitment" estado="in_progress" />)
    const camino = await screen.findByRole('list', { name: 'Camino del flujo' })
    const pasos = within(camino).getAllByRole('listitem')
    expect(pasos.map((p) => p.textContent)).toEqual([
      'Paso cumplido: Borrador',
      'Paso cumplido: Aprobado',
      'Estado actual: En ejecución',
      'Paso pendiente: Cumplido',
      'Paso pendiente: Verificado'
    ])
    expect(pasos[2]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Otros cierres:', { exact: false })).toHaveTextContent('Otros cierres: Cancelado')
  })

  it('en un cierre fuera del camino, lo marca allí como el estado actual', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    montar(<CaminoDelFlujo objeto="commitment" estado="cancelled" />)
    await screen.findByRole('list', { name: 'Camino del flujo' })
    expect(screen.getByText('Cancelado')).toHaveAttribute('aria-current', 'step')
  })

  it('sin workflow todavía no dibuja nada', () => {
    fetch = mockFetch([])
    const { container } = montar(<CaminoDelFlujo objeto="commitment" estado="draft" />)
    expect(container).toBeEmptyDOMElement()
  })
})
