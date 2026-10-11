import { screen } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WF_APORTE, WF_PROGRAMA } from '../../test/inversion'
import { montar } from '../../test/montar'
import { aparienciaDe } from './apariencias'
import { EstadoChip } from './EstadoChip'

// las piezas comunes de F5: los estados de WF-G y WF-P con tono e ícono, nunca solo color (design-system.md §4.1)
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('piezas comunes de F5', () => {
  it('los estados de un aporte y de un programa llevan la etiqueta de su workflow', async () => {
    fetch = mockFetch([
      { path: '/objects/social_contribution/workflow', body: WF_APORTE },
      { path: '/objects/social_program/workflow', body: WF_PROGRAMA }
    ])
    montar(
      <>
        <EstadoChip objeto="social_contribution" estado="procured" />
        <EstadoChip objeto="social_program" estado="monitoring" />
      </>
    )
    expect(await screen.findByText('Adquirido')).toBeInTheDocument()
    expect(await screen.findByText('En monitoreo')).toBeInTheDocument()
  })

  it.each([
    ['social_contribution', 'requested', 'neutral'],
    ['social_contribution', 'procured', 'progress'],
    ['social_contribution', 'delivered', 'success'],
    ['social_contribution', 'rejected', 'final'],
    ['social_program', 'pending_approval', 'info'],
    ['social_program', 'executing', 'progress'],
    ['social_program', 'suspended', 'warning'],
    ['social_program', 'cancelled', 'final']
  ])('%s · %s tiene el tono %s', (objeto, estado, tono) => {
    expect(aparienciaDe(objeto, estado).tono).toBe(tono)
  })
})
