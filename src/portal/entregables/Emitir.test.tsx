import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BORRADOR_CON_MAPA_FALLIDO,
  BORRADOR_LISTO,
  baseDeF8,
  EJECUTIVA,
  ENTREGABLE,
  entregableEn,
  EQUIPO_DE_ENTREGABLES,
  SHA_EXTERNO,
  SHA_INTERNO,
  SHA_MODELO,
  SOLO_LECTURA_F8,
  transicion,
  VERSION_EXTERNO,
  VERSION_INTERNO
} from '../../test/f8'
import { montar, pagina } from '../../test/montar'
import { GERENCIA_SOCIAL } from '../../test/portal'
import { espiarRed, problema, type Red, type RutaEspecial } from '../../test/red'
import type { Registro } from '../datos/registros'
import type { EstadoDelBorrador } from './contrato'
import { AccionesDelEntregable } from './Emitir'
import { Versiones } from './Versiones'

// WF-H, la emisión y las versiones (deliverables.md §8.3 a §8.5, api.md §4.12): se emite lo revisado, con la lista entera y motivo
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

const abrir = (entregable: Registro, borrador: EstadoDelBorrador, transiciones: unknown[], especiales: RutaEspecial[] = []) => {
  fetch = mockFetch([
    { path: '/sgspe/deliverables/d1/draft', body: borrador },
    { path: '/objects/deliverable/records/d1/transitions', body: transiciones },
    ...baseDeF8(GERENCIA_SOCIAL)
  ])
  red = espiarRed(especiales)
  montar(<AccionesDelEntregable entregable={entregable} />, { usuario: GERENCIA_SOCIAL, permisos: EQUIPO_DE_ENTREGABLES })
}
const marcarLaLista = async (dialogo: HTMLElement) => {
  for (const casilla of within(dialogo).getAllByRole('checkbox')) await userEvent.click(casilla)
}
const emitida: RutaEspecial = {
  method: 'POST',
  path: '/sgspe/deliverables/d1/issue',
  responder: () => jsonResponse({ deliverable: entregableEn('issued', { current_revision: '0' }), versions: [VERSION_INTERNO, VERSION_EXTERNO] }, 201)
}

