// un espía sobre el fetch que dejó mockFetch de @wasichai/testing: guarda cada llamada con sus cabeceras y su cuerpo
// (JSON o multipart) y contesta las rutas especiales que mockFetch no sabe hacer (archivos, cabeceras, errores con
// X-Correlation-Id). se instala después de mockFetch y se restaura antes que él
export interface Llamada {
  metodo: string
  ruta: string
  cabeceras: Headers
  cuerpo: unknown
  formulario: FormData | null
}

export interface RutaEspecial {
  method?: string
  path: string | RegExp
  responder: (llamada: Llamada) => Response | Promise<Response>
}

export interface Red {
  llamadas: Llamada[]
  restaurar: () => void
  // las llamadas a una ruta (sin la consulta) con un método
  a: (metodo: string, ruta: string | RegExp) => Llamada[]
}

export function espiarRed(especiales: RutaEspecial[] = [], base = '/api'): Red {
  const siguiente = globalThis.fetch
  const llamadas: Llamada[] = []
  globalThis.fetch = async (entrada, opciones = {}) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.toString() : entrada.url
    const ruta = url.startsWith(base) ? url.slice(base.length) : url
    const cuerpo = opciones.body
    const llamada: Llamada = {
      metodo: (opciones.method ?? 'GET').toUpperCase(),
      ruta,
      cabeceras: new Headers(opciones.headers),
      cuerpo: typeof cuerpo === 'string' && cuerpo ? JSON.parse(cuerpo) : null,
      formulario: cuerpo instanceof FormData ? cuerpo : null
    }
    llamadas.push(llamada)
    const especial = especiales.find(
      (e) => (e.method ?? 'GET').toUpperCase() === llamada.metodo && (typeof e.path === 'string' ? e.path === ruta.split('?')[0] : e.path.test(ruta))
    )
    return especial ? especial.responder(llamada) : siguiente(entrada, opciones)
  }
  const coincide = (ruta: string, patron: string | RegExp) => (typeof patron === 'string' ? ruta.split('?')[0] === patron : patron.test(ruta))
  return {
    llamadas,
    restaurar: () => {
      globalThis.fetch = siguiente
    },
    a: (metodo, patron) => llamadas.filter((l) => l.metodo === metodo && coincide(l.ruta, patron))
  }
}

// una respuesta de error con el problem+json de wasichai y su identificador de correlación
export const problema = (status: number, detail: string, errors: { field: string; message: string }[] = [], correlacion = 'corr-123') =>
  new Response(JSON.stringify({ title: 'Error', status, detail, errors }), {
    status,
    headers: { 'Content-Type': 'application/problem+json', 'X-Correlation-Id': correlacion }
  })

// un archivo XLSX con su nombre en Content-Disposition
export const archivoXlsx = (nombre: string) =>
  new Response('PK', {
    status: 200,
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${nombre}"` }
  })
