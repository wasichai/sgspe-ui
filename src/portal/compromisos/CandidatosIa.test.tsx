import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEF_COMPROMISO } from '../../test/compromisos'
import { baseDeIa, CANDIDATO_IA, EQUIPO_IA, GERENCIA_IA } from '../../test/ia'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { Candidatos } from './Candidatos'

// los candidatos de IA en S28 (flujo 7, ai-architecture.md §4.2 y §12.2): el texto y la cita re-identificados, el compromiso
// prellenado con los nombres legibles, nada se envía con un marcador y el responsable lo elige quien acepta
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const CON_RESERVADO = registro(
  'k3',
  { project: 'p1', proposed_text: 'Entregar víveres a [PERSONA]', ai_generated: true, confidence: 0.6, source_evidence: 'ev1', ai_interaction: 'ai1' },
  { state: 'proposed', createdAt: '2026-10-08T14:00:00Z', updatedAt: '2026-10-08T14:00:00Z' }
)

const ID_LARGO = '0b5d9d5e-1c2a-4f6e-9a47-3c8d2e1f7a90'
const CON_MARCADOR_AL_CORTE = registro(
  'k4',
  {
    project: 'p1',
    proposed_text: `${'a'.repeat(110)} [PERSONA:${ID_LARGO}] fin`,
    ai_generated: true,
    confidence: 0.6,
    source_evidence: 'ev1',
    ai_interaction: 'ai1'
  },
  { state: 'proposed', createdAt: '2026-10-08T13:00:00Z', updatedAt: '2026-10-08T13:00:00Z' }
)

const montarCandidatos = () => {
  fetch = mockFetch([
    { path: '/objects/commitment_candidate/records', body: pagina([CANDIDATO_IA, CON_RESERVADO, CON_MARCADOR_AL_CORTE]) },
    { path: /^\/objects\/commitment_candidate\/records\/k\d\/transitions$/, body: [] },
    { path: '/metadata/objects/commitment', body: DEF_COMPROMISO },
    { path: '/users', body: [{ id: 'u-gestora', email: 'gestora@sgspe.test', displayName: 'Gestora de prueba', enabled: true }] },
    ...baseDeIa()
  ])
  red = espiarRed([
    {
      method: 'POST',
      path: /^\/sgspe\/commitment-candidates\/k\d\/accept$/,
      responder: () => jsonResponse({ commitment: registro('c9', { project: 'p1' }, { state: 'draft' }), candidate: CANDIDATO_IA }, 201)
    }
  ])
  montar(<Candidatos proyecto="p1" />, { usuario: GERENCIA_IA, permisos: EQUIPO_IA })
}

describe('S28 · candidatos de IA', () => {
  it('el texto y la cita se re-identifican para quien lee los nombres y descarga el acta', async () => {
    montarCandidatos()
    const region = await screen.findByRole('region', { name: 'Candidatos a compromiso' })
    await waitFor(() => expect(within(region).getAllByText('Ana Ejemplo')).toHaveLength(2))
    expect(within(region).getAllByRole('link', { name: 'Abrir la fuente' })[0]).toHaveAttribute('href', '/r/evidence/ev1')
    expect(within(region).queryByText(/\[PERSONA:pe1\]/)).not.toBeInTheDocument()
  })

  it('revisar prellena con el nombre legible y manda el responsable elegido', async () => {
    montarCandidatos()
    await userEvent.click((await screen.findAllByRole('button', { name: 'Revisar' }))[0])
    const panel = await screen.findByRole('dialog')
    expect(await within(panel).findByLabelText('Descripción')).toHaveValue('Construir un reservorio pedido por Ana Ejemplo')
    expect(within(panel).getByText('La IA no propone un responsable: elíjalo usted.')).toBeInTheDocument()
    await userEvent.type(within(panel).getByLabelText('Código del compromiso'), 'C-020')
    await userEvent.type(within(panel).getByLabelText('Monto'), '100')
    await userEvent.selectOptions(await within(panel).findByLabelText('Responsable del compromiso'), 'u-gestora')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Revisado en el acta')
    await userEvent.click(within(panel).getByRole('button', { name: 'Aceptar y crear borrador' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitment-candidates/k1/accept')).toHaveLength(1))
    expect(red!.a('POST', '/sgspe/commitment-candidates/k1/accept')[0].cuerpo).toEqual({
      attributes: expect.objectContaining({
        code: 'C-020',
        title: 'Construir un reservorio pedido por Ana Ejemplo',
        description: 'Construir un reservorio pedido por Ana Ejemplo',
        owner_user_id: 'u-gestora',
        owner_user_email: 'gestora@sgspe.test'
      })
    })
  })

  it('un marcador sin reemplazar impide aceptar el candidato', async () => {
    montarCandidatos()
    await userEvent.click((await screen.findAllByRole('button', { name: 'Revisar' }))[1])
    const panel = await screen.findByRole('dialog')
    await userEvent.type(await within(panel).findByLabelText('Código del compromiso'), 'C-021')
    await userEvent.type(within(panel).getByLabelText('Monto'), '50')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Revisado')
    await userEvent.click(within(panel).getByRole('button', { name: 'Aceptar y crear borrador' }))
    expect(
      (
        await within(panel).findAllByText(
          'Reemplace los datos reservados (persona, documento, teléfono, correo u otro dato reservado) por lo que corresponda antes de aceptar.'
        )
      ).length
    ).toBeGreaterThan(0)
    expect(red!.a('POST', '/sgspe/commitment-candidates/k3/accept')).toHaveLength(0)
    await userEvent.clear(within(panel).getByLabelText('Título del compromiso'))
    await userEvent.type(within(panel).getByLabelText('Título del compromiso'), 'Entregar víveres a la junta')
    await userEvent.clear(within(panel).getByLabelText('Descripción'))
    await userEvent.type(within(panel).getByLabelText('Descripción'), 'Entregar víveres a la junta directiva')
    await userEvent.click(within(panel).getByRole('button', { name: 'Aceptar y crear borrador' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitment-candidates/k3/accept')).toHaveLength(1))
  })

  it('el título recortado no parte un marcador: lo deja entero y el formulario bloquea', async () => {
    montarCandidatos()
    await userEvent.click((await screen.findAllByRole('button', { name: 'Revisar' }))[2])
    const panel = await screen.findByRole('dialog')
    expect(await within(panel).findByLabelText('Título del compromiso')).toHaveValue(`${'a'.repeat(110)} [PERSONA:${ID_LARGO}]`)
    await userEvent.type(within(panel).getByLabelText('Código del compromiso'), 'C-022')
    await userEvent.type(within(panel).getByLabelText('Monto'), '50')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Revisado')
    await userEvent.click(within(panel).getByRole('button', { name: 'Aceptar y crear borrador' }))
    expect((await within(panel).findAllByText(/Reemplace los datos reservados/)).length).toBeGreaterThan(0)
    expect(red!.a('POST', '/sgspe/commitment-candidates/k4/accept')).toHaveLength(0)
  })
})
