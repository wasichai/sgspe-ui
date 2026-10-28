import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseDeCompromisos, C1, EQUIPO_DE_COMPROMISOS, GESTORA } from '../../test/compromisos'
import { definicion, montar, pagina, registro } from '../../test/montar'
import { permisos, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red } from '../../test/red'
import type { Registro } from '../datos/registros'
import { PestanaEntregas } from './PestanaEntregas'
import { Verificacion } from './Verificacion'

vi.mock('../documentos/exif', () => ({ leerExif: async () => ({}) }))

// S32 (flujos 10 y 11): la entrega con su acta y fotos subidas antes y vinculadas por id, con IK y motivo, sin cambiar el
// estado; corregirla con If-Match; las cumplidas no cambian; quién dio la conformidad es restringido; el responsable no
// verifica
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const ENTREGA = registro(
  'dl1',
  { commitment: 'c1', delivery_date: '2026-10-01', place: 'Tunas Pampa', delivered_items: 'Geomembrana', delivered_amount: 10000, conformity_given: true },
  { updatedAt: '2026-10-02T15:00:00Z' }
)
const DEF_ENTREGA = definicion('delivery', [
  ['delivery_date', { type: 'DATE' }],
  'place',
  'delivered_items',
  ['delivered_amount', { type: 'DECIMAL' }],
  'recipients',
  ['conformity_given', { type: 'BOOLEAN' }],
  'conformity_by'
])
const DEF_EVIDENCIA = definicion('evidence', [
  ['evidence_type', { type: 'ENUM', enumOptions: ['ACTA DE ENTREGA', 'FOTO', 'ACTA'] }],
  ['classification', { type: 'ENUM', enumOptions: ['PUBLICA', 'INTERNA'] }],
  'title'
])
const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  { path: '/objects/delivery/records', body: pagina([ENTREGA]) },
  { path: '/metadata/objects/delivery', body: DEF_ENTREGA },
  { path: '/metadata/objects/evidence', body: DEF_EVIDENCIA },
  { path: '/objects/delivery/records/dl1/related/evidence_delivery', body: pagina([]) },
  {
    path: '/objects/commitment/records/c1/transitions',
    body: [
      { name: 'verify', label: 'Verificar', to: 'verified', toLabel: 'Verificado', allowed: true, reason: null },
      { name: 'reopen_execution', label: 'Devolver a ejecución', to: 'in_progress', toLabel: 'En ejecución', allowed: true, reason: null },
      { name: 'close', label: 'Cerrar', to: 'closed', toLabel: 'Cerrado', allowed: true, reason: null }
    ]
  },
  { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } }
]
const abrir = (compromiso: Registro = C1, opciones: { permisos?: ReturnType<typeof permisos> } = {}) =>
  montar(<PestanaEntregas compromiso={compromiso} escribe />, { usuario: GESTORA, permisos: opciones.permisos ?? EQUIPO_DE_COMPROMISOS })

