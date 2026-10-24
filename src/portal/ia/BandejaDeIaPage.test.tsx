import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEF_COMPROMISO } from '../../test/compromisos'
import {
  baseDeIa,
  CANDIDATO_IA,
  EQUIPO_IA,
  ESTADO_ACTIVO,
  ESTADO_SIN_ORGANIZACION,
  GERENCIA_IA,
  SUG_ACTOR,
  SUG_BORRADOR,
  SUG_CLASIFICACION,
  SUG_DUPLICADO,
  SUG_ILEGIBLE,
  SUG_RESUMEN,
  TRANSICIONES_DE_SUGERENCIA
} from '../../test/ia'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import { BandejaDeIaPage } from './BandejaDeIaPage'

// S52 (screens.md §13, ai-architecture.md §9.3): lo propuesto en el proyecto, por confianza y fecha, sin lo que no se lee ni lo
// que se muestra en otra pantalla; rechazar va por WF-K con motivo; los candidatos se revisan como en S28
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

// una propuesta sobre una queja que la cuenta no lee (confidencial u otro proyecto): no aparece
const OCULTA = registro(
  's7',
  {
    project: 'p1',
    suggestion_kind: 'CLASIFICACION',
    target_object: 'grievance',
    target_record_id: 'g9',
    suggested_value: '{"field":"category","value":"EMPLEO"}',
    confidence: 0.95,
    model: 'claude-haiku-4-5',
    ai_interaction: 'ai2'
  },
  { state: 'proposed' }
)
const DECIDIDA = registro('s8', { ...SUG_CLASIFICACION.attributes }, { state: 'rejected' })
const HUMANO = registro(
  'k2',
  { project: 'p1', proposed_text: 'Pintar la escuela', ai_generated: false },
  { state: 'proposed', createdAt: '2026-10-11T15:00:00Z' }
)

const montarBandeja = (estado: unknown = ESTADO_ACTIVO, extra: MockRoute[] = []) => {
  fetch = mockFetch([
    ...extra,
    {
      path: '/objects/ai_suggestion/records',
      body: pagina([SUG_CLASIFICACION, SUG_ACTOR, SUG_DUPLICADO, SUG_BORRADOR, SUG_RESUMEN, SUG_ILEGIBLE, OCULTA, DECIDIDA])
    },
    { path: '/objects/commitment_candidate/records', body: pagina([CANDIDATO_IA, HUMANO]) },
    { path: /^\/objects\/ai_suggestion\/records\/s\d\/transitions$/, body: TRANSICIONES_DE_SUGERENCIA },
    { path: /^\/objects\/commitment_candidate\/records\/k\d\/transitions$/, body: [] },
    { path: '/objects/grievance/records/g9', status: 404, body: { title: 'Not Found', status: 404 } },
    { path: '/metadata/objects/commitment', body: DEF_COMPROMISO },
    ...baseDeIa(estado)
  ])
  montar(<BandejaDeIaPage />, { ruta: '/projects/p1/ai-review', camino: '/projects/:projectId/ai-review', usuario: GERENCIA_IA, permisos: EQUIPO_IA })
}
const TIPO = /^(Candidato a compromiso|Posible duplicado|Clasificación|Borrador de acta|Extracción|Resumen ejecutivo)$/
const lista = () => screen.findByRole('list', { name: 'Propuestas por revisar' })
const tarjeta = async (tipo: string, n = 0) => (await within(await lista()).findAllByText(tipo))[n].closest('li')!

