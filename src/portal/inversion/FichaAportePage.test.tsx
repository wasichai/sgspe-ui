import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APORTE,
  APROBACION_DE_APORTES,
  baseDeInversion,
  DEF_APORTE,
  EQUIPO_DE_INVERSION,
  INVERSION,
  ITEM_BIEN,
  ITEM_SERVICIO,
  PERMISOS_DE_APROBACION
} from '../../test/inversion'
import { selectNativo } from '../../test/formulario'
import { montar, pagina } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import type { Registro } from '../datos/registros'
import { FichaAportePage } from './FichaAportePage'
import { estadosDeLaFicha } from '../../test/fichas'

vi.mock('../documentos/exif', () => ({ leerExif: async () => ({}) }))

// S44 (screens.md §10, WF-P): el aporte con su total que se aprobará (la suma de sus ítems, como la juzga el servidor), la barra del
// tope de la campaña sin contarlo dos veces, los ítems solo en requested (decisión 1), «Editar» con motivo y sin los términos
// aprobados fuera de requested (elección 7), y el 404 de un aporte de otro proyecto sin distinguir
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const transiciones = (lista: [string, string][]) => ({
  path: '/objects/social_contribution/records/a1/transitions',
  body: lista.map(([name, label]) => ({ name, label, to: 'approved', toLabel: 'Aprobado', allowed: true, reason: null }))
})

const rutas = (aporte: Registro = APORTE, extra: MockRoute[] = []): MockRoute[] => [
  ...extra,
  ...baseDeInversion(),
  { path: '/objects/social_contribution/records/a1', body: aporte },
  transiciones([
    ['approve_direct', 'Aprobar sin revisión interna'],
    ['reject', 'Rechazar']
  ]),
  { method: 'POST', path: '/sgspe/transition-checks', body: { allowed: true, blocking: [], warnings: [] } },
  { path: '/objects/contribution_item/records', body: pagina([ITEM_BIEN, ITEM_SERVICIO]) },
  { path: '/objects/commitment/records', body: pagina([]) },
  { path: '/objects/social_contribution/records', body: pagina([]) },
  { path: '/objects/stakeholder_request/records', body: pagina([]) },
  { path: '/objects/delivery/records', body: pagina([]) },
  { path: '/objects/receipt/records', body: pagina([]) },
  { path: '/objects/social_contribution/records/a1/related/evidence_social_contribution', body: pagina([]) },
  { path: '/objects/social_contribution/records/a1/history', body: [] }
]

const abrir = (usuario = INVERSION, permisos = EQUIPO_DE_INVERSION) =>
  montar(<FichaAportePage />, {
    ruta: '/projects/p1/contributions/a1',
    camino: '/projects/:projectId/contributions/:contributionId',
    usuario,
    permisos
  })

