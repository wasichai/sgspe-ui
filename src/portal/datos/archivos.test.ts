import { createApiClient } from '@wasichai/core'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { espiarRed, problema, type Red } from '../../test/red'
import { descriptorDe, subirArchivo, tamanoPe } from './archivos'
import { codigoDelError, crearPedido } from './http'

// WAS-ADR-0061 y api.md §4.9 (decisión D1): el archivo sube en la parte `file` a la ruta del campo y vuelve su descriptor
let fetch: FetchMock | null = null
let red: Red | null = null
const cliente = createApiClient({ baseUrl: '/api', storagePrefix: 'sgspe' })
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

describe('archivos', () => {
  it('sube el archivo en la parte file del campo y devuelve su descriptor', async () => {
    const descriptor = { id: 'f1', name: 'acta.pdf', contentType: 'application/pdf', size: 1234, sha256: 'ab' }
    fetch = mockFetch([{ method: 'POST', path: '/objects/evidence/files/file', status: 201, body: descriptor }])
    red = espiarRed()
    const archivo = new File(['%PDF-1.7'], 'acta.pdf', { type: 'application/pdf' })
    expect(await subirArchivo(crearPedido(cliente, vi.fn()), 'evidence', 'file', archivo)).toEqual(descriptor)
    const [llamada] = red.llamadas
    expect((llamada.formulario?.get('file') as File).name).toBe('acta.pdf')
    expect(llamada.cabeceras.has('Idempotency-Key')).toBe(false)
  })

  it('un archivo rechazado trae el error del campo', async () => {
    fetch = mockFetch([])
    red = espiarRed([
      { method: 'POST', path: '/objects/evidence/files/file', responder: () => problema(400, 'tipo', [{ field: 'file', message: 'FILE_TOO_LARGE' }]) }
    ])
    const error = await subirArchivo(crearPedido(cliente, vi.fn()), 'evidence', 'file', new File(['x'], 'x.bin')).catch((e: unknown) => e)
    expect(codigoDelError(error)).toBe('FILE_TOO_LARGE')
  })

  // los mensajes reales de wasichai-files 0.6.0 (FileService.kt): texto libre en inglés sobre `file`
  it.each([
    ['must be one of application/pdf, image/*', 'FILE_TYPE_NOT_ALLOWED'],
    ['must not be empty', 'FILE_EMPTY'],
    ['must be at most 20971520 bytes', 'FILE_TOO_LARGE'],
    ['algo que el portal no conoce', 'FILE_REJECTED']
  ])('un 400 de wasichai-files «%s» se vuelve el código %s', async (mensaje, codigo) => {
    fetch = mockFetch([])
    red = espiarRed([
      {
        method: 'POST',
        path: '/objects/evidence/files/file',
        responder: () => problema(400, "File type x is not allowed in 'file'", [{ field: 'file', message: mensaje }])
      }
    ])
    const error = await subirArchivo(crearPedido(cliente, vi.fn()), 'evidence', 'file', new File(['x'], 'x.zip')).catch((e: unknown) => e)
    expect(codigoDelError(error)).toBe(codigo)
  })

  it('lee el descriptor de un registro y dice el tamaño en es-PE', () => {
    expect(descriptorDe({ id: 'f1', name: 'a.jpg', size: 10, contentType: 'image/jpeg', sha256: 'x' })?.name).toBe('a.jpg')
    expect(descriptorDe({ id: 'f1', name: 'a.jpg', size: 10 })).toBeNull()
    expect(descriptorDe(null)).toBeNull()
    expect(descriptorDe('f1')).toBeNull()
    expect(tamanoPe(980)).toBe('980 B')
    expect(tamanoPe(12_500)).toBe('12.2 kB')
    expect(tamanoPe(3_400_000)).toBe('3.2 MB')
  })
})
