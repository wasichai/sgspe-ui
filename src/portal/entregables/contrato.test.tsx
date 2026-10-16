import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jsonResponse, mockFetch, type FetchMock } from '@wasichai/testing'
import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BORRADOR_EN_COLA, BORRADOR_LISTO, ENTREGABLE, SECCION_CONCLUSIONES, SECCION_PORTADA, SHA_MODELO, TIPOS_DE_ENTREGABLE } from '../../test/f8'
import { montar } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { ErrorDeSgspe } from '../datos/http'
import {
  hallazgosDe,
  intervaloDeConsulta,
  rutaDeLaVersion,
  rutaDelBorrador,
  seccionDelTipo,
  useEmitir,
  useEstadoDelBorrador,
  usePedirBorrador,
  useSubirPlantilla,
  useTiposDeEntregable
} from './contrato'
import { cambioDespuesDelBorrador, codigoGi, esCalculada, seEditan } from './tipos'

// el contrato de entregables y plantillas (api.md §4.12): el sondeo del borrador, el pedido con motivo y clave, la emisión con
// IK, IM y CR, la subida multipart con su clave y las violaciones de una plantilla rechazada y los tipos del backend; y las reglas fijas
// de los tipos
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

function Acciones() {
  const pedir = usePedirBorrador('d1')
  const emitir = useEmitir('d1')
  const subir = useSubirPlantilla()
  const archivo = new File(['PK'], 'plantilla.dotx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' })
  return (
    <>
      <button onClick={() => pedir.mutate({ motivo: 'Revisión de septiembre' })}>Pedir</button>
      <button onClick={() => emitir.mutate({ entregable: ENTREGABLE, draftModelSha256: SHA_MODELO, checklistConfirmed: true, motivo: 'Entrega al cliente' })}>
        Emitir
      </button>
      <button onClick={() => subir.mutate({ archivo, clave: 'informe-base', nombre: 'Plantilla Ejemplo' })}>Subir</button>
    </>
  )
}

function Tipos() {
  const tipos = useTiposDeEntregable()
  return <p>{tipos.data ? `tipos:${tipos.data.map((x) => x.type).join(',')}` : 'leyendo'}</p>
}

function Estado() {
  const estado = useEstadoDelBorrador('d1')
  return <p>{estado.isError ? 'error' : (estado.data?.status ?? 'leyendo')}</p>
}

describe('sondeo del borrador', () => {
  afterEach(() => vi.useRealTimers())

  it('vuelve a preguntar mientras está pendiente y se detiene al listo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fetch = mockFetch([])
    let veces = 0
    red = espiarRed([{ path: '/sgspe/deliverables/d1/draft', responder: () => jsonResponse(++veces < 2 ? BORRADOR_EN_COLA : BORRADOR_LISTO) }])
    montar(<Estado />)
    expect(await screen.findByText('EN COLA')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(12000))
    expect(await screen.findByText('LISTO')).toBeInTheDocument()
    const hasta = red.a('GET', '/sgspe/deliverables/d1/draft').length
    expect(hasta).toBeGreaterThanOrEqual(2)
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(red.a('GET', '/sgspe/deliverables/d1/draft')).toHaveLength(hasta)
  })

  it('ante un error deja de preguntar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fetch = mockFetch([])
    red = espiarRed([{ path: '/sgspe/deliverables/d1/draft', responder: () => problema(500, 'falla') }])
    montar(<Estado />)
    expect(await screen.findByText('error', {}, { timeout: 10000 })).toBeInTheDocument()
    const hasta = red.a('GET', '/sgspe/deliverables/d1/draft').length
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(red.a('GET', '/sgspe/deliverables/d1/draft')).toHaveLength(hasta)
  })
})

