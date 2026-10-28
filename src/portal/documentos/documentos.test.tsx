import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeCompromisos, EQUIPO_DE_COMPROMISOS, P1 } from '../../test/compromisos'
import { definicion, montar, pagina, registro, ubicacion } from '../../test/montar'
import { permisos } from '../../test/portal'
import { archivoXlsx, espiarRed, problema, type Red } from '../../test/red'
import { BibliotecaPage } from './BibliotecaPage'
import { FichaEvidenciaPage } from './FichaEvidenciaPage'

vi.mock('./exif', () => ({ leerExif: async () => ({}) }))

// S45 y S46 (screens.md §11): la biblioteca filtra en el servidor y abre la ficha; la ficha dice qué sustenta la evidencia, la
// descarga solo con el permiso de su clasificación y cambia sus datos con If-Match y motivo
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const DESCRIPTOR = { id: 'f1', name: 'lista.pdf', contentType: 'application/pdf', size: 2_000_000, sha256: 'a1b2' }
const EV = registro(
  'ev1',
  {
    project: 'p1',
    title: 'Lista de beneficiarios',
    evidence_type: 'OTRO',
    classification: 'CONFIDENCIAL',
    file: DESCRIPTOR,
    author: 'Equipo',
    people_identifiable: false
  },
  { updatedAt: '2026-10-05T15:00:00Z' }
)
const DEF = definicion('evidence', [
  ['evidence_type', { type: 'ENUM', enumOptions: ['ACTA DE ENTREGA', 'FOTO', 'OTRO'] }],
  ['classification', { type: 'ENUM', enumOptions: ['PUBLICA', 'INTERNA', 'CONFIDENCIAL', 'DATOS PERSONALES'] }],
  'title',
  ['document_date', { type: 'DATE' }],
  'author',
  ['people_identifiable', { type: 'BOOLEAN' }],
  ['photo_consent_given', { type: 'BOOLEAN' }]
])
const relacionados = (objeto: string, contenido: unknown[] | number): MockRoute =>
  typeof contenido === 'number'
    ? { path: `/objects/evidence/records/ev1/related/evidence_${objeto}`, status: contenido, body: { title: 'x' } }
    : { path: `/objects/evidence/records/ev1/related/evidence_${objeto}`, body: pagina(contenido) }

const rutasDeFicha = (extra: MockRoute[] = [], evidencia = EV): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  { path: '/metadata/objects/evidence', body: DEF },
  { path: '/objects/evidence/records/ev1', body: evidencia },
  { path: '/objects/evidence/records', body: pagina([]) },
  relacionados('commitment', [registro('c1', { project: 'p1', code: 'C-001', title: 'Reservorio' })]),
  relacionados('delivery', [registro('dl1', { delivery_date: '2026-10-01' })]),
  // un registro sin código ni título se nombra con un texto, nunca con su id
  relacionados('engagement', [registro('en1', { project: 'p1' })]),
  // los objetos que la cuenta no lee no se listan ni son un error
  relacionados('agreement', 403),
  ...['stakeholder', 'community', 'land_parcel', 'field_visit', 'field_observation', 'study'].map((o) => relacionados(o, []))
]
const abrirFicha = (opciones: { permisos?: ReturnType<typeof permisos> } = {}) =>
  montar(<FichaEvidenciaPage />, {
    ruta: '/projects/p1/documents/ev1',
    camino: '/projects/:projectId/documents/:documentId',
    permisos: opciones.permisos ?? EQUIPO_DE_COMPROMISOS
  })