describe('S52 · bandeja de revisión de IA', () => {
  it('ordena por confianza y fecha, deja fuera el resumen, lo decidido y lo que no se lee', async () => {
    montarBandeja()
    await waitFor(async () =>
      expect(
        within(await lista())
          .getAllByText(TIPO)
          .map((e) => e.textContent)
      ).toEqual(['Candidato a compromiso', 'Posible duplicado', 'Clasificación', 'Borrador de acta', 'Extracción', 'Extracción', 'Candidato a compromiso'])
    )
    expect(screen.queryByText(/EMPLEO/)).not.toBeInTheDocument()
    expect(within(await lista()).getAllByText('Clasificación')).toHaveLength(1)
    // solo se pide lo propuesto: lo decidido no gasta el tope (D10 de la revisión de UX)
    for (const objeto of ['ai_suggestion', 'commitment_candidate'])
      expect(fetch!.calls.filter((l) => l.path.startsWith(`/objects/${objeto}/records?`)).every((l) => l.path.includes('state=proposed'))).toBe(true)
  })

  it('cada tarjeta dice confianza, modelo, instrucción, el registro, lo propuesto y la cita con su fuente', async () => {
    montarBandeja()
    const clasificacion = await tarjeta('Clasificación')
    expect(within(clasificacion).getByText('Confianza 74 %')).toBeInTheDocument()
    expect(within(clasificacion).getByText('Modelo: claude-haiku-4-5')).toBeInTheDocument()
    expect(await within(clasificacion).findByText('Instrucción: ai-08@1')).toBeInTheDocument()
    expect(await within(clasificacion).findByText('Categoría: AGUA Y MEDIO AMBIENTE')).toBeInTheDocument()
    expect(await within(clasificacion).findByText('Falta agua en el anexo')).toBeInTheDocument()
    expect(within(clasificacion).getByRole('link', { name: 'Abrir la fuente' })).toHaveAttribute('href', '/r/grievance/g1')
    expect(within(clasificacion).getByText('Sugerencia de IA')).toBeInTheDocument()
  })

  it('una propuesta ilegible solo se puede rechazar', async () => {
    montarBandeja()
    const ilegible = await tarjeta('Extracción', 1)
    expect(within(ilegible).getByText('Esta propuesta no se puede leer: solo puede rechazarse.')).toBeInTheDocument()
    expect(await within(ilegible).findByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
    expect(within(ilegible).queryByRole('button', { name: 'Marcar como duplicada' })).not.toBeInTheDocument()
    expect(within(await tarjeta('Clasificación')).getByRole('button', { name: 'Marcar como duplicada' })).toBeInTheDocument()
  })

  it('el duplicado se compara lado a lado y el borrador de acta se decide en su editor', async () => {
    montarBandeja()
    expect(within(await tarjeta('Posible duplicado')).getByRole('link', { name: 'Comparar lado a lado' })).toHaveAttribute('href', '/projects/p1/ai-review/s3')
    expect(within(await tarjeta('Borrador de acta')).getByRole('link', { name: 'Decidir en el editor del acta' })).toHaveAttribute(
      'href',
      '/projects/p1/engagements/e1/minutes'
    )
  })

  it('rechazar pide motivo y aplica la transición de WF-K con la versión leída', async () => {
    montarBandeja()
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/ai_suggestion/records/s1/transitions/reject',
        responder: () => jsonResponse({ ...SUG_CLASIFICACION, state: 'rejected' })
      }
    ])
    await userEvent.click(await within(await tarjeta('Clasificación')).findByRole('button', { name: 'Rechazar' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'La queja es de empleo, no de agua')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(red!.a('POST', '/objects/ai_suggestion/records/s1/transitions/reject')).toHaveLength(1))
    const [llamada] = red.a('POST', '/objects/ai_suggestion/records/s1/transitions/reject')
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-09T15:00:00Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''La%20queja%20es%20de%20empleo%2C%20no%20de%20agua")
  })

  it('los filtros acotan por tipo y por origen', async () => {
    montarBandeja()
    await lista()
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'candidato')
    expect(within(await lista()).getAllByText(TIPO)).toHaveLength(2)
    await userEvent.selectOptions(screen.getByLabelText('Origen'), 'persona')
    expect(within(await lista()).getByText('Pintar la escuela')).toBeInTheDocument()
    expect(within(await lista()).getAllByText(TIPO)).toHaveLength(1)
  })

  // rediseño de UX (2026-10-20): sin coincidencias, el vacío dice cuántas hay sin los filtros y los limpia
  it('si los filtros no dejan ninguna propuesta, el vacío ofrece limpiarlos', async () => {
    montarBandeja()
    const antes = within(await lista()).getAllByRole('listitem').length
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'DUPLICADO')
    await userEvent.selectOptions(screen.getByLabelText('Origen'), 'persona')
    expect(await screen.findByText('Nada coincide con los filtros')).toBeInTheDocument()
    expect(screen.getByText(/^Sin los filtros hay \d+\.$/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(within(await lista()).getAllByRole('listitem')).toHaveLength(antes)
  })

  it('un candidato se revisa como en S28', async () => {
    montarBandeja()
    await userEvent.click(await within(await tarjeta('Candidato a compromiso')).findByRole('button', { name: 'Revisar' }))
    expect(await screen.findByRole('dialog', { name: 'Revisar el candidato' })).toBeInTheDocument()
  })

  it('con la organización sin IA lo dice y sigue listando lo propuesto', async () => {
    montarBandeja(ESTADO_SIN_ORGANIZACION)
    expect(await screen.findByText('Su organización no tiene la IA activada: puede seguir decidiendo lo ya propuesto.')).toBeInTheDocument()
    expect(within(await lista()).getAllByText(TIPO).length).toBeGreaterThan(0)
  })

  it('sin propuestas dice que no hay nada por revisar', async () => {
    montarBandeja(ESTADO_ACTIVO, [
      { path: '/objects/ai_suggestion/records', body: pagina([]) },
      { path: '/objects/commitment_candidate/records', body: pagina([]) }
    ])
    expect(await screen.findByText('No hay propuestas por revisar en este proyecto.')).toBeInTheDocument()
  })
})
