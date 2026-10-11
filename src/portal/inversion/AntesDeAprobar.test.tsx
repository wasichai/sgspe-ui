import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { P1 } from '../../test/compromisos'
import { APORTE, APROBACION_DE_APORTES, baseDeInversion, EQUIPO_DE_INVERSION, INVERSION, PERMISOS_DE_APROBACION } from '../../test/inversion'
import { montar, registro } from '../../test/montar'
import { espiarRed, type Red } from '../../test/red'
import type { Registro } from '../datos/registros'
import type { Comprobacion } from '../transiciones/api'
import { AntesDeAprobar } from './AntesDeAprobar'

// «Antes de aprobar» de S44: la consulta en seco de la aprobación del rol, cada lineamiento con su situación y su texto, la
// justificación que se pide y se escribe con motivo, y la sinergia que no se justifica (elección 9)
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const transicion = (name: string, label: string) => ({ name, label, to: 'approved', toLabel: 'Aprobado', allowed: true, reason: null })
const rutas = (aporte: Registro, transiciones: unknown[], proyecto: Registro = P1): MockRoute[] => [
  { path: '/objects/project/records/p1', body: proyecto },
  { path: '/objects/social_contribution/records/a1', body: aporte },
  { path: '/objects/social_contribution/records/a1/transitions', body: transiciones },
  ...baseDeInversion()
]
const consultaEnSeco = (respuesta: Comprobacion) => espiarRed([{ method: 'POST', path: '/sgspe/transition-checks', responder: () => jsonResponse(respuesta) }])
const fila = (nombre: string) => screen.getByText(nombre).closest('li') as HTMLElement

