import type { EnlaceDeAviso } from './avisos'
import { atributo, type Registro } from './registros'

// a dónde lleva un registro (ux-architecture.md §6.3): todo registro de un proyecto tiene su ficha bajo ese proyecto. un aviso
// o una tarea solo traen el objeto y el id, así que el portal pasa por /r/:object/:recordId, que lee el registro como quien mira
// (con sus permisos) y salta a su ficha con el contexto del proyecto puesto
export function rutaDeFicha(objeto: string, registro: Registro): string | null {
  const proyecto = atributo<string>(registro, 'project')
  const id = encodeURIComponent(registro.id)
  const enProyecto = (resto: string) => (proyecto ? `/projects/${encodeURIComponent(proyecto)}/${resto}` : null)
  switch (objeto) {
    case 'project':
      return `/projects/${id}/overview`
    case 'commitment':
      return enProyecto(`commitments/${id}`)
    case 'agreement':
      return enProyecto(`agreements/${id}`)
    case 'engagement':
      return enProyecto(`engagements/${id}`)
    case 'stakeholder':
      return enProyecto(`stakeholders/${id}`)
    case 'area_of_influence':
      return enProyecto(`areas/${id}`)
    case 'field_visit':
      return enProyecto(`field-visits/${id}`)
    case 'task':
      return enProyecto(`tasks?task=${id}`)
    case 'evidence':
      // una evidencia del tenant (sin proyecto) tiene su ficha en la biblioteca global
      return proyecto ? `/projects/${encodeURIComponent(proyecto)}/documents/${id}` : `/documents/${id}`
    default:
      return null
  }
}

export const rutaParaAbrir = (objeto: string, id: string): string => `/r/${encodeURIComponent(objeto)}/${encodeURIComponent(id)}`

// una ruta del mismo origen: empieza por una sola '/'. un navegador trata la barra invertida como '/' y descarta
// tabuladores y saltos de línea, así que «/\otro.example» o «/<tab>/otro.example» llevarían a otro sitio: una barra
// invertida o un carácter de control la descartan
const CONTROL_O_BARRA_INVERTIDA = /[\u0000-\u001f\u007f\\]/
const esRutaPropia = (url: string) => url.startsWith('/') && !url.startsWith('//') && !CONTROL_O_BARRA_INVERTIDA.test(url)

// el destino de un aviso: un RECORD pasa por /r/…; una URL del mismo origen se abre tal cual; una ROUTE es una clave de rutas de
// wasichai-ui que el portal no tiene (SGSPE no publica avisos con ROUTE), así que no lleva a ninguna parte
export function destinoDeAviso(enlace: EnlaceDeAviso | null | undefined): string | null {
  if (!enlace) return null
  if (enlace.type === 'RECORD' && enlace.object && enlace.recordId) return rutaParaAbrir(enlace.object, enlace.recordId)
  if (enlace.type === 'URL' && enlace.url && esRutaPropia(enlace.url)) return enlace.url
  return null
}