describe('S45 · biblioteca', () => {
  it('lista con la columna Proyecto, filtra en el servidor y abre la ficha bajo el proyecto', async () => {
    fetch = mockFetch([
      { path: '/metadata/objects/evidence', body: DEF },
      { path: '/objects/project/records', body: pagina([P1]) },
      { path: '/objects/evidence/records', body: pagina([EV, registro('ev2', { title: 'Del tenant', evidence_type: 'FOTO' })]) }
    ])
    red = espiarRed()
    montar(<BibliotecaPage />, { ruta: '/documents', camino: '/documents', permisos: EQUIPO_DE_COMPROMISOS })
    const tabla = await screen.findByRole('table', { name: 'Evidencias' })
    expect(await within(tabla).findByRole('link', { name: 'PRJ-01 · Pukaqaqa' })).toHaveAttribute('href', '/projects/p1/overview')
    // D12: el título es un enlace a la ficha, y el encabezado dice el total del servidor
    expect(within(tabla).getByRole('link', { name: 'Lista de beneficiarios' })).toHaveAttribute('href', '/projects/p1/documents/ev1')
    expect(screen.getByText('2 evidencias')).toBeInTheDocument()
    expect(within(tabla).getByText('1.9 MB')).toBeInTheDocument()
    // la clasificación que la cuenta no lee (ev2 no la trae) dice Restringido, nunca vacío
    expect(within(tabla).getByText('Restringido')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'FOTO')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Solo fotos con personas sin consentimiento' }))
    await waitFor(() => expect(red!.a('GET', '/objects/evidence/records').at(-1)?.ruta).toContain('photo_consent_given=false'))
    const ultima = red.a('GET', '/objects/evidence/records').at(-1)!.ruta
    expect(ultima).toContain('evidence_type=FOTO')
    expect(ultima).toContain('people_identifiable=true')
    await userEvent.click(within(await screen.findByRole('table', { name: 'Evidencias' })).getByText('Lista de beneficiarios'))
    expect(ubicacion.actual).toBe('/projects/p1/documents/ev1')
  })

  it('una restringida sin título se nombra «Archivo reservado» ante quien no la descarga, y por su archivo ante quien sí (P59)', async () => {
    const SIN_TITULO = registro('ev3', {
      project: 'p1',
      evidence_type: 'OTRO',
      classification: 'DATOS PERSONALES',
      file: { ...DESCRIPTOR, id: 'f3', name: 'padron-de-comuneros.xlsx' }
    })
    fetch = mockFetch([
      { path: '/metadata/objects/evidence', body: DEF },
      { path: '/objects/project/records', body: pagina([P1]) },
      { path: '/objects/evidence/records', body: pagina([SIN_TITULO]) }
    ])
    const vista = montar(<BibliotecaPage />, {
      ruta: '/documents',
      camino: '/documents',
      permisos: permisos({ project: ['READ'], project_assignment: ['READ'], evidence: ['READ'] })
    })
    const tabla = await screen.findByRole('table', { name: 'Evidencias' })
    expect(await within(tabla).findByText('Archivo reservado')).toBeInTheDocument()
    expect(screen.queryByText(/padron-de-comuneros/)).not.toBeInTheDocument()
    vista.unmount()
    montar(<BibliotecaPage />, { ruta: '/documents', camino: '/documents', permisos: EQUIPO_DE_COMPROMISOS })
    expect(await within(await screen.findByRole('table', { name: 'Evidencias' })).findByText('padron-de-comuneros.xlsx')).toBeInTheDocument()
  })

  it('una evidencia sin título ni archivo se nombra con un texto, nunca con su id', async () => {
    fetch = mockFetch([
      { path: '/metadata/objects/evidence', body: DEF },
      { path: '/objects/project/records', body: pagina([P1]) },
      { path: '/objects/evidence/records', body: pagina([registro('3f2a9c1e-0000-4000-8000-000000000001', { project: 'p1', evidence_type: 'OTRO' })]) }
    ])
    montar(<BibliotecaPage />, { ruta: '/documents', camino: '/documents', permisos: EQUIPO_DE_COMPROMISOS })
    const tabla = await screen.findByRole('table', { name: 'Evidencias' })
    expect(await within(tabla).findByText('Evidencia sin nombre')).toBeInTheDocument()
    expect(screen.queryByText(/3f2a9c1e/)).not.toBeInTheDocument()
  })
})

