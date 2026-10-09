import { esQcs, RUTA_DE_QCS } from './atencion'
import type { EnlaceDeAviso } from './avisos'
import { atributo, type Registro } from './registros'

// a dónde lleva un registro (ux-architecture.md §6.3): todo registro de un proyecto tiene su ficha bajo ese proyecto. un aviso
// o una tarea solo traen el objeto y el id, así que el portal pasa por /r/:object/:recordId, que lee el registro como quien mira
// (con sus permisos) y salta a su ficha con el contexto del proyecto puesto. desde F4, las QCS (S36 y S57), los riesgos (S40), las
// alertas (S41), los incidentes y las menciones y señales (S58 y S59); un impacto o una regla llevan a su lista (S61 y S60). una
// medida o una revisión no traen proyecto: se ven en la ficha de su riesgo y no tienen ruta propia
export function rutaDeFicha(objeto: string, registro: Registro): string | null {
  const proyecto = atributo<string>(registro, 'project')
  const id = encodeURIComponent(registro.id)
  const enProyecto = (resto: string) => (proyecto ? `/projects/${encodeURIComponent(proyecto)}/${resto}` : null)
  if (esQcs(objeto)) return enProyecto(`${RUTA_DE_QCS[objeto]}/${id}`)
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
    case 'social_risk':
      return enProyecto(`risks/${id}`)
    case 'early_warning':
      return enProyecto(`risks/warnings/${id}`)
    case 'incident':
      return enProyecto(`incidents/${id}`)
    case 'media_mention':
      return enProyecto(`risks/mentions/${id}`)
    case 'early_warning_signal':
      return enProyecto(`risks/signals/${id}`)
    case 'potential_impact':
      return enProyecto('risks/impacts')
    case 'early_warning_rule':
      // una regla del tenant (sin proyecto) vive en la lista global de reglas
      return proyecto ? `/projects/${encodeURIComponent(proyecto)}/risks/rules` : '/risks/rules'
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
