import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeCompromisos, C1, EQUIPO_DE_COMPROMISOS, GESTORA } from '../../test/compromisos'
import { montar, pagina, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { atributo, useRegistro } from '../datos/registros'
import { PestanaReprogramaciones } from './PestanaReprogramaciones'

// RF-COM-003 (api.md §4.5): reprogramar es un comando con IK, IM y CR que deja la fecha anterior en un registro inmutable; la
// misma fecha no se manda; un 412 se recarga y el reintento lleva la versión nueva
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const HISTORIA = registro('r1', {
  commitment: 'c1',
  previous_due_date: '2026-10-31',
  new_due_date: '2026-11-30',
  reschedule_reason: 'Lluvias',
  agreed_with_stakeholder: true
})
const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  { path: '/objects/commitment_reschedule/records', body: pagina([HISTORIA]) }
]

// la ficha lee el compromiso con useRegistro: tras «Recargar» la pestaña recibe la versión nueva
function Ficha() {
  const compromiso = useRegistro('commitment', 'c1')
  return compromiso.data ? <PestanaReprogramaciones compromiso={compromiso.data} escribe /> : null
}

// la cabecera de la ficha: la situación de plazo del compromiso que la caché tiene
function FichaConPlazo() {
  const compromiso = useRegistro('commitment', 'c1')
  return compromiso.data ? (
    <>
      <SituacionDePlazo valor={atributo(compromiso.data, 'deadline_status')} />
      <PestanaReprogramaciones compromiso={compromiso.data} escribe />
    </>
  ) : null
}

