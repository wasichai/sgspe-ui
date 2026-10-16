import { useQuery } from '@tanstack/react-query'
import { useComando } from '../datos/comandos'
import { codigoDelError, ErrorDeSgspe, usePedir } from '../datos/http'
import type { Registro } from '../datos/registros'

// el contrato de entregables y plantillas que lee el portal (api.md §4.12, DeliverableDrafts.kt, DeliverableIssue.kt,
// DeliverableContent.kt y DeliverableTemplates.kt de sgspe). una pantalla no pide /api/sgspe/deliverables/** ni
// /api/sgspe/deliverable-templates por su cuenta

export interface AvisoDelBorrador {
  code: string
  // la clave de la sección o, en PDF_CHECK_FAILED, el nivel; null si no tiene
  section: string | null
}

export interface NivelDelBorrador {
  level: 'INTERNO' | 'EXTERNO'
  // el SHA-256 del PDF candidato del último borrador LISTO; null antes del primero
  candidateSha256: string | null
}

export interface EstadoDelBorrador {
  // SIN GENERAR, EN COLA, EN PROCESO, LISTO o FALLIDO; null si nunca se pidió
  status: string | null
  requestedAt: string | null
  generatedAt: string | null
  revision: string | null
  modelSha256: string | null
  pending: boolean
  levels: NivelDelBorrador[]
  warnings: AvisoDelBorrador[]
}

// deliverables.md §8.2: el portal consulta el estado cada 5 s mientras está pendiente; no hay aviso al terminar
export const CADA_CUANTO = 5000

// un error del estado deja de sondear: la pantalla ofrece reintentar (Review Focus 1)
export const intervaloDeConsulta = (estado: EstadoDelBorrador | undefined, conError: boolean): number | false =>
  !conError && estado?.pending ? CADA_CUANTO : false

export function useEstadoDelBorrador(id: string) {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['deliverable-draft', id],
    queryFn: () => pedir<EstadoDelBorrador>(`/sgspe/deliverables/${encodeURIComponent(id)}/draft`),
    refetchInterval: (consulta) => intervaloDeConsulta(consulta.state.data, consulta.state.status === 'error')
  })
}

// POST …/drafts con motivo (deliverable es requiresReason) e Idempotency-Key (decisión 16): 202 { deliverable }
export function usePedirBorrador(id: string) {
  return useComando<{ deliverable: Registro }, { motivo: string }>(
    ({ motivo }) => ({ ruta: `/sgspe/deliverables/${encodeURIComponent(id)}/drafts`, json: {}, motivo }),
    {
      invalidar: () => [
        ['deliverable-draft', id],
        ['record', 'deliverable', id],
        ['records', 'deliverable']
      ]
    }
  )
}

export interface Emision {
  entregable: Registro
  draftModelSha256: string
  checklistConfirmed: boolean
  motivo: string
}

export interface Emitida {
  deliverable: Registro
  versions: Registro[]
}

// POST …/issue con IK, IM y CR: copia las candidatas, crea las versiones y aplica issued
export function useEmitir(id: string) {
  return useComando<Emitida, Emision>(
    ({ entregable, draftModelSha256, checklistConfirmed, motivo }) => ({
      ruta: `/sgspe/deliverables/${encodeURIComponent(id)}/issue`,
      json: { draftModelSha256, checklistConfirmed },
      version: entregable.updatedAt,
      motivo
    }),
    {
      invalidar: () => [
        ['record', 'deliverable', id],
        ['records', 'deliverable'],
        ['records', 'deliverable_version'],
        ['deliverable-draft', id],
        ['transitions', 'deliverable', id],
        ['history', 'deliverable', id],
        ['documents', 'deliverable', id]
      ]
    }
  )
}

export type FormatoDeArchivo = 'pdf' | 'docx'

// siempre con la marca BORRADOR (DeliverableContent); el DOCX solo en INTERNO; format=model nunca se pide
export const rutaDelBorrador = (id: string, nivel: 'INTERNO' | 'EXTERNO', formato: FormatoDeArchivo): string =>
  `/sgspe/deliverables/${encodeURIComponent(id)}/draft/content?level=${nivel}&format=${formato}`

