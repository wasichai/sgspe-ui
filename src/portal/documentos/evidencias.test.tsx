import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definicion, montar, pagina, registro } from '../../test/montar'
import { permisos } from '../../test/portal'
import { archivoXlsx, espiarRed, problema, type Red } from '../../test/red'
import { nombreNeutro, TAMANO_MAXIMO } from './api'
import { DocumentosEmitidos } from './DocumentosEmitidos'
import { EvidenciasDelRegistro } from './EvidenciasDelRegistro'

// la foto trae su EXIF; aquí se fija lo que leería (exif.test.ts prueba la lectura)
vi.mock('./exif', () => ({ leerExif: async () => ({ capturadoEn: '2026-10-07T19:03:11.000Z', ubicacion: [-77.53, -9.525] }) }))

// api.md §4.9 (decisión D1): subir es el archivo a wasichai-files y después el registro con Idempotency-Key, sin volver a subir
// el archivo en un reintento; la descarga de una CONFIDENCIAL pide DOWNLOAD_RESTRICTED (Review Focus 2 de 3.2); un vínculo con
// un compromiso (requiresReason) lleva motivo; los documentos emitidos se abren congelados
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const COMPROMISO = registro('c1', { project: 'p1', code: 'C-1', title: 'Reservorio' }, { state: 'in_progress' })
const DESCRIPTOR = { id: 'f1', name: 'acta.pdf', contentType: 'application/pdf', size: 12_500, sha256: 'ab' }
const DEF_EVIDENCIA = definicion('evidence', [
  ['evidence_type', { type: 'ENUM', enumOptions: ['ACTA DE ENTREGA', 'FOTO', 'CARTA'] }],
  ['classification', { type: 'ENUM', enumOptions: ['PUBLICA', 'INTERNA', 'CONFIDENCIAL', 'DATOS PERSONALES'] }],
  'title',
  ['document_date', { type: 'DATE' }],
  'author',
  ['people_identifiable', { type: 'BOOLEAN' }],
  ['photo_consent_given', { type: 'BOOLEAN' }],
  ['file', { type: 'FILE' }]
])
const PUBLICA = registro('ev1', {
  title: 'Acta de entrega',
  evidence_type: 'ACTA DE ENTREGA',
  classification: 'PUBLICA',
  file: DESCRIPTOR,
  document_date: '2026-10-01'
})
const CONFIDENCIAL = registro('ev2', {
  title: 'Lista de beneficiarios',
  evidence_type: 'OTRO',
  classification: 'CONFIDENCIAL',
  file: { ...DESCRIPTOR, id: 'f2' }
})
const SIN_CLASIFICACION = registro('ev3', { title: 'Foto', evidence_type: 'FOTO', file: { ...DESCRIPTOR, id: 'f3' } })
// una restringida sin título, subida antes de P59 con su nombre original
const SIN_TITULO = registro('ev4', {
  evidence_type: 'OTRO',
  classification: 'DATOS PERSONALES',
  file: { ...DESCRIPTOR, id: 'f4', name: 'padron-de-comuneros.xlsx' }
})

const base = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  { path: '/metadata/objects/evidence', body: DEF_EVIDENCIA },
  { path: '/objects/commitment/records/c1/related/evidence_commitment', body: pagina([PUBLICA, CONFIDENCIAL, SIN_CLASIFICACION, SIN_TITULO]) }
]
const EQUIPO = permisos({ commitment: ['READ', 'UPDATE'], evidence: ['READ', 'CREATE', 'UPDATE'] })

