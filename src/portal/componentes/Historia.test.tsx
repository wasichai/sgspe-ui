import { screen, within } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { definicion, montar, workflow } from '../../test/montar'
import { Historia } from './Historia'

// la actividad de un registro, legible (tercera pasada de UX, 1.9): la fecha con su hora, la persona, un cambio de estado de dónde a
// dónde con las etiquetas del flujo y, de los demás campos, cuáles cambiaron con su etiqueta; el motivo al final
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const WF = workflow('grievance', [
  ['acknowledged', 'Acusada'],
  ['in_action', 'En atención']
])

describe('Historia', () => {
  it('dice el cambio de estado con las etiquetas del flujo y los demás campos por su etiqueta', async () => {
    fetch = mockFetch([
      { path: '/objects/grievance/workflow', body: WF },
      { path: '/metadata/objects/grievance', body: definicion('grievance', [['resolution', { label: 'Resolución' }]]) },
      {
        path: '/objects/grievance/records/q1/history',
        body: [
          {
            id: 'h1',
            userEmail: 'gestora@sgspe.test',
            operation: 'UPDATE',
            occurredAt: '2026-10-02T15:12:00Z',
            reason: 'Se coordina con la contratista',
            changes: [
              { field: 'state', before: 'acknowledged', after: 'in_action' },
              { field: 'resolution', before: null, after: 'Turno rotativo' }
            ]
          }
        ]
      }
    ])
    montar(<Historia objeto="grievance" id="q1" vacio="Sin actividad" />)
    const entrada = (await screen.findByText(/gestora@sgspe\.test/)).closest('li') as HTMLElement
    expect(await within(entrada).findByText(/el estado: «Acusada» → «En atención»/)).toBeInTheDocument()
    expect(entrada).toHaveTextContent('(Resolución)')
    expect(entrada).toHaveTextContent('— Se coordina con la contratista')
    // la hora de Lima, no solo el día
    expect(entrada).toHaveTextContent('10:12')
    // el valor de un campo no se copia en la actividad
    expect(entrada).not.toHaveTextContent('Turno rotativo')
  })
})
