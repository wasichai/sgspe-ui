import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import type { CallerPermissions } from '@wasichai/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  baseDeIa,
  EQUIPO_IA,
  ESTADO_SIN_ORGANIZACION,
  GERENCIA_IA,
  SUG_ACTOR,
  SUG_CLASIFICACION,
  SUG_ILEGIBLE,
  TRANSICIONES_DE_SUGERENCIA
} from '../../test/ia'
import { montar, pagina, registro } from '../../test/montar'
import { permisos } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import { AceptarSugerencia } from './AceptarSugerencia'
import { BandejaDeIaPage } from './BandejaDeIaPage'

// aceptar con corrección y motivo (ai-architecture.md §4.2, screens.md S52): se escribe lo revisado, nunca un marcador; una
// persona nueva la acepta quien escribe sus nombres; aceptar funciona sin la IA activada (api.md §4.14)
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const SUG_CLAUSULA = registro(
  's10',
  {
    project: 'p1',
    suggestion_kind: 'EXTRACCION',
    target_object: 'agreement',
    target_record_id: 'a1',
    suggested_value: JSON.stringify({
      item: 'clause',
      clause_number: '5',
      clause_text: 'El proyecto contratará a [PERSONA] como vigía',
      creates_commitment: true
    }),
    confidence: 0.6,
    model: 'claude-ejemplo',
    ai_interaction: 'ai1'
  },
  { state: 'proposed', updatedAt: '2026-10-09T18:00:00Z' }
)
const aceptacion = (id: string) => `/sgspe/ai-suggestions/${id}/accept`
const aceptada = (s: { id: string }) => () => jsonResponse({ suggestion: { ...s, state: 'accepted' }, result: null })

const montarDrawer = (sugerencia: typeof SUG_CLASIFICACION, permisosDe: CallerPermissions = EQUIPO_IA, extra: MockRoute[] = []) => {
  fetch = mockFetch([...extra, { path: '/objects/locality/records/l1', body: registro('l1', { name: 'Localidad Ejemplo' }) }, ...baseDeIa()])
  const alCerrar = vi.fn()
  return { alCerrar, montarlo: () => montar(<AceptarSugerencia sugerencia={sugerencia} alCerrar={alCerrar} />, { usuario: GERENCIA_IA, permisos: permisosDe }) }
}

