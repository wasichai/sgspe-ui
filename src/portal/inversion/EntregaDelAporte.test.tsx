import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APORTE, baseDeInversion, EQUIPO_DE_INVERSION, INVERSION } from '../../test/inversion'
import { definicion, montar, pagina, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import type { Registro } from '../datos/registros'
import { EntregaDelAporte } from './EntregaDelAporte'

vi.mock('../documentos/exif', () => ({ leerExif: async () => ({}) }))

// la entrega de un aporte (spec F5 §3.5, decisión 2, P8): una sola, capturada en procured sin monto entregado, con sus tres
// evidencias subidas antes y propuestas una tras otra; sus requisitos a la vista; congelada desde delivered
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-10T15:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const ADQUIRIDO = registro('a1', APORTE.attributes, { state: 'procured', updatedAt: APORTE.updatedAt })
const ENTREGA = registro(
  'dl9',
  {
    social_contribution: 'a1',
    delivery_date: '2026-10-09',
    place: 'Plaza de la institución',
    delivered_items: 'Estantes y transporte',
    conformity_given: true
  },
  { updatedAt: '2026-10-09T20:00:00Z' }
)
const DEF_EVIDENCIA = definicion('evidence', [
  ['evidence_type', { type: 'ENUM', enumOptions: ['ACTA DE RECEPCION', 'FOTO', 'COMPROBANTE', 'OTRO'] }],
  ['classification', { type: 'ENUM', enumOptions: ['PUBLICA', 'INTERNA', 'DATOS PERSONALES'] }],
  'title'
])
const evidencia = (id: string, tipo: string) => registro(id, { title: `Evidencia ${tipo}`, evidence_type: tipo, classification: 'INTERNA' })

const rutas = (entregas: Registro[] = [], extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeInversion(),
  { path: '/objects/delivery/records', body: pagina(entregas) },
  { path: '/objects/receipt/records', body: pagina([]) },
  { path: '/metadata/objects/evidence', body: DEF_EVIDENCIA },
  { path: '/objects/delivery/records/dl9/related/evidence_delivery', body: pagina([evidencia('ev1', 'ACTA DE RECEPCION'), evidencia('ev2', 'FOTO')]) }
]
const abrir = (aporte: Registro = ADQUIRIDO) => montar(<EntregaDelAporte aporte={aporte} escribe />, { usuario: INVERSION, permisos: EQUIPO_DE_INVERSION })

describe('S44 · entrega del aporte', () => {
  it('en Adquirido registra la única entrega sin monto, con sus evidencias por id, la clave y el motivo; propone la evidencia que falta', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/evidence/files/file',
        responder: () => jsonResponse({ id: 'f1', name: 'acta.pdf', contentType: 'application/pdf', size: 10, sha256: 'x' }, 201)
      },
      {
        method: 'POST',
        path: '/sgspe/evidence',
        responder: () => jsonResponse(registro('ev1', { title: 'Acta firmada', evidence_type: 'ACTA DE RECEPCION' }), 201)
      },
      {
        method: 'POST',
        path: '/sgspe/social-contributions/a1/deliveries',
        responder: () => jsonResponse({ delivery: ENTREGA, contribution: ADQUIRIDO }, 201)
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }))
    const panel = await screen.findByRole('dialog', { name: 'Registrar la entrega del aporte' })
    expect(within(panel).queryByLabelText('Monto entregado')).not.toBeInTheDocument()
    expect(within(panel).getByText('Faltan: ACTA DE RECEPCION, FOTO, COMPROBANTE')).toBeInTheDocument()
    const subida = within(panel).getByRole('group', { name: 'Subir una evidencia' })
    expect(within(subida).getByLabelText('Tipo de evidencia')).toHaveValue('ACTA DE RECEPCION')
    expect(within(subida).getByLabelText('Clasificación')).toHaveValue('DATOS PERSONALES')
    await userEvent.upload(within(subida).getByLabelText(/Archivo/), new File(['%PDF'], 'acta.pdf', { type: 'application/pdf' }))
    await userEvent.type(within(subida).getByLabelText('Título'), 'Acta firmada')
    await userEvent.click(within(subida).getByRole('button', { name: 'Subir evidencia' }))
    expect(await within(panel).findByText('Acta firmada · ACTA DE RECEPCION')).toBeInTheDocument()
    expect(within(panel).getByText('Faltan: FOTO, COMPROBANTE')).toBeInTheDocument()
    // la siguiente que falta queda propuesta, también con DATOS PERSONALES (una foto con personas)
    await waitFor(() =>
      expect(within(within(panel).getByRole('group', { name: 'Subir una evidencia' })).getByLabelText('Tipo de evidencia')).toHaveValue('FOTO')
    )
    expect(red.a('POST', '/sgspe/social-contributions/a1/deliveries')).toHaveLength(0)
    await userEvent.type(within(panel).getByLabelText('Qué se entregó'), 'Estantes y transporte')
    await userEvent.click(within(panel).getByLabelText('El grupo de interés dio conformidad'))
    await userEvent.type(within(panel).getByLabelText('Quiénes dieron la conformidad'), 'Directiva de la asociación')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Entrega en la plaza')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/social-contributions/a1/deliveries')).toHaveLength(1))
    const [alta] = red.a('POST', '/sgspe/social-contributions/a1/deliveries')
    expect(alta.cuerpo).toEqual({
      attributes: {
        delivery_date: '2026-10-10',
        delivered_items: 'Estantes y transporte',
        conformity_given: true,
        conformity_by: 'Directiva de la asociación'
      },
      evidence: ['ev1']
    })
    expect(alta.cabeceras.get('If-Match')).toBe(`"${APORTE.updatedAt}"`)
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Entrega%20en%20la%20plaza")
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Entrega guardada.')
  })

  it('otra persona ya registró la entrega: DELIVERY_EXISTS dice su texto y relee la entrega registrada', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/social-contributions/a1/deliveries',
        responder: () => problema(409, 'ya tiene entrega', [{ field: 'social_contribution', message: 'DELIVERY_EXISTS' }])
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }))
    const panel = await screen.findByRole('dialog', { name: 'Registrar la entrega del aporte' })
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Entrega en la plaza')
    const lecturas = red.a('GET', '/objects/delivery/records').length
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    expect(
      await within(panel).findByText('Este aporte ya tiene su entrega: un aporte se entrega una sola vez. Corrija la entrega registrada.')
    ).toBeInTheDocument()
    await waitFor(() => expect(red!.a('GET', '/objects/delivery/records').length).toBeGreaterThan(lecturas))
    // otra entrega no se guarda: «Guardar entrega» se apaga y se dice dónde se vinculan las evidencias subidas
    expect(within(panel).getByRole('button', { name: 'Guardar entrega' })).toBeDisabled()
    expect(within(panel).getByText(/las evidencias que subió se vinculan desde su tarjeta/)).toBeInTheDocument()
  })

  it('la entrega registrada se ve con sus requisitos; no se ofrece otra; lo que la cuenta no lee dice «Restringido»', async () => {
    fetch = mockFetch(rutas([ENTREGA]))
    abrir()
    expect(await screen.findByRole('heading', { name: /^Entrega del/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Corregir' })).toBeInTheDocument()
    expect(screen.getAllByText('Restringido').length).toBeGreaterThanOrEqual(2)
    const requisitos = screen.getByRole('region', { name: 'Lo que pide «Registrar entrega»' })
    const estadoDe = (nombre: string) => (within(requisitos).getByText(nombre).closest('li') as HTMLElement).textContent
    await waitFor(() => expect(estadoDe('ACTA DE RECEPCION')).toContain('Lista'))
    expect(estadoDe('FOTO')).toContain('Lista')
    expect(estadoDe('COMPROBANTE')).toContain('Falta')
    expect(estadoDe('Conformidad dada')).toContain('Lista')
    expect(estadoDe('Quiénes dieron la conformidad')).toContain('Su cuenta no lo lee')
    expect(screen.getByRole('button', { name: 'Subir acta de recepción firmada' })).toBeInTheDocument()
  })

  it('desde Entregado la entrega y sus evidencias no cambian: sin Corregir ni subir, y lo dice', async () => {
    fetch = mockFetch(rutas([ENTREGA]))
    abrir({ ...ADQUIRIDO, state: 'delivered' })
    expect(await screen.findByText('El aporte ya se entregó o se anuló: su entrega y sus evidencias no cambian.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Subir acta de recepción firmada' })).not.toBeInTheDocument()
  })

  it('antes de adquirir no ofrece registrar y dice cuándo se registra', async () => {
    fetch = mockFetch(rutas())
    abrir({ ...ADQUIRIDO, state: 'approved' })
    expect(await screen.findByText('La entrega se registra cuando el aporte está adquirido.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).not.toBeInTheDocument()
  })
})