export const rutaDeLaVersion = (id: string, numero: number, formato: FormatoDeArchivo): string =>
  `/sgspe/deliverables/${encodeURIComponent(id)}/versions/${numero}/content?format=${formato}`

// una violación o un aviso de TemplateValidator: el código y su detalle (un estilo, una fuente, una parte del paquete)
export interface Hallazgo {
  code: string
  detail: string
}

export interface Plantilla {
  id: string
  templateKey: string
  name: string | null
  sha256: string | null
  createdAt: string | null
  warnings: Hallazgo[]
}

export interface PlantillaSubida {
  id: string
  templateKey: string
  sha256: string
  warnings: Hallazgo[]
}

// GET /api/sgspe/deliverable-templates: la más reciente de cada clave (READ sobre deliverable)
export function usePlantillas(activo = true) {
  const pedir = usePedir()
  return useQuery({ queryKey: ['deliverable-templates'], queryFn: () => pedir<Plantilla[]>('/sgspe/deliverable-templates'), enabled: activo })
}

export interface Subida {
  archivo: File
  clave: string
  nombre: string
}

// POST multipart (file, templateKey, name) con Idempotency-Key; name solo si se escribió (StrictBody)
export function useSubirPlantilla() {
  return useComando<PlantillaSubida, Subida>(
    ({ archivo, clave, nombre }) => {
      const formulario = new FormData()
      formulario.append('file', archivo, archivo.name)
      formulario.append('templateKey', clave)
      if (nombre.trim()) formulario.append('name', nombre.trim())
      return { ruta: '/sgspe/deliverable-templates', formulario }
    },
    { invalidar: () => [['deliverable-templates']] }
  )
}

const lista = (valor: unknown): Hallazgo[] =>
  Array.isArray(valor)
    ? valor.flatMap((h) =>
        h && typeof h === 'object' && typeof (h as Hallazgo).code === 'string'
          ? [{ code: (h as Hallazgo).code, detail: String((h as Hallazgo).detail ?? '') }]
          : []
      )
    : []

// 422 TEMPLATE_INVALID trae violations[] y warnings[] en el problem+json (DeliverableTemplatesController)
export function hallazgosDe(error: unknown): { violaciones: Hallazgo[]; avisos: Hallazgo[] } | null {
  if (codigoDelError(error) !== 'TEMPLATE_INVALID' || !(error instanceof ErrorDeSgspe)) return null
  return { violaciones: lista(error.cuerpo?.violations), avisos: lista(error.cuerpo?.warnings) }
}

// la descarga nativa de wasichai-files (READ): la plantilla no tiene marca ni export_log
export const rutaDeLaPlantilla = (id: string): string => `/objects/deliverable_template/records/${encodeURIComponent(id)}/files/file`

// GET /api/sgspe/deliverable-types (DeliverableTypeCatalog, decisión 1 del plan): los tipos que registra el backend con sus
// secciones; assisted dice si la sección admite AI-04 y guide es su guía de redacción. no cambian mientras corre el backend: se
// leen una vez por sesión. el portal no copia ninguna lista de secciones
export interface SeccionDelTipo {
  key: string
  title: string
  order: number
  kind: string
  required: boolean
  assisted: boolean
  guide: string
}

export interface TipoDeEntregable {
  type: string
  version: number
  sections: SeccionDelTipo[]
}

export function useTiposDeEntregable() {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['deliverable-types'],
    queryFn: () => pedir<TipoDeEntregable[]>('/sgspe/deliverable-types'),
    staleTime: Infinity,
    gcTime: Infinity
  })
}

// la sección de un tipo por su clave; undefined si el tipo o la sección no están (o los tipos todavía no se leyeron)
export const seccionDelTipo = (tipos: TipoDeEntregable[] | undefined, tipo: string, clave: string): SeccionDelTipo | undefined =>
  tipos?.find((t) => t.type === tipo)?.sections.find((s) => s.key === clave)
