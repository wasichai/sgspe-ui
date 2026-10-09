import type { Pedido } from './http'

// los archivos de un campo FILE de wasichai-files (WAS-ADR-0061, decisión D1). el alta de un registro con archivo es en dos
// pasos: el archivo sube primero a POST /api/objects/{object}/files/{field} (parte multipart `file`; el servidor valida el
// tamaño y el tipo por sus bytes y calcula el SHA-256) y responde su descriptor; el registro se crea después con el id del
// descriptor en el campo. un reintento repite solo el segundo paso: el archivo ya subido no viaja otra vez
export interface DescriptorDeArchivo {
  id: string
  name: string
  contentType: string
  size: number
  sha256: string
}

export async function subirArchivo(pedir: Pedido, objeto: string, campo: string, archivo: File): Promise<DescriptorDeArchivo> {
  const formulario = new FormData()
  formulario.append('file', archivo, archivo.name)
  return pedir<DescriptorDeArchivo>(`/objects/${objeto}/files/${campo}`, { formulario })
}

// el valor de un campo FILE en un registro leído: el descriptor, o nada si el campo está vacío o es restringido
export function descriptorDe(valor: unknown): DescriptorDeArchivo | null {
  if (!valor || typeof valor !== 'object') return null
  const d = valor as Partial<DescriptorDeArchivo>
  return typeof d.id === 'string' && typeof d.name === 'string' && typeof d.size === 'number' ? (d as DescriptorDeArchivo) : null
}

// el tamaño con su unidad, en números es-PE: 980 B, 12.5 kB, 3.4 MB
export function tamanoPe(bytes: number): string {
  const formato = (n: number) => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(n)
  if (bytes < 1000) return `${formato(bytes)} B`
  if (bytes < 1_000_000) return `${formato(bytes / 1000)} kB`
  return `${formato(bytes / 1_000_000)} MB`
}
