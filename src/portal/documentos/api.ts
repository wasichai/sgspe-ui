import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import type { DocumentSnapshot } from '@wasichai/documents'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { descriptorDe, subirArchivo, type DescriptorDeArchivo } from '../datos/archivos'
import { useComando } from '../datos/comandos'
import { codigoDelError, guardarArchivo, usePedir } from '../datos/http'
import { atributo, texto, useRelacionados, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// las evidencias de BC-12 sobre el campo FILE de wasichai-files (decisión D1, api.md §4.9) y los documentos emitidos de
// wasichai-documents (RQ-REP-029)

// la descarga de estas clasificaciones exige DOWNLOAD_RESTRICTED, también a quien la subió (RF-DOC-003, security.md §7.5)
export const CLASIFICACIONES_RESTRINGIDAS: readonly string[] = ['CONFIDENCIAL', 'DATOS PERSONALES']

// los objetos con un vínculo evidence_<objeto> (database-model.md §16): el destino de «Vincular a un registro…». F3 y, desde F4,
// las tres QCS, el riesgo, el incidente y la mención (api.md §4.9)
export const DESTINOS_DE_EVIDENCIA: readonly string[] = [
  'commitment',
  'delivery',
  'agreement',
  'engagement',
  'stakeholder',
  'community',
  'land_parcel',
  'field_visit',
  'field_observation',
  'study',
  'grievance',
  'inquiry',
  'stakeholder_request',
  'social_risk',
  'incident',
  'media_mention'
]

// el tope de un archivo de evidencia: 20 MB de 1024 × 1024 bytes, el mismo de wasichai.files.max-bytes (P52). más grande, el
// servidor responde 400 FILE_TOO_LARGE sobre `file`; el portal lo dice antes de subirlo
export const TAMANO_MAXIMO = 20 * 1024 * 1024

const esRestringida = (clasificacion: unknown): boolean => typeof clasificacion === 'string' && CLASIFICACIONES_RESTRINGIDAS.includes(clasificacion)

// P59: el descriptor del archivo lo lee todo quien lee la evidencia y el servidor no puede ocultar su nombre, así que una
// evidencia CONFIDENCIAL o de DATOS PERSONALES se sube con un nombre neutro: evidencia-<aaaammdd-hhmmss>.<extensión>, con la
// hora de Lima y la extensión del original. el nombre original no sale del navegador
//
// lo que sigue al último punto no siempre es una extensión ("Lista Sra. Mamani", "DNI 12345678.Quispe"): se conserva solo si
// tiene la forma de una (/^\.[a-z0-9]{1,8}$/) y es una de los tipos de evidence.file; si no, sale del tipo MIME del archivo, y
// sin un tipo conocido el nombre va sin extensión. la forma sola no basta: ".quispe" la tiene
const EXTENSIONES_CONOCIDAS: ReadonlySet<string> = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
  '.bmp',
  '.csv',
  '.txt',
  '.docx',
  '.xlsx',
  '.odt',
  '.ods'
])
const EXTENSION_DEL_TIPO: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/tiff': '.tif',
  'image/bmp': '.bmp',
  'text/csv': '.csv',
  'text/plain': '.txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.oasis.opendocument.text': '.odt',
  'application/vnd.oasis.opendocument.spreadsheet': '.ods'
}

function extensionSegura(archivo: File): string {
  const punto = archivo.name.lastIndexOf('.')
  const delNombre = punto > 0 ? archivo.name.slice(punto).toLowerCase() : ''
  if (/^\.[a-z0-9]{1,8}$/.test(delNombre) && EXTENSIONES_CONOCIDAS.has(delNombre)) return delNombre
  return EXTENSION_DEL_TIPO[archivo.type.toLowerCase()] ?? ''
}

export function nombreNeutro(archivo: File, ahora: Date = new Date()): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(ahora)
      .map((p) => [p.type, p.value])
  )
  return `evidencia-${partes.year}${partes.month}${partes.day}-${partes.hour}${partes.minute}${partes.second}${extensionSegura(archivo)}`
}

// el archivo que viaja: el mismo, o una copia con el nombre neutro si la clasificación es restringida
export const archivoParaSubir = (archivo: File, clasificacion: unknown, ahora: Date = new Date()): File =>
  esRestringida(clasificacion) ? new File([archivo], nombreNeutro(archivo, ahora), { type: archivo.type, lastModified: archivo.lastModified }) : archivo

