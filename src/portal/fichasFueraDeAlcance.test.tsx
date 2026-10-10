import { screen } from '@testing-library/react'
import { mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar } from '../test/montar'
import { FichaAcuerdoPage } from './acuerdos/FichaAcuerdoPage'
import { FichaEvidenciaPage } from './documentos/FichaEvidenciaPage'
import { FichaGrupoPage } from './grupos/FichaGrupoPage'
import { AreaDeInfluenciaPage } from './proyectos/AreaDeInfluenciaPage'
import { EditorDeActaPage } from './relacionamiento/EditorDeActaPage'
import { FichaInteraccionPage } from './relacionamiento/FichaInteraccionPage'
import { VisitaDeCampoPage } from './relacionamiento/VisitaDeCampoPage'
import { AprobacionPage } from './tareas/AprobacionPage'

vi.mock('./graficos/Grafico', () => import('../test/graficoFalso'))
vi.mock('./mapa/Mapa', () => import('../test/mapaFalso'))

// el alcance de lectura por proyecto (ADR-0029, spec 4.4 §3.6 y §3.12): la ficha de un registro de otro proyecto responde 404
// como la de uno que no existe, y el portal no los distingue. sin «Reintentar», que no sirve, ni el detalle en inglés
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const ILEGIBLE: MockRoute = {
  path: /^\/objects\/[a-z_]+\/records\/r9$/,
  status: 404,
  body: { title: 'Not Found', status: 404, detail: 'Record r9 does not exist', errors: [] }
}

const FICHAS: [string, ComponentType, string, string, MockRoute[]][] = [
  ['acuerdo', FichaAcuerdoPage, '/projects/p1/agreements/r9', '/projects/:projectId/agreements/:agreementId', []],
  ['evidencia', FichaEvidenciaPage, '/projects/p1/documents/r9', '/projects/:projectId/documents/:documentId', []],
  ['grupo de interés', FichaGrupoPage, '/projects/p1/stakeholders/r9', '/projects/:projectId/stakeholders/:stakeholderId', []],
  ['interacción', FichaInteraccionPage, '/projects/p1/engagements/r9', '/projects/:projectId/engagements/:engagementId', []],
  [
    'acta',
    EditorDeActaPage,
    '/projects/p1/engagements/r9/minutes',
    '/projects/:projectId/engagements/:engagementId/minutes',
    [{ path: '/metadata/objects/engagement', body: definicion('engagement', ['title']) }]
  ],
  ['aprobación', AprobacionPage, '/tasks/approvals/commitment/r9', '/tasks/approvals/:object/:recordId', []],
  ['área de influencia', AreaDeInfluenciaPage, '/projects/p1/areas/r9', '/projects/:projectId/areas/:areaId', []],
  ['visita de campo', VisitaDeCampoPage, '/projects/p1/field-visits/r9', '/projects/:projectId/field-visits/:visitId', []]
]

describe('fichas de un registro que la cuenta no lee', () => {
  it.each(FICHAS)('la ficha de %s que responde 404 dice que no existe o no es de sus proyectos, sin reintento', async (_ficha, Ficha, ruta, camino, extra) => {
    fetch = mockFetch([...extra, ILEGIBLE])
    montar(<Ficha />, { ruta, camino })
    expect(await screen.findByText('El registro no existe o no es de sus proyectos.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.queryByText(/does not exist/)).not.toBeInTheDocument()
  })
})
