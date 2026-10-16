import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  baseDeF8,
  ENTREGABLE,
  EQUIPO_DE_ENTREGABLES,
  PERSONA_ID,
  SECCION_ANTECEDENTES,
  SECCION_REDES,
  SUG_CON_RESERVADO,
  SUG_RESUMEN,
  SUG_SECCION,
  transicion
} from '../../test/f8'
import { montar, pagina } from '../../test/montar'
import { GERENCIA_SOCIAL } from '../../test/portal'
import { espiarRed, problema, type Red, type RutaEspecial } from '../../test/red'
import type { Registro } from '../datos/registros'
import { SugerenciaDeSeccion } from './SugerenciaDeSeccion'

// AI-04 en una sección (spec §3.9, api.md §4.14): pedir la sugerencia, verla al lado re-identificada, usarla con el texto revisado y
// motivo (las personas pasan a mención; otro marcador no deja enviar) y copiar el resumen ejecutivo del proyecto
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const rutas = (borradores: Registro[], resumenes: Registro[] = []): MockRoute[] => [
  { path: /suggestion_kind=BORRADOR/, body: pagina(borradores) },
  { path: /suggestion_kind=RESUMEN/, body: pagina(resumenes) },
  { path: '/objects/ai_suggestion/records/sug1/transitions', body: [transicion('reject', 'Rechazar', 'rejected', 'Rechazada')] },
  { path: '/objects/ai_suggestion/records/sug2/transitions', body: [] },
  ...baseDeF8(GERENCIA_SOCIAL)
]
const abrir = ({
  borradores = [SUG_SECCION],
  resumenes = [] as Registro[],
  seccion = SECCION_ANTECEDENTES as Registro,
  sucio = false,
  especiales = [] as RutaEspecial[]
} = {}) => {
  fetch = mockFetch(rutas(borradores, resumenes))
  red = espiarRed(especiales)
  montar(<SugerenciaDeSeccion entregable={ENTREGABLE} seccion={seccion} sucio={sucio} />, { usuario: GERENCIA_SOCIAL, permisos: EQUIPO_DE_ENTREGABLES })
}
const aceptada: RutaEspecial = {
  method: 'POST',
  path: '/sgspe/ai-suggestions/sug1/accept',
  responder: () => jsonResponse({ suggestion: { ...SUG_SECCION, state: 'accepted' }, result: SECCION_ANTECEDENTES })
}