// si quien mira puede bajar el archivo: con DOWNLOAD_RESTRICTED, siempre; sin ella, solo si lee la clasificación y no es
// restringida (el servidor aplica la misma comprobación a las dos rutas de descarga, GET /api/sgspe/evidence/{id}/content y la
// nativa de wasichai-files: sin la acción, 403 ACTION_REQUIRED sobre classification). la acción sale de
// GET /api/auth/me/permissions, como las de F2
export function usePuedeDescargar(): (evidencia: Registro) => boolean {
  const { can } = useAuth()
  const restringidas = can('evidence', 'DOWNLOAD_RESTRICTED')
  return (evidencia) => {
    if (restringidas) return true
    const clasificacion = atributo<string>(evidencia, 'classification')
    return typeof clasificacion === 'string' && !CLASIFICACIONES_RESTRINGIDAS.includes(clasificacion)
  }
}

// el nombre del archivo que se puede decir (P59): el del descriptor para quien descarga la evidencia; «Archivo reservado» para
// quien no (una restringida sin DOWNLOAD_RESTRICTED, o una cuya clasificación no lee); null sin archivo
export function useNombreDeArchivo(): (evidencia: Registro) => string | null {
  const { t } = useTranslation(NS)
  const puedeDescargar = usePuedeDescargar()
  return (evidencia) => {
    const descriptor = descriptorDe(atributo(evidencia, 'file'))
    if (!descriptor) return null
    return puedeDescargar(evidencia) && descriptor.name ? descriptor.name : t('evidencias.archivoReservado')
  }
}

// cómo se nombra una evidencia en una lista, una ficha o un aviso: su título; sin título, el nombre de su archivo que se puede
// decir; sin archivo, un texto neutro. nunca su id: un UUID no le dice nada a nadie
export function useNombreDeEvidencia(): (evidencia: Registro) => string {
  const { t } = useTranslation(NS)
  const nombreDeArchivo = useNombreDeArchivo()
  return (evidencia) => texto(evidencia, 'title') || nombreDeArchivo(evidencia) || t('evidencias.sinNombre')
}

// las evidencias vinculadas a un registro, desde su lado del vínculo (evidence_commitment desde commitment…)
export const useEvidenciasDe = (objeto: string, id: string | undefined) => useRelacionados(objeto, id, `evidence_${objeto}`)

export interface Vinculo {
  object: string
  recordId: string
}

export interface AltaDeEvidencia {
  archivo: File
  // evidence_type, classification y los descriptivos; los vacíos no viajan
  atributos: Record<string, unknown>
  // [longitud, latitud] del EXIF
  ubicacion?: [number, number]
  vinculos?: Vinculo[]
  // un vínculo con un objeto requiresReason (commitment, agreement) exige motivo en los dos registros (WAS-ADR-0041)
  motivo?: string
}

export function cuerpoDeEvidencia(alta: AltaDeEvidencia, descriptor: DescriptorDeArchivo) {
  const attributes = Object.fromEntries(Object.entries(alta.atributos).filter(([, v]) => v !== '' && v !== undefined && v !== null))
  return {
    attributes: { ...attributes, file: descriptor.id },
    ...(alta.ubicacion ? { geometries: { location: { type: 'Point', coordinates: alta.ubicacion } } } : {}),
    ...(alta.vinculos && alta.vinculos.length > 0 ? { links: alta.vinculos } : {})
  }
}