describe('S29 · reprogramaciones', () => {
  it('dice el historial y no ofrece reprogramar un borrador', async () => {
    fetch = mockFetch(rutas())
    montar(<PestanaReprogramaciones compromiso={{ ...C1, state: 'draft' }} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    const tabla = await screen.findByRole('table', { name: 'Reprogramaciones' })
    expect(within(tabla).getByText('Lluvias')).toBeInTheDocument()
    expect(within(tabla).getByText('Sí')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reprogramar' })).not.toBeInTheDocument()
  })

  it('valida la fecha y el motivo, y manda IK, If-Match y el motivo', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/commitments/c1/reschedules',
        responder: () =>
          jsonResponse(
            {
              reschedule: registro('r2', {}),
              commitment: { ...C1, attributes: { ...C1.attributes, due_date: '2027-01-15' }, updatedAt: '2026-10-09T16:00:00Z' }
            },
            201
          )
      }
    ])
    montar(<PestanaReprogramaciones compromiso={C1} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/Fecha de vencimiento vigente/)).toBeInTheDocument()
    await userEvent.type(within(dialogo).getByLabelText('Fecha nueva'), '2026-11-30')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reprogramar' }))
    expect(await within(dialogo).findByText('La fecha nueva es la misma que la vigente')).toBeInTheDocument()
    expect(within(dialogo).getByText('Escriba el motivo de la reprogramación')).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/commitments/c1/reschedules')).toHaveLength(0)
    await userEvent.clear(within(dialogo).getByLabelText('Fecha nueva'))
    await userEvent.type(within(dialogo).getByLabelText('Fecha nueva'), '2027-01-15')
    await userEvent.type(within(dialogo).getByLabelText('Motivo de la reprogramación'), 'Paro regional')
    await userEvent.click(within(dialogo).getByLabelText('Se acordó con el grupo de interés'))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reprogramar' }))
    expect(await screen.findByText(/El compromiso vence ahora el/)).toBeInTheDocument()
    const [llamada] = red.a('POST', '/sgspe/commitments/c1/reschedules')
    expect(llamada.cuerpo).toEqual({ attributes: { new_due_date: '2027-01-15', reschedule_reason: 'Paro regional', agreed_with_stakeholder: true } })
    expect(llamada.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-05T15:00:00.123456Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Paro%20regional")
  })

  it('un 412 ofrece Recargar, conserva lo escrito y el reintento lleva la versión nueva', async () => {
    let lecturas = 0
    fetch = mockFetch(rutas())
    let intentos = 0
    red = espiarRed([
      {
        path: '/objects/commitment/records/c1',
        responder: () => jsonResponse(++lecturas === 1 ? C1 : { ...C1, updatedAt: '2026-10-08T10:00:00Z' })
      },
      {
        method: 'POST',
        path: '/sgspe/commitments/c1/reschedules',
        responder: () => (++intentos === 1 ? problema(412, 'otra') : jsonResponse({ reschedule: registro('r2', {}), commitment: C1 }, 201))
      }
    ])
    montar(<Ficha />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Fecha nueva'), '2027-01-15')
    await userEvent.type(within(dialogo).getByLabelText('Motivo de la reprogramación'), 'Paro regional')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reprogramar' }))
    await userEvent.click(await within(dialogo).findByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(within(dialogo).queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument())
    expect(within(dialogo).getByLabelText('Motivo de la reprogramación')).toHaveValue('Paro regional')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reprogramar' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitments/c1/reschedules')).toHaveLength(2))
    const [primera, segunda] = red.a('POST', '/sgspe/commitments/c1/reschedules')
    expect(segunda.cabeceras.get('If-Match')).toBe('"2026-10-08T10:00:00Z"')
    // el primer intento no dejó clave en el servidor: el reintento de la misma acción repite la suya
    expect(segunda.cabeceras.get('Idempotency-Key')).toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  it('un vencido reprogramado queda AL DIA con la respuesta del comando, sin esperar otra lectura', async () => {
    const VENCIDO = { ...C1, attributes: { ...C1.attributes, deadline_status: 'VENCIDO' } }
    fetch = mockFetch(rutas())
    red = espiarRed([
      { path: '/objects/commitment/records/c1', responder: () => jsonResponse(VENCIDO) },
      {
        method: 'POST',
        path: '/sgspe/commitments/c1/reschedules',
        responder: () =>
          jsonResponse(
            {
              reschedule: registro('r2', {}),
              commitment: { ...C1, attributes: { ...C1.attributes, due_date: '2027-01-15', deadline_status: 'AL DIA' }, updatedAt: '2026-10-09T16:00:00Z' }
            },
            201
          )
      }
    ])
    montar(<FichaConPlazo />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByLabelText('Situación de plazo: VENCIDO')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reprogramar' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Fecha nueva'), '2027-01-15')
    await userEvent.type(within(dialogo).getByLabelText('Motivo de la reprogramación'), 'Paro regional')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reprogramar' }))
    expect(await screen.findByLabelText('Situación de plazo: AL DIA')).toBeInTheDocument()
    expect(red.a('GET', '/objects/commitment/records/c1')).toHaveLength(1)
  })

  it('SAME_DUE_DATE del servidor va junto a la fecha, con su texto', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/commitments/c1/reschedules',
        responder: () => problema(400, 'x', [{ field: 'attributes.new_due_date', message: 'SAME_DUE_DATE' }])
      }
    ])
    montar(<PestanaReprogramaciones compromiso={C1} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Fecha nueva'), '2027-01-15')
    await userEvent.type(within(dialogo).getByLabelText('Motivo de la reprogramación'), 'x')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reprogramar' }))
    expect(await within(dialogo).findByText('La fecha nueva es la misma que la vigente.')).toBeInTheDocument()
    expect(within(dialogo).queryByText('SAME_DUE_DATE')).not.toBeInTheDocument()
    // el error del servidor era de la fecha enviada: cambiarla lo quita
    await userEvent.clear(within(dialogo).getByLabelText('Fecha nueva'))
    await userEvent.type(within(dialogo).getByLabelText('Fecha nueva'), '2027-02-01')
    expect(within(dialogo).queryByText('La fecha nueva es la misma que la vigente.')).not.toBeInTheDocument()
  })

  it('el motivo se corta en 500 caracteres, el límite de X-Change-Reason', async () => {
    fetch = mockFetch(rutas())
    montar(<PestanaReprogramaciones compromiso={C1} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Motivo de la reprogramación')).toHaveAttribute('maxLength', '500')
  })

  it('STATE_MISMATCH dice su texto propio y el diálogo conserva lo escrito', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/commitments/c1/reschedules',
        responder: () => problema(409, 'x', [{ field: 'state', message: 'STATE_MISMATCH' }])
      }
    ])
    montar(<PestanaReprogramaciones compromiso={C1} escribe />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    await userEvent.click(await screen.findByRole('button', { name: 'Reprogramar' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Fecha nueva'), '2027-01-15')
    await userEvent.type(within(dialogo).getByLabelText('Motivo de la reprogramación'), 'Paro regional')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reprogramar' }))
    expect(await within(dialogo).findByText(/Solo se reprograma un compromiso aprobado, en ejecución o bloqueado/)).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Fecha nueva')).toHaveValue('2027-01-15')
    expect(within(dialogo).getByLabelText('Motivo de la reprogramación')).toHaveValue('Paro regional')
  })
})
