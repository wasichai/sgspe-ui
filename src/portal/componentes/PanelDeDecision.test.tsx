import { screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, workflow } from '../../test/montar'
import { PanelDeDecision } from './PanelDeDecision'

// design-system.md §6.1: cuatro tarjetas fijas que responden sin buscar: el estado actual (desde cuándo y quién), la
// siguiente acción (con lo que falta para darla), el responsable y el vencimiento con su situación de plazo
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})
const WF = workflow('commitment', [
  ['draft', 'Borrador'],
  ['approved', 'Aprobado']
])
const tarjeta = (nombre: string) => screen.getByRole('group', { name: nombre })

describe('PanelDeDecision', () => {
  it('dibuja las cuatro tarjetas con lo que llega', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    montar(
      <PanelDeDecision
        objeto="commitment"
        estado="approved"
        desde="2026-10-02T15:00:00Z"
        siguiente={{ etiqueta: 'Registrar el cumplimiento', falta: 'Falta una entrega con conformidad' }}
        responsable={null}
        vencimiento="2026-11-30"
        situacion="POR VENCER"
      />
    )
    expect(screen.getByRole('region', { name: 'Situación' })).toBeInTheDocument()
    expect(await within(tarjeta('Estado actual')).findByText('Aprobado')).toBeInTheDocument()
    expect(within(tarjeta('Estado actual')).getByText('Desde', { exact: false })).toHaveTextContent('Desde 2 oct. 2026')
    expect(within(tarjeta('Estado actual')).queryByText('Por', { exact: false })).not.toBeInTheDocument()
    expect(within(tarjeta('Siguiente acción')).getByText('Registrar el cumplimiento')).toBeInTheDocument()
    expect(within(tarjeta('Siguiente acción')).getByText('Falta una entrega con conformidad')).toBeInTheDocument()
    expect(within(tarjeta('Responsable')).getByText('Sin responsable')).toBeInTheDocument()
    expect(within(tarjeta('Vencimiento')).getByText('30 nov. 2026')).toBeInTheDocument()
    expect(within(tarjeta('Vencimiento')).getByLabelText('Situación de plazo: Por vencer')).toBeInTheDocument()
  })

  it('sin siguiente acción ni vencimiento lo dice; «desde» que no llegó es «—»', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    montar(<PanelDeDecision objeto="commitment" estado="draft" siguiente={null} responsable={null} vencimiento={null} />)
    expect(await within(tarjeta('Estado actual')).findByText('Borrador')).toBeInTheDocument()
    expect(within(tarjeta('Estado actual')).getByText('Desde', { exact: false })).toHaveTextContent('Desde —')
    expect(within(tarjeta('Siguiente acción')).getByText('Nada pendiente')).toBeInTheDocument()
    expect(within(tarjeta('Vencimiento')).getByText('Sin fecha límite')).toBeInTheDocument()
  })
})