// registrar una evidencia en dos pasos: el archivo una sola vez por elección (un reintento no lo vuelve a subir) y el registro
// con Idempotency-Key (un reintento repite la misma clave y el mismo id de archivo, api.md §4.9). registrar devuelve el
// registro o null; el error queda en `error` para que la pantalla lo diga. lo subido vale para el mismo archivo con el mismo
// nombre: pasar a una clasificación restringida lo vuelve a subir con el nombre neutro (P59). la primera subida, con el nombre
// original, queda huérfana en wasichai-files y se acepta: ningún registro la cita, así que nadie lee su descriptor; quien la
// subió ya conoce el nombre, y StoredFileCleanup la borra pasadas 24 h. un archivo ya usado por otra evidencia (409
// EVIDENCE_FILE_IN_USE) se olvida: el siguiente intento lo sube de nuevo
export function useRegistrarEvidencia() {
  const pedir = usePedir()
  const subido = useRef<{ archivo: File; restringida: boolean; descriptor: DescriptorDeArchivo } | null>(null)
  const renovar = useRef(false)
  const subir = useMutation({
    mutationFn: async ({ archivo, clasificacion }: { archivo: File; clasificacion: unknown }) => {
      const restringida = esRestringida(clasificacion)
      if (subido.current?.archivo === archivo && subido.current.restringida === restringida) return subido.current.descriptor
      const descriptor = await subirArchivo(pedir, 'evidence', 'file', archivoParaSubir(archivo, clasificacion))
      subido.current = { archivo, restringida, descriptor }
      return descriptor
    }
  })
  const comando = useComando<Registro, { alta: AltaDeEvidencia; descriptor: DescriptorDeArchivo }>(
    ({ alta, descriptor }) => ({ ruta: '/sgspe/evidence', json: cuerpoDeEvidencia(alta, descriptor), motivo: alta.motivo }),
    { invalidar: () => [['records', 'evidence'], ['related']] }
  )
  return {
    registrar: async (alta: AltaDeEvidencia): Promise<Registro | null> => {
      if (renovar.current) {
        renovar.current = false
        comando.nuevaAccion()
      }
      try {
        const descriptor = await subir.mutateAsync({ archivo: alta.archivo, clasificacion: alta.atributos.classification })
        const registro = await comando.mutateAsync({ alta, descriptor })
        subido.current = null
        return registro
      } catch (error) {
        // la clave del alta fallida ya vio otro archivo: el intento con el archivo nuevo es otra acción (la clave se renueva al
        // empezarlo, para que el error se siga diciendo mientras tanto)
        if (codigoDelError(error) === 'EVIDENCE_FILE_IN_USE') {
          subido.current = null
          renovar.current = true
        }
        return null
      }
    },
    enCurso: subir.isPending || comando.isPending,
    // el fallo de la subida trae su código sobre `file` (FILE_TOO_LARGE, un tipo no admitido); el del registro, sobre su campo
    error: subir.error ?? comando.error,
    nuevaAccion: () => {
      subido.current = null
      renovar.current = false
      subir.reset()
      comando.nuevaAccion()
    },
    // quita el error que se dice sin tocar la clave ni lo subido: un reintento sigue siendo la misma acción
    limpiarError: () => {
      subir.reset()
      comando.reset()
    }
  }
}

// vincular y desvincular (api.md §4.9): CR si el destino es requiresReason; sin IK
export function useVincularEvidencia() {
  return useComando<void, { evidencia: string; vinculo: Vinculo; motivo?: string }>(
    ({ evidencia, vinculo, motivo }) => ({ ruta: `/sgspe/evidence/${evidencia}/links`, json: vinculo, motivo }),
    { conClave: false, invalidar: (_r, { evidencia }) => [['related'], ['record', 'evidence', evidencia]] }
  )
}

export function useDesvincularEvidencia() {
  return useComando<void, { evidencia: string; vinculo: Vinculo; motivo?: string }>(
    ({ evidencia, vinculo, motivo }) => ({
      ruta: `/sgspe/evidence/${evidencia}/links/${vinculo.object}/${vinculo.recordId}`,
      metodo: 'DELETE',
      json: undefined,
      motivo
    }),
    { conClave: false, invalidar: (_r, { evidencia }) => [['related'], ['record', 'evidence', evidencia]] }
  )
}

// la descarga por SGSPE (GET /api/sgspe/evidence/{id}/content): siempre attachment, con el nombre del archivo
export function useDescargarEvidencia() {
  const pedir = usePedir()
  return useMutation({
    mutationFn: async (evidencia: Registro) => {
      const archivo = await pedir.archivo(`/sgspe/evidence/${evidencia.id}/content`)
      guardarArchivo(archivo, `evidencia-${evidencia.id}`)
    }
  })
}

// ---- documentos emitidos (wasichai-documents) ----

export interface DocumentoEmitido {
  id: string
  number: string
  status: 'VALID' | 'ARCHIVED'
  recordId: string
  objectName: string
  issuedAt: string | null
  snapshot: DocumentSnapshot
}

export interface TipoDeDocumento {
  name: string
  label: string
}

export function useDocumentosEmitidos(objeto: string, id: string) {
  const pedir = usePedir()
  return useQuery({ queryKey: ['documents', objeto, id], queryFn: () => pedir<DocumentoEmitido[]>(`/objects/${objeto}/records/${id}/documents`) })
}

export function useTiposDeDocumento(objeto: string, activo = true) {
  const pedir = usePedir()
  return useQuery({ queryKey: ['document-types', objeto], queryFn: () => pedir<TipoDeDocumento[]>(`/objects/${objeto}/document-types`), enabled: activo })
}

export function useEmitirDocumento(objeto: string, id: string) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (tipo: string) => pedir<DocumentoEmitido>(`/objects/${objeto}/records/${id}/documents/${tipo}`, { metodo: 'POST' }),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['documents', objeto, id] })
      void cliente.invalidateQueries({ queryKey: ['history', objeto, id] })
    }
  })
}

// la página imprimible es de /admin (documentsModule, Tarea 1): abre aparte, con la misma sesión
export const rutaDeImpresion = (documento: DocumentoEmitido) => `/admin/documents/${encodeURIComponent(documento.id)}/print`
