import { ApiError } from '@wasichai/core'
import { ErrorDeSgspe, esCodigo, type Pedido } from './http'

// los archivos de un campo FILE de wasichai-files (WAS-ADR-0061, decisión D1). el alta de un registro con archivo es en dos
// pasos: el archivo sube primero a POST /api/objects/{object}/files/{field} (parte multipart `file`; el servidor valida el
// tamaño y el tipo por sus bytes y calcula el SHA-256) y responde su descriptor; el registro se crea después con el id del
// descriptor en el campo. un reintento repite solo el segundo paso: el archivo ya subido no viaja otra vez
export interface DescriptorDeArchivo {
  id: string
  // UPS-24: el servidor los omite del descriptor que lee quien no descarga una evidencia restringida; la respuesta de la
  // subida (201) los trae siempre
  name?: string
  contentType: string
  size: number
  sha256?: string
}

export async function subirArchivo(pedir: Pedido, objeto: string, campo: string, archivo: File): Promise<DescriptorDeArchivo> {
  const formulario = new FormData()
  formulario.append('file', archivo, archivo.name)
  try {
    return await pedir<DescriptorDeArchivo>(`/objects/${objeto}/files/${campo}`, { formulario })
  } catch (error) {
    throw conCodigoDeArchivo(error)
  }
}

// wasichai-files rechaza con un 400 sobre `file` y texto libre en inglés (FileService.kt): un tipo no admitido («must be one of
// …»), un archivo vacío («must not be empty») o su propio tope («must be at most N bytes»). el portal los vuelve códigos para
// decirlos en español; un texto que no reconoce queda como FILE_REJECTED, nunca en inglés
function conCodigoDeArchivo(error: unknown): unknown {
  if (!(error instanceof ApiError) || error.status !== 400) return error
  const violacion = error.violations.find((v) => v.field === 'file')
  if (!violacion || esCodigo(violacion.message)) return error
  const texto = violacion.message ?? ''
  const codigo = /^must be one of/i.test(texto)
    ? 'FILE_TYPE_NOT_ALLOWED'
    : /^must not be empty/i.test(texto)
      ? 'FILE_EMPTY'
      : /^must be at most \d+ bytes/i.test(texto)
        ? 'FILE_TOO_LARGE'
        : 'FILE_REJECTED'
  return new ErrorDeSgspe(400, error.message, [{ field: 'file', message: codigo }], error instanceof ErrorDeSgspe ? error.correlationId : null)
}

// el valor de un campo FILE en un registro leído: el descriptor, o nada si el campo está vacío o es restringido. `name` y
// `sha256` pueden faltar (UPS-24): quien llama no los da por hechos
export function descriptorDe(valor: unknown): DescriptorDeArchivo | null {
  if (!valor || typeof valor !== 'object') return null
  const d = valor as Partial<DescriptorDeArchivo>
  return typeof d.id === 'string' &&
    typeof d.size === 'number' &&
    typeof d.contentType === 'string' &&
    (d.name === undefined || typeof d.name === 'string') &&
    (d.sha256 === undefined || typeof d.sha256 === 'string')
    ? (d as DescriptorDeArchivo)
    : null
}

// el tamaño con su unidad, en números es-PE y en base 1024 como el tope de 20 MB: 980 B, 12.2 kB, 3.2 MB
export function tamanoPe(bytes: number): string {
  const formato = (n: number) => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(n)
  if (bytes < 1024) return `${formato(bytes)} B`
  if (bytes < 1024 * 1024) return `${formato(bytes / 1024)} kB`
  return `${formato(bytes / (1024 * 1024))} MB`
}
