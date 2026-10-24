import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, registro, workflow } from '../../test/montar'
import { BotonesDeTransicion } from './BotonesDeTransicion'

// rediseño de UX (2026-10-20): en el encabezado de una ficha, una sola acción primaria, la misma «Siguiente acción» del panel de
// decisión; las demás transiciones, las acciones poco frecuentes de la ficha y las destructivas (al final) van en «Más
// acciones». la ficha de una queja tenía seis botones del mismo peso, y en el teléfono ocupaban un cuarto de la pantalla
let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const QUEJA = registro('g1', { code: 'QJ-001' }, { state: 'received' })
const WF = workflow('grievance', [
  ['received', 'Recibida'],
  ['acknowledged', 'Acusada'],
  ['rejected', 'Rechazada'],
  ['withdrawn', 'Desistida'],
  ['cancelled', 'Anulada']
])
// el orden de la API no es el del camino: «Rechazar» llega primero
const TRANSICIONES = [
  { name: 'reject', label: 'Rechazar', to: 'rejected', toLabel: 'Rechazada', allowed: true, reason: null },
  { name: 'acknowledge', label: 'Acusar recibo', to: 'acknowledged', toLabel: 'Acusada', allowed: true, reason: null },
  { name: 'void', label: 'Anular', to: 'cancelled', toLabel: 'Anulada', allowed: true, reason: null },
  { name: 'withdraw', label: 'Registrar desistimiento', to: 'withdrawn', toLabel: 'Desistida', allowed: true, reason: null }
]

function iniciar(comprobacion: unknown = { allowed: true, blocking: [], warnings: [] }) {
  fetch = mockFetch([
    { path: '/objects/grievance/workflow', body: WF },
    { path: '/objects/grievance/records/g1/transitions', body: TRANSICIONES },
    { method: 'POST', path: '/sgspe/transition-checks', body: comprobacion }
  ])
}

const menu = () => screen.getByRole('group', { name: 'Más acciones' })

describe('transiciones agrupadas del encabezado de una ficha', () => {
  it('la primaria es la del camino, no la primera de la API; las demás quedan en «Más acciones»', async () => {
    iniciar()
    montar(<BotonesDeTransicion agrupadas objeto="grievance" registro={QUEJA} />)
    expect(await screen.findByRole('button', { name: 'Acusar recibo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    const nombres = within(menu())
      .getAllByRole('button')
      .map((b) => b.textContent)
    // las destructivas al final, nombrando el objeto
    expect(nombres).toEqual(['Rechazar', 'Registrar desistimiento', 'Anular'])
  })

  it('las acciones poco frecuentes de la ficha van en el mismo menú, antes de las destructivas', async () => {
    iniciar()
    montar(<BotonesDeTransicion agrupadas objeto="grievance" registro={QUEJA} mas={<button type="button">Reclasificar…</button>} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
    const nombres = within(menu())
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(nombres).toEqual(['Rechazar', 'Registrar desistimiento', 'Reclasificar…', 'Anular'])
  })

  it('una transición bloqueada dice a la vista, dentro del menú, por qué no se puede', async () => {
    iniciar({ allowed: false, blocking: [{ code: 'X', message: 'Falta la respuesta al reclamante', field: null }], warnings: [] })
    montar(<BotonesDeTransicion agrupadas objeto="grievance" registro={QUEJA} comprobarAntes={['reject']} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
    const rechazar = within(menu()).getByRole('button', { name: 'Rechazar' })
    await waitFor(() => expect(rechazar).toBeDisabled())
    expect(within(menu()).getByText('Falta la respuesta al reclamante')).toBeVisible()
    expect(rechazar).toHaveAccessibleDescription('Falta la respuesta al reclamante')
  })

  it('elegir una del menú lo cierra y abre su diálogo', async () => {
    iniciar()
    montar(<BotonesDeTransicion agrupadas objeto="grievance" registro={QUEJA} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
    await userEvent.click(within(menu()).getByRole('button', { name: 'Rechazar' }))
    expect(screen.queryByRole('group', { name: 'Más acciones' })).not.toBeInTheDocument()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('con la primaria de la ficha (sinPrimaria), la del camino queda a la vista como secundaria', async () => {
    iniciar()
    montar(<BotonesDeTransicion agrupadas sinPrimaria objeto="grievance" registro={QUEJA} />)
    const acusar = await screen.findByRole('button', { name: 'Acusar recibo' })
    expect(acusar.closest('[role="group"][aria-label="Más acciones"]')).toBeNull()
  })

  it('sin transiciones pero con acciones de la ficha, igual ofrece el menú', async () => {
    fetch = mockFetch([
      { path: '/objects/grievance/workflow', body: WF },
      { path: '/objects/grievance/records/g1/transitions', body: [] }
    ])
    montar(<BotonesDeTransicion agrupadas objeto="grievance" registro={QUEJA} mas={<button type="button">Reclasificar…</button>} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Más acciones' }))
    expect(within(menu()).getByRole('button', { name: 'Reclasificar…' })).toBeInTheDocument()
  })
})
