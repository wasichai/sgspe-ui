import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeAtencion, CONSULTA, EQUIPO_DE_QUEJAS, EQUIPO_DE_RELACIONES, GESTORA_DE_QUEJAS, QUEJA, SOLICITUD } from '../../test/atencion'
import { montar, registro, ubicacion } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { RELACIONISTA } from '../../test/portal'
import { useAceptarSolicitud, useDerivarPregunta, useReclasificar } from './comandos'
import { DialogoDeReclasificacion } from './DialogoDeReclasificacion'

// los comandos de QCS (api.md §4.4 y §4.6): la ruta, el cuerpo y las cabeceras de cada uno (If-Match, motivo e Idempotency-Key), la
// clave repetida en el reintento de la misma acción y otra para otro registro (P63), y el diálogo de reclasificación
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

function Reclasificar({ original }: { original: typeof QUEJA }) {
  const comando = useReclasificar('grievance')
  return (
    <>
      <button
        type="button"
        onClick={() => comando.mutate({ registro: original, destino: 'inquiry', atributos: { code: 'C-009' }, motivo: 'era una consulta' })}
      >
        Reclasificar
      </button>
      <p>{comando.isError ? 'falló' : comando.isSuccess ? `creada ${comando.data.created.id}` : 'quieto'}</p>
    </>
  )
}

function Aceptar() {
  const comando = useAceptarSolicitud()
  return (
    <button
      type="button"
      onClick={() =>
        comando.mutate({
          solicitud: SOLICITUD,
          respuesta: 'Se entregarán 40 calaminas',
          respondidaEn: '2026-10-09T15:00:00Z',
          atributos: { code: 'COM-010', title: 'Calaminas para el local comunal', amount: '1200', currency: 'PEN' },
          motivo: 'aprobada en comité'
        })
      }
    >
      Aceptar
    </button>
  )
}

function Derivar() {
  const comando = useDerivarPregunta()
  const pregunta = registro('q1', { engagement: 'e1', question_text: '¿Habrá empleo local?' })
  return (
    <button
      type="button"
      onClick={() =>
        comando.mutate({ pregunta, destino: 'inquiry', atributos: { code: 'C-020', description: '¿Habrá empleo local?' }, motivo: 'pregunta de la asamblea' })
      }
    >
      Derivar
    </button>
  )
}

describe('comandos de QCS', () => {
  it('reclasificar manda el tipo y el código nuevos con If-Match, el motivo y una clave que se repite al reintentar', async () => {
    fetch = mockFetch([])
    let veces = 0
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/grievances/g1/reclassify',
        responder: () =>
          ++veces === 1
            ? problema(503, 'sin servicio')
            : jsonResponse({ original: { ...QUEJA, state: 'closed' }, created: registro('i9', { code: 'C-009' }) }, 201)
      }
    ])
    montar(<Reclasificar original={QUEJA} />, { usuario: GESTORA_DE_QUEJAS, permisos: EQUIPO_DE_QUEJAS })
    await userEvent.click(screen.getByRole('button', { name: 'Reclasificar' }))
    await screen.findByText('falló')
    await userEvent.click(screen.getByRole('button', { name: 'Reclasificar' }))
    expect(await screen.findByText('creada i9')).toBeInTheDocument()
    const [primera, segunda] = red.a('POST', '/sgspe/grievances/g1/reclassify')
    expect(primera.cuerpo).toEqual({ targetType: 'inquiry', attributes: { code: 'C-009' } })
    expect(primera.cabeceras.get('If-Match')).toBe(`"${QUEJA.updatedAt}"`)
    expect(primera.cabeceras.get('X-Change-Reason')).toBe("UTF-8''era%20una%20consulta")
    expect(primera.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(segunda.cabeceras.get('Idempotency-Key')).toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  it('aceptar una solicitud manda la respuesta, cuándo se comunicó y el compromiso que nace, con If-Match y clave', async () => {
    fetch = mockFetch([
      { method: 'POST', path: '/sgspe/stakeholder-requests/r1/accept', status: 201, body: { request: SOLICITUD, commitment: registro('c9', {}) } }
    ])
    red = espiarRed()
    montar(<Aceptar />, { usuario: GESTORA_DE_QUEJAS, permisos: EQUIPO_DE_QUEJAS })
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/stakeholder-requests/r1/accept')).toHaveLength(1))
    const [llamada] = red.a('POST', '/sgspe/stakeholder-requests/r1/accept')
    expect(llamada.cuerpo).toEqual({
      creates: 'commitment',
      response: 'Se entregarán 40 calaminas',
      respondedAt: '2026-10-09T15:00:00Z',
      attributes: { code: 'COM-010', title: 'Calaminas para el local comunal', amount: '1200', currency: 'PEN' }
    })
    expect(llamada.cabeceras.get('If-Match')).toBe(`"${SOLICITUD.updatedAt}"`)
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('derivar una pregunta manda el destino y los datos de la QCS, con el motivo y la clave, sin If-Match', async () => {
    fetch = mockFetch([
      { method: 'POST', path: '/sgspe/engagement-questions/q1/referral', status: 201, body: { question: registro('q1', {}), created: CONSULTA } }
    ])
    red = espiarRed()
    const invalidar = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    montar(<Derivar />, { usuario: RELACIONISTA, permisos: EQUIPO_DE_RELACIONES })
    await userEvent.click(screen.getByRole('button', { name: 'Derivar' }))
    // la pregunta leída sola también queda vieja: ahora tiene referred_at
    await waitFor(() =>
      expect(invalidar.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))).toContain(JSON.stringify(['record', 'engagement_question', 'q1']))
    )
    await waitFor(() => expect(red!.a('POST', '/sgspe/engagement-questions/q1/referral')).toHaveLength(1))
    const [llamada] = red.a('POST', '/sgspe/engagement-questions/q1/referral')
    expect(llamada.cuerpo).toEqual({ target: 'inquiry', attributes: { code: 'C-020', description: '¿Habrá empleo local?' } })
    expect(llamada.cabeceras.has('If-Match')).toBe(false)
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })
})

