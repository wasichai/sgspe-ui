import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock, type MockRoute } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  baseDeF8,
  entregableEn,
  EQUIPO_DE_ENTREGABLES,
  PRESENTACION_EN_COLA,
  PRESENTACION_FALLIDA,
  PRESENTACION_INTERNA,
  PRESENTACION_LISTA,
  SOLO_LECTURA_F8,
  VERSION_EXTERNO,
  VERSION_INTERNO
} from '../../test/f8'
import { montar, pagina, ubicacion } from '../../test/montar'
import { GERENCIA_SOCIAL } from '../../test/portal'
import { espiarRed, type Red, type RutaEspecial } from '../../test/red'
import type { Presentacion } from './contrato'
import { PresentacionesPage } from './PresentacionesPage'

// la página de presentaciones de un entregable emitido (deliverables.md §16, ADR-0031, api.md §4.12): pedir por público y nivel,
// el estado de cada una, el PDF, el MP4 a pedido y el presentador, con la lista de verificación de EXTERNO y PUBLICO al ver o
// bajar (ASM-147) y el aviso de que sin conexión se presenta con el PDF. el reproductor real (Remotion) se reemplaza por su doble
vi.mock('../presentaciones/PresentadorImpl', () => import('../../test/presentadorFalso'))

let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const EMITIDO = entregableEn('issued', { current_revision: '0', current_version: 'v2' })
const ESPECIFICACION = {
  schema: 1,
  meta: { code: 'INF-001' },
  slides: [{ id: 'portada' }, { id: 'cierre' }]
}
const pdf = () => new Response('%PDF', { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="laminas.pdf"' } })

const abrir = ({
  presentaciones = [PRESENTACION_LISTA, PRESENTACION_EN_COLA, PRESENTACION_FALLIDA, PRESENTACION_INTERNA] as Presentacion[],
  versiones = [VERSION_EXTERNO, VERSION_INTERNO],
  permisos = EQUIPO_DE_ENTREGABLES,
  especiales = [] as RutaEspecial[],
  especificacion = ESPECIFICACION as unknown,
  ruta = '/reports/deliverables/d1/presentations'
} = {}) => {
  const rutas: MockRoute[] = [
    { path: '/objects/deliverable/records/d1', body: EMITIDO },
    { path: '/objects/deliverable_version/records', body: pagina(versiones) },
    { path: '/sgspe/deliverables/d1/presentations', body: presentaciones },
    ...baseDeF8(GERENCIA_SOCIAL)
  ]
  fetch = mockFetch(rutas)
  red = espiarRed([
    { path: /^\/sgspe\/presentations\/[^/]+\/content/, responder: pdf },
    { path: /^\/sgspe\/presentations\/[^/]+\/spec/, responder: () => jsonResponse(especificacion) },
    { method: 'GET', path: /^\/sgspe\/presentations\/[^/]+\/video/, responder: () => new Response('mp4', { headers: { 'Content-Type': 'video/mp4' } }) },
    ...especiales
  ])
  const camino = ruta.startsWith('/projects/')
    ? '/projects/:projectId/reports/deliverables/:deliverableId/presentations'
    : '/reports/deliverables/:deliverableId/presentations'
  montar(<PresentacionesPage />, { ruta, camino, usuario: GERENCIA_SOCIAL, permisos })
}

const fila = async (publico: string) => {
  const tabla = await screen.findByRole('table', { name: 'Presentaciones pedidas' })
  return within(tabla).getByRole('row', { name: new RegExp(publico) })
}
const confirmarLista = async () => {
  const dialogo = await screen.findByRole('dialog', { name: /Lista de verificación/ })
  const confirmar = within(dialogo).getByRole('button', { name: 'Confirmar y seguir' })
  expect(confirmar).toBeDisabled()
  for (const casilla of within(dialogo).getAllByRole('checkbox')) await userEvent.click(casilla)
  await userEvent.click(confirmar)
}

describe('presentaciones de un entregable emitido', () => {
  it('muestra el entregable, el aviso sin conexión, el pedido y cada presentación con su estado', async () => {
    abrir()
    expect(await screen.findByRole('heading', { level: 1, name: 'Presentaciones' })).toBeInTheDocument()
    expect(screen.getByText(/^INF-001 · /)).toBeInTheDocument()
    expect(screen.getByText(/presente con el PDF/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al entregable' })).toHaveAttribute('href', '/reports/deliverables/d1')
    expect(await screen.findByRole('heading', { name: 'Pedir una presentación' })).toBeInTheDocument()
    const lista = await fila('Instituciones')
    expect(within(lista).getByText('Listo')).toBeInTheDocument()
    expect(within(lista).getByText('12')).toBeInTheDocument()
    expect(within(await fila('Dirección')).getByText('En cola')).toBeInTheDocument()
    const fallida = await fila('Comunidad')
    expect(within(fallida).getByText('Fallido')).toBeInTheDocument()
    expect(within(fallida).getByText('No se pudo componer: un texto no cabe en su lámina.')).toBeInTheDocument()
    // la regla de una sola primaria: la del pedido
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(1)
  })

  it('pide una presentación con la versión, el público y los niveles que ese público admite', async () => {
    abrir({
      especiales: [
        {
          method: 'POST',
          path: '/sgspe/deliverables/d1/versions/2/presentations',
          responder: () => jsonResponse({ presentation: { ...PRESENTACION_EN_COLA, id: 'pr9' } }, 202)
        }
      ]
    })
    const version = await screen.findByRole('combobox', { name: 'Versión emitida' })
    await waitFor(() => expect(within(version).getAllByRole('option').length).toBeGreaterThan(1))
    await userEvent.selectOptions(version, '2')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Público' }), 'COMUNIDAD')
    const nivel = screen.getByRole('combobox', { name: 'Nivel de divulgación' })
    expect(
      within(nivel)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Público'])
    expect(screen.getByText(/Para entender y preguntar/)).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Público' }), 'INSTITUCIONES')
    expect(
      within(nivel)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Externo', 'Público'])
    await userEvent.click(screen.getByRole('button', { name: 'Pedir la presentación' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/deliverables/d1/versions/2/presentations')).toHaveLength(1))
    const [pedido] = red!.a('POST', '/sgspe/deliverables/d1/versions/2/presentations')
    expect(pedido.cuerpo).toEqual({ audience: 'INSTITUCIONES', level: 'EXTERNO' })
    expect(pedido.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(await screen.findByText('Presentación pedida: se está componiendo.')).toBeInTheDocument()
  })

  it('EXTERNO pide la lista de verificación antes de bajar el PDF, una vez por presentación', async () => {
    abrir()
    const lista = await fila('Instituciones')
    await userEvent.click(within(lista).getByRole('button', { name: 'Bajar el PDF' }))
    await confirmarLista()
    await waitFor(() => expect(red!.a('GET', /\/sgspe\/presentations\/pr1\/content\?checklistConfirmed=true$/)).toHaveLength(1))
    await userEvent.click(within(lista).getByRole('button', { name: 'Bajar el PDF' }))
    await waitFor(() => expect(red!.a('GET', /\/sgspe\/presentations\/pr1\/content\?checklistConfirmed=true$/)).toHaveLength(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancelar la lista no baja nada', async () => {
    abrir()
    await userEvent.click(within(await fila('Instituciones')).getByRole('button', { name: 'Bajar el PDF' }))
    const dialogo = await screen.findByRole('dialog', { name: /Lista de verificación/ })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(red!.a('GET', /\/sgspe\/presentations\/pr1\/content/)).toHaveLength(0)
  })

  it('INTERNO se baja sin lista de verificación', async () => {
    abrir()
    await userEvent.click(within(await fila('Equipo de campo')).getByRole('button', { name: 'Bajar el PDF' }))
    await waitFor(() => expect(red!.a('GET', /\/sgspe\/presentations\/pr4\/content$/)).toHaveLength(1))
    expect(screen.queryByRole('dialog', { name: /Lista de verificación/ })).not.toBeInTheDocument()
  })

  it('presenta a pantalla completa sobre la especificación y avanza con el teclado', async () => {
    abrir()
    await userEvent.click(within(await fila('Instituciones')).getByRole('button', { name: 'Presentar' }))
    await confirmarLista()
    const presentador = await screen.findByRole('dialog', { name: 'INF-001 · Instituciones · Externo' })
    expect(await within(presentador).findByText('reproduciendo la lámina 1 de 2')).toBeInTheDocument()
    expect(red!.a('GET', /\/sgspe\/presentations\/pr1\/spec\?checklistConfirmed=true$/)).toHaveLength(1)
    expect(within(presentador).getByText('Lámina 1 de 2')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowRight}')
    expect(within(presentador).getByText('reproduciendo la lámina 2 de 2')).toBeInTheDocument()
    await userEvent.keyboard('{ArrowRight}')
    expect(within(presentador).getByText('Lámina 2 de 2')).toBeInTheDocument()
    await userEvent.click(within(presentador).getByRole('button', { name: 'Lámina anterior' }))
    expect(within(presentador).getByText('reproduciendo la lámina 1 de 2')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('una especificación de otra versión de esquema no se dibuja: se presenta con el PDF', async () => {
    abrir({ especificacion: { ...ESPECIFICACION, schema: 2 } })
    await userEvent.click(within(await fila('Equipo de campo')).getByRole('button', { name: 'Presentar' }))
    const presentador = await screen.findByRole('dialog', { name: 'INF-001 · Equipo de campo · Interno' })
    expect(await within(presentador).findByText(/no se puede mostrar en el navegador/)).toBeInTheDocument()
    expect(within(presentador).queryByRole('button', { name: 'Lámina siguiente' })).not.toBeInTheDocument()
  })

  it('pide el MP4 de una presentación lista y baja el que ya está, con la lista del nivel', async () => {
    const conVideo = { ...PRESENTACION_INTERNA, videoStatus: 'LISTO', videoSha256: 'ab'.repeat(32) }
    abrir({
      presentaciones: [PRESENTACION_LISTA, conVideo],
      especiales: [
        {
          method: 'POST',
          path: '/sgspe/presentations/pr1/video',
          responder: () => jsonResponse({ presentation: { ...PRESENTACION_LISTA, videoStatus: 'EN COLA' } }, 202)
        }
      ]
    })
    await userEvent.click(within(await fila('Instituciones')).getByRole('button', { name: 'Pedir el MP4' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/presentations/pr1/video')).toHaveLength(1))
    expect(red!.a('POST', '/sgspe/presentations/pr1/video')[0].cabeceras.get('Idempotency-Key')).toBeTruthy()
    await userEvent.click(within(await fila('Equipo de campo')).getByRole('button', { name: 'Bajar el MP4' }))
    await waitFor(() => expect(red!.a('GET', /\/sgspe\/presentations\/pr4\/video$/)).toHaveLength(1))
  })

  it('dice el estado del MP4 mientras se compone y por qué falló', async () => {
    abrir({
      presentaciones: [
        { ...PRESENTACION_LISTA, videoStatus: 'EN PROCESO' },
        { ...PRESENTACION_INTERNA, videoStatus: 'FALLIDO', videoFailureCode: 'TIMEOUT' }
      ]
    })
    expect(within(await fila('Instituciones')).getByText('Componiendo el MP4…')).toBeInTheDocument()
    const fallida = await fila('Equipo de campo')
    expect(within(fallida).getByText('El MP4 no se pudo componer: tardó más de lo permitido.')).toBeInTheDocument()
    expect(within(fallida).getByRole('button', { name: 'Pedir el MP4' })).toBeInTheDocument()
  })

  it('pedir otra vez una fallida repite su versión, su público y su nivel', async () => {
    abrir({
      especiales: [
        {
          method: 'POST',
          path: '/sgspe/deliverables/d1/versions/2/presentations',
          responder: () => jsonResponse({ presentation: { ...PRESENTACION_FALLIDA, status: 'EN COLA' } }, 202)
        }
      ]
    })
    await userEvent.click(within(await fila('Comunidad')).getByRole('button', { name: 'Pedir otra vez' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/deliverables/d1/versions/2/presentations')).toHaveLength(1))
    expect(red!.a('POST', '/sgspe/deliverables/d1/versions/2/presentations')[0].cuerpo).toEqual({ audience: 'COMUNIDAD', level: 'PUBLICO' })
  })

  it('quien solo lee ve el estado, pero no pide ni baja', async () => {
    abrir({ permisos: SOLO_LECTURA_F8 })
    const lista = await fila('Instituciones')
    expect(within(lista).getByText('Listo')).toBeInTheDocument()
    expect(within(lista).getByText('Sin permiso para bajarla')).toBeInTheDocument()
    expect(within(lista).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Pedir presentaciones de este entregable no está entre sus permisos.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pedir la presentación' })).not.toBeInTheDocument()
  })

  it('sin versiones emitidas dice de dónde salen las presentaciones', async () => {
    abrir({ versiones: [], presentaciones: [] })
    expect(await screen.findByText('Las presentaciones salen de una versión emitida, y este entregable todavía no tiene ninguna.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pedir una presentación' })).not.toBeInTheDocument()
  })

  it('abierta desde un proyecto, vuelve al entregable dentro del proyecto', async () => {
    abrir({ ruta: '/projects/p1/reports/deliverables/d1/presentations' })
    expect(await screen.findByRole('link', { name: 'Volver al entregable' })).toHaveAttribute('href', '/projects/p1/reports/deliverables/d1')
    expect(ubicacion.actual).toBe('/projects/p1/reports/deliverables/d1/presentations')
  })
})