describe('S44 · ficha del aporte', () => {
  it('dice el aporte con su tipo, su estado, su campaña y el total que se aprobará; para qué y para quién; el tope sin contarlo dos veces', async () => {
    fetch = mockFetch(rutas())
    abrir()
    // el título dice para qué es (U-27 del rediseño de UX); el código va en el antetítulo
    expect(await screen.findByRole('heading', { name: 'Equipar la biblioteca escolar', level: 1 })).toBeInTheDocument()
    // en el camino del flujo y el panel de decisión (revisión de UX, etapa 4); ya no en la cabecera (U-25)
    expect((await screen.findAllByText('Solicitado')).length).toBeGreaterThan(0)
    expect(estadosDeLaFicha()).toHaveLength(1)
    expect(await screen.findByRole('button', { name: 'Aprobar sin revisión interna' })).toBeInTheDocument()
    const paraQue = screen.getByRole('region', { name: 'Para qué y para quién' })
    expect(within(paraQue).getByText('Equipar la biblioteca escolar')).toBeInTheDocument()
    expect(await within(paraQue).findByRole('link', { name: 'Asociación Ejemplo' })).toBeInTheDocument()
    // quién paga, en su propia sección (DD-06 del rediseño de UX)
    const financiacion = screen.getByRole('region', { name: 'Quién paga y a qué se vincula' })
    expect(await within(financiacion).findByRole('link', { name: 'Empresa Ejemplo S.A.' })).toBeInTheDocument()
    expect(await screen.findByText('Total que se aprobará: S/ 1,750.50')).toBeInTheDocument()
    const tope = await screen.findByRole('region', { name: 'Tope de apoyo social de la campaña' })
    expect(within(tope).getByText('Este aporte').nextElementSibling).toHaveTextContent('S/ 1,750.50')
    expect(within(tope).getByText('Queda').nextElementSibling).toHaveTextContent('S/ 48,249.50')
  })

  // P-09 del rediseño de UX (DD-02 y DD-06; U-03, U-25, U-26 y U-27): el antetítulo en sans; una sola primaria; rechazar, en
  // «Más acciones»; el estado una sola vez (en el panel de decisión); «Para qué y para quién» pliega sus campos sin dato
  it('una sola primaria, rechazar en «Más acciones», el estado una sola vez y los campos sin dato plegados', async () => {
    fetch = mockFetch(
      rutas(APORTE, [
        {
          path: '/objects/social_contribution/records/a1/transitions',
          body: [
            { name: 'reject', label: 'Rechazar', to: 'rejected', toLabel: 'Rechazado', allowed: true, reason: null },
            { name: 'approve', label: 'Aprobar', to: 'approved', toLabel: 'Aprobado', allowed: true, reason: null }
          ]
        }
      ])
    )
    abrir()
    const titulo = await screen.findByRole('heading', { name: 'Equipar la biblioteca escolar', level: 1 })
    const cabecera = titulo.parentElement!
    expect(within(cabecera).getByText(/^Aporte · AP-001/)).not.toHaveClass('font-sg-mono')
    expect(within(cabecera).queryByText('Solicitado')).not.toBeInTheDocument()
    const acciones = await screen.findByRole('group', { name: 'Acciones del registro' })
    expect(await within(acciones).findByRole('button', { name: 'Aprobar' })).toHaveAttribute('data-variant', 'primary')
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(1)
    expect(within(acciones).queryByRole('button', { name: /^Rechazar/ })).not.toBeInTheDocument()
    await userEvent.click(within(acciones).getByRole('button', { name: 'Más acciones' }))
    expect(within(screen.getByRole('group', { name: 'Más acciones' })).getByRole('button', { name: /^Rechazar/ })).toBeInTheDocument()
    expect(await screen.findAllByText('Solicitado', { selector: '[data-estado]' })).toHaveLength(1)
    const paraQue = screen.getByRole('region', { name: 'Para qué y para quién' })
    expect(within(paraQue).queryByText('Festividad')).not.toBeInTheDocument()
    await userEvent.click(within(paraQue).getByRole('button', { name: /^Mostrar los \d+ campos sin dato$/ }))
    expect(within(paraQue).getByText('Festividad')).toBeInTheDocument()
  })

  it('en Solicitado ofrece «Nuevo ítem»; al guardar uno se relee el aporte con su total', async () => {
    fetch = mockFetch(rutas(APORTE, [{ method: 'POST', path: '/objects/contribution_item/records', status: 201, body: ITEM_BIEN }]))
    red = espiarRed()
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo ítem' }))
    const drawer = await screen.findByRole('dialog', { name: 'Nuevo ítem' })
    await userEvent.type(await within(drawer).findByLabelText(/^description/), 'Libros')
    await userEvent.selectOptions(selectNativo(within(drawer).getByLabelText(/^item_kind/)), 'BIEN')
    await userEvent.type(within(drawer).getByLabelText(/^line_amount/), '200')
    const lecturas = red.a('GET', '/objects/social_contribution/records/a1').length
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('POST', '/objects/contribution_item/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/contribution_item/records')[0].cuerpo).toMatchObject({ attributes: { description: 'Libros', social_contribution: 'a1' } })
    await waitFor(() => expect(red!.a('GET', '/objects/social_contribution/records/a1').length).toBeGreaterThan(lecturas))
  })

  it('fuera de Solicitado los ítems no cambian y lo dice; «Editar» no ofrece los términos aprobados', async () => {
    fetch = mockFetch(rutas({ ...APORTE, state: 'approved' }))
    abrir()
    expect(await screen.findByText('El aporte ya salió de «Solicitado»: sus ítems no cambian. Un cambio es otro aporte.')).toBeInTheDocument()
    expect(await screen.findByText('Total aprobado: S/ 1,750.50')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo ítem' })).not.toBeInTheDocument()
    // sin barra del tope: ya se juzgó al aprobar
    expect(screen.queryByRole('region', { name: 'Tope de apoyo social de la campaña' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }))
    const drawer = await screen.findByRole('dialog', { name: 'Editar el aporte' })
    expect(drawer).toHaveAccessibleDescription(/no cambian la moneda, el tipo, el tema, la campaña/)
    expect(await within(drawer).findByLabelText(/^occasion/)).toBeInTheDocument()
    expect(within(drawer).queryByLabelText(/^currency/)).not.toBeInTheDocument()
    expect(within(drawer).queryByLabelText(/^contribution_type/)).not.toBeInTheDocument()
  })

  it('al guardar «Editar» (fijar el tipo) vuelve a consultar en seco: «Aprobar» deja de estar bloqueado sin recargar', async () => {
    const sinTipo = { ...APORTE, attributes: { ...APORTE.attributes, contribution_type: null } }
    const conTipo = { ...APORTE, attributes: { ...APORTE.attributes, contribution_type: 'DONACION' }, updatedAt: '2026-10-05T16:00:00Z' }
    fetch = mockFetch(rutas(sinTipo, [{ method: 'PUT', path: '/objects/social_contribution/records/a1', body: conTipo }]))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/transition-checks',
        responder: () =>
          jsonResponse(
            red!.a('PUT', '/objects/social_contribution/records/a1').length > 0
              ? { allowed: true, blocking: [], warnings: [] }
              : { allowed: false, blocking: [{ code: 'FIELD_REQUIRED', message: 'Falta el tipo de aporte.', field: 'contribution_type' }], warnings: [] }
          )
      }
    ])
    abrir()
    const aprobar = await screen.findByRole('button', { name: 'Aprobar sin revisión interna' })
    await waitFor(() => expect(aprobar).toBeDisabled())
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const drawer = await screen.findByRole('dialog', { name: 'Editar el aporte' })
    // el aporte es requiresReason: sin motivo, el cambio no sale (tercera pasada de UX, 2.2)
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'Lo pidió la junta')
    await userEvent.selectOptions(selectNativo(await within(drawer).findByLabelText(/^contribution_type/)), 'DONACION')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('PUT', '/objects/social_contribution/records/a1')).toHaveLength(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprobar sin revisión interna' })).toBeEnabled())
  })

  // tercera pasada de UX (1.1): el bloqueo por un campo se resuelve donde se informa, sin abrir «Editar» con todos los campos
  it('el bloqueo por un campo ofrece completarlo ahí mismo: solo ese campo, y «Aprobar» se habilita sin recargar', async () => {
    const sinTipo = { ...APORTE, attributes: { ...APORTE.attributes, contribution_type: null } }
    const conTipo = { ...APORTE, attributes: { ...APORTE.attributes, contribution_type: 'DONACION' }, updatedAt: '2026-10-05T16:00:00Z' }
    fetch = mockFetch(rutas(sinTipo, [{ method: 'PUT', path: '/objects/social_contribution/records/a1', body: conTipo }]))
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/transition-checks',
        responder: () =>
          jsonResponse(
            red!.a('PUT', '/objects/social_contribution/records/a1').length > 0
              ? { allowed: true, blocking: [], warnings: [] }
              : { allowed: false, blocking: [{ code: 'FIELD_REQUIRED', message: 'Falta el tipo de aporte.', field: 'contribution_type' }], warnings: [] }
          )
      }
    ])
    abrir()
    const aprobar = await screen.findByRole('button', { name: 'Aprobar sin revisión interna' })
    await waitFor(() => expect(aprobar).toBeDisabled())
    await userEvent.click(await screen.findByRole('button', { name: /^Completar «contribution_type»/ }))
    const drawer = await screen.findByRole('dialog', { name: /^Completar «contribution_type»/ })
    const tipo = await within(drawer).findByLabelText(/^contribution_type/)
    expect(within(drawer).queryByLabelText(/^occasion/)).not.toBeInTheDocument()
    await userEvent.type(within(drawer).getByLabelText('Motivo (obligatorio)'), 'Lo pidió la junta')
    await userEvent.selectOptions(selectNativo(tipo), 'DONACION')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('PUT', '/objects/social_contribution/records/a1')).toHaveLength(1))
    expect(red.a('PUT', '/objects/social_contribution/records/a1')[0].cabeceras.get('X-Change-Reason')).toBe("UTF-8''Lo%20pidi%C3%B3%20la%20junta")
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprobar sin revisión interna' })).toBeEnabled())
    expect(screen.queryByRole('button', { name: /^Completar/ })).not.toBeInTheDocument()
  })

  it('un ITEMS_FROZEN al borrar (otra persona aprobó mientras tanto) dice su texto', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([
      {
        method: 'DELETE',
        path: '/objects/contribution_item/records/it1',
        responder: () => problema(409, 'congelado', [{ field: 'social_contribution', message: 'ITEMS_FROZEN' }])
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Estantes de madera' }))
    const drawer = await screen.findByRole('dialog', { name: 'Ítems' })
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Borrar' }))
    await userEvent.click(within(drawer).getByRole('button', { name: 'Borrar' }))
    expect(await within(drawer).findByText('Otra persona aprobó el aporte mientras tanto: sus ítems ya no cambian.')).toBeInTheDocument()
  })

  it('un ítem con un monto que no es válido no se suma como cero: dice los inválidos y ningún total', async () => {
    const roto = { ...ITEM_BIEN, attributes: { ...ITEM_BIEN.attributes, line_amount: 'abc' } }
    fetch = mockFetch(rutas(APORTE, [{ path: '/objects/contribution_item/records', body: pagina([roto]) }]))
    abrir()
    expect(await screen.findByText('Hay montos de ítems que no son válidos y no se suman: corríjalos.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Estantes de madera' })).toBeInTheDocument()
    expect(screen.queryByText(/^Total que se aprobará/)).not.toBeInTheDocument()
    // la barra del tope no dice «Este aporte S/ 0.00» ni un «Queda» inflado: no se dibuja
    expect(screen.queryByRole('region', { name: 'Tope de apoyo social de la campaña' })).not.toBeInTheDocument()
  })

  it('con un ítem válido y otro ilegible no dice una suma parcial como total ni dibuja el tope', async () => {
    const roto = { ...ITEM_BIEN, attributes: { ...ITEM_BIEN.attributes, line_amount: 'abc' } }
    fetch = mockFetch(rutas(APORTE, [{ path: '/objects/contribution_item/records', body: pagina([roto, ITEM_SERVICIO]) }]))
    abrir()
    expect(await screen.findByText('Hay montos de ítems que no son válidos y no se suman: corríjalos.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Transporte a la institución' })).toBeInTheDocument()
    expect(screen.queryByText(/^Total que se aprobará/)).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tope de apoyo social de la campaña' })).not.toBeInTheDocument()
  })

  it('si el tope de lectura corta los ítems, el total que se aprobará no se dice como completo ni se dibuja el tope', async () => {
    const muchos = Array.from({ length: 1000 }, (_, i) => ({ ...ITEM_BIEN, id: `it${i}` }))
    fetch = mockFetch(rutas(APORTE, [{ path: '/objects/contribution_item/records', body: pagina(muchos, { nextCursor: 'c2' }) }]))
    abrir()
    expect(await screen.findByText('La lista de ítems llegó al tope de lectura: el total no se calcula porque podría faltar algún ítem.')).toBeInTheDocument()
    expect(screen.queryByText(/^Total que se aprobará/)).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tope de apoyo social de la campaña' })).not.toBeInTheDocument()
  })

  it('quien aprueba lee el aporte sin «Editar», «Nuevo ítem» ni «Borrar»', async () => {
    // APPROVER tiene «u» sobre social_contribution: UPDATE para transicionar, con todos los campos de solo lectura
    const soloLectura = { ...DEF_APORTE, fields: DEF_APORTE.fields.map((f) => ({ ...f, editable: false })) }
    fetch = mockFetch(rutas(APORTE, [transiciones([['approve', 'Aprobar']]), { path: '/metadata/objects/social_contribution', body: soloLectura }]))
    abrir(APROBACION_DE_APORTES, PERMISOS_DE_APROBACION)
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo ítem' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Estantes de madera' }))
    expect(within(await screen.findByRole('dialog', { name: 'Ítems' })).queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument()
  })

  it('mientras busca la solicitud de origen, «Cargando» no queda dentro de un párrafo (un <p> no contiene otro)', async () => {
    fetch = mockFetch(rutas())
    red = espiarRed([{ path: '/objects/stakeholder_request/records', responder: () => new Promise<Response>(() => {}) }])
    abrir()
    const trazabilidad = await screen.findByRole('complementary', { name: 'Trazabilidad' })
    const cargando = await within(trazabilidad).findByRole('status')
    expect(cargando.parentElement?.closest('p')).toBeNull()
    expect(within(trazabilidad).getByText(/Solicitud de origen/)).toBeInTheDocument()
  })

  it('un aporte que no existe o que la cuenta no lee (404) lo dice sin distinguir y sin «Reintentar»', async () => {
    fetch = mockFetch(rutas(APORTE, [{ path: '/objects/social_contribution/records/a1', status: 404, body: { title: 'Not Found', status: 404 } }]))
    abrir()
    expect(await screen.findByText('El registro no existe o no es de sus proyectos.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a programas e inversión' })).toHaveAttribute('href', '/projects/p1/programs')
  })
})
