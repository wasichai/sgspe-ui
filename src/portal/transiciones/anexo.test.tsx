import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ENTREGABLE, transicion } from '../../test/f8'
import { montar, pagina } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { BotonesDeTransicion } from './BotonesDeTransicion'

// el anexo del motivo (decisión 13 del plan 8.3): lo que la pantalla agrega al motivo que escribe la persona, a la vista antes de
// confirmar
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

describe('el anexo del motivo', () => {
  it('se muestra y se agrega al motivo de la transición', async () => {
    fetch = mockFetch([
      { path: '/objects/deliverable/records/d1/transitions', body: [transicion('approve', 'Aprobar', 'approved', 'Aprobado')] },
      { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } },
      {
        path: '/objects/deliverable/workflow',
        body: { id: 'wf', objectName: 'deliverable', name: 'x', label: 'x', enabled: true, definition: { states: [], transitions: [] } }
      },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    red = espiarRed([{ method: 'POST', path: '/objects/deliverable/records/d1/transitions/approve', responder: () => jsonResponse(ENTREGABLE) }])
    montar(<BotonesDeTransicion objeto="deliverable" registro={ENTREGABLE} anexos={{ approve: 'Modelo revisado SHA-256 abc' }} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }))
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText('Se agrega al motivo: Modelo revisado SHA-256 abc')).toBeInTheDocument()
    await userEvent.type(within(dialogo).getByRole('textbox'), 'Revisado')
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/deliverable/records/d1/transitions/approve')).toHaveLength(1))
    expect(red!.a('POST', '/objects/deliverable/records/d1/transitions/approve')[0].cabeceras.get('X-Change-Reason')).toBe(
      `UTF-8''${encodeURIComponent('Revisado · Modelo revisado SHA-256 abc')}`
    )
  })

  it('con anexo, el motivo más el anexo no pasan de 500 caracteres', async () => {
    const anexo = 'Modelo revisado SHA-256 abc'
    fetch = mockFetch([
      { path: '/objects/deliverable/records/d1/transitions', body: [transicion('approve', 'Aprobar', 'approved', 'Aprobado')] },
      { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } },
      {
        path: '/objects/deliverable/workflow',
        body: { id: 'wf', objectName: 'deliverable', name: 'x', label: 'x', enabled: true, definition: { states: [], transitions: [] } }
      },
      { path: '/objects/project_assignment/records', body: pagina([]) }
    ])
    red = espiarRed([{ method: 'POST', path: '/objects/deliverable/records/d1/transitions/approve', responder: () => jsonResponse(ENTREGABLE) }])
    montar(<BotonesDeTransicion objeto="deliverable" registro={ENTREGABLE} anexos={{ approve: anexo }} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }))
    const dialogo = screen.getByRole('dialog')
    const caja = within(dialogo).getByRole('textbox')
    await userEvent.click(caja)
    await userEvent.paste('a'.repeat(600))
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/deliverable/records/d1/transitions/approve')).toHaveLength(1))
    const enviado = decodeURIComponent(
      red!.a('POST', '/objects/deliverable/records/d1/transitions/approve')[0].cabeceras.get('X-Change-Reason')!.replace("UTF-8''", '')
    )
    expect(enviado.length).toBe(500)
    expect(enviado.endsWith(` · ${anexo}`)).toBe(true)
  })
})