describe('S52 · aceptar una sugerencia', () => {
  it('acepta una clasificación con corrección y motivo, aunque la organización no tenga la IA activada', async () => {
    fetch = mockFetch([
      { path: '/objects/ai_suggestion/records', body: pagina([SUG_CLASIFICACION]) },
      { path: '/objects/commitment_candidate/records', body: pagina([]) },
      { path: '/objects/ai_suggestion/records/s1/transitions', body: TRANSICIONES_DE_SUGERENCIA },
      ...baseDeIa(ESTADO_SIN_ORGANIZACION)
    ])
    red = espiarRed([{ method: 'POST', path: aceptacion('s1'), responder: aceptada(SUG_CLASIFICACION) }])
    montar(<BandejaDeIaPage />, { ruta: '/projects/p1/ai-review', camino: '/projects/:projectId/ai-review', usuario: GERENCIA_IA, permisos: EQUIPO_IA })
    await userEvent.click(await screen.findByRole('button', { name: 'Aceptar…' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la propuesta' })
    await userEvent.selectOptions(await within(dialogo).findByLabelText('Categoría'), 'EMPLEO')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }))
    expect(within(dialogo).getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('POST', aceptacion('s1'))).toHaveLength(0)
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'La queja es de empleo')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(red!.a('POST', aceptacion('s1'))).toHaveLength(1))
    const [llamada] = red.a('POST', aceptacion('s1'))
    expect(llamada.cuerpo).toEqual({ attributes: { field: 'category', value: 'EMPLEO' } })
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-09T15:00:00Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''La%20queja%20es%20de%20empleo")
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Aceptar la propuesta' })).not.toBeInTheDocument())
  })

  it('Aceptar… solo con la transición accept permitida y una fila de la lista cerrada', async () => {
    fetch = mockFetch([
      { path: '/objects/ai_suggestion/records', body: pagina([SUG_CLASIFICACION, SUG_ILEGIBLE]) },
      { path: '/objects/commitment_candidate/records', body: pagina([]) },
      { path: '/objects/ai_suggestion/records/s1/transitions', body: TRANSICIONES_DE_SUGERENCIA.filter((tr) => tr.name !== 'accept') },
      { path: '/objects/ai_suggestion/records/s6/transitions', body: TRANSICIONES_DE_SUGERENCIA },
      ...baseDeIa()
    ])
    montar(<BandejaDeIaPage />, { ruta: '/projects/p1/ai-review', camino: '/projects/:projectId/ai-review', usuario: GERENCIA_IA, permisos: EQUIPO_IA })
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Rechazar' })).toHaveLength(2))
    expect(screen.queryByRole('button', { name: 'Aceptar…' })).not.toBeInTheDocument()
  })

  it('aceptar una extracción con un marcador en el texto no envía nada hasta reemplazarlo', async () => {
    const { alCerrar, montarlo } = montarDrawer(SUG_CLAUSULA)
    red = espiarRed([{ method: 'POST', path: aceptacion('s10'), responder: aceptada(SUG_CLAUSULA) }])
    montarlo()
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la propuesta' })
    expect(within(dialogo).getByLabelText('Texto de la cláusula')).toHaveValue('El proyecto contratará a [PERSONA] como vigía')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Cláusula 5 del convenio')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }))
    expect(
      within(dialogo).getByText(
        'Reemplace los datos reservados (persona, documento, teléfono, correo u otro dato reservado) por lo que corresponda antes de aceptar.'
      )
    ).toBeInTheDocument()
    expect(red.a('POST', aceptacion('s10'))).toHaveLength(0)
    await userEvent.clear(within(dialogo).getByLabelText('Texto de la cláusula'))
    await userEvent.type(within(dialogo).getByLabelText('Texto de la cláusula'), 'El proyecto contratará a un vigía comunal')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(red!.a('POST', aceptacion('s10'))).toHaveLength(1))
    expect(red.a('POST', aceptacion('s10'))[0].cuerpo).toEqual({
      attributes: { item: 'clause', clause_number: '5', clause_text: 'El proyecto contratará a un vigía comunal', creates_commitment: true }
    })
    await waitFor(() => expect(alCerrar).toHaveBeenCalled())
  })

  it('un actor persona nuevo pide nombres y apellidos y los manda en lugar del marcador', async () => {
    const { montarlo } = montarDrawer(SUG_ACTOR)
    red = espiarRed([{ method: 'POST', path: aceptacion('s2'), responder: aceptada(SUG_ACTOR) }])
    montarlo()
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la propuesta' })
    expect(await within(dialogo).findByText('Localidad Ejemplo')).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }))
    expect(within(dialogo).getAllByText('Este dato es obligatorio')).toHaveLength(2)
    await userEvent.type(within(dialogo).getByLabelText('Nombres'), 'Rosa')
    await userEvent.type(within(dialogo).getByLabelText('Apellidos'), 'Ejemplo')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Sexo'), 'FEMENINO')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Presidenta de la junta')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(red!.a('POST', aceptacion('s2'))).toHaveLength(1))
    expect(red.a('POST', aceptacion('s2'))[0].cuerpo).toEqual({
      attributes: { item: 'actor', kind: 'person', given_names: 'Rosa', surnames: 'Ejemplo', sex: 'FEMENINO', residence_locality: 'l1' }
    })
  })

  it('quien no escribe los nombres de una persona no acepta un actor nuevo', async () => {
    const { montarlo } = montarDrawer(SUG_ACTOR, permisos({ ...EQUIPO_IA.objects, person: ['READ'] }))
    montarlo()
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la propuesta' })
    expect(within(dialogo).getByText('Su cuenta no puede escribir los nombres de una persona: esta propuesta la acepta quien sí puede.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Aceptar' })).toBeDisabled()
  })

  it('otra persona ya la decidió: lo dice con su texto, nunca con el código', async () => {
    const { montarlo } = montarDrawer(SUG_CLASIFICACION)
    red = espiarRed([{ method: 'POST', path: aceptacion('s1'), responder: () => problema(409, 'x', [{ field: 'state', message: 'STATE_MISMATCH' }]) }])
    montarlo()
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la propuesta' })
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Revisado')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }))
    expect(await within(dialogo).findByText('Otra persona ya decidió esta propuesta: recargue la bandeja.')).toBeInTheDocument()
    expect(within(dialogo).queryByText(/STATE_MISMATCH/)).not.toBeInTheDocument()
  })

  it.each(['[CONTACTO]', '[DATO_SENSIBLE]', '[CORREO:2]'])('un texto con %s tampoco se envía', async (marcador) => {
    const { montarlo } = montarDrawer(SUG_CLAUSULA)
    red = espiarRed([{ method: 'POST', path: aceptacion('s10'), responder: aceptada(SUG_CLAUSULA) }])
    montarlo()
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la propuesta' })
    const texto = within(dialogo).getByLabelText('Texto de la cláusula')
    await userEvent.clear(texto)
    await userEvent.type(texto, `Llamar a ${marcador.replace(/\[/g, '[[')}`)
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Cláusula 5')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }))
    expect(within(dialogo).getByText(/Reemplace los datos reservados/)).toBeInTheDocument()
    expect(red.a('POST', aceptacion('s10'))).toHaveLength(0)
  })

  it('sin permiso para crear el grupo de interés, no manda el que la IA propuso', async () => {
    const SUG_ORG = registro(
      's11',
      {
        project: 'p1',
        suggestion_kind: 'EXTRACCION',
        target_object: 'organization',
        suggested_value: JSON.stringify({
          item: 'actor',
          kind: 'organization',
          name: 'Junta Ejemplo',
          organization_type: 'JUNTA',
          stakeholder: { stakeholder_type: 'ORGANIZACION COMUNAL' }
        }),
        confidence: 0.7,
        model: 'claude-ejemplo',
        ai_interaction: 'ai1'
      },
      { state: 'proposed', updatedAt: '2026-10-09T18:00:00Z' }
    )
    const { montarlo } = montarDrawer(SUG_ORG, permisos({ ...EQUIPO_IA.objects, stakeholder: ['READ'] }))
    red = espiarRed([{ method: 'POST', path: aceptacion('s11'), responder: aceptada(SUG_ORG) }])
    montarlo()
    const dialogo = await screen.findByRole('dialog', { name: 'Aceptar la propuesta' })
    expect(within(dialogo).queryByText('Crear además su grupo de interés en este proyecto')).not.toBeInTheDocument()
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Junta del anexo')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(red!.a('POST', aceptacion('s11'))).toHaveLength(1))
    expect(red.a('POST', aceptacion('s11'))[0].cuerpo).toEqual({
      attributes: { item: 'actor', kind: 'organization', name: 'Junta Ejemplo', organization_type: 'JUNTA' }
    })
  })
})