describe('contrato de entregables', () => {
  it('consulta cada 5 s solo mientras está pendiente y para ante un error', () => {
    expect(intervaloDeConsulta(BORRADOR_EN_COLA, false)).toBe(5000)
    expect(intervaloDeConsulta(BORRADOR_LISTO, false)).toBe(false)
    expect(intervaloDeConsulta(BORRADOR_EN_COLA, true)).toBe(false)
    expect(intervaloDeConsulta(undefined, false)).toBe(false)
  })

  it('las rutas de descarga codifican el id y nunca piden el modelo', () => {
    expect(rutaDelBorrador('d 1', 'INTERNO', 'docx')).toBe('/sgspe/deliverables/d%201/draft/content?level=INTERNO&format=docx')
    expect(rutaDeLaVersion('d1', 2, 'pdf')).toBe('/sgspe/deliverables/d1/versions/2/content?format=pdf')
  })

  it('pide el borrador con motivo y clave, y emite con IK, IM, CR y el SHA-256 revisado', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      { method: 'POST', path: '/sgspe/deliverables/d1/drafts', responder: () => jsonResponse({ deliverable: ENTREGABLE }, 202) },
      { method: 'POST', path: '/sgspe/deliverables/d1/issue', responder: () => jsonResponse({ deliverable: ENTREGABLE, versions: [] }, 201) }
    ])
    montar(<Acciones />)
    await userEvent.click(screen.getByRole('button', { name: 'Pedir' }))
    await expect.poll(() => red!.a('POST', '/sgspe/deliverables/d1/drafts').length).toBe(1)
    const [pedido] = red.a('POST', '/sgspe/deliverables/d1/drafts')
    expect(pedido.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Revisi%C3%B3n%20de%20septiembre")
    expect(pedido.cabeceras.get('Idempotency-Key')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Emitir' }))
    await expect.poll(() => red!.a('POST', '/sgspe/deliverables/d1/issue').length).toBe(1)
    const [emision] = red.a('POST', '/sgspe/deliverables/d1/issue')
    expect(emision.cuerpo).toEqual({ draftModelSha256: SHA_MODELO, checklistConfirmed: true })
    expect(emision.cabeceras.get('If-Match')).toBe('"2026-10-10T15:05:00Z"')
    expect(emision.cabeceras.get('X-Change-Reason')).toBe("UTF-8''Entrega%20al%20cliente")
    expect(emision.cabeceras.get('Idempotency-Key')).toBeTruthy()
  })

  it('sube la plantilla en multipart con su clave, su nombre y una clave de idempotencia', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/deliverable-templates',
        responder: () => jsonResponse({ id: 't9', templateKey: 'informe-base', sha256: 'x', warnings: [] }, 201)
      }
    ])
    montar(<Acciones />)
    await userEvent.click(screen.getByRole('button', { name: 'Subir' }))
    await expect.poll(() => red!.a('POST', '/sgspe/deliverable-templates').length).toBe(1)
    const [subida] = red.a('POST', '/sgspe/deliverable-templates')
    expect(subida.formulario?.get('templateKey')).toBe('informe-base')
    expect(subida.formulario?.get('name')).toBe('Plantilla Ejemplo')
    expect((subida.formulario?.get('file') as File).name).toBe('plantilla.dotx')
    expect(subida.cabeceras.get('Idempotency-Key')).toBeTruthy()
    expect(subida.cabeceras.get('Content-Type')).toBeNull()
  })

  it('lee los tipos de entregable con su clave de sesión', async () => {
    fetch = mockFetch([{ path: '/sgspe/deliverable-types', body: TIPOS_DE_ENTREGABLE }])
    red = espiarRed()
    montar(<Tipos />)
    expect(await screen.findByText('tipos:DIAGNOSTICO SOCIAL,INFORME DE CAMPO Y AVANCE')).toBeInTheDocument()
    expect(red!.a('GET', '/sgspe/deliverable-types')).toHaveLength(1)
  })

  it('lee las violaciones y los avisos de una plantilla rechazada', () => {
    const rechazo = new ErrorDeSgspe(422, 'x', [{ field: 'file', message: 'TEMPLATE_INVALID' }], 'c', null, {
      violations: [{ code: 'MACROS', detail: 'la plantilla trae macros' }],
      warnings: [{ code: 'FONT_IN_TABLE', detail: 'Calibri' }]
    })
    expect(hallazgosDe(rechazo)).toEqual({
      violaciones: [{ code: 'MACROS', detail: 'la plantilla trae macros' }],
      avisos: [{ code: 'FONT_IN_TABLE', detail: 'Calibri' }]
    })
    expect(hallazgosDe(new ErrorDeSgspe(400, 'x', [{ field: 'file', message: 'FILE_TOO_LARGE' }], 'c'))).toBeNull()
  })
})

describe('reglas de los tipos de entregable', () => {
  it('la marca de IA y la guía salen de los tipos del backend', () => {
    expect(seccionDelTipo(TIPOS_DE_ENTREGABLE, 'INFORME DE CAMPO Y AVANCE', 'antecedentes')?.assisted).toBe(true)
    expect(seccionDelTipo(TIPOS_DE_ENTREGABLE, 'INFORME DE CAMPO Y AVANCE', 'redes')?.assisted).toBe(false)
    expect(seccionDelTipo(TIPOS_DE_ENTREGABLE, 'DIAGNOSTICO SOCIAL', 'introduccion')?.guide).toBe('Propósito del estudio y del documento.')
    expect(seccionDelTipo(TIPOS_DE_ENTREGABLE, 'OTRO', 'antecedentes')).toBeUndefined()
    expect(seccionDelTipo(undefined, 'DIAGNOSTICO SOCIAL', 'introduccion')).toBeUndefined()
  })

  it('se edita en borrador y observado; una calculada nunca; un cambio posterior al borrador se nota', () => {
    expect(seEditan(ENTREGABLE)).toBe(true)
    expect(seEditan({ ...ENTREGABLE, state: 'in_review' })).toBe(false)
    expect(esCalculada(SECCION_PORTADA)).toBe(true)
    expect(cambioDespuesDelBorrador(SECCION_CONCLUSIONES, '2026-10-10T15:00:00.000Z')).toBe(true)
    expect(cambioDespuesDelBorrador(SECCION_PORTADA, '2026-10-10T15:00:00Z')).toBe(false)
    expect(cambioDespuesDelBorrador(SECCION_CONCLUSIONES, null)).toBe(false)
  })

  it('el código de un grupo de interés es el de las exportaciones', () => {
    expect(codigoGi('5e4f3a2b-1c0d-4e9f-8a7b-6c5d4e3f2a1b')).toBe('GI-5E4F3A2B1C0D')
  })
})
