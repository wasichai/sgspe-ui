import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { montar, pagina, workflow } from '../../test/montar'
import { PanelDeDecision } from './PanelDeDecision'

// design-system.md §6.1: cuatro tarjetas fijas que responden sin buscar: el estado actual (desde cuándo y quién), la
// siguiente acción (con lo que falta para darla), el responsable y el vencimiento con su situación de plazo
let fetch: FetchMock | null = null
afterEach(() => {
  vi.useRealTimers()
  fetch?.restore()
  fetch = null
})
const WF = workflow('commitment', [
  ['draft', 'Borrador'],
  ['approved', 'Aprobado']
])
const tarjeta = (nombre: string) => screen.getByRole('group', { name: nombre })

describe('PanelDeDecision', () => {
  // tercera pasada de UX (1.2): lo que el diálogo del paso pedirá no es una falta: se dice en tono neutro, sin bloquear
  it('dice los datos que el paso pedirá, en tono neutro', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    montar(
      <PanelDeDecision
        objeto="commitment"
        estado="approved"
        siguiente={{ etiqueta: 'Resolver', pide: ['Resolución', 'Respuesta'] }}
        responsable={null}
        vencimiento={null}
      />
    )
    const pide = within(tarjeta('Siguiente acción')).getByText('Al darla se le pedirán «Resolución» y «Respuesta».')
    expect(pide).toHaveClass('text-sg-text-muted')
    expect(pide).not.toHaveClass('text-sg-warning')
    await within(tarjeta('Estado actual')).findByText('Aprobado')
  })

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

  // rediseño de UX (2026-10-20): «Desde —» no decía nada; un registro anterior a state_changed_at no lo tiene
  it('sin siguiente acción ni vencimiento lo dice; sin «desde», la línea no se dibuja', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    montar(<PanelDeDecision objeto="commitment" estado="draft" siguiente={null} responsable={null} vencimiento={null} />)
    expect(await within(tarjeta('Estado actual')).findByText('Borrador')).toBeInTheDocument()
    expect(within(tarjeta('Estado actual')).queryByText('Desde', { exact: false })).not.toBeInTheDocument()
    // tercera pasada de UX (1.4): fuera de un estado final, sin una acción suya, el paso lo da otra persona; nunca «Nada pendiente»
    expect(within(tarjeta('Siguiente acción')).getByText('El siguiente paso lo da otra persona.')).toBeInTheDocument()
    expect(within(tarjeta('Siguiente acción')).queryByText('Nada pendiente')).not.toBeInTheDocument()
    expect(within(tarjeta('Vencimiento')).getByText('Sin fecha límite')).toBeInTheDocument()
  })

  // tercera pasada de UX (1.7, DD-35): el vencimiento también en relativo, con la fecha exacta en <time>, mientras el plazo corre
  it('dice cuándo vence desde hoy mientras el plazo corre; sin situación (un plazo que ya no corre), solo la fecha', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-28T15:00:00Z') })
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    const { unmount } = montar(
      <PanelDeDecision objeto="commitment" estado="approved" siguiente={null} responsable={null} vencimiento="2026-11-02" situacion="POR VENCER" />
    )
    const tarjetaDeVencimiento = tarjeta('Vencimiento')
    expect(within(tarjetaDeVencimiento).getByText('2 nov. 2026').closest('time')).toHaveAttribute('dateTime', '2026-11-02')
    expect(within(tarjetaDeVencimiento).getByText('vence en 5 días')).toBeInTheDocument()
    unmount()
    montar(<PanelDeDecision objeto="commitment" estado="approved" siguiente={null} responsable={null} vencimiento="2026-10-01" />)
    expect(within(tarjeta('Vencimiento')).queryByText(/venció/)).not.toBeInTheDocument()
  })

  it('en días hábiles, el que el backend cuenta así', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-28T15:00:00Z') })
    fetch = mockFetch([{ path: '/objects/grievance/workflow', body: WF }])
    montar(
      <PanelDeDecision
        objeto="grievance"
        estado="received"
        siguiente={null}
        responsable={null}
        vencimiento="2026-10-23"
        situacion="VENCIDO"
        vencimientoEnHabiles
      />
    )
    expect(within(tarjeta('Vencimiento')).getByText('venció hace 3 días hábiles')).toBeInTheDocument()
  })

  // tercera pasada de UX (1.8): un objeto sin responsable ni plazo (un aporte, un incidente) no dibuja esas tarjetas vacías; un dato
  // que existe y está vacío sí se dice («Sin responsable» importa en un compromiso)
  it('sin responsable ni vencimiento en el objeto, no dibuja esas tarjetas', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    montar(<PanelDeDecision objeto="commitment" estado="draft" siguiente={null} />)
    await within(tarjeta('Estado actual')).findByText('Borrador')
    expect(screen.queryByRole('group', { name: 'Responsable' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Vencimiento' })).not.toBeInTheDocument()
    expect(screen.queryByText('Sin responsable')).not.toBeInTheDocument()
  })

  it('«Nada pendiente» solo en un estado final', async () => {
    const final = { ...WF, definition: { ...WF.definition, states: [...WF.definition.states, { name: 'closed', label: 'Cerrado', type: 'FINAL' }] } }
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: final }])
    montar(<PanelDeDecision objeto="commitment" estado="closed" siguiente={null} responsable={null} vencimiento={null} />)
    expect(await within(tarjeta('Siguiente acción')).findByText('Nada pendiente')).toBeInTheDocument()
  })

  it('con el proyecto, la siguiente acción dice que le toca a quien mira', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    montar(<PanelDeDecision objeto="commitment" estado="draft" proyecto="p1" siguiente={{ etiqueta: 'Enviar' }} responsable={null} vencimiento={null} />)
    expect(await within(tarjeta('Siguiente acción')).findByText('Le toca a usted.')).toBeInTheDocument()
  })

  it('sin asignación vigente al proyecto, dice que no está asignado en vez de «le toca a usted»', async () => {
    fetch = mockFetch([
      { path: '/objects/commitment/workflow', body: WF },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    montar(<PanelDeDecision objeto="commitment" estado="draft" proyecto="p1" siguiente={{ etiqueta: 'Enviar' }} responsable={null} vencimiento={null} />, {
      permisos: { admin: false, objects: { commitment: ['READ'], project_assignment: ['READ'] } }
    })
    expect(await within(tarjeta('Siguiente acción')).findByText('Usted no está asignado a este proyecto: la da quien lo esté.')).toBeInTheDocument()
    expect(within(tarjeta('Siguiente acción')).queryByText('Le toca a usted.')).not.toBeInTheDocument()
  })

  // DD-06 (U-25): el panel es el único lugar del estado, con el camino del flujo plegado dentro de «Estado actual»
  it('pliega el camino del flujo dentro de «Estado actual» y lo despliega con el teclado', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    montar(<PanelDeDecision objeto="commitment" estado="approved" camino={['draft', 'approved']} siguiente={null} responsable={null} vencimiento={null} />)
    const estado = tarjeta('Estado actual')
    await within(estado).findByText('Aprobado')
    expect(document.querySelectorAll('[data-estado]')).toHaveLength(1)
    const ver = within(estado).getByRole('button', { name: 'Ver el camino' })
    expect(ver).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Camino del flujo' })).not.toBeInTheDocument()
    ver.focus()
    await userEvent.keyboard('{Enter}')
    expect(ver).toHaveAttribute('aria-expanded', 'true')
    const camino = within(estado).getByRole('list', { name: 'Camino del flujo' })
    expect(within(camino).getByText('Aprobado').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(document.querySelectorAll('[data-estado]')).toHaveLength(1)
    await userEvent.keyboard(' ')
    expect(ver).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Camino del flujo' })).not.toBeInTheDocument()
  })

  it('sin camino no ofrece desplegarlo', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: WF }])
    montar(<PanelDeDecision objeto="commitment" estado="draft" siguiente={null} responsable={null} vencimiento={null} />)
    await within(tarjeta('Estado actual')).findByText('Borrador')
    expect(screen.queryByRole('button', { name: 'Ver el camino' })).not.toBeInTheDocument()
  })
})