describe('AI-04 en la sección', () => {
  it('pide AI-04 sobre la sección con su clave', async () => {
    abrir({
      borradores: [],
      especiales: [
        {
          method: 'POST',
          path: '/sgspe/ai/runs',
          responder: () => jsonResponse({ interaction: 'ai1', interactions: ['ai1'], suggestions: [SUG_SECCION], candidates: [] }, 201)
        }
      ]
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Sugerir con IA' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai/runs')).toHaveLength(1))
    const [corrida] = red!.a('POST', '/sgspe/ai/runs')
    expect(corrida.cuerpo).toEqual({ useCase: 'AI-04', target: { object: 'deliverable_section', recordId: 'sec-antecedentes' } })
    expect(corrida.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('muestra la sugerencia al lado con la persona re-identificada; usarla la convierte en mención y acepta con motivo', async () => {
    abrir({ especiales: [aceptada] })
    const panel = await screen.findByRole('region', { name: 'Borrador de la IA' })
    expect(await within(panel).findByText(/Persona Ejemplo 1/)).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Usar…' }))
    const dialogo = screen.getByRole('dialog', { name: 'Usar la sugerencia en la sección' })
    const texto = within(dialogo).getByLabelText('Texto que irá a la sección')
    expect(texto).toHaveValue(`## Antecedentes\nLa directiva, con [[person:${PERSONA_ID}]], pidió una reunión.`)
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Revisado contra el acta')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Usar en la sección' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai-suggestions/sug1/accept')).toHaveLength(1))
    const [aceptacion] = red!.a('POST', '/sgspe/ai-suggestions/sug1/accept')
    expect(aceptacion.cuerpo).toEqual({ attributes: { content: `## Antecedentes\nLa directiva, con [[person:${PERSONA_ID}]], pidió una reunión.` } })
    expect(aceptacion.cabeceras.get('If-Match')).toBe('"2026-10-11T15:00:00Z"')
    expect(aceptacion.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Revisado%20contra%20el%20acta")
    expect(aceptacion.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('un marcador sin resolver impide usar la sugerencia; el 422 del servidor se dice en su texto', async () => {
    abrir({
      borradores: [SUG_CON_RESERVADO],
      especiales: [
        {
          method: 'POST',
          path: '/sgspe/ai-suggestions/sug2/accept',
          responder: () => problema(422, 'x', [{ field: 'attributes.content', message: 'UNRESOLVED_PSEUDONYM' }])
        }
      ]
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Usar…' }))
    const dialogo = screen.getByRole('dialog')
    expect(
      within(dialogo).getByText('El texto todavía lleva datos reservados por la IA: reemplácelos por una mención o por un texto genérico.')
    ).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Usar en la sección' })).toBeDisabled()
    const texto = within(dialogo).getByLabelText('Texto que irá a la sección')
    await userEvent.clear(texto)
    await userEvent.type(texto, 'Habló una persona de la directiva.')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Sin datos personales')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Usar en la sección' }))
    expect(await within(dialogo).findByText(/nombra a una persona sin identificar/)).toBeInTheDocument()
  })

  it('con cambios sin guardar no deja usar la sugerencia', async () => {
    abrir({ sucio: true })
    const usar = await screen.findByRole('button', { name: 'Usar…' })
    expect(usar).toBeDisabled()
    expect(screen.getByText('Guarde o descarte los cambios de la sección antes de usar una sugerencia.')).toBeInTheDocument()
  })

  it('una sección que el tipo no marca con IA no ofrece nada; un 422 de la corrida se explica', async () => {
    abrir({ seccion: SECCION_REDES })
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Borrador de la IA' })).not.toBeInTheDocument())
    fetch!.restore()
    red!.restaurar()
    document.body.innerHTML = ''
    abrir({
      borradores: [],
      especiales: [
        { method: 'POST', path: '/sgspe/ai/runs', responder: () => problema(422, 'x', [{ field: 'target.recordId', message: 'SECTION_NOT_ASSISTED' }]) }
      ]
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Sugerir con IA' }))
    expect(await screen.findByText('El tipo de entregable no prevé borradores de IA para esta sección.')).toBeInTheDocument()
  })

  it('copia el resumen ejecutivo del proyecto a la sección destino', async () => {
    abrir({
      borradores: [],
      resumenes: [SUG_RESUMEN],
      especiales: [
        {
          method: 'POST',
          path: '/sgspe/ai-suggestions/sug3/accept',
          responder: () => jsonResponse({ suggestion: { ...SUG_RESUMEN, state: 'accepted' }, result: SECCION_ANTECEDENTES })
        }
      ]
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Usar el resumen ejecutivo del proyecto…' }))
    const dialogo = screen.getByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Punto de partida')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Usar en la sección' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai-suggestions/sug3/accept')).toHaveLength(1))
    expect(red!.a('POST', '/sgspe/ai-suggestions/sug3/accept')[0].cuerpo).toEqual({
      attributes: { section: 'sec-antecedentes', content: 'El proyecto tuvo cuatro interacciones en el periodo.' }
    })
  })

  it('tras un 412, Recargar cierra el diálogo y «Usar…» manda la versión nueva', async () => {
    let vigente: Registro = SUG_SECCION
    let intentos = 0
    abrir({
      especiales: [
        { method: 'GET', path: /suggestion_kind=BORRADOR/, responder: () => jsonResponse(pagina([vigente])) },
        {
          method: 'POST',
          path: '/sgspe/ai-suggestions/sug1/accept',
          responder: () => {
            intentos += 1
            return intentos === 1 ? problema(412, 'x') : jsonResponse({ suggestion: { ...SUG_SECCION, state: 'accepted' }, result: SECCION_ANTECEDENTES })
          }
        }
      ]
    })
    const panel = await screen.findByRole('region', { name: 'Borrador de la IA' })
    await userEvent.click(await within(panel).findByRole('button', { name: 'Usar…' }))
    let dialogo = screen.getByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Revisado')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Usar en la sección' }))
    vigente = { ...SUG_SECCION, updatedAt: '2026-10-12T10:00:00Z' }
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await userEvent.click(within(panel).getByRole('button', { name: 'Usar…' }))
    dialogo = screen.getByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Revisado')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Usar en la sección' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/ai-suggestions/sug1/accept')).toHaveLength(2))
    expect(red!.a('POST', '/sgspe/ai-suggestions/sug1/accept')[1].cabeceras.get('If-Match')).toBe('"2026-10-12T10:00:00Z"')
  })

  it('con el texto vacío dice que falta; con cambios sin guardar el resumen también da la razón', async () => {
    abrir({ borradores: [], resumenes: [SUG_RESUMEN], sucio: true })
    const usarResumen = await screen.findByRole('button', { name: 'Usar el resumen ejecutivo del proyecto…' })
    expect(usarResumen).toBeDisabled()
    expect(usarResumen).toHaveAttribute('title', 'Guarde o descarte los cambios de la sección antes de usar una sugerencia.')
    expect(screen.getByText('Guarde o descarte los cambios de la sección antes de usar una sugerencia.')).toBeInTheDocument()
    fetch!.restore()
    red!.restaurar()
    document.body.innerHTML = ''
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Usar…' }))
    const dialogo = screen.getByRole('dialog')
    await userEvent.clear(within(dialogo).getByLabelText('Texto que irá a la sección'))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Usar en la sección' }))
    expect(await within(dialogo).findByText('Escriba el texto de la sección.')).toBeInTheDocument()
  })
})
