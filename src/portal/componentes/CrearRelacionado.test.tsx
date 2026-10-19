import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, pagina, registro } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { CrearRelacionado } from './CrearRelacionado'

// la revisión de UX, etapa 5: las altas que nacen de un registro, juntas en «Crear relacionado», solo las que la cuenta puede
// crear en el proyecto
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const ACCIONES = [
  { objeto: 'commitment', etiqueta: 'Registrar compromiso', a: '/projects/p1/commitments/new?origin_engagement=e1' },
  { objeto: 'grievance', etiqueta: 'Registrar queja', a: '/projects/p1/attention/new?origin_engagement=e1' }
]
const asignada = [registro('a1', { project: 'p1', member_user_id: RELACIONISTA.id, active: true, start_date: '2026-01-01' })]
const abrir = (p: ReturnType<typeof permisos>) =>
  montar(<CrearRelacionado proyecto="p1" acciones={ACCIONES} />, { ruta: '/projects/p1/engagements/e1', usuario: RELACIONISTA, permisos: p })

describe('CrearRelacionado', () => {
  it('reúne las altas que la cuenta puede crear, con lo ya sabido en la ruta', async () => {
    fetch = mockFetch([{ path: '/objects/project_assignment/records', body: pagina(asignada) }])
    abrir(permisos({ commitment: ['READ', 'CREATE'], grievance: ['READ'], project_assignment: ['READ'] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Crear relacionado' }))
    const menu = screen.getByRole('group', { name: 'Crear relacionado' })
    expect(menu).toContainElement(screen.getByRole('link', { name: 'Registrar compromiso' }))
    expect(screen.getByRole('link', { name: 'Registrar compromiso' })).toHaveAttribute('href', '/projects/p1/commitments/new?origin_engagement=e1')
    expect(screen.queryByRole('link', { name: 'Registrar queja' })).not.toBeInTheDocument()
  })

  it('sin una asignación vigente al proyecto, o sin nada que pueda crear, no se dibuja', async () => {
    fetch = mockFetch([{ path: '/objects/project_assignment/records', body: pagina([]) }])
    abrir(permisos({ commitment: ['READ', 'CREATE'], project_assignment: ['READ'] }))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: 'Crear relacionado' })).not.toBeInTheDocument()
  })
})
