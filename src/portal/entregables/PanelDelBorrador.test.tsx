import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BORRADOR_CON_MAPA_FALLIDO,
  BORRADOR_EN_COLA,
  BORRADOR_LISTO,
  baseDeF8,
  ENTREGABLE,
  entregableEn,
  EQUIPO_DE_ENTREGABLES,
  REDACCION,
  SECCIONES,
  SHA_INTERNO,
  SIN_BORRADOR
} from '../../test/f8'
import { montar } from '../../test/montar'
import { GERENCIA_SOCIAL, RELACIONISTA } from '../../test/portal'
import { espiarRed, problema, type Red, type RutaEspecial } from '../../test/red'
import type { Registro } from '../datos/registros'
import { PanelDelBorrador } from './PanelDelBorrador'

// el panel del borrador (deliverables.md §8.2, api.md §4.12): el sondeo de 5 s con un reloj falso (la máquina suele estar
// cargada: las aserciones cuentan «al menos» y «ninguno después»), el PDF de cada nivel, el DOCX INTERNO y el pedido con motivo
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  URL.createObjectURL = vi.fn(() => 'blob:borrador')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

const usuario = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
const abrir = (especiales: RutaEspecial[], entregable: Registro = ENTREGABLE, quien = GERENCIA_SOCIAL, permisos = EQUIPO_DE_ENTREGABLES) => {
  fetch = mockFetch(baseDeF8(quien))
  red = espiarRed(especiales)
  montar(<PanelDelBorrador entregable={entregable} secciones={SECCIONES} />, { usuario: quien, permisos })
}
const estado = (respuestas: (() => Response)[]): RutaEspecial => {
  let veces = 0
  return { path: '/sgspe/deliverables/d1/draft', responder: () => respuestas[Math.min(veces++, respuestas.length - 1)]() }
}
const llamadas = () => red!.a('GET', '/sgspe/deliverables/d1/draft').length

describe('panel del borrador', () => {
  it('sondea mientras está en cola y para al quedar listo', async () => {
    abrir([estado([() => jsonResponse(BORRADOR_EN_COLA), () => jsonResponse(BORRADOR_EN_COLA), () => jsonResponse(BORRADOR_LISTO)])])
    expect(await screen.findByText('Se prepara el borrador: el estado se consulta cada 5 segundos.')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(5000)
    await vi.advanceTimersByTimeAsync(5000)
    expect(await screen.findByText('Estado del borrador: LISTO')).toBeInTheDocument()
    expect(llamadas()).toBeGreaterThanOrEqual(3)
    const despuesDeListo = llamadas()
    await vi.advanceTimersByTimeAsync(15000)
    expect(llamadas()).toBe(despuesDeListo)
  })

  it('un error del estado deja de sondear y ofrece reintentar', async () => {
    abrir([estado([() => jsonResponse(BORRADOR_EN_COLA), () => problema(400, 'x'), () => jsonResponse(BORRADOR_LISTO)])])
    await screen.findByText('Se prepara el borrador: el estado se consulta cada 5 segundos.')
    await vi.advanceTimersByTimeAsync(5000)
    expect(await screen.findByText('No se pudo actualizar el estado del borrador.')).toBeInTheDocument()
    const conError = llamadas()
    await vi.advanceTimersByTimeAsync(15000)
    expect(llamadas()).toBe(conError)
    await usuario().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Estado del borrador: LISTO')).toBeInTheDocument()
  })

  it('abre el PDF de cada nivel con su marca, descarga el DOCX INTERNO y dice la huella de cada candidata', async () => {
    abrir([
      estado([() => jsonResponse(BORRADOR_LISTO)]),
      { path: '/sgspe/deliverables/d1/draft/content', responder: () => new Response('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } }) }
    ])
    const panel = await screen.findByRole('region', { name: 'Borrador' })
    expect(await within(panel).findByText(`Huella de lo que se emitirá (INTERNO): ${SHA_INTERNO}`)).toBeInTheDocument()
    await usuario().click(within(panel).getByRole('button', { name: 'Ver el PDF EXTERNO' }))
    expect(await screen.findByRole('dialog', { name: 'Borrador EXTERNO (con la marca BORRADOR)' })).toBeInTheDocument()
    await waitFor(() => expect(red!.a('GET', /\/draft\/content\?level=EXTERNO&format=pdf$/)).toHaveLength(1))
    // el diálogo es modal: se cierra antes de tocar el panel
    await usuario().keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await usuario().click(within(panel).getByRole('button', { name: 'Descargar el DOCX «Interno»' }))
    await waitFor(() => expect(red!.a('GET', /\/draft\/content\?level=INTERNO&format=docx$/)).toHaveLength(1))
  })

  it('sin descargar lo restringido no ofrece los archivos, y lo dice', async () => {
    abrir([estado([() => jsonResponse(BORRADOR_LISTO)])], ENTREGABLE, RELACIONISTA, REDACCION)
    const panel = await screen.findByRole('region', { name: 'Borrador' })
    expect(await within(panel).findByText('Su rol no descarga los borradores: los revisa quien puede leer todo su contenido.')).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /Ver el PDF/ })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Generar otro borrador' })).not.toBeInTheDocument()
  })

  it('pide un borrador con motivo y explica los parámetros que faltan', async () => {
    abrir([
      estado([() => jsonResponse(SIN_BORRADOR)]),
      {
        method: 'POST',
        path: '/sgspe/deliverables/d1/drafts',
        responder: () =>
          problema(422, 'x', [
            { field: 'community', message: 'DELIVERABLE_PARAMETERS_MISSING' },
            { field: 'project.working_crs', message: 'DELIVERABLE_PARAMETERS_MISSING' }
          ])
      }
    ])
    await usuario().click(await screen.findByRole('button', { name: 'Pedir borrador' }))
    const dialogo = screen.getByRole('dialog', { name: 'Pedir borrador' })
    await usuario().type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Revisión de septiembre')
    await usuario().click(within(dialogo).getByRole('button', { name: 'Pedir' }))
    expect(await within(dialogo).findByText(/Falta la comunidad del informe\./)).toBeInTheDocument()
    expect(within(dialogo).getByText(/no tiene sistema de coordenadas de trabajo/)).toBeInTheDocument()
    expect(red!.a('POST', '/sgspe/deliverables/d1/drafts')[0].cabeceras.get('X-Change-Reason')).toBe("UTF-8''Revisi%C3%B3n%20de%20septiembre")
  })

  it('los avisos dicen su sección y un mapa fallido bloquea la emisión; en revisión no se pide otro borrador', async () => {
    abrir([estado([() => jsonResponse(BORRADOR_CON_MAPA_FALLIDO)])], entregableEn('in_review'))
    const panel = await screen.findByRole('region', { name: 'Borrador' })
    expect(
      await within(panel).findByText('No se pudo dibujar un mapa de la sección Portada: la emisión queda bloqueada hasta un borrador nuevo.')
    ).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Generar otro borrador' })).not.toBeInTheDocument()
  })

  it('deja de sondear al desmontar', async () => {
    abrir([estado([() => jsonResponse(BORRADOR_EN_COLA)])])
    await screen.findByText('Se prepara el borrador: el estado se consulta cada 5 segundos.')
    await vi.advanceTimersByTimeAsync(5000)
    expect(llamadas()).toBeGreaterThanOrEqual(2)
    cleanup()
    const alDesmontar = llamadas()
    await vi.advanceTimersByTimeAsync(20000)
    expect(llamadas()).toBe(alDesmontar)
  })
})
