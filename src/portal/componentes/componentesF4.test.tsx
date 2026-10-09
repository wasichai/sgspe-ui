import { screen } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WF_QUEJA } from '../../test/atencion'
import { montar } from '../../test/montar'
import { WF_ALERTA } from '../../test/riesgos'
import { aparienciaDe } from './apariencias'
import { EstadoChip } from './EstadoChip'
import { SituacionDePlazo } from './SituacionDePlazo'

// las piezas comunes de F4: la situación de revisión de un riesgo (review_status, RN-WFL-001) y los estados de WF-E1 a WF-E3, WF-F,
// WF-J y WF-M con tono e ícono, nunca solo color (design-system.md §4.1)
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('piezas comunes de F4', () => {
  it('la situación de revisión de un riesgo se dice con su nombre accesible y su tono', async () => {
    montar(
      <>
        <SituacionDePlazo valor="REVISION VENCIDA" revision />
        <SituacionDePlazo valor="POR REVISAR" revision />
      </>
    )
    expect(await screen.findByLabelText('Situación de revisión: REVISION VENCIDA')).toHaveClass('text-sg-danger')
    expect(screen.getByLabelText('Situación de revisión: POR REVISAR')).toHaveClass('text-sg-warning')
  })

  it('los estados de una queja y de una alerta llevan la etiqueta de su workflow', async () => {
    fetch = mockFetch([
      { path: '/objects/grievance/workflow', body: WF_QUEJA },
      { path: '/objects/early_warning/workflow', body: WF_ALERTA }
    ])
    montar(
      <>
        <EstadoChip objeto="grievance" estado="in_action" />
        <EstadoChip objeto="early_warning" estado="in_triage" />
      </>
    )
    expect(await screen.findByText('En atención')).toBeInTheDocument()
    expect(await screen.findByText('En triaje')).toBeInTheDocument()
  })

  it.each([
    ['grievance', 'rejected', 'final'],
    ['grievance', 'in_action', 'progress'],
    ['inquiry', 'referred', 'info'],
    ['stakeholder_request', 'declined', 'warning'],
    ['social_risk', 'mitigating', 'progress'],
    ['early_warning', 'detected', 'warning'],
    ['early_warning', 'dismissed', 'final'],
    ['incident', 'closed', 'final']
  ])('%s en %s tiene el tono %s', (objeto, estado, tono) => {
    expect(aparienciaDe(objeto, estado).tono).toBe(tono)
  })
})
