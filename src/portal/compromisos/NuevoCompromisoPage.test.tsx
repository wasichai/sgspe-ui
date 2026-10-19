import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { baseDeCompromisos, DEF_COMPROMISO, EQUIPO_DE_COMPROMISOS, GESTORA } from '../../test/compromisos'
import { montar, pagina, registro, ubicacion } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { NuevoCompromisoPage } from './NuevoCompromisoPage'

// S30 (screens.md §7, flujo 8): los pasos validan lo suyo y lo dicen junto al control; el origen en un taller pide
// justificación; la revisión dice lo que D1 y D2 van a exigir; el alta lleva la clave nativa y el motivo, después los
// solicitantes y el envío; si algo falla tras el alta, el borrador no se vuelve a crear
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const TALLER = registro('e7', { project: 'p1', title: 'Taller de riego', engagement_type: 'TALLER' }, { state: 'held' })
const CAMPANA = registro('camp1', { project: 'p1', name: 'Campaña 2026', social_support_cap: 30000, currency: 'PEN' })
const APROBADO = registro('c5', { project: 'p1', exploration_campaign: 'camp1', amount: 20000, currency: 'PEN' }, { state: 'approved' })
const CREADO = registro('c9', { project: 'p1', code: 'C-010' }, { state: 'draft', updatedAt: '2026-10-09T15:00:00Z' })

const rutas = (extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeCompromisos(),
  { path: '/objects/exploration_campaign/records', body: pagina([CAMPANA]) },
  { path: '/objects/stakeholder/records', body: pagina([registro('s1', { project: 'p1', organization: 'o1' }, { state: 'assessed' })]) },
  { path: '/objects/organization/records/o1', body: registro('o1', { name: 'Junta de regantes' }) },
  { path: '/objects/engagement/records', body: pagina([TALLER]) },
  { path: '/objects/commitment/records', body: pagina([APROBADO]) }
]
const abrir = () =>
  montar(<NuevoCompromisoPage />, {
    ruta: '/projects/p1/commitments/new',
    camino: '/projects/:projectId/commitments/new',
    usuario: GESTORA,
    permisos: EQUIPO_DE_COMPROMISOS
  })
const JUSTIFICACION = 'Un compromiso que nace de un taller o de una reunión informativa exige la justificación de su origen'
const alPaso = async (nombre: string) => userEvent.click(await screen.findByRole('button', { name: new RegExp(nombre) }))
const pasoActual = () => screen.getByRole('heading', { level: 2 })
const siguiente = async () => userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }))
const escribir = async (etiqueta: string, valor: string) => userEvent.type(await screen.findByLabelText(etiqueta), valor)
const elegir = async (etiqueta: string, valor: string) => userEvent.selectOptions(await screen.findByLabelText(etiqueta), valor)

// el origen va primero (revisión de UX, etapa 5): de dónde nace el compromiso condiciona el resto
async function llenarHastaLaRevision() {
  await userEvent.type(await screen.findByLabelText('Buscar la interacción por título'), 'Ta')
  await userEvent.click(await screen.findByRole('button', { name: 'Taller de riego · Taller' }))
  await elegir('Cómo se pidió', 'ACUERDO EN REUNION')
  await escribir('Fecha del acuerdo', '2026-09-10')
  await siguiente()
  expect(await screen.findByText(JUSTIFICACION)).toBeInTheDocument()
  await escribir('Justificación del origen', 'La asamblea lo ratificó')
  // el aviso se va en cuanto la justificación está escrita
  expect(screen.queryByText(JUSTIFICACION)).not.toBeInTheDocument()
  await siguiente()
  await escribir('Código', 'C-010')
  await escribir('Título', 'Canal de riego')
  await escribir('Descripción', 'Revestir 2 km de canal')
  await escribir('Objetivo', 'Riego en estiaje')
  await elegir('Tipo de recurso', 'MATERIAL')
  await escribir('Cantidad', '2')
  await escribir('Unidad', 'km')
  await siguiente()
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Junta de regantes' }))
  await siguiente()
  await escribir('Beneficiarios en total', '80')
  await siguiente()
  await escribir('Monto', '15,000')
  await elegir('Campaña de exploración', 'camp1')
  await siguiente()
  await escribir('Fecha de vencimiento', '2026-12-20')
  await escribir('Responsable · correo', 'cmm@sgspe.test')
  await escribir('Responsable · identificador de usuario', 'u-cmm')
  await siguiente()
}