describe('emitir', () => {
  it('emite con el SHA-256 revisado, la lista y el motivo', async () => {
    abrir(entregableEn('approved'), BORRADOR_LISTO, [transicion('return_to_draft', 'Devolver a borrador', 'draft', 'Borrador')], [emitida])
    await userEvent.click(await screen.findByRole('button', { name: 'Emitir…' }))
    const dialogo = screen.getByRole('dialog', { name: 'Emitir el entregable' })
    expect(within(dialogo).getByText(SHA_MODELO)).toBeInTheDocument()
    expect(within(dialogo).getByText(`INTERNO: ${SHA_INTERNO}`)).toBeInTheDocument()
    expect(within(dialogo).getByText(`EXTERNO: ${SHA_EXTERNO}`)).toBeInTheDocument()
    expect(within(dialogo).getAllByRole('checkbox')).toHaveLength(4)
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Entrega al cliente')
    expect(within(dialogo).getByRole('button', { name: 'Emitir' })).toBeDisabled()
    await marcarLaLista(dialogo)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Emitir' }))
    expect(await screen.findByText('Entregable emitido en su revisión 0.')).toBeInTheDocument()
    const [emision] = red!.a('POST', '/sgspe/deliverables/d1/issue')
    expect(emision.cuerpo).toEqual({ draftModelSha256: SHA_MODELO, checklistConfirmed: true })
    expect(emision.cabeceras.get('If-Match')).toBe('"2026-10-10T15:05:00Z"')
    expect(emision.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Entrega%20al%20cliente")
  })

  it('un modelo distinto se explica y ofrece recargar el borrador', async () => {
    abrir(
      entregableEn('approved'),
      BORRADOR_LISTO,
      [],
      [
        {
          method: 'POST',
          path: '/sgspe/deliverables/d1/issue',
          responder: () => problema(409, 'x', [{ field: 'draftModelSha256', message: 'MODEL_MISMATCH' }])
        }
      ]
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Emitir…' }))
    const dialogo = screen.getByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Entrega')
    await marcarLaLista(dialogo)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Emitir' }))
    expect(await within(dialogo).findByText(/El borrador cambió desde que lo revisó/)).toBeInTheDocument()
    const antes = red!.a('GET', '/sgspe/deliverables/d1/draft').length
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Recargar el borrador' }))
    await waitFor(() => expect(red!.a('GET', '/sgspe/deliverables/d1/draft').length).toBeGreaterThan(antes))
  })

  it('un mapa fallido o la lista incompleta no dejan emitir', async () => {
    abrir(entregableEn('approved'), BORRADOR_CON_MAPA_FALLIDO, [])
    const boton = await screen.findByRole('button', { name: 'Emitir…' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('title', 'Un mapa del borrador falló: pida un borrador nuevo antes de emitir.')
  })

  it('si el borrador cambia con el diálogo abierto, avisa, desmarca la lista y no deja emitir hasta usar el actual', async () => {
    const OTRO = 'f'.repeat(64)
    let borrador: EstadoDelBorrador = BORRADOR_LISTO
    let intentos = 0
    abrir(
      entregableEn('approved'),
      BORRADOR_LISTO,
      [],
      [
        { path: '/sgspe/deliverables/d1/draft', responder: () => jsonResponse(borrador) },
        {
          method: 'POST',
          path: '/sgspe/deliverables/d1/issue',
          responder: () =>
            ++intentos === 1
              ? problema(409, 'x', [{ field: 'draftModelSha256', message: 'MODEL_MISMATCH' }])
              : jsonResponse({ deliverable: entregableEn('issued', { current_revision: '0' }), versions: [VERSION_INTERNO, VERSION_EXTERNO] }, 201)
        }
      ]
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Emitir…' }))
    const dialogo = screen.getByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Motivo (obligatorio)'), 'Entrega')
    await marcarLaLista(dialogo)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Emitir' }))
    await within(dialogo).findByRole('button', { name: 'Recargar el borrador' })
    borrador = { ...BORRADOR_LISTO, modelSha256: OTRO }
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Recargar el borrador' }))
    expect(await within(dialogo).findByText(/cambió mientras esta ventana estaba abierta/)).toBeInTheDocument()
    expect(within(dialogo).getByText(SHA_MODELO)).toBeInTheDocument()
    for (const c of within(dialogo).getAllByRole('checkbox')) expect(c).not.toBeChecked()
    expect(within(dialogo).getByRole('button', { name: 'Emitir' })).toBeDisabled()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Usar el borrador actual' }))
    expect(within(dialogo).getByText(OTRO)).toBeInTheDocument()
    await marcarLaLista(dialogo)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Emitir' }))
    await waitFor(() => expect(red!.a('POST', '/sgspe/deliverables/d1/issue')).toHaveLength(2))
    expect(red!.a('POST', '/sgspe/deliverables/d1/issue')[1].cuerpo).toEqual({ draftModelSha256: OTRO, checklistConfirmed: true })
  })

  it('un mapa fallido dice su razón como texto junto al botón', async () => {
    abrir(entregableEn('approved'), BORRADOR_CON_MAPA_FALLIDO, [])
    expect(await screen.findByText('Un mapa del borrador falló: pida un borrador nuevo antes de emitir.')).toBeInTheDocument()
  })

  it('«Aprobar» agrega el SHA-256 del modelo revisado al motivo; sin el estado del borrador no se ofrece', async () => {
    abrir(entregableEn('in_review'), BORRADOR_LISTO, [
      transicion('approve', 'Aprobar', 'approved', 'Aprobado'),
      transicion('observe', 'Observar', 'observed', 'Observado')
    ])
    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }))
    expect(screen.getByText(`Se agrega al motivo: Modelo revisado SHA-256 ${SHA_MODELO}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Emitir…' })).not.toBeInTheDocument()
  })
})

describe('versiones', () => {
  const montarVersiones = (usuario = GERENCIA_SOCIAL, permisos = EQUIPO_DE_ENTREGABLES) => {
    fetch = mockFetch([
      { path: '/objects/deliverable_version/records', body: pagina([VERSION_EXTERNO, VERSION_INTERNO]) },
      {
        path: '/objects/deliverable/records/d1/documents',
        body: [
          { id: 'doc1', number: 'CE-2026-0001', status: 'VALID', recordId: 'd1', objectName: 'deliverable', issuedAt: '2026-10-12T15:00:00Z', snapshot: {} }
        ]
      },
      ...baseDeF8(usuario)
    ])
    red = espiarRed([
      { path: /\/sgspe\/deliverables\/d1\/versions\/\d+\/content/, responder: () => new Response('%PDF', { headers: { 'Content-Type': 'application/pdf' } }) }
    ])
    montar(<Versiones entregable={ENTREGABLE} />, { usuario, permisos })
  }

  it('lista cada versión con su nivel, su huella y sus descargas, y la constancia de emisión', async () => {
    montarVersiones()
    const tabla = await screen.findByRole('table', { name: 'Versiones emitidas' })
    expect(within(tabla).getByText(SHA_INTERNO)).toBeInTheDocument()
    expect(within(tabla).getAllByText('conclusiones')).toHaveLength(2)
    await userEvent.click(within(tabla).getByRole('button', { name: 'Descargar el DOCX de la versión 1' }))
    await waitFor(() => expect(red!.a('GET', /\/sgspe\/deliverables\/d1\/versions\/1\/content\?format=docx$/)).toHaveLength(1))
    expect(within(tabla).queryByRole('button', { name: 'Descargar el DOCX de la versión 2' })).not.toBeInTheDocument()
    expect(within(tabla).getByRole('button', { name: 'Descargar el PDF de la versión 2' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /CE-2026-0001/ })).toBeInTheDocument()
  })

  it('un fallo de descarga se limpia al descargar de nuevo', async () => {
    montarVersiones()
    let n = 0
    red!.restaurar()
    red = espiarRed([
      {
        path: /\/sgspe\/deliverables\/d1\/versions\/\d+\/content/,
        responder: () => (++n === 1 ? problema(500, 'x') : new Response('%PDF', { headers: { 'Content-Type': 'application/pdf' } }))
      }
    ])
    const tabla = await screen.findByRole('table', { name: 'Versiones emitidas' })
    const boton = within(tabla).getByRole('button', { name: 'Descargar el PDF de la versión 2' })
    await userEvent.click(boton)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await userEvent.click(boton)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('sin descargar lo restringido ni exportar, no ofrece descargas', async () => {
    montarVersiones(EJECUTIVA, SOLO_LECTURA_F8)
    const tabla = await screen.findByRole('table', { name: 'Versiones emitidas' })
    expect(within(tabla).queryByRole('button', { name: /Descargar/ })).not.toBeInTheDocument()
  })
})
