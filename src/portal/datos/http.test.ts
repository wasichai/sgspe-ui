import { createApiClient } from '@wasichai/core'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { espiarRed, problema, type Red } from '../../test/red'
import { campoDelError, codigoDelError, crearPedido, ErrorDeSgspe, ESPERA_PARA_REVOCAR, guardarArchivo, motivoEnCabecera, nombreDeArchivo } from './http'

// api.md §3.5 a §3.8: el portal manda If-Match con el updatedAt leído, el motivo en la forma RFC 8187 y una clave de
// idempotencia por acción; los errores traen su detail, sus campos y el X-Correlation-Id
let fetch: FetchMock | null = null
let red: Red | null = null
const cliente = createApiClient({ baseUrl: '/api', storagePrefix: 'sgspe' })

beforeEach(() => {
  localStorage.clear()
  cliente.setToken('t-1')
})
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = null
  fetch = null
})

describe('pedir', () => {
  it('manda el token, la versión, el motivo codificado y la clave', async () => {
    fetch = mockFetch([{ method: 'PUT', path: '/objects/project/records/p1', body: { id: 'p1' } }])
    red = espiarRed()
    const pedir = crearPedido(cliente, vi.fn())
    await pedir('/objects/project/records/p1', {
      metodo: 'PUT',
      json: { attributes: {} },
      version: '2026-10-07T14:03:11.482913Z',
      motivo: 'cambió la etapa',
      clave: 'k-1'
    })
    const [llamada] = red.llamadas
    expect(llamada.cabeceras.get('Authorization')).toBe('Bearer t-1')
    expect(llamada.cabeceras.get('If-Match')).toBe('"2026-10-07T14:03:11.482913Z"')
    expect(llamada.cabeceras.get('X-Change-Reason')).toBe("UTF-8''cambi%C3%B3%20la%20etapa")
    expect(llamada.cabeceras.get('Idempotency-Key')).toBe('k-1')
    expect(llamada.cabeceras.get('Content-Type')).toBe('application/json')
    expect(llamada.cuerpo).toEqual({ attributes: {} })
  })

  it('sin motivo ni versión no manda esas cabeceras', async () => {
    fetch = mockFetch([{ path: '/objects/project/records', body: { content: [] } }])
    red = espiarRed()
    await crearPedido(cliente, vi.fn())('/objects/project/records')
    expect(red.llamadas[0].cabeceras.has('If-Match')).toBe(false)
    expect(red.llamadas[0].cabeceras.has('X-Change-Reason')).toBe(false)
    expect(red.llamadas[0].cabeceras.has('Content-Type')).toBe(false)
  })

  it('un multipart no fija Content-Type: el navegador pone el boundary', async () => {
    fetch = mockFetch([{ method: 'POST', path: '/sgspe/territory/imports', body: { importBatchId: 'b1' } }])
    red = espiarRed()
    const formulario = new FormData()
    formulario.append('target', 'project_component')
    await crearPedido(cliente, vi.fn())('/sgspe/territory/imports', { formulario })
    expect(red.llamadas[0].metodo).toBe('POST')
    expect(red.llamadas[0].cabeceras.has('Content-Type')).toBe(false)
    expect(red.llamadas[0].formulario?.get('target')).toBe('project_component')
  })

  it('un 412 es un ErrorDeSgspe con el detail, los campos y la correlación', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      {
        method: 'PUT',
        path: '/objects/project/records/p1',
        responder: () => problema(412, 'El registro cambió', [{ field: 'updatedAt', message: 'valor actual x' }], 'abc-9')
      }
    ])
    const error = await crearPedido(cliente, vi.fn())('/objects/project/records/p1', { metodo: 'PUT', json: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ErrorDeSgspe)
    expect(error).toMatchObject({
      status: 412,
      message: 'El registro cambió',
      correlationId: 'abc-9',
      violations: [{ field: 'updatedAt', message: 'valor actual x' }]
    })
  })

  it('el código de una guarda sale de errors[0].message y su campo de errors[0].field; el texto libre de wasichai no es código', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      {
        method: 'DELETE',
        path: '/objects/project/records/p1',
        responder: () => problema(409, 'No se puede borrar project', [{ field: 'engagement.project', message: 'HAS_DEPENDENTS' }])
      },
      { method: 'PUT', path: '/objects/project/records/p1', responder: () => problema(400, 'Datos inválidos', [{ field: 'name', message: 'es obligatorio' }]) }
    ])
    const pedir = crearPedido(cliente, vi.fn())
    const conCodigo = await pedir('/objects/project/records/p1', { metodo: 'DELETE' }).catch((e: unknown) => e)
    expect(codigoDelError(conCodigo)).toBe('HAS_DEPENDENTS')
    expect(campoDelError(conCodigo)).toBe('engagement.project')
    const sinCodigo = await pedir('/objects/project/records/p1', { metodo: 'PUT', json: {} }).catch((e: unknown) => e)
    expect(codigoDelError(sinCodigo)).toBeNull()
    expect(campoDelError(sinCodigo)).toBeNull()
    expect(codigoDelError(new Error('x'))).toBeNull()
  })

  it('un 401 borra el token y cierra la sesión', async () => {
    fetch = mockFetch([{ path: '/objects/project/records', status: 401, body: null }])
    const cerrar = vi.fn()
    await expect(crearPedido(cliente, cerrar)('/objects/project/records')).rejects.toMatchObject({ status: 401 })
    expect(cliente.getToken()).toBeNull()
    expect(cerrar).toHaveBeenCalledOnce()
  })

  it('un archivo vuelve con su nombre', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      {
        method: 'POST',
        path: '/sgspe/exports/stakeholder-register',
        responder: () => new Response('PK', { headers: { 'Content-Disposition': 'attachment; filename="x.xlsx"; filename*=UTF-8\'\'registro%20GI.xlsx' } })
      }
    ])
    const archivo = await crearPedido(cliente, vi.fn()).archivo('/sgspe/exports/stakeholder-register', { json: { disclosureLevel: 'INTERNO' } })
    expect(archivo.nombre).toBe('registro GI.xlsx')
    expect(await archivo.blob.text()).toBe('PK')
  })
})