describe('S30 · crear compromiso', () => {
  it('un paso no avanza sin sus datos obligatorios y lo dice junto a cada control', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir()
    // el origen no pide nada sin una interacción en taller: se pasa al qué
    await siguiente()
    await siguiente()
    expect(await screen.findAllByText('Este dato es obligatorio')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Qué se compromete', level: 2 })).toBeInTheDocument()
    await escribir('Código', 'C-010')
    await escribir('Título', 'Canal')
    await escribir('Cantidad', '1e999999')
    await siguiente()
    expect(await screen.findByText('Escriba un número de hasta 15 dígitos enteros y 4 decimales')).toBeInTheDocument()
    expect(red.llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0)
  })

  it('lo escrito se guarda en el navegador: al volver se recupera con un aviso, y se puede descartar', async () => {
    fetch = mockFetch(rutas())
    const { unmount } = abrir()
    await siguiente()
    await escribir('Código', 'C-010')
    await escribir('Título', 'Canal de riego')
    await waitFor(() => expect(localStorage.getItem('sgspe.borrador.compromiso.p1')).toContain('Canal de riego'))
    unmount()
    abrir()
    expect(await screen.findByText(/Se recuperó lo que escribió/)).toBeInTheDocument()
    await siguiente()
    expect(screen.getByLabelText('Título')).toHaveValue('Canal de riego')
    await userEvent.click(screen.getByRole('button', { name: 'Descartar el borrador' }))
    expect(screen.getByLabelText('Título')).toHaveValue('')
    expect(localStorage.getItem('sgspe.borrador.compromiso.p1')).toBeNull()
  })

  it('«Guardar y salir» deja el borrador del navegador y vuelve a la lista; «Cancelar» también vuelve (revisión de UX, etapa 5)', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    const { unmount } = abrir()
    expect(await screen.findByRole('heading', { level: 2, name: 'Origen' })).toBeInTheDocument()
    await siguiente()
    await escribir('Título', 'Canal de riego')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y salir' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments'))
    expect(localStorage.getItem('sgspe.borrador.compromiso.p1')).toContain('Canal de riego')
    expect(red.llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0)
    unmount()
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments'))
  })

  // revisión de UX, decisión 6: el código propuesto llega como valor por defecto: no es un borrador por guardar
  it('propone el código del backend sin guardarlo como borrador, y no pisa el de un borrador recuperado', async () => {
    fetch = mockFetch(rutas([{ path: /^\/sgspe\/codes\/next\?object=commitment&project=p1$/, body: { code: 'COM-2026-012' } }]))
    const { unmount } = abrir()
    await siguiente()
    await waitFor(() => expect(screen.getByLabelText('Código')).toHaveValue('COM-2026-012'))
    await new Promise((r) => setTimeout(r, 700))
    expect(localStorage.getItem('sgspe.borrador.compromiso.p1')).toBeNull()
    unmount()
    localStorage.setItem('sgspe.borrador.compromiso.p1', JSON.stringify({ valores: { code: 'C-MIO', title: 'Canal' }, guardado: '2026-10-19T15:00:00Z' }))
    abrir()
    await siguiente()
    expect(await screen.findByLabelText('Código')).toHaveValue('C-MIO')
  })

  it('la barra del tope suma lo aprobado en la campaña y avisa si este compromiso lo supera', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await siguiente()
    await escribir('Código', 'C-010')
    await escribir('Título', 'Canal')
    for (let i = 0; i < 3; i++) await siguiente()
    await escribir('Monto', '15000')
    await elegir('Campaña de exploración', 'camp1')
    const tope = await screen.findByRole('region', { name: 'Tope de apoyo social de la campaña' })
    expect(await within(tope).findByText('S/ 20,000.00')).toBeInTheDocument()
    expect(within(tope).getByText('-S/ 5,000.00')).toBeInTheDocument()
    expect(within(tope).getByRole('alert')).toHaveTextContent('supera el tope')
  })

  it('crea el borrador con la clave y el motivo, vincula al solicitante y lo envía con la versión creada', async () => {
    fetch = mockFetch(rutas([{ method: 'POST', path: '/objects/commitment/records/c9/transitions/submit', body: { ...CREADO, state: 'pending_approval' } }]))
    red = espiarRed([
      { method: 'POST', path: '/objects/commitment/records', responder: () => jsonResponse(CREADO, 201) },
      { method: 'POST', path: '/objects/commitment/records/c9/related/commitment_stakeholder', responder: () => new Response(null, { status: 204 }) }
    ])
    abrir()
    await llenarHastaLaRevision()
    expect(await screen.findByText('Están los datos de la matriz y el responsable.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar a aprobación' }))
    expect(await screen.findByText('Escriba el motivo del cambio')).toBeInTheDocument()
    await escribir('Motivo (obligatorio)', 'Acordado en el taller')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar a aprobación' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments/c9'))
    const [alta] = red.a('POST', '/objects/commitment/records')
    expect(alta.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(alta.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Acordado%20en%20el%20taller")
    expect(alta.cuerpo).toMatchObject({
      attributes: {
        project: 'p1',
        code: 'C-010',
        amount: '15000',
        quantity: '2',
        origin_engagement: 'e7',
        origin_justification: 'La asamblea lo ratificó',
        owner_user_id: 'u-cmm',
        owner_user_email: 'cmm@sgspe.test',
        exploration_campaign: 'camp1',
        currency: 'PEN'
      }
    })
    const [vinculo] = red.a('POST', '/objects/commitment/records/c9/related/commitment_stakeholder')
    expect(vinculo.cuerpo).toEqual({ otherId: 's1' })
    expect(vinculo.cabeceras.get('X-Change-Reason')).toBeTruthy()
    const [envio] = red.a('POST', '/objects/commitment/records/c9/transitions/submit')
    expect(envio.cabeceras.get('If-Match')).toBe('"2026-10-09T15:00:00Z"')
  })

  it('desde una queja (S36) dice que nace de ella y manda origin_grievance en el alta', async () => {
    fetch = mockFetch(
      rutas([
        { path: '/objects/grievance/records/g1', body: registro('g1', { project: 'p1', code: 'Q-001', description: 'Canal turbio' }) },
        // F4: el compromiso suma la relación con su queja de origen (plan 4.1)
        {
          path: '/metadata/objects/commitment',
          body: {
            ...DEF_COMPROMISO,
            fields: [
              ...DEF_COMPROMISO.fields,
              { ...DEF_COMPROMISO.fields[0], id: 'commitment.origin_grievance', name: 'origin_grievance', type: 'RELATION', relationTarget: 'grievance' }
            ]
          }
        }
      ])
    )
    red = espiarRed([{ method: 'POST', path: '/objects/commitment/records', responder: () => jsonResponse(CREADO, 201) }])
    montar(<NuevoCompromisoPage />, {
      ruta: '/projects/p1/commitments/new?origin_grievance=g1',
      camino: '/projects/:projectId/commitments/new',
      usuario: GESTORA,
      permisos: EQUIPO_DE_COMPROMISOS
    })
    expect(await screen.findByRole('link', { name: 'Q-001' })).toHaveAttribute('href', '/projects/p1/grievances/g1')
    expect(screen.getByText(/Nace de la queja/)).toBeInTheDocument()
    await siguiente()
    await escribir('Código', 'C-011')
    await escribir('Título', 'Limpieza del canal')
    for (let i = 0; i < 3; i++) await siguiente()
    await escribir('Monto', '500')
    await siguiente()
    await siguiente()
    await escribir('Motivo (obligatorio)', 'Atiende la queja Q-001')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(red!.a('POST', '/objects/commitment/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/commitment/records')[0].cuerpo).toMatchObject({ attributes: { project: 'p1', origin_grievance: 'g1' } })
  })

  it('desde una interacción (?origin_engagement) la propone como origen y la manda en el alta (revisión de UX, etapa 5)', async () => {
    fetch = mockFetch(rutas([{ path: '/objects/engagement/records/e7', body: TALLER }]))
    red = espiarRed([{ method: 'POST', path: '/objects/commitment/records', responder: () => jsonResponse(CREADO, 201) }])
    montar(<NuevoCompromisoPage />, {
      ruta: '/projects/p1/commitments/new?origin_engagement=e7',
      camino: '/projects/:projectId/commitments/new',
      usuario: GESTORA,
      permisos: EQUIPO_DE_COMPROMISOS
    })
    expect(await screen.findByText(/Taller de riego · Taller/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar la interacción por título')).not.toBeInTheDocument()
    // un taller pide la justificación de su origen, como si se hubiera elegido a mano
    await siguiente()
    expect(await screen.findByText(JUSTIFICACION)).toBeInTheDocument()
    await escribir('Justificación del origen', 'La asamblea lo ratificó')
    await siguiente()
    await escribir('Código', 'C-012')
    await escribir('Título', 'Canal')
    for (let i = 0; i < 3; i++) await siguiente()
    await escribir('Monto', '500')
    await siguiente()
    await siguiente()
    await escribir('Motivo (obligatorio)', 'Acordado en el taller')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(red!.a('POST', '/objects/commitment/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/commitment/records')[0].cuerpo).toMatchObject({ attributes: { origin_engagement: 'e7' } })
  })

  it('desde un riesgo (?social_risk) dice que lo atiende y lo manda en el alta (revisión de UX, etapa 5)', async () => {
    fetch = mockFetch(
      rutas([
        { path: '/objects/social_risk/records/k1', body: registro('k1', { project: 'p1', code: 'R-001', title: 'Polvo en la vía' }) },
        // el compromiso tiene la relación con el riesgo que atiende (commitment_social_risk)
        {
          path: '/metadata/objects/commitment',
          body: {
            ...DEF_COMPROMISO,
            fields: [
              ...DEF_COMPROMISO.fields,
              { ...DEF_COMPROMISO.fields[0], id: 'commitment.social_risk', name: 'social_risk', type: 'RELATION', relationTarget: 'social_risk' }
            ]
          }
        }
      ])
    )
    red = espiarRed([{ method: 'POST', path: '/objects/commitment/records', responder: () => jsonResponse(CREADO, 201) }])
    montar(<NuevoCompromisoPage />, {
      ruta: '/projects/p1/commitments/new?social_risk=k1',
      camino: '/projects/:projectId/commitments/new',
      usuario: GESTORA,
      permisos: EQUIPO_DE_COMPROMISOS
    })
    expect(await screen.findByText(/Atiende el riesgo/)).toBeInTheDocument()
    await siguiente()
    await escribir('Código', 'C-013')
    await escribir('Título', 'Riego de la vía')
    for (let i = 0; i < 3; i++) await siguiente()
    await escribir('Monto', '500')
    await siguiente()
    await siguiente()
    await escribir('Motivo (obligatorio)', 'Atiende el riesgo')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(red!.a('POST', '/objects/commitment/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/commitment/records')[0].cuerpo).toMatchObject({ attributes: { social_risk: 'k1' } })
  })

  it('las campañas y las interacciones se piden del proyecto; PROJECT_MISMATCH vuelve al paso del monto con su texto (P54)', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/commitment/records',
        responder: () => problema(409, 'otro proyecto', [{ field: 'exploration_campaign', message: 'PROJECT_MISMATCH' }])
      }
    ])
    abrir()
    await llenarHastaLaRevision()
    await escribir('Motivo (obligatorio)', 'Acordado en el taller')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByText(/El registro elegido es de otro proyecto/)).toBeInTheDocument()
    expect(screen.getByLabelText('Campaña de exploración')).toBeInTheDocument()
    expect(red.a('GET', '/objects/exploration_campaign/records').length).toBeGreaterThan(0)
    expect(red.a('GET', '/objects/exploration_campaign/records').every((l) => l.ruta.includes('project=p1'))).toBe(true)
    expect(red.a('GET', '/objects/engagement/records').every((l) => l.ruta.includes('project=p1'))).toBe(true)
    expect(red.a('GET', '/objects/engagement/records').length).toBeGreaterThan(0)
  })

  it('la revisión dice lo que falta para el envío con el paso donde se completa; enviar queda deshabilitado', async () => {
    fetch = mockFetch(rutas())
    abrir()
    await siguiente()
    await escribir('Código', 'C-010')
    await escribir('Título', 'Canal')
    for (let i = 0; i < 3; i++) await siguiente()
    await escribir('Monto', '100')
    await siguiente()
    await siguiente()
    const lista = await screen.findByRole('region', { name: 'Lo que pide el envío a aprobación' })
    expect(within(lista).getByText('Falta: Responsable')).toBeInTheDocument()
    expect(within(lista).getByText('Falta: Al menos un grupo de interés solicitante')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar a aprobación' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled()
    await userEvent.click(within(lista).getAllByRole('button', { name: 'Ir al paso' })[0])
    expect(screen.getByRole('heading', { name: 'Qué se compromete', level: 2 })).toBeInTheDocument()
  })

  it('si el vínculo falla tras el alta, lo dice con la ficha y el reintento no vuelve a crear el compromiso', async () => {
    fetch = mockFetch(rutas())
    let intentos = 0
    red = espiarRed([
      { method: 'POST', path: '/objects/commitment/records', responder: () => jsonResponse(CREADO, 201) },
      {
        method: 'POST',
        path: '/objects/commitment/records/c9/related/commitment_stakeholder',
        responder: () => (++intentos === 1 ? problema(500, 'caído') : new Response(null, { status: 204 }))
      }
    ])
    abrir()
    await llenarHastaLaRevision()
    await escribir('Motivo (obligatorio)', 'Taller')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByText(/se creó en borrador pero no se terminó de registrar/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir la ficha del compromiso' })).toHaveAttribute('href', '/projects/p1/commitments/c9')
    // tras el alta, los pasos ya no se editan: lo que cambie aquí no se guardaría
    await alPaso('Qué se compromete')
    expect(screen.getByText(/El borrador ya se creó: lo que cambie en estos pasos no se guarda/)).toBeInTheDocument()
    expect(screen.getByLabelText('Código')).toBeDisabled()
    await alPaso('Revisión y envío')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments/c9'))
    expect(red.a('POST', '/objects/commitment/records')).toHaveLength(1)
  })

  it.each([
    ['WORKSHOP_COMMITMENT_BLOCKED', 'El proyecto no admite compromisos que nazcan de un taller o de una reunión informativa.'],
    ['PROJECT_MISMATCH', 'El registro elegido es de otro proyecto: un registro solo se vincula con lo de su proyecto.']
  ])('%s sobre la interacción de origen vuelve al paso del origen con su texto junto al buscador', async (codigo, textoEsperado) => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { method: 'POST', path: '/objects/commitment/records', responder: () => problema(409, 'rechazado', [{ field: 'origin_engagement', message: codigo }]) }
    ])
    abrir()
    await llenarHastaLaRevision()
    await escribir('Motivo (obligatorio)', 'Acordado en el taller')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(pasoActual()).toHaveTextContent('Origen'))
    expect(screen.getByText(textoEsperado)).toBeInTheDocument()
    expect(screen.queryByText(codigo)).not.toBeInTheDocument()
  })

  it('el responsable y el verificador del servidor vuelven al paso del plazo; lo que no tiene paso queda en la revisión', async () => {
    fetch = mockFetch(rutas())
    let intento = 0
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/commitment/records',
        responder: () =>
          ++intento === 1
            ? problema(409, 'rechazado', [{ field: 'owner_user_id', message: 'Usuario desconocido' }])
            : problema(409, 'rechazado', [
                { field: 'verifier_user_email', message: 'Usuario desconocido' },
                { field: 'agreement', message: 'PROJECT_MISMATCH' }
              ])
      }
    ])
    abrir()
    await llenarHastaLaRevision()
    await escribir('Motivo (obligatorio)', 'Acordado en el taller')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(pasoActual()).toHaveTextContent('Plazo y responsable'))
    expect(screen.getByText('Usuario desconocido')).toBeInTheDocument()
    await alPaso('Revisión y envío')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    // una violación sin paso deja el aviso en la revisión, con todas las que trae
    expect(await screen.findByText(/El registro elegido es de otro proyecto/)).toBeInTheDocument()
    expect(pasoActual()).toHaveTextContent('Revisión y envío')
  })

  it('al guardar se vuelven a revisar los pasos: un verificador igual al responsable no se envía aunque se salte el paso', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed()
    abrir()
    await llenarHastaLaRevision()
    await alPaso('Plazo y responsable')
    await escribir('Verificador · correo', 'cmm@sgspe.test')
    await escribir('Verificador · identificador de usuario', 'u-cmm')
    await alPaso('Qué se compromete')
    await alPaso('Revisión y envío')
    await escribir('Motivo (obligatorio)', 'Acordado en el taller')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(pasoActual()).toHaveTextContent('Plazo y responsable'))
    expect(screen.getByText('El verificador no puede ser el responsable')).toBeInTheDocument()
    expect(red.llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0)
  })

  it('una justificación que ya no corresponde al origen no se envía', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      { method: 'POST', path: '/objects/commitment/records', responder: () => jsonResponse(CREADO, 201) },
      { method: 'POST', path: '/objects/commitment/records/c9/related/commitment_stakeholder', responder: () => new Response(null, { status: 204 }) }
    ])
    abrir()
    await llenarHastaLaRevision()
    await alPaso('Origen')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    await alPaso('Revisión y envío')
    await escribir('Motivo (obligatorio)', 'Acordado en el taller')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments/c9'))
    const [alta] = red.a('POST', '/objects/commitment/records')
    expect(alta.cuerpo).toMatchObject({ attributes: { code: 'C-010' } })
    expect((alta.cuerpo as { attributes: Record<string, unknown> }).attributes).not.toHaveProperty('origin_justification')
    expect((alta.cuerpo as { attributes: Record<string, unknown> }).attributes).not.toHaveProperty('origin_engagement')
  })

  it('un 412 al enviar relee la versión y reintenta una vez con la nueva', async () => {
    fetch = mockFetch(rutas([{ path: '/objects/commitment/records/c9', body: { ...CREADO, updatedAt: '2026-10-09T15:00:05Z' } }]))
    let envios = 0
    red = espiarRed([
      { method: 'POST', path: '/objects/commitment/records', responder: () => jsonResponse(CREADO, 201) },
      { method: 'POST', path: '/objects/commitment/records/c9/related/commitment_stakeholder', responder: () => new Response(null, { status: 204 }) },
      {
        method: 'POST',
        path: '/objects/commitment/records/c9/transitions/submit',
        responder: () => (++envios === 1 ? problema(412, 'versión') : jsonResponse({ ...CREADO, state: 'pending_approval' }))
      }
    ])
    abrir()
    await llenarHastaLaRevision()
    await escribir('Motivo (obligatorio)', 'Acordado en el taller')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar a aprobación' }))
    await waitFor(() => expect(ubicacion.actual).toBe('/projects/p1/commitments/c9'))
    const envio = red.a('POST', '/objects/commitment/records/c9/transitions/submit')
    expect(envio.map((l) => l.cabeceras.get('If-Match'))).toEqual(['"2026-10-09T15:00:00Z"', '"2026-10-09T15:00:05Z"'])
    expect(envio.every((l) => l.cabeceras.get('X-Change-Reason'))).toBe(true)
  })

  it('mientras se leen las asignaciones no dice solo lectura, y si su lectura falla lo dice con reintento', async () => {
    fetch = mockFetch(rutas([{ path: /^\/objects\/project_assignment\/records\?.*member_user_id/, status: 500, body: { title: 'Error', status: 500 } }]))
    abrir()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText(/No está asignado a este proyecto/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nuevo compromiso' })).not.toBeInTheDocument()
  })
})
