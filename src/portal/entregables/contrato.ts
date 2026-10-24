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
  // la marca del PDF (ASM-140): si trae logo y su color de acento RRGGBB; sin acento rige el de la plantilla base
  hasLogo: boolean
  accentColor: string | null
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
  // la marca del PDF (ASM-140): un PNG o JPEG y el acento en seis dígitos hexadecimales, los dos opcionales
  logo?: File | null
  acento?: string
}

// POST multipart (file, templateKey, name, logo y accentColor) con Idempotency-Key; name, logo y accentColor solo si se dieron
// (StrictBody). el acento va sin '#' y en mayúsculas, como lo guarda el backend
export function useSubirPlantilla() {
  return useComando<PlantillaSubida, Subida>(
    ({ archivo, clave, nombre, logo, acento }) => {
      const formulario = new FormData()
      formulario.append('file', archivo, archivo.name)
      formulario.append('templateKey', clave)
      if (nombre.trim()) formulario.append('name', nombre.trim())
      if (logo) formulario.append('logo', logo, logo.name)
      const color = acento?.trim().replace(/^#/, '').toUpperCase()
      if (color) formulario.append('accentColor', color)
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

// las violaciones de la marca (BrandLogo del backend) se dicen en su campo; el resto, en la lista de problemas
export const LOGO_INVALIDO = 'LOGO_INVALID'
export const ACENTO_INVALIDO = 'ACCENT_INVALID'
export function marcaDe(violaciones: Hallazgo[]): { logo: Hallazgo[]; acento: Hallazgo[]; resto: Hallazgo[] } {
  return {
    logo: violaciones.filter((v) => v.code === LOGO_INVALIDO),
    acento: violaciones.filter((v) => v.code === ACENTO_INVALIDO),
    resto: violaciones.filter((v) => v.code !== LOGO_INVALIDO && v.code !== ACENTO_INVALIDO)
  }
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

// las presentaciones de una versión emitida (api.md §4.12, ADR-0031, deliverables.md §16; DeliverablePresentations.kt de sgspe):
// el pedido por público y nivel, la lista con su estado, el PDF de láminas, la especificación para el reproductor y el MP4 a
// pedido. una pantalla no pide /api/sgspe/presentations/** por su cuenta
export const PUBLICOS = ['DIRECCION', 'CAMPO', 'INVESTIGACION', 'INSTITUCIONES', 'COMUNIDAD'] as const
export type Publico = (typeof PUBLICOS)[number]
// del menos al más restrictivo (Presentations.ORDER)
export const NIVELES_DE_PRESENTACION = ['INTERNO', 'EXTERNO', 'PUBLICO'] as const
export type NivelDePresentacion = (typeof NIVELES_DE_PRESENTACION)[number]

// los niveles que admite cada público (Audience.kt, deliverables.md §16.5): un público solo restringe, nunca relaja
const NIVELES_DEL_PUBLICO: Readonly<Record<Publico, readonly NivelDePresentacion[]>> = {
  DIRECCION: NIVELES_DE_PRESENTACION,
  CAMPO: NIVELES_DE_PRESENTACION,
  INVESTIGACION: NIVELES_DE_PRESENTACION,
  INSTITUCIONES: ['EXTERNO', 'PUBLICO'],
  COMUNIDAD: ['PUBLICO']
}

// los niveles que se pueden pedir de una versión para un público: igual o más restrictivo que el de la versión (si no, 422
// LEVEL_NOT_ALLOWED) y admitido por el público (422 AUDIENCE_LEVEL_MISMATCH). PUBLICO también exige hechos tipados en el modelo
// (422 PUBLIC_NOT_AVAILABLE), que el portal no sabe de antemano: lo dice el servidor
export function nivelesPosibles(nivelDeLaVersion: string, publico: Publico): NivelDePresentacion[] {
  const desde = NIVELES_DE_PRESENTACION.indexOf(nivelDeLaVersion as NivelDePresentacion)
  if (desde < 0) return []
  return NIVELES_DE_PRESENTACION.slice(desde).filter((n) => NIVELES_DEL_PUBLICO[publico].includes(n))
}

// la acción de descarga de cada nivel sobre deliverable: la exigen el pedido y cada descarga
export const accionDelNivel = (nivel: string): 'DOWNLOAD_RESTRICTED' | 'EXPORT' => (nivel === 'INTERNO' ? 'DOWNLOAD_RESTRICTED' : 'EXPORT')
// EXTERNO y PUBLICO piden la lista de verificación al bajar el PDF, abrir la especificación o bajar el MP4 (ASM-147), no al pedir
export const pideLista = (nivel: string): boolean => nivel !== 'INTERNO'

export interface Presentacion {
  id: string
  versionNumber: number | null
  audience: string | null
  level: string | null
  // EN COLA, EN PROCESO, LISTO o FALLIDO
  status: string | null
  failureCode: string | null
  slideCount: number | null
  requestedAt: string | null
  generatedAt: string | null
  modelSha256: string | null
  specSha256: string | null
  pdfSha256: string | null
  plannerVersion: string | null
  designVersion: string | null
  rendererVersion: string | null
  // el MP4 a pedido (ASM-148): vacíos si no se pidió; su FALLIDO no toca el PDF
  videoStatus: string | null
  videoFailureCode: string | null
  videoRequestedAt: string | null
  videoGeneratedAt: string | null
  videoSha256: string | null
}

const PENDIENTES: readonly (string | null)[] = ['EN COLA', 'EN PROCESO']
export const estaPendiente = (estado: string | null | undefined): boolean => PENDIENTES.includes(estado ?? null)

// como el borrador: cada 5 s mientras una presentación o su video está en cola o en proceso; un error deja de consultar
export const consultaDePresentaciones = (lista: Presentacion[] | undefined, conError: boolean): number | false =>
  !conError && (lista ?? []).some((p) => estaPendiente(p.status) || estaPendiente(p.videoStatus)) ? CADA_CUANTO : false

export function usePresentaciones(id: string, activa = true) {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['deliverable-presentations', id],
    queryFn: () => pedir<Presentacion[]>(`/sgspe/deliverables/${encodeURIComponent(id)}/presentations`),
    enabled: activa,
    refetchInterval: (consulta) => consultaDePresentaciones(consulta.state.data, consulta.state.status === 'error')
  })
}

export interface PedidoDePresentacion {
  numero: number
  publico: Publico
  nivel: NivelDePresentacion
}

// POST …/versions/{n}/presentations con Idempotency-Key: 202 { presentation }, EN COLA o la existente con la misma versión,
// público, nivel y versión del planificador (una FALLIDO vuelve a la cola)
export function usePedirPresentacion(id: string) {
  return useComando<{ presentation: Presentacion }, PedidoDePresentacion>(
    ({ numero, publico, nivel }) => ({
      ruta: `/sgspe/deliverables/${encodeURIComponent(id)}/versions/${numero}/presentations`,
      json: { audience: publico, level: nivel }
    }),
    { invalidar: () => [['deliverable-presentations', id]] }
  )
}

// POST /presentations/{id}/video sin cuerpo y con Idempotency-Key: pone el MP4 EN COLA; uno pendiente o LISTO vuelve como está
export function usePedirVideo(entregable: string) {
  return useComando<{ presentation: Presentacion }, { presentacion: string }>(
    ({ presentacion }) => ({ ruta: `/sgspe/presentations/${encodeURIComponent(presentacion)}/video` }),
    { invalidar: () => [['deliverable-presentations', entregable]] }
  )
}

export type ArchivoDePresentacion = 'content' | 'spec' | 'video'

// content es el PDF de láminas, spec la especificación del reproductor y video el MP4; cada descarga queda en export_log. en
// EXTERNO y PUBLICO la ruta lleva la lista confirmada (si no, 400 CHECKLIST_REQUIRED)
export const rutaDeLaPresentacion = (id: string, archivo: ArchivoDePresentacion, listaConfirmada: boolean): string =>
  `/sgspe/presentations/${encodeURIComponent(id)}/${archivo}${listaConfirmada ? '?checklistConfirmed=true' : ''}`

// la especificación para el reproductor: cada apertura es una descarga (export_log, formato deck), así que no se guarda en la
// caché al cerrar ni se reintenta sola
export function useEspecificacion(id: string, listaConfirmada: boolean) {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['presentation-spec', id, listaConfirmada],
    queryFn: () => pedir<unknown>(rutaDeLaPresentacion(id, 'spec', listaConfirmada)),
    staleTime: Infinity,
    gcTime: 0,
    retry: false
  })
}
