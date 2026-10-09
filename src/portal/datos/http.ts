import { ApiError, useApiClient, useAuth, type ApiClient, type FieldViolation } from '@wasichai/core'
import { useMemo } from 'react'

// el cliente HTTP del portal para todo lo que el ApiClient de core no hace: cabeceras de escritura de SGSPE (If-Match,
// X-Change-Reason, Idempotency-Key; api.md §3.5 a §3.7), multipart, descargas de archivos y el X-Correlation-Id de los
// errores (§3.8). usa el mismo token (sgspe.token) y, ante un 401, cierra la sesión de core como lo haría su cliente

// un error de la API con lo que la interfaz muestra: el detail en el idioma del dominio, los campos de errors[] y el
// identificador de correlación que la persona puede citar al pedir ayuda (design-system.md §6.5)
export class ErrorDeSgspe extends ApiError {
  constructor(
    status: number,
    message: string,
    violations: FieldViolation[],
    readonly correlationId: string | null
  ) {
    super(status, message, violations)
  }
}

// una guarda o un comando de SGSPE rechaza con su código en errors[0].message y el campo en errors[0].field (api.md §3.3,
// ruling P15); el texto en español va en detail. el message de un error de wasichai (permiso, tipo, obligatorio) es texto
// libre: solo cuenta como código lo que está en inglés UPPER_SNAKE
export const esCodigo = (texto: string | null | undefined): texto is string => typeof texto === 'string' && /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(texto)

export function codigoDelError(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  const mensaje = error.violations[0]?.message
  return esCodigo(mensaje) ? mensaje : null
}

// el campo del error con código: un campo del registro, un objeto (engagement_question), `record`, `reason`, `state` o la
// ruta de un comando (`filters.project`, `attributes.code`, `file`, `multipart`); en HAS_DEPENDENTS, `<objeto>.<campo>`
export const campoDelError = (error: unknown): string | null => (codigoDelError(error) ? ((error as ApiError).violations[0]?.field ?? null) : null)

export interface OpcionesDePedido {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  // cuerpo JSON
  json?: unknown
  // cuerpo multipart (importaciones)
  formulario?: FormData
  // el updatedAt que se leyó: va en If-Match entre comillas (§3.6)
  version?: string | null
  // el motivo del cambio (§3.7)
  motivo?: string | null
  // la clave de idempotencia de la acción (§3.5): se repite en cada reintento de la misma acción
  clave?: string | null
  aceptar?: string
}

export interface Archivo {
  blob: Blob
  nombre: string | null
}

// RFC 8187: el motivo viaja siempre como UTF-8'' más el texto codificado, así un acento o un % significan lo que dicen
export const motivoEnCabecera = (motivo: string): string => `UTF-8''${encodeURIComponent(motivo.trim())}`

// el reporte o la exportación se pide como XLSX o problem+json: sin el segundo, un error llega con su estado y el cuerpo
// vacío (api.md §3.3 y §4.2)
export const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const ACEPTAR_REPORTE = `${XLSX}, application/problem+json`

// una clave por acción del usuario, de 1 a 64 caracteres (§3.5)
export const nuevaClave = (): string => crypto.randomUUID()

// el nombre del archivo de Content-Disposition: filename*=UTF-8''… gana sobre filename="…"
export function nombreDeArchivo(disposicion: string | null): string | null {
  if (!disposicion) return null
  const extendido = /filename\*=UTF-8''([^;]+)/i.exec(disposicion)
  if (extendido) {
    // un filename* mal codificado no rompe la descarga: vale el filename simple, si lo hay
    try {
      return decodeURIComponent(extendido[1].trim())
    } catch {
      // URIError: sigue con el filename simple
    }
  }
  return /filename="?([^";]+)"?/i.exec(disposicion)?.[1] ?? null
}

function cabeceras(cliente: ApiClient, opciones: OpcionesDePedido): Headers {
  const h = new Headers()
  const token = cliente.getToken()
  if (token) h.set('Authorization', `Bearer ${token}`)
  if (opciones.json !== undefined) h.set('Content-Type', 'application/json')
  if (opciones.version) h.set('If-Match', `"${opciones.version}"`)
  if (opciones.motivo?.trim()) h.set('X-Change-Reason', motivoEnCabecera(opciones.motivo))
  if (opciones.clave) h.set('Idempotency-Key', opciones.clave)
  if (opciones.aceptar) h.set('Accept', opciones.aceptar)
  return h
}

async function fallo(respuesta: Response): Promise<ErrorDeSgspe> {
  const texto = await respuesta.text()
  let cuerpo: { detail?: string; title?: string; errors?: FieldViolation[] } | null = null
  try {
    cuerpo = texto ? JSON.parse(texto) : null
  } catch {
    cuerpo = null
  }
  return new ErrorDeSgspe(
    respuesta.status,
    cuerpo?.detail ?? cuerpo?.title ?? respuesta.statusText,
    cuerpo?.errors ?? [],
    respuesta.headers.get('X-Correlation-Id')
  )
}

export interface Pedido {
  <T>(ruta: string, opciones?: OpcionesDePedido): Promise<T>
  archivo: (ruta: string, opciones?: OpcionesDePedido) => Promise<Archivo>
}

// las rutas son relativas a /api, como en el cliente de core: '/objects/project/records'
export function crearPedido(cliente: ApiClient, alNoAutorizado: () => void): Pedido {
  async function enviar(ruta: string, opciones: OpcionesDePedido): Promise<Response> {
    const respuesta = await fetch(`${cliente.baseUrl}${ruta}`, {
      method: opciones.metodo ?? (opciones.json !== undefined || opciones.formulario ? 'POST' : 'GET'),
      headers: cabeceras(cliente, opciones),
      body: opciones.formulario ?? (opciones.json !== undefined ? JSON.stringify(opciones.json) : undefined)
    })
    if (respuesta.ok) return respuesta
    if (respuesta.status === 401) {
      cliente.setToken(null)
      alNoAutorizado()
    }
    throw await fallo(respuesta)
  }
  const pedir = (async <T>(ruta: string, opciones: OpcionesDePedido = {}): Promise<T> => {
    const respuesta = await enviar(ruta, opciones)
    if (respuesta.status === 204) return undefined as T
    const texto = await respuesta.text()
    return (texto ? JSON.parse(texto) : null) as T
  }) as Pedido
  pedir.archivo = async (ruta, opciones = {}) => {
    const respuesta = await enviar(ruta, opciones)
    return { blob: await respuesta.blob(), nombre: nombreDeArchivo(respuesta.headers.get('Content-Disposition')) }
  }
  return pedir
}

// el pedido de la sesión abierta: un 401 cierra la sesión de core y RequireSession lleva al login
export function usePedir(): Pedido {
  const cliente = useApiClient()
  const { signOut } = useAuth()
  return useMemo(() => crearPedido(cliente, signOut), [cliente, signOut])
}

// guarda un archivo descargado con su nombre (las exportaciones y el reporte de diferencias)
// el enlace va al documento durante el clic (Firefox no descarga desde un enlace suelto) y la URL se revoca después, no en el
// mismo tick: Firefox y Safari pueden cortar una descarga cuya URL ya no existe
export function guardarArchivo({ blob, nombre }: Archivo, porDefecto: string): void {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre ?? porDefecto
  enlace.hidden = true
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