describe('S32 · entregas', () => {
  it('dice lo ejecutado, la evidencia mínima de su tipo de recurso y «Restringido» en la conformidad que no lee', async () => {
    fetch = mockFetch(rutas())
    abrir()
    expect(await screen.findByText('Ejecutado: S/ 10,000.00 de S/ 25,000.00')).toBeInTheDocument()
    expect(screen.getByText(/al menos un «Acta de entrega» y una «Foto»/)).toBeInTheDocument()
    const tarjeta = (await screen.findByRole('heading', { name: /Entrega del/ })).closest('li') as HTMLElement
    // la entrega no trae recipients ni conformity_by: la cuenta no los lee
    expect(within(tarjeta).getAllByText('Restringido')).toHaveLength(2)
    expect(within(tarjeta).getByText('S/ 10,000.00')).toBeInTheDocument()
  })

  it('sube el acta antes y registra la entrega con sus evidencias por id, la clave y el motivo', async () => {
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
        responder: () => jsonResponse(registro('ev1', { title: 'Acta firmada', evidence_type: 'ACTA DE ENTREGA' }), 201)
      },
      { method: 'POST', path: '/sgspe/commitments/c1/deliveries', responder: () => jsonResponse({ delivery: registro('dl2', {}), commitment: C1 }, 201) }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }))
    const panel = await screen.findByRole('dialog')
    const evidencia = within(panel).getByRole('group', { name: 'Subir una evidencia' })
    await userEvent.upload(within(evidencia).getByLabelText(/Archivo/), new File(['%PDF'], 'acta.pdf', { type: 'application/pdf' }))
    expect(within(evidencia).getByLabelText('Tipo de evidencia')).toHaveValue('ACTA DE ENTREGA')
    await userEvent.selectOptions(within(evidencia).getByLabelText('Clasificación'), 'INTERNA')
    await userEvent.type(within(evidencia).getByLabelText('Título'), 'Acta firmada')
    await userEvent.click(within(evidencia).getByRole('button', { name: 'Subir evidencia' }))
    expect(await within(panel).findByText('Acta firmada · Acta de entrega')).toBeInTheDocument()
    // tercera pasada de UX (1.6): con el acta subida, dice lo que falta para el cumplimiento y propone la foto
    expect(within(panel).getByText('Para el cumplimiento faltan: «Foto».')).toBeInTheDocument()
    expect(within(within(panel).getByRole('group', { name: 'Subir una evidencia' })).getByLabelText('Tipo de evidencia')).toHaveValue('FOTO')
    // la subida de la evidencia no envió la entrega
    expect(red.a('POST', '/sgspe/commitments/c1/deliveries')).toHaveLength(0)
    await userEvent.type(within(panel).getByLabelText('Monto entregado'), '1e5')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    expect(await within(panel).findByText('Escriba un monto de hasta 15 dígitos enteros y 4 decimales')).toBeInTheDocument()
    await userEvent.clear(within(panel).getByLabelText('Monto entregado'))
    await userEvent.type(within(panel).getByLabelText('Monto entregado'), '5,000')
    await userEvent.type(within(panel).getByLabelText('Qué se entregó'), 'Tuberías')
    await userEvent.click(within(panel).getByLabelText('El grupo de interés dio conformidad'))
    await userEvent.type(within(panel).getByLabelText('Quiénes dieron la conformidad'), 'Junta directiva')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Entrega en obra')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitments/c1/deliveries')).toHaveLength(1))
    const [alta] = red.a('POST', '/sgspe/commitments/c1/deliveries')
    expect(alta.cuerpo).toMatchObject({
      attributes: { delivered_amount: '5000', delivered_items: 'Tuberías', conformity_given: true, conformity_by: 'Junta directiva' },
      evidence: ['ev1']
    })
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Entrega%20en%20obra")
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Entrega guardada.')
  })

  // tercera pasada de UX (1.6): guardada la entrega, el siguiente paso (registrar el cumplimiento) se ofrece en el mismo lugar
  it('antes de subir nada dice las dos evidencias que faltan; guardada la entrega, ofrece registrar el cumplimiento ahí mismo', async () => {
    const conCumplimiento = {
      path: '/objects/commitment/records/c1/transitions',
      body: [{ name: 'register_fulfillment', label: 'Registrar cumplimiento', to: 'fulfilled', toLabel: 'Cumplido', allowed: true, reason: null }]
    }
    fetch = mockFetch(rutas([conCumplimiento]))
    red = espiarRed([
      { method: 'POST', path: '/sgspe/commitments/c1/deliveries', responder: () => jsonResponse({ delivery: registro('dl2', {}), commitment: C1 }, 201) }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }))
    const panel = await screen.findByRole('dialog')
    expect(await within(panel).findByText('Para el cumplimiento faltan: «Acta de entrega» y «Foto».')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar cumplimiento' })).not.toBeInTheDocument()
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Entrega en obra')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Entrega guardada.')
    expect(await screen.findByRole('button', { name: 'Registrar cumplimiento' })).toHaveAttribute('data-variant', 'secondary')
  })

  it('sin la definición de la entrega no ofrece guardar ni campos: dice el fallo y, al releerla, el formulario', async () => {
    fetch = mockFetch(rutas())
    let falla = true
    red = espiarRed([{ path: '/metadata/objects/delivery', responder: () => (falla ? problema(503, 'caída') : jsonResponse(DEF_ENTREGA)) }])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }))
    const panel = await screen.findByRole('dialog')
    expect(await within(panel).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    // nada que escribir y perder: ni campos, ni subida de evidencias, ni «Guardar entrega»
    expect(within(panel).queryByLabelText('Monto entregado')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('group', { name: 'Subir una evidencia' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Guardar entrega' })).not.toBeInTheDocument()
    falla = false
    await userEvent.click(within(panel).getByRole('button', { name: 'Reintentar' }))
    expect(await within(panel).findByLabelText('Monto entregado')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Guardar entrega' })).toBeInTheDocument()
    expect(red.a('POST', '/sgspe/commitments/c1/deliveries')).toHaveLength(0)
  })

  it('dibuja solo los campos que envía: ni los de solo lectura ni los restringidos', async () => {
    fetch = mockFetch(
      rutas([
        {
          path: '/metadata/objects/delivery',
          body: definicion('delivery', [
            ['delivery_date', { type: 'DATE' }],
            ['place', { editable: false }],
            'delivered_items',
            ['delivered_amount', { type: 'DECIMAL' }],
            ['conformity_given', { type: 'BOOLEAN' }]
          ])
        }
      ])
    )
    red = espiarRed([
      { method: 'POST', path: '/sgspe/commitments/c1/deliveries', responder: () => jsonResponse({ delivery: registro('dl2', {}), commitment: C1 }, 201) }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.type(await within(panel).findByLabelText('Monto entregado'), '300')
    expect(within(panel).queryByLabelText('Lugar')).not.toBeInTheDocument()
    expect(within(panel).queryByLabelText('Receptores')).not.toBeInTheDocument()
    await userEvent.click(within(panel).getByLabelText('El grupo de interés dio conformidad'))
    expect(within(panel).queryByLabelText('Quiénes dieron la conformidad')).not.toBeInTheDocument()
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Entrega en obra')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitments/c1/deliveries')).toHaveLength(1))
    const atributos = (red.a('POST', '/sgspe/commitments/c1/deliveries')[0].cuerpo as { attributes: Record<string, unknown> }).attributes
    expect(Object.keys(atributos).sort()).toEqual(['conformity_given', 'delivered_amount', 'delivery_date'])
    expect(atributos).toMatchObject({ delivered_amount: '300', conformity_given: true })
  })

  it('sin conformidad el alta no manda quiénes la dieron, aunque se haya escrito antes de desmarcarla', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { method: 'POST', path: '/sgspe/commitments/c1/deliveries', responder: () => jsonResponse({ delivery: registro('dl2', {}), commitment: C1 }, 201) }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar entrega' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.click(await within(panel).findByLabelText('El grupo de interés dio conformidad'))
    await userEvent.type(within(panel).getByLabelText('Quiénes dieron la conformidad'), 'Junta directiva')
    await userEvent.click(within(panel).getByLabelText('El grupo de interés dio conformidad'))
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Entrega parcial')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/commitments/c1/deliveries')).toHaveLength(1))
    const atributos = (red.a('POST', '/sgspe/commitments/c1/deliveries')[0].cuerpo as { attributes: Record<string, unknown> }).attributes
    expect(atributos.conformity_given).toBe(false)
    expect(atributos).not.toHaveProperty('conformity_by')
  })

  it('quien lee los restringidos los ve en la tarjeta y los corrige; desmarcar la conformidad borra quiénes la dieron', async () => {
    const leida = registro(
      'dl1',
      { ...ENTREGA.attributes, recipients: 'Familias del anexo', conformity_by: 'Junta directiva' },
      { updatedAt: '2026-10-02T15:00:00Z' }
    )
    fetch = mockFetch(rutas([{ path: '/objects/delivery/records', body: pagina([leida]) }]))
    red = espiarRed([{ method: 'PATCH', path: '/sgspe/deliveries/dl1', responder: () => jsonResponse({ delivery: leida, commitment: C1 }) }])
    abrir()
    const tarjeta = (await screen.findByRole('heading', { name: /Entrega del/ })).closest('li') as HTMLElement
    expect(within(tarjeta).getByText('Familias del anexo')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Junta directiva')).toBeInTheDocument()
    expect(within(tarjeta).queryByText('Restringido')).not.toBeInTheDocument()
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Corregir' }))
    const panel = await screen.findByRole('dialog')
    expect(await within(panel).findByLabelText('Receptores')).toHaveValue('Familias del anexo')
    expect(within(panel).getByLabelText('Quiénes dieron la conformidad')).toHaveValue('Junta directiva')
    await userEvent.click(within(panel).getByLabelText('El grupo de interés dio conformidad'))
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'No hubo conformidad')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    await waitFor(() => expect(red!.a('PATCH', '/sgspe/deliveries/dl1')).toHaveLength(1))
    expect(red.a('PATCH', '/sgspe/deliveries/dl1')[0].cuerpo).toEqual({ attributes: { conformity_given: false, conformity_by: null } })
  })

  it('corregir una entrega sin conformidad no manda conformity_given si no cambió', async () => {
    const sinConformidad = registro('dl1', { ...ENTREGA.attributes, conformity_given: false }, { updatedAt: '2026-10-02T15:00:00Z' })
    fetch = mockFetch(rutas([{ path: '/objects/delivery/records', body: pagina([sinConformidad]) }]))
    red = espiarRed([{ method: 'PATCH', path: '/sgspe/deliveries/dl1', responder: () => jsonResponse({ delivery: sinConformidad, commitment: C1 }) }])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Corregir' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.type(await within(panel).findByLabelText('Lugar'), ' Alto')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Lugar incompleto')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    await waitFor(() => expect(red!.a('PATCH', '/sgspe/deliveries/dl1')).toHaveLength(1))
    expect(red.a('PATCH', '/sgspe/deliveries/dl1')[0].cuerpo).toEqual({ attributes: { place: 'Tunas Pampa Alto' } })
  })

  it('la lista de entregas que no se lee dice el fallo con «Reintentar»', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([{ path: '/objects/delivery/records', responder: () => problema(500, 'caída') }])
    abrir()
    const seccion = await screen.findByRole('region', { name: 'Entregas' })
    expect(await within(seccion).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  // hallazgo U-07 (DD-07): la fecha de la entrega se muestra y se escribe como dd/mm/aaaa y viaja como AAAA-MM-DD
  it('corregir la fecha escrita como 20/10/2026 manda delivery_date 2026-10-20', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([{ method: 'PATCH', path: '/sgspe/deliveries/dl1', responder: () => jsonResponse({ delivery: ENTREGA, commitment: C1 }) }])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Corregir' }))
    const panel = await screen.findByRole('dialog')
    const fecha = within(panel).getByLabelText('Fecha de la entrega')
    expect(fecha).toHaveValue('01/10/2026')
    await userEvent.clear(fecha)
    await userEvent.type(fecha, '20/10/2026')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Fecha mal escrita')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    await waitFor(() => expect(red!.a('PATCH', '/sgspe/deliveries/dl1')).toHaveLength(1))
    expect(red.a('PATCH', '/sgspe/deliveries/dl1')[0].cuerpo).toEqual({ attributes: { delivery_date: '2026-10-20' } })
  })

  it('corregir manda solo lo cambiado con If-Match; DELIVERY_FROZEN dice su texto', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { method: 'PATCH', path: '/sgspe/deliveries/dl1', responder: () => problema(409, 'congelada', [{ field: 'commitment', message: 'DELIVERY_FROZEN' }]) }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Corregir' }))
    const panel = await screen.findByRole('dialog')
    await userEvent.clear(within(panel).getByLabelText('Lugar'))
    await userEvent.type(within(panel).getByLabelText('Lugar'), 'Anexo Huallpa')
    await userEvent.type(within(panel).getByLabelText('Motivo (obligatorio)'), 'Lugar mal escrito')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar entrega' }))
    expect(
      await within(panel).findByText(
        'El compromiso ya está cumplido o cancelado: sus entregas no cambian. Si está cumplido (no verificado ni cerrado), devuélvalo a ejecución para corregirlas.'
      )
    ).toBeInTheDocument()
    const [llamada] = red.a('PATCH', '/sgspe/deliveries/dl1')
    expect(llamada.cuerpo).toEqual({ attributes: { place: 'Anexo Huallpa' } })
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-02T15:00:00Z"')
    expect(llamada.cabeceras.has('Idempotency-Key')).toBe(false)
  })

  it('con el compromiso cumplido no se registra ni se corrige', async () => {
    fetch = mockFetch(rutas())
    abrir({ ...C1, state: 'fulfilled' })
    expect(await screen.findByText(/sus entregas no cambian/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument()
  })

  it('con el compromiso cancelado tampoco: cancelled es final (P55)', async () => {
    fetch = mockFetch(rutas())
    abrir({ ...C1, state: 'cancelled' })
    expect(await screen.findByText('El compromiso está cancelado: sus entregas ya no cambian.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar entrega' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument()
  })
})

describe('S32 · verificación', () => {
  it('ofrece solo verificar y devolver a ejecución, y avisa al responsable de la segregación', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    montar(<Verificacion compromiso={{ ...C1, state: 'fulfilled' }} />, { usuario: GESTORA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByText('Usted es responsable de este compromiso: otra persona lo verifica.')).toBeInTheDocument()
    expect(await screen.findByText('Entregas con conformidad: 1 de 1')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Verificar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Devolver a ejecución' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()
    // «Verificar» se comprueba en seco antes de ofrecerse (D11)
    await waitFor(() =>
      expect(red!.a('POST', '/sgspe/transition-checks').map((l) => l.cuerpo)).toContainEqual({ object: 'commitment', recordId: 'c1', transition: 'verify' })
    )
  })

  it('otra persona no ve el aviso de segregación', async () => {
    fetch = mockFetch(rutas())
    montar(<Verificacion compromiso={{ ...C1, state: 'fulfilled' }} />, { usuario: RELACIONISTA, permisos: EQUIPO_DE_COMPROMISOS })
    expect(await screen.findByText('Entregas con conformidad: 1 de 1')).toBeInTheDocument()
    expect(screen.queryByText(/otra persona lo verifica/)).not.toBeInTheDocument()
  })
})