describe('cabeceras', () => {
  it('el motivo siempre viaja en la forma UTF-8 de RFC 8187', () => {
    expect(motivoEnCabecera('  10% de avance ')).toBe("UTF-8''10%25%20de%20avance")
  })

  it.each([
    ['attachment; filename="a.xlsx"', 'a.xlsx'],
    ["attachment; filename*=UTF-8''b%C3%B1.xlsx", 'bñ.xlsx'],
    [null, null],
    // un filename* mal codificado no lanza URIError: vale el filename simple, y sin él, ninguno (revisión final, M10)
    ['attachment; filename*=UTF-8\'\'mal%E0%A4.xlsx; filename="respaldo.xlsx"', 'respaldo.xlsx'],
    ["attachment; filename*=UTF-8''mal%E0%A4.xlsx", null]
  ])('Content-Disposition %j nombra %j', (valor, nombre) => {
    expect(nombreDeArchivo(valor)).toBe(nombre)
  })
})

describe('guardarArchivo (revisión final, M10)', () => {
  // jsdom no trae createObjectURL ni revokeObjectURL: se ponen y se devuelven a como estaban
  const originales = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL }
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    URL.createObjectURL = originales.crear
    URL.revokeObjectURL = originales.revocar
  })

  it('revoca la URL del blob después del clic, no en el mismo tick: Firefox y Safari cortarían la descarga', () => {
    vi.useFakeTimers()
    const crear = vi.fn(() => 'blob:prueba')
    const revocar = vi.fn()
    URL.createObjectURL = crear
    URL.revokeObjectURL = revocar
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      // el enlace está en el documento al hacer clic (Firefox no descarga desde un enlace suelto)
      expect(this.isConnected).toBe(true)
      expect(this.download).toBe('reporte.xlsx')
    })
    guardarArchivo({ blob: new Blob(['PK']), nombre: null }, 'reporte.xlsx')
    expect(clic).toHaveBeenCalledOnce()
    expect(revocar).not.toHaveBeenCalled()
    // unos segundos después, no en el siguiente tick (re-revisión, menor 5)
    vi.advanceTimersByTime(1000)
    expect(revocar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(ESPERA_PARA_REVOCAR)
    expect(revocar).toHaveBeenCalledWith('blob:prueba')
    expect(document.querySelector('a[download]')).toBeNull()
  })
})