describe('S46 · ficha de evidencia', () => {
  // revisión de UX, etapa 4: en un proyecto, el encabezado común sin el enlace suelto a la biblioteca (lo dicen las migas)
  it('la ficha de evidencia lleva el encabezado común, con su tipo y sin el enlace suelto a la biblioteca', async () => {
    fetch = mockFetch(rutasDeFicha())
    abrirFicha()
    expect(await screen.findByRole('heading', { name: 'Lista de beneficiarios', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/^Evidencia · /)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Biblioteca' })).not.toBeInTheDocument()
  })

  it('sin DOWNLOAD_RESTRICTED una CONFIDENCIAL muestra sus datos y lo que sustenta, sin descarga', async () => {
    fetch = mockFetch(rutasDeFicha())
    red = espiarRed()
    abrirFicha({ permisos: permisos({ project: ['READ'], project_assignment: ['READ'], evidence: ['READ'], commitment: ['READ'], delivery: ['READ'] }) })
    expect(await screen.findByRole('heading', { name: 'Lista de beneficiarios', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descargar' })).not.toBeInTheDocument()
    expect(screen.getByText(/no descarga el archivo/)).toBeInTheDocument()
    // P59: el nombre del archivo tampoco se dice
    expect(screen.getByText('Archivo reservado')).toBeInTheDocument()
    expect(screen.queryByText('lista.pdf')).not.toBeInTheDocument()
    const sustenta = screen.getByRole('region', { name: 'Sustenta' })
    expect(await within(sustenta).findByRole('link', { name: 'Compromiso: C-001 · Reservorio' })).toHaveAttribute('href', '/projects/p1/commitments/c1')
    expect(within(sustenta).getByRole('link', { name: 'Entrega: 2026-10-01' })).toHaveAttribute('href', '/r/delivery/dl1')
    expect(within(sustenta).queryByText(/Acuerdo/)).not.toBeInTheDocument()
    expect(within(sustenta).getByRole('link', { name: 'Interacción: Registro sin nombre' })).toBeInTheDocument()
    expect(within(sustenta).queryByText(/en1/)).not.toBeInTheDocument()
    // sgspe#14: la huella SHA-256 tampoco, porque deja confirmar si alguien tiene un archivo concreto
    expect(screen.queryByText('a1b2')).not.toBeInTheDocument()
    expect(screen.getByText('Reservada')).toBeInTheDocument()
    expect(red.a('GET', '/sgspe/evidence/ev1/content')).toHaveLength(0)
  })

  // UPS-24: el servidor oculta el nombre y la huella a quien no descarga; el tipo y el tamaño siguen
  it('un descriptor sin nombre ni huella muestra el tipo y el tamaño y reserva ambos, sin «undefined»', async () => {
    const sinNombre = registro(
      'ev1',
      {
        project: 'p1',
        title: 'Lista de beneficiarios',
        evidence_type: 'OTRO',
        classification: 'CONFIDENCIAL',
        file: { id: 'f1', contentType: 'application/pdf', size: 2_000_000 }
      },
      { updatedAt: '2026-10-05T15:00:00Z' }
    )
    fetch = mockFetch(rutasDeFicha([], sinNombre))
    abrirFicha({ permisos: permisos({ project: ['READ'], project_assignment: ['READ'], evidence: ['READ'] }) })
    expect(await screen.findByRole('heading', { name: 'Lista de beneficiarios', level: 1 })).toBeInTheDocument()
    // el tipo como se lee, con el MIME en title (tercera pasada de UX)
    expect(screen.getByText('PDF')).toHaveAttribute('title', 'application/pdf')
    expect(screen.getByText('1.9 MB')).toBeInTheDocument()
    expect(screen.getByText('Archivo reservado')).toBeInTheDocument()
    expect(screen.getByText('Reservada')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('undefined')
  })

  it('quien descarga, con un descriptor sin nombre ni huella, ve lo reservado y no «undefined»', async () => {
    const sinNombre = registro(
      'ev1',
      {
        project: 'p1',
        title: 'Lista de beneficiarios',
        evidence_type: 'OTRO',
        classification: 'CONFIDENCIAL',
        file: { id: 'f1', contentType: 'application/pdf', size: 2_000_000 }
      },
      { updatedAt: '2026-10-05T15:00:00Z' }
    )
    fetch = mockFetch(rutasDeFicha([], sinNombre))
    abrirFicha()
    expect(await screen.findByRole('heading', { name: 'Lista de beneficiarios', level: 1 })).toBeInTheDocument()
    // el tipo como se lee, con el MIME en title (tercera pasada de UX)
    expect(screen.getByText('PDF')).toHaveAttribute('title', 'application/pdf')
    expect(screen.getByText('Archivo reservado')).toBeInTheDocument()
    expect(screen.getByText('Reservada')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('undefined')
  })

  it('un objeto que el modelo del tenant no tiene (404) no se lista en «Sustenta» ni es un fallo', async () => {
    fetch = mockFetch(
      rutasDeFicha([
        // un tenant de F3 no tiene las QCS: el relacionado responde 404
        relacionados('grievance', 404),
        relacionados('inquiry', [registro('i1', { project: 'p1', code: 'CON-001' })]),
        ...['stakeholder_request', 'social_risk', 'incident', 'media_mention'].map((o) => relacionados(o, []))
      ])
    )
    abrirFicha()
    const sustenta = await screen.findByRole('region', { name: 'Sustenta' })
    expect(await within(sustenta).findByRole('link', { name: 'Consulta: CON-001' })).toBeInTheDocument()
    expect(within(sustenta).queryByText(/Queja/)).not.toBeInTheDocument()
    expect(within(sustenta).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(within(sustenta).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('con DOWNLOAD_RESTRICTED se descarga por la ruta de SGSPE', async () => {
    fetch = mockFetch(rutasDeFicha())
    red = espiarRed([{ path: '/sgspe/evidence/ev1/content', responder: () => archivoXlsx('lista.pdf') }])
    abrirFicha()
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar' }))
    expect(screen.getByText('lista.pdf')).toBeInTheDocument()
    expect(screen.getByText('a1b2')).toBeInTheDocument()
    await waitFor(() => expect(red!.a('GET', '/sgspe/evidence/ev1/content')).toHaveLength(1))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  // una foto restringida que muestra personas sin consentimiento
  const FOTO = registro(
    'ev1',
    {
      project: 'p1',
      title: 'Foto de la asamblea',
      evidence_type: 'FOTO',
      classification: 'DATOS PERSONALES',
      file: { id: 'f5', name: 'asamblea.jpg', contentType: 'image/jpeg', size: 1024, sha256: 'c3d4' },
      people_identifiable: true,
      photo_consent_given: false
    },
    { updatedAt: '2026-10-05T15:00:00Z' }
  )
  const imagen = () => new Response('JPEG', { status: 200, headers: { 'Content-Type': 'image/jpeg' } })

  it('sin DOWNLOAD_RESTRICTED una foto restringida no tiene vista previa ni se pide su archivo', async () => {
    fetch = mockFetch(rutasDeFicha([], FOTO))
    red = espiarRed()
    abrirFicha({ permisos: permisos({ project: ['READ'], project_assignment: ['READ'], evidence: ['READ'] }) })
    expect(await screen.findByRole('heading', { name: 'Foto de la asamblea', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Vista previa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(red.a('GET', '/sgspe/evidence/ev1/content')).toHaveLength(0)
  })

  it('con DOWNLOAD_RESTRICTED la foto se pide y se difumina si muestra personas sin consentimiento', async () => {
    fetch = mockFetch(rutasDeFicha([], FOTO))
    red = espiarRed([{ path: '/sgspe/evidence/ev1/content', responder: imagen }])
    abrirFicha()
    const vista = await screen.findByRole('region', { name: 'Vista previa' })
    const foto = await within(vista).findByRole('img', { name: 'Foto de la asamblea' })
    expect(foto).toHaveAttribute('src', 'blob:x')
    expect(foto).toHaveClass('blur-md')
    expect(within(vista).getByText(/la vista previa va difuminada/)).toBeInTheDocument()
    expect(screen.getByText(/No sale en una salida «Externo»/)).not.toHaveTextContent(/RNF-/)
    expect(red.a('GET', '/sgspe/evidence/ev1/content')).toHaveLength(1)
  })

  it('si la vista previa falla, Reintentar vuelve a pedir el archivo', async () => {
    fetch = mockFetch(rutasDeFicha([], FOTO))
    let intentos = 0
    red = espiarRed([{ path: '/sgspe/evidence/ev1/content', responder: () => (++intentos === 1 ? problema(500, 'falló el almacén') : imagen()) }])
    abrirFicha()
    const vista = await screen.findByRole('region', { name: 'Vista previa' })
    await userEvent.click(await within(vista).findByRole('button', { name: 'Reintentar' }))
    expect(await within(vista).findByRole('img', { name: 'Foto de la asamblea' })).toBeInTheDocument()
    expect(red.a('GET', '/sgspe/evidence/ev1/content')).toHaveLength(2)
  })

  it('con la clasificación ilegible dice Restringido, no descarga ni nombra el archivo', async () => {
    const SIN_CLASIFICACION = registro('ev1', { project: 'p1', evidence_type: 'FOTO', file: FOTO.attributes.file }, { updatedAt: '2026-10-05T15:00:00Z' })
    fetch = mockFetch(rutasDeFicha([], SIN_CLASIFICACION))
    red = espiarRed()
    abrirFicha({ permisos: permisos({ project: ['READ'], project_assignment: ['READ'], evidence: ['READ'] }) })
    expect(await screen.findByRole('heading', { name: 'Archivo reservado', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Restringido')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descargar' })).not.toBeInTheDocument()
    expect(screen.queryByText(/asamblea\.jpg/)).not.toBeInTheDocument()
    expect(screen.queryByText('c3d4')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Vista previa' })).not.toBeInTheDocument()
    expect(red.a('GET', '/sgspe/evidence/ev1/content')).toHaveLength(0)
  })

  // hallazgo U-07 (DD-07): la fecha del documento se muestra y se escribe como dd/mm/aaaa y viaja como AAAA-MM-DD
  it('corregir la fecha del documento escrita como 20/10/2026 manda document_date 2026-10-20', async () => {
    fetch = mockFetch(rutasDeFicha([], registro('ev1', { ...EV.attributes, document_date: '2026-10-01' }, { updatedAt: EV.updatedAt })))
    red = espiarRed([{ method: 'PATCH', path: '/sgspe/evidence/ev1', responder: () => jsonResponse(EV) }])
    abrirFicha()
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar datos o clasificación' }))
    const panel = await screen.findByRole('dialog')
    const fecha = within(panel).getByLabelText('Fecha del documento')
    expect(fecha).toHaveValue('01/10/2026')
    await userEvent.clear(fecha)
    await userEvent.type(fecha, '20/10/2026')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(red!.a('PATCH', '/sgspe/evidence/ev1')).toHaveLength(1))
    expect(red.a('PATCH', '/sgspe/evidence/ev1')[0].cuerpo).toEqual({ attributes: { document_date: '2026-10-20' } })
  })

  it('cambiar la clasificación pide motivo, manda solo lo cambiado con If-Match y un 412 ofrece Recargar que conserva lo escrito', async () => {
    fetch = mockFetch(rutasDeFicha())
    let intentos = 0
    red = espiarRed([
      {
        method: 'PATCH',
        path: '/sgspe/evidence/ev1',
        responder: () =>
          ++intentos === 1 ? problema(412, 'otra versión') : jsonResponse({ ...EV, attributes: { ...EV.attributes, classification: 'INTERNA' } })
      }
    ])
    abrirFicha()
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar datos o clasificación' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(panel).getByLabelText('Clasificación'), 'INTERNA')
    // el motivo se dice una vez; bajar una restringida añade su propio aviso
    expect(within(panel).getAllByText(/Cambiar la clasificación exige un motivo/)).toHaveLength(1)
    expect(within(panel).getByText(/Bajar una clasificación restringida exige además permiso para descargar archivos restringidos/)).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    expect(await within(panel).findByText('Escriba el motivo del cambio')).toBeInTheDocument()
    expect(red.a('PATCH', '/sgspe/evidence/ev1')).toHaveLength(0)
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Ya no tiene datos personales')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    expect(await within(panel).findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    const [primera] = red.a('PATCH', '/sgspe/evidence/ev1')
    expect(primera.cuerpo).toEqual({ attributes: { classification: 'INTERNA' } })
    expect(primera.cabeceras.get('If-Match')).toBe('"2026-10-05T15:00:00Z"')
    expect(primera.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Ya%20no%20tiene%20datos%20personales")
    const lecturas = red.a('GET', '/objects/evidence/records/ev1').length
    await userEvent.click(within(panel).getByRole('button', { name: 'Recargar' }))
    await waitFor(() => expect(red!.a('GET', '/objects/evidence/records/ev1').length).toBeGreaterThan(lecturas))
    expect(within(panel).getByLabelText('Motivo (obligatorio)')).toHaveValue('Ya no tiene datos personales')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(red.a('PATCH', '/sgspe/evidence/ev1')).toHaveLength(2)
  })

  // plan 4.2a: una evidencia vinculada a una QCS confidencial no baja a una clasificación no restringida (409 sobre classification)
  it('bajar la clasificación de una evidencia de una QCS confidencial lo dice junto a la clasificación, sin el código', async () => {
    fetch = mockFetch(rutasDeFicha())
    red = espiarRed([
      {
        method: 'PATCH',
        path: '/sgspe/evidence/ev1',
        responder: () => problema(409, 'no restringida', [{ field: 'classification', message: 'EVIDENCE_NOT_RESTRICTED' }])
      }
    ])
    abrirFicha()
    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar datos o clasificación' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(panel).getByLabelText('Clasificación'), 'INTERNA')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Ya no tiene datos personales')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    const texto = 'Una evidencia vinculada a una QCS confidencial es CONFIDENCIAL o de DATOS PERSONALES: no se vincula ni baja a otra clasificación.'
    await waitFor(() => expect(within(panel).getByLabelText('Clasificación')).toHaveAccessibleDescription(texto))
    expect(within(panel).queryByText('EVIDENCE_NOT_RESTRICTED')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('una versión nueva lleva replaces con el id de esta evidencia', async () => {
    fetch = mockFetch(rutasDeFicha())
    red = espiarRed([
      { method: 'POST', path: '/objects/evidence/files/file', responder: () => jsonResponse({ ...DESCRIPTOR, id: 'f9' }, 201) },
      { method: 'POST', path: '/sgspe/evidence', responder: () => jsonResponse(registro('ev9', { project: 'p1' }), 201) }
    ])
    abrirFicha()
    await userEvent.click(await screen.findByRole('button', { name: 'Subir versión nueva' }))
    const panel = await screen.findByRole('group', { name: 'Subir una evidencia' })
    await userEvent.upload(
      within(panel).getByLabelText('Archivo (PDF, foto, hoja, documento o texto; hasta 20 MB)'),
      new File(['%PDF'], 'lista-v2.pdf', { type: 'application/pdf' })
    )
    await userEvent.selectOptions(within(panel).getByLabelText('Tipo de evidencia'), 'OTRO')
    await userEvent.selectOptions(within(panel).getByLabelText('Clasificación'), 'CONFIDENCIAL')
    await userEvent.click(within(panel).getByRole('button', { name: 'Subir evidencia' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/evidence')).toHaveLength(1))
    expect(red.a('POST', '/sgspe/evidence')[0].cuerpo).toMatchObject({ attributes: { file: 'f9', replaces: 'ev1', project: 'p1' } })
  })
})