const transiciones = (lista: { name: string; allowed: boolean }[]) => ({
  path: '/objects/grievance/records/g1/transitions',
  body: lista.map((x) => ({ ...x, label: x.name, to: 'closed', toLabel: 'Cerrada', reason: null }))
})

describe('diálogo de reclasificación', () => {
  const abrir = () =>
    montar(<DialogoDeReclasificacion objeto="grievance" registro={{ ...QUEJA, state: 'acknowledged' }} alCerrar={() => {}} />, {
      ruta: '/projects/p1/grievances/g1',
      camino: '/projects/:projectId/grievances/:id',
      usuario: GESTORA_DE_QUEJAS,
      permisos: EQUIPO_DE_QUEJAS
    })

  it('ofrece los otros dos tipos, exige código y motivo y abre la ficha del registro nuevo', async () => {
    fetch = mockFetch([
      ...baseDeAtencion(),
      transiciones([{ name: 'close_reclassified_acknowledged', allowed: true }]),
      { method: 'POST', path: '/sgspe/grievances/g1/reclassify', status: 201, body: { original: QUEJA, created: registro('r9', { code: 'S-009' }) } }
    ])
    red = espiarRed()
    abrir()
    const dialogo = await screen.findByRole('dialog', { name: 'Reclasificar' })
    expect(within(dialogo).getByText(/La queja Q-001 se cierra/)).toBeInTheDocument()
    expect(within(dialogo).getByRole('radio', { name: 'Consulta' })).toBeChecked()
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Solicitud' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reclasificar' }))
    expect(within(dialogo).getByText('Escriba el código del registro nuevo.')).toBeInTheDocument()
    expect(within(dialogo).getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/grievances/g1/reclassify')).toHaveLength(0)
    await userEvent.type(within(dialogo).getByLabelText('Código del registro nuevo'), 'S-009')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'pide apoyo, no reclama')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reclasificar' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/requests/r9'))
    expect(red.a('POST', '/sgspe/grievances/g1/reclassify')[0].cuerpo).toEqual({ targetType: 'stakeholder_request', attributes: { code: 'S-009' } })
  })

  it('el estado que cambió mientras tanto (409 STATE_MISMATCH) dice su texto', async () => {
    fetch = mockFetch([
      ...baseDeAtencion(),
      { path: '/objects/grievance/records/g1', body: QUEJA },
      transiciones([]),
      {
        method: 'POST',
        path: '/sgspe/grievances/g1/reclassify',
        status: 409,
        body: { title: 'Conflict', status: 409, detail: 'estado', errors: [{ field: 'state', message: 'STATE_MISMATCH' }] }
      }
    ])
    abrir()
    const dialogo = await screen.findByRole('dialog', { name: 'Reclasificar' })
    await userEvent.type(within(dialogo).getByLabelText('Código del registro nuevo'), 'C-009')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'era una consulta')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reclasificar' }))
    expect(await within(dialogo).findByText(/ya no está en el estado de partida/)).toBeInTheDocument()
    expect(within(dialogo).queryByText(/STATE_MISMATCH/)).not.toBeInTheDocument()
  })

  it('un 412 ofrece «Recargar»', async () => {
    fetch = mockFetch([
      ...baseDeAtencion(),
      { path: '/objects/grievance/records/g1', body: QUEJA },
      transiciones([]),
      {
        method: 'POST',
        path: '/sgspe/grievances/g1/reclassify',
        status: 412,
        body: { title: 'Precondition Failed', status: 412, detail: 'versión', errors: [] }
      }
    ])
    abrir()
    const dialogo = await screen.findByRole('dialog', { name: 'Reclasificar' })
    await userEvent.type(within(dialogo).getByLabelText('Código del registro nuevo'), 'C-009')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'era una consulta')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reclasificar' }))
    expect(await within(dialogo).findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  })
})