describe('S44 · antes de aprobar', () => {
  it('consulta en seco la aprobación del rol y dice cada lineamiento: lo que bloquea, lo que advierte, lo que cumple y lo que no se evalúa', async () => {
    const proyecto = registro('p1', { ...P1.attributes, policy_non_monetary_donations: false }, { state: 'active' })
    fetch = mockFetch(rutas(APORTE, [transicion('approve_direct', 'Aprobar sin revisión interna')], proyecto))
    red = consultaEnSeco({
      allowed: false,
      blocking: [{ code: 'PAID_LABOR', message: 'El ítem Jornales es MANO DE OBRA', field: 'contribution_item' }],
      warnings: [
        { code: 'CAP_OTHER_CURRENCY', message: 'Hay montos de la campaña en otra moneda que no se suman al tope', field: 'currency' },
        { code: 'REASON_REQUIRED', message: 'La aprobación exige motivo', field: 'reason' }
      ]
    })
    montar(<AntesDeAprobar aporte={APORTE} escribe />, { usuario: INVERSION, permisos: EQUIPO_DE_INVERSION })
    const panel = await screen.findByRole('region', { name: 'Antes de aprobar' })
    expect(within(panel).getByText(/Las reglas de «Aprobar sin revisión interna» corren aquí/)).toBeInTheDocument()
    await waitFor(() => expect(within(fila('Sin mano de obra')).getByText('Bloquea')).toBeInTheDocument())
    expect(within(fila('Sin mano de obra')).getByText('El ítem Jornales es MANO DE OBRA')).toBeInTheDocument()
    expect(within(fila('Tope de la campaña')).getByText('Advierte')).toBeInTheDocument()
    expect(within(fila('Donación no monetaria')).getByText('No se evalúa')).toBeInTheDocument()
    expect(within(fila('Acuerdo de sinergia vigente')).getByText('No se evalúa')).toBeInTheDocument()
    expect(within(fila('Ítems y tipo de aporte')).getByText('Cumple')).toBeInTheDocument()
    expect(within(panel).queryByText('La aprobación exige motivo')).not.toBeInTheDocument()
    expect(red.a('POST', '/sgspe/transition-checks')[0].cuerpo).toEqual({ object: 'social_contribution', recordId: 'a1', transition: 'approve_direct' })
  })

  it('con un lineamiento incumplido pide la justificación; escribirla manda el cambio con el motivo y la versión leída y vuelve a consultar', async () => {
    // el GET trae toda clave que la cuenta lee, también las vacías: sin la clave, la justificación no viajaría (atributosDeEscritura)
    const sinJustificar = { ...APORTE, attributes: { ...APORTE.attributes, guideline_deviation_justification: null } }
    fetch = mockFetch([
      { method: 'PUT', path: '/objects/social_contribution/records/a1', body: sinJustificar },
      ...rutas(sinJustificar, [transicion('approve_direct', 'Aprobar sin revisión interna')])
    ])
    red = consultaEnSeco({
      allowed: false,
      blocking: [{ code: 'MONETARY_DONATION', message: 'Una DONACION con DINERO', field: 'contribution_item' }],
      warnings: []
    })
    montar(<AntesDeAprobar aporte={sinJustificar} escribe />, { usuario: INVERSION, permisos: EQUIPO_DE_INVERSION })
    expect(await screen.findByText(/escriba una justificación para poder aprobarlo/)).toBeInTheDocument()
    await waitFor(() => expect(red!.a('POST', '/sgspe/transition-checks')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Escribir la justificación' }))
    const drawer = await screen.findByRole('dialog', { name: 'Justificación de la desviación' })
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'acuerdo de la mesa')
    await userEvent.type(await within(drawer).findByLabelText(/^guideline_deviation_justification/), 'La asociación administra el fondo')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('PUT', '/objects/social_contribution/records/a1')).toHaveLength(1))
    const [cambio] = red.a('PUT', '/objects/social_contribution/records/a1')
    expect(cambio.cuerpo).toMatchObject({ attributes: { guideline_deviation_justification: 'La asociación administra el fondo' } })
    expect(cambio.cabeceras.get('If-Match')).toBe(`"${APORTE.updatedAt}"`)
    expect(cambio.cabeceras.get('X-Change-Reason')).toBe("UTF-8''acuerdo%20de%20la%20mesa")
    await waitFor(() => expect(red!.a('POST', '/sgspe/transition-checks').length).toBeGreaterThanOrEqual(2))
  })

  it('la sinergia sin acuerdo vigente bloquea aunque haya justificación, y lo dice', async () => {
    const conSinergia = registro(
      'a1',
      { ...APORTE.attributes, has_institutional_synergy: true, guideline_deviation_justification: 'Prioridad comunal' },
      { state: 'requested' }
    )
    fetch = mockFetch(rutas(conSinergia, [transicion('approve_direct', 'Aprobar sin revisión interna')]))
    red = consultaEnSeco({
      allowed: false,
      blocking: [{ code: 'SYNERGY_AGREEMENT_REQUIRED', message: 'El acuerdo de sinergia está VENCIDO', field: 'agreement' }],
      warnings: [{ code: 'PAID_LABOR', message: 'El ítem Jornales es MANO DE OBRA', field: 'contribution_item' }]
    })
    montar(<AntesDeAprobar aporte={conSinergia} escribe />, { usuario: INVERSION, permisos: EQUIPO_DE_INVERSION })
    await waitFor(() => expect(within(fila('Acuerdo de sinergia vigente')).getByText('Bloquea')).toBeInTheDocument())
    expect(within(fila('Sin mano de obra')).getByText('Advierte')).toBeInTheDocument()
    expect(screen.getByText(/La sinergia sin un acuerdo vigente no se cubre con la justificación/)).toBeInTheDocument()
    expect(screen.getByText('Prioridad comunal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar la justificación' })).toBeInTheDocument()
  })

  it('quien aprueba consulta «Aprobar»; la segregación dice por qué no, con el texto del código y sin ofrecer escribir', async () => {
    fetch = mockFetch(rutas(APORTE, [transicion('approve', 'Aprobar'), transicion('reject', 'Rechazar')]))
    red = consultaEnSeco({
      allowed: false,
      blocking: [{ code: 'SEGREGATION_OF_DUTIES', message: 'Usted registró este aporte (P5)', field: 'record' }],
      warnings: []
    })
    montar(<AntesDeAprobar aporte={APORTE} escribe />, { usuario: APROBACION_DE_APORTES, permisos: PERMISOS_DE_APROBACION })
    await waitFor(() => expect(within(fila('Quién aprueba')).getByText('Bloquea')).toBeInTheDocument())
    expect(
      within(fila('Quién aprueba')).getByText(
        'Por segregación de funciones, quien registró un compromiso, un aporte o un programa no lo aprueba, y el responsable de un compromiso no lo verifica.'
      )
    ).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/transition-checks')[0].cuerpo).toMatchObject({ transition: 'approve' })
    expect(screen.queryByRole('button', { name: /justificación/ })).not.toBeInTheDocument()
  })

  it('si no se pudieron leer las transiciones lo dice y no consulta en seco a ciegas', async () => {
    fetch = mockFetch([
      { path: '/objects/social_contribution/records/a1/transitions', status: 500, body: { title: 'Error', status: 500 } },
      ...rutas(APORTE, [])
    ])
    red = consultaEnSeco({ allowed: true, blocking: [], warnings: [] })
    montar(<AntesDeAprobar aporte={APORTE} escribe />, { usuario: INVERSION, permisos: EQUIPO_DE_INVERSION })
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText(/Las reglas de «Aprobar» corren aquí/)).not.toBeInTheDocument()
    expect(red.a('POST', '/sgspe/transition-checks')).toHaveLength(0)
  })

  it('sin la justificación en lo leído (campo que la cuenta no lee) no ofrece escribirla', async () => {
    const { guideline_deviation_justification: _sinClave, ...atributos } = APORTE.attributes
    const sinClave = { ...APORTE, attributes: atributos }
    fetch = mockFetch(rutas(sinClave, [transicion('approve_direct', 'Aprobar sin revisión interna')]))
    red = consultaEnSeco({
      allowed: false,
      blocking: [{ code: 'MONETARY_DONATION', message: 'Una DONACION con DINERO', field: 'contribution_item' }],
      warnings: []
    })
    montar(<AntesDeAprobar aporte={sinClave} escribe />, { usuario: INVERSION, permisos: EQUIPO_DE_INVERSION })
    expect(await screen.findByText(/escriba una justificación para poder aprobarlo/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Escribir la justificación' })).not.toBeInTheDocument()
  })
})