describe('evidencias de un registro', () => {
  it('sube en dos pasos con el EXIF, el vínculo y el motivo, y un reintento repite la clave sin volver a subir el archivo', async () => {
    fetch = mockFetch(base())
    let altas = 0
    red = espiarRed([
      { method: 'POST', path: '/objects/evidence/files/file', responder: () => jsonResponse(DESCRIPTOR, 201) },
      {
        method: 'POST',
        path: '/sgspe/evidence',
        responder: () => (++altas === 1 ? new Response(null, { status: 503 }) : jsonResponse(registro('ev9', { title: 'Acta firmada' }), 201))
      }
    ])
    montar(<EvidenciasDelRegistro objeto="commitment" registro={COMPROMISO} escribe />, { permisos: EQUIPO })
    await userEvent.click(await screen.findByRole('button', { name: 'Subir evidencia' }))
    const panel = await screen.findByRole('group', { name: 'Subir una evidencia' })
    await userEvent.upload(
      within(panel).getByLabelText('Archivo (PDF, foto, hoja, documento o texto; hasta 20 MB)'),
      new File(['jpeg'], 'foto.jpg', { type: 'image/jpeg' })
    )
    expect(await within(panel).findByText(/Foto tomada el/)).toBeInTheDocument()
    await userEvent.selectOptions(within(panel).getByLabelText('Tipo de evidencia'), 'FOTO')
    await userEvent.selectOptions(within(panel).getByLabelText('Clasificación'), 'INTERNA')
    await userEvent.type(within(panel).getByLabelText('Título'), 'Acta firmada')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Sustenta la entrega')
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    expect(await within(panel).findByRole('alert')).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/evidence')).toHaveLength(2))
    expect(red.a('POST', '/objects/evidence/files/file')).toHaveLength(1)
    const [primera, segunda] = red.a('POST', '/sgspe/evidence')
    expect(primera.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(segunda.cabeceras.get('Idempotency-Key')).toBe(primera.cabeceras.get('Idempotency-Key'))
    expect(segunda.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Sustenta%20la%20entrega")
    expect(segunda.cuerpo).toEqual({
      attributes: {
        file: 'f1',
        evidence_type: 'FOTO',
        classification: 'INTERNA',
        title: 'Acta firmada',
        people_identifiable: false,
        captured_at: '2026-10-07T19:03:11.000Z',
        project: 'p1'
      },
      geometries: { location: { type: 'Point', coordinates: [-77.53, -9.525] } },
      links: [{ object: 'commitment', recordId: 'c1' }]
    })
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Subir una evidencia' })).not.toBeInTheDocument())
  })

  it('sin archivo, tipo ni clasificación lo dice junto a cada control y no pide nada', async () => {
    fetch = mockFetch(base())
    red = espiarRed()
    montar(<EvidenciasDelRegistro objeto="commitment" registro={COMPROMISO} escribe />, { permisos: EQUIPO })
    await userEvent.click(await screen.findByRole('button', { name: 'Subir evidencia' }))
    const panel = await screen.findByRole('group', { name: 'Subir una evidencia' })
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    expect(await within(panel).findByText('Elija el archivo')).toBeInTheDocument()
    expect(within(panel).getAllByText('Elija una opción')).toHaveLength(2)
    expect(within(panel).getByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('POST', '/objects/evidence/files/file')).toHaveLength(0)
    expect(red.a('POST', '/sgspe/evidence')).toHaveLength(0)
  })

  it('un archivo rechazado por su tamaño dice el texto del código junto al archivo', async () => {
    fetch = mockFetch(base())
    red = espiarRed([
      { method: 'POST', path: '/objects/evidence/files/file', responder: () => problema(400, 'grande', [{ field: 'file', message: 'FILE_TOO_LARGE' }]) }
    ])
    montar(<EvidenciasDelRegistro objeto="commitment" registro={COMPROMISO} escribe />, { permisos: EQUIPO })
    await userEvent.click(await screen.findByRole('button', { name: 'Subir evidencia' }))
    const panel = await screen.findByRole('group', { name: 'Subir una evidencia' })
    await userEvent.upload(
      within(panel).getByLabelText('Archivo (PDF, foto, hoja, documento o texto; hasta 20 MB)'),
      new File(['x'], 'acta.pdf', { type: 'application/pdf' })
    )
    await userEvent.selectOptions(within(panel).getByLabelText('Tipo de evidencia'), 'ACTA DE ENTREGA')
    await userEvent.selectOptions(within(panel).getByLabelText('Clasificación'), 'PUBLICA')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'acta')
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    expect(await within(panel).findByText('El archivo pasa de 20 MB: redúzcalo o divídalo en varias evidencias.')).toBeInTheDocument()
    expect(within(panel).queryByText('FILE_TOO_LARGE')).not.toBeInTheDocument()
    expect(red.a('POST', '/sgspe/evidence')).toHaveLength(0)
    // elegir otro archivo quita el error del anterior
    await userEvent.upload(
      within(panel).getByLabelText('Archivo (PDF, foto, hoja, documento o texto; hasta 20 MB)'),
      new File(['x'], 'acta-corta.pdf', { type: 'application/pdf' })
    )
    await waitFor(() => expect(within(panel).queryByText('El archivo pasa de 20 MB: redúzcalo o divídalo en varias evidencias.')).not.toBeInTheDocument())
  })

  it('un archivo de más de 20 MB lo dice junto al archivo y no lo sube', async () => {
    fetch = mockFetch(base())
    red = espiarRed()
    montar(<EvidenciasDelRegistro objeto="commitment" registro={COMPROMISO} escribe />, { permisos: EQUIPO })
    await userEvent.click(await screen.findByRole('button', { name: 'Subir evidencia' }))
    const panel = await screen.findByRole('group', { name: 'Subir una evidencia' })
    const grande = new File(['x'], 'video.pdf', { type: 'application/pdf' })
    Object.defineProperty(grande, 'size', { value: TAMANO_MAXIMO + 1 })
    await userEvent.upload(within(panel).getByLabelText('Archivo (PDF, foto, hoja, documento o texto; hasta 20 MB)'), grande)
    expect(await within(panel).findByText('El archivo pasa de 20 MB: redúzcalo o divídalo en varias evidencias.')).toBeInTheDocument()
    await userEvent.selectOptions(within(panel).getByLabelText('Tipo de evidencia'), 'CARTA')
    await userEvent.selectOptions(within(panel).getByLabelText('Clasificación'), 'PUBLICA')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'carta')
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    expect(red.a('POST', '/objects/evidence/files/file')).toHaveLength(0)
  })

  it('una CONFIDENCIAL o de DATOS PERSONALES viaja con un nombre neutro con la hora de Lima: el original no sale (P59)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T02:30:05Z'))
    fetch = mockFetch(base())
    red = espiarRed([
      { method: 'POST', path: '/objects/evidence/files/file', responder: () => jsonResponse({ ...DESCRIPTOR, name: 'evidencia-20261009-213005.pdf' }, 201) },
      { method: 'POST', path: '/sgspe/evidence', responder: () => jsonResponse(registro('ev9', {}), 201) }
    ])
    montar(<EvidenciasDelRegistro objeto="commitment" registro={COMPROMISO} escribe />, { permisos: EQUIPO })
    await userEvent.click(await screen.findByRole('button', { name: 'Subir evidencia' }))
    const panel = await screen.findByRole('group', { name: 'Subir una evidencia' })
    await userEvent.upload(
      within(panel).getByLabelText('Archivo (PDF, foto, hoja, documento o texto; hasta 20 MB)'),
      new File(['%PDF'], 'padron-de-comuneros.PDF', { type: 'application/pdf' })
    )
    await userEvent.selectOptions(within(panel).getByLabelText('Tipo de evidencia'), 'CARTA')
    await userEvent.selectOptions(within(panel).getByLabelText('Clasificación'), 'DATOS PERSONALES')
    expect(within(panel).getByText(/se sube con un nombre neutro/)).toBeInTheDocument()
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'padrón')
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/evidence')).toHaveLength(1))
    const [subida] = red.a('POST', '/objects/evidence/files/file')
    const enviado = subida.formulario?.get('file') as File
    expect(enviado.name).toBe('evidencia-20261009-213005.pdf')
    expect(JSON.stringify(red.llamadas.map((l) => l.cuerpo))).not.toContain('padron-de-comuneros')
    const enero = new Date('2026-01-01T05:00:00Z')
    expect(nombreNeutro(new File(['x'], 'sin-extension'), enero)).toBe('evidencia-20260101-000000')
    // lo que sigue al último punto no siempre es una extensión: solo una conocida se conserva; si no, la del tipo MIME o ninguna
    expect(nombreNeutro(new File(['x'], 'Lista Sra. Mamani'), enero)).toBe('evidencia-20260101-000000')
    expect(nombreNeutro(new File(['x'], 'Lista Sra. Mamani', { type: 'image/jpeg' }), enero)).toBe('evidencia-20260101-000000.jpg')
    expect(
      nombreNeutro(new File(['x'], 'Padron comuneros v2.Juan Quispe', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), enero)
    ).toBe('evidencia-20260101-000000.xlsx')
    expect(nombreNeutro(new File(['x'], 'DNI 12345678.Quispe', { type: 'application/pdf' }), enero)).toBe('evidencia-20260101-000000.pdf')
    expect(nombreNeutro(new File(['x'], 'DNI 12345678.Quispe'), enero)).toBe('evidencia-20260101-000000')
    expect(nombreNeutro(new File(['x'], 'Foto.JPEG', { type: 'image/jpeg' }), enero)).toBe('evidencia-20260101-000000.jpeg')
  })

  // decisión 18: lo subido se recuerda por archivo y por clasificación. la primera subida, con el nombre original, queda
  // huérfana en wasichai-files; se acepta (ver useRegistrarEvidencia)
  it('pasar a CONFIDENCIAL tras un alta fallida vuelve a subir el archivo con el nombre neutro', async () => {
    fetch = mockFetch(base())
    let altas = 0
    red = espiarRed([
      { method: 'POST', path: '/objects/evidence/files/file', responder: () => jsonResponse(DESCRIPTOR, 201) },
      {
        method: 'POST',
        path: '/sgspe/evidence',
        responder: () => (++altas === 1 ? new Response(null, { status: 503 }) : jsonResponse(registro('ev9', {}), 201))
      }
    ])
    montar(<EvidenciasDelRegistro objeto="commitment" registro={COMPROMISO} escribe />, { permisos: EQUIPO })
    await userEvent.click(await screen.findByRole('button', { name: 'Subir evidencia' }))
    const panel = await screen.findByRole('group', { name: 'Subir una evidencia' })
    await userEvent.upload(
      within(panel).getByLabelText('Archivo (PDF, foto, hoja, documento o texto; hasta 20 MB)'),
      new File(['%PDF'], 'padron-de-comuneros.pdf', { type: 'application/pdf' })
    )
    await userEvent.selectOptions(within(panel).getByLabelText('Tipo de evidencia'), 'CARTA')
    await userEvent.selectOptions(within(panel).getByLabelText('Clasificación'), 'INTERNA')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'padrón')
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    expect(await within(panel).findByRole('alert')).toBeInTheDocument()
    await userEvent.selectOptions(within(panel).getByLabelText('Clasificación'), 'CONFIDENCIAL')
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/evidence')).toHaveLength(2))
    const [primera, segunda] = red.a('POST', '/objects/evidence/files/file')
    expect((primera.formulario?.get('file') as File).name).toBe('padron-de-comuneros.pdf')
    expect((segunda.formulario?.get('file') as File).name).toMatch(/^evidencia-\d{8}-\d{6}\.pdf$/)
    expect(red.a('POST', '/sgspe/evidence')[1].cuerpo).toMatchObject({ attributes: { classification: 'CONFIDENCIAL' } })
  })

  it('EVIDENCE_FILE_IN_USE lo dice junto al archivo; el siguiente intento lo sube de nuevo con otra clave', async () => {
    fetch = mockFetch(base())
    let altas = 0
    red = espiarRed([
      { method: 'POST', path: '/objects/evidence/files/file', responder: () => jsonResponse(DESCRIPTOR, 201) },
      {
        method: 'POST',
        path: '/sgspe/evidence',
        responder: () =>
          ++altas === 1 ? problema(409, 'en uso', [{ field: 'file', message: 'EVIDENCE_FILE_IN_USE' }]) : jsonResponse(registro('ev9', {}), 201)
      }
    ])
    montar(<EvidenciasDelRegistro objeto="commitment" registro={COMPROMISO} escribe />, { permisos: EQUIPO })
    await userEvent.click(await screen.findByRole('button', { name: 'Subir evidencia' }))
    const panel = await screen.findByRole('group', { name: 'Subir una evidencia' })
    await userEvent.upload(
      within(panel).getByLabelText('Archivo (PDF, foto, hoja, documento o texto; hasta 20 MB)'),
      new File(['%PDF'], 'carta.pdf', { type: 'application/pdf' })
    )
    await userEvent.selectOptions(within(panel).getByLabelText('Tipo de evidencia'), 'CARTA')
    await userEvent.selectOptions(within(panel).getByLabelText('Clasificación'), 'INTERNA')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'carta')
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    expect(
      await within(panel).findByText(
        'Ese archivo ya es de otra evidencia: elíjalo de nuevo para subirlo otra vez, o reemplace esa evidencia con una versión nueva.'
      )
    ).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/evidence')).toHaveLength(2))
    expect(red.a('POST', '/objects/evidence/files/file')).toHaveLength(2)
    const [primera, segunda] = red.a('POST', '/sgspe/evidence')
    expect(segunda.cabeceras.get('Idempotency-Key')).not.toBe(primera.cabeceras.get('Idempotency-Key'))
  })

  it('sin DOWNLOAD_RESTRICTED una CONFIDENCIAL no se descarga y una clasificación ilegible es «Restringido»', async () => {
    fetch = mockFetch(base())
    red = espiarRed([{ path: '/sgspe/evidence/ev1/content', responder: () => archivoXlsx('acta.pdf') }])
    montar(<EvidenciasDelRegistro objeto="commitment" registro={COMPROMISO} escribe={false} />, {
      permisos: permisos({ commitment: ['READ'], evidence: ['READ'] })
    })
    const tabla = await screen.findByRole('table', { name: 'Evidencias' })
    const fila = (nombre: string) => within(tabla).getByRole('link', { name: nombre }).closest('tr') as HTMLElement
    expect(within(fila('Lista de beneficiarios')).queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument()
    expect(within(fila('Lista de beneficiarios')).getByText('Restringida')).toBeInTheDocument()
    expect(within(fila('Foto')).getByText('Restringido')).toBeInTheDocument()
    expect(within(fila('Foto')).queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument()
    expect(within(fila('Lista de beneficiarios')).getByText(/hace falta permiso para descargar archivos restringidos/)).toBeInTheDocument()
    // sin leer la clasificación, la ayuda no insinúa cuál es
    expect(within(fila('Foto')).getByText(/Su rol no lee la clasificación de esta evidencia/)).toBeInTheDocument()
    expect(within(fila('Foto')).queryByText(/CONFIDENCIAL/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Subir evidencia' })).not.toBeInTheDocument()
    await userEvent.click(within(fila('Acta de entrega')).getByRole('button', { name: 'Descargar Acta de entrega' }))
    await waitFor(() => expect(red!.a('GET', '/sgspe/evidence/ev1/content')).toHaveLength(1))
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(within(fila('Acta de entrega')).getByText('12.2 kB')).toBeInTheDocument()
    // P59: el nombre del archivo de una restringida no se dice a quien no la descarga
    expect(within(tabla).getByRole('link', { name: 'Archivo reservado' })).toBeInTheDocument()
    expect(screen.queryByText(/padron-de-comuneros/)).not.toBeInTheDocument()
  })

  it('con DOWNLOAD_RESTRICTED la CONFIDENCIAL se descarga; desvincular de un compromiso pide motivo', async () => {
    fetch = mockFetch(base([{ method: 'DELETE', path: '/sgspe/evidence/ev2/links/commitment/c1', status: 204 }]))
    red = espiarRed()
    montar(<EvidenciasDelRegistro objeto="commitment" registro={COMPROMISO} escribe />, {
      permisos: permisos({ commitment: ['READ', 'UPDATE'], evidence: ['READ', 'CREATE', 'UPDATE', 'DOWNLOAD_RESTRICTED'] })
    })
    expect(await screen.findByRole('button', { name: 'Descargar Lista de beneficiarios' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'padron-de-comuneros.xlsx' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Desvincular Lista de beneficiarios' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Desvincular la evidencia' }))
    expect(await within(dialogo).findByText('Escriba el motivo del cambio')).toBeInTheDocument()
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'No corresponde')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Desvincular la evidencia' }))
    await waitFor(() => expect(red!.a('DELETE', '/sgspe/evidence/ev2/links/commitment/c1')).toHaveLength(1))
    expect(red.a('DELETE', '/sgspe/evidence/ev2/links/commitment/c1')[0].cabeceras.get('X-Change-Reason')).toBe("UTF-8''No%20corresponde")
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('mientras las evidencias cargan no dice que no hay ninguna, y si fallan lo dice con reintento', async () => {
    fetch = mockFetch([{ path: '/metadata/objects/evidence', body: DEF_EVIDENCIA }])
    red = espiarRed([{ path: '/objects/commitment/records/c1/related/evidence_commitment', responder: () => problema(500, 'caído') }])
    montar(<EvidenciasDelRegistro objeto="commitment" registro={COMPROMISO} escribe />, { permisos: EQUIPO })
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('Este registro todavía no tiene evidencias.')).not.toBeInTheDocument()
  })
})

const SNAPSHOT = {
  template: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Minuta de la asamblea de octubre' }] }] },
  values: {},
  platform: {},
  related: {},
  objectName: 'engagement',
  objectLabel: 'Interacción',
  number: 'MR-2026-001',
  issuedAt: '2026-10-07T15:00:00Z'
}
const DOCUMENTO = {
  id: 'd1',
  number: 'MR-2026-001',
  year: 2026,
  sequence: 1,
  status: 'VALID',
  recordId: 'e1',
  objectName: 'engagement',
  issuedAt: '2026-10-07T15:00:00Z',
  snapshot: SNAPSHOT
}

// en F3 solo la interacción tiene tipos de documento (meeting-minutes y attendance-list, plan 3.1): el «Acta de entrega» espera a UPS-23
describe('documentos emitidos', () => {
  it('lista los documentos, abre uno congelado con su enlace de impresión y emite otro con el tipo elegido', async () => {
    fetch = mockFetch([
      { path: '/objects/engagement/records/e1/documents', body: [DOCUMENTO] },
      {
        path: '/objects/engagement/document-types',
        body: [
          { name: 'meeting-minutes', label: 'Minuta de reunión' },
          { name: 'attendance-list', label: 'Lista de asistentes' }
        ]
      },
      { method: 'POST', path: '/objects/engagement/records/e1/documents/attendance-list', status: 201, body: { ...DOCUMENTO, id: 'd2', number: 'LA-2026-001' } }
    ])
    red = espiarRed()
    montar(<DocumentosEmitidos objeto="engagement" registroId="e1" escribe />, { permisos: permisos({ engagement: ['READ', 'UPDATE'] }) })
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir MR-2026-001' }))
    const panel = await screen.findByRole('dialog')
    expect(within(panel).getByText('Minuta de la asamblea de octubre')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Imprimir o guardar PDF' })).toHaveAttribute('href', '/admin/documents/d1/print')
    await userEvent.keyboard('{Escape}')
    await userEvent.selectOptions(screen.getByLabelText('Tipo de documento'), 'attendance-list')
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }))
    expect(await screen.findByText('Documento LA-2026-001 emitido.')).toBeInTheDocument()
    expect(red.a('POST', '/objects/engagement/records/e1/documents/attendance-list')).toHaveLength(1)
  })

  // P62: emitir a mano es editar el registro; el servidor pide UPDATE, la asignación vigente al proyecto y, sin EDIT_ANY, ser
  // quien lo creó. la ficha no sabe quién lo creó, así que cada negativa se dice con su texto, nunca con el código
  it('cada 403 de la emisión se dice con su motivo, sin el código', async () => {
    const negativas = [
      problema(403, 'sin edición', [{ field: 'record', message: 'ACTION_REQUIRED' }]),
      problema(403, 'sin asignación', [{ field: 'project', message: 'NOT_ASSIGNED' }]),
      new Response(JSON.stringify({ title: 'Error', status: 403, detail: 'no es suyo', errors: [{ message: 'NOT_OWN_RECORD' }] }), {
        status: 403,
        headers: { 'Content-Type': 'application/problem+json' }
      }),
      problema(403, 'no lo lee', [{ field: 'record', message: 'OBJECT_NOT_READABLE' }])
    ]
    fetch = mockFetch([
      { path: '/objects/engagement/records/e1/documents', body: [DOCUMENTO] },
      { path: '/objects/engagement/document-types', body: [{ name: 'meeting-minutes', label: 'Minuta de reunión' }] }
    ])
    red = espiarRed([{ method: 'POST', path: '/objects/engagement/records/e1/documents/meeting-minutes', responder: () => negativas.shift()! }])
    montar(<DocumentosEmitidos objeto="engagement" registroId="e1" escribe />, { permisos: permisos({ engagement: ['READ', 'UPDATE'] }) })
    await userEvent.selectOptions(await screen.findByLabelText('Tipo de documento'), 'meeting-minutes')
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }))
    expect(await screen.findByText('Emitir un documento exige poder editar este registro: su rol no lo tiene.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }))
    expect(await screen.findByText('Solo el equipo del proyecto emite sus documentos: no tiene una asignación vigente a este proyecto.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }))
    expect(await screen.findByText('Solo quien creó este registro emite sus documentos: su cuenta no edita registros de otras personas.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }))
    expect(await screen.findByText('Su rol no puede leer este registro, así que no emite sus documentos.')).toBeInTheDocument()
    expect(screen.queryByText(/ACTION_REQUIRED|NOT_ASSIGNED|NOT_OWN_RECORD|OBJECT_NOT_READABLE/)).not.toBeInTheDocument()
    // el detail del servidor nombra el objeto y el proyecto: nunca se dibuja
    expect(screen.queryByText(/sin edición|sin asignación|no es suyo|no lo lee/)).not.toBeInTheDocument()
    expect(red.a('POST', '/objects/engagement/records/e1/documents/meeting-minutes')).toHaveLength(4)
  })

  // guarda de UI: emitir es editar el registro (P62) y pide la asignación vigente al proyecto (useEscribeEnProyecto)
  it('con UPDATE pero sin asignación vigente no se ofrece emitir', async () => {
    fetch = mockFetch([{ path: '/objects/engagement/records/e1/documents', body: [DOCUMENTO] }])
    red = espiarRed()
    montar(<DocumentosEmitidos objeto="engagement" registroId="e1" escribe={false} />, { permisos: permisos({ engagement: ['READ', 'UPDATE'] }) })
    expect(await screen.findByRole('button', { name: 'Abrir MR-2026-001' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Emitir' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Tipo de documento')).not.toBeInTheDocument()
    expect(red.a('GET', '/objects/engagement/document-types')).toHaveLength(0)
  })

  it('quien solo lee no emite; sin el módulo (404) no se dibuja', async () => {
    fetch = mockFetch([{ path: '/objects/engagement/records/e1/documents', body: [DOCUMENTO] }])
    red = espiarRed()
    const { unmount } = montar(<DocumentosEmitidos objeto="engagement" registroId="e1" escribe />, { permisos: permisos({ engagement: ['READ'] }) })
    expect(await screen.findByRole('button', { name: 'Abrir MR-2026-001' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Emitir' })).not.toBeInTheDocument()
    expect(red.a('GET', '/objects/engagement/document-types')).toHaveLength(0)
    unmount()
    red.restaurar()
    fetch.restore()
    fetch = mockFetch([])
    red = espiarRed()
    montar(<DocumentosEmitidos objeto="engagement" registroId="e1" escribe />, { permisos: permisos({ engagement: ['READ'] }) })
    await waitFor(() => expect(red!.a('GET', '/objects/engagement/records/e1/documents')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByText('Documentos emitidos')).not.toBeInTheDocument())
  })
})
