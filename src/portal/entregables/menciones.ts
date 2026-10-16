import { quedanMarcadores } from '../ia/marcadores'

// las menciones de la narrativa de un entregable (spec §2.2.9, deliverables.md §7.4): un token Markdown que apunta a un registro,
// nunca el nombre escrito, para que EXTERNO lo resuelva al cargo o al código GI-. el id es un UUID (Mentions.TOKEN del backend)
export type TipoDeMencion = 'person' | 'position' | 'stakeholder'
export const TIPOS_DE_MENCION: readonly TipoDeMencion[] = ['person', 'position', 'stakeholder']

const UUID = '[0-9a-fA-F-]{36}'
const TOKEN = new RegExp(`\\[\\[(person|position|stakeholder):(${UUID})\\]\\]`, 'g')

export const mencion = (tipo: TipoDeMencion, id: string): string => `[[${tipo}:${id}]]`

// lo que puede volverse un nodo de mención en el editor (lo pegado como HTML o leído del Markdown): un tipo de la lista y un UUID
// con sus guiones en su sitio. cualquier otra cosa no es mención y queda como texto
export const UUID_ESTRICTO = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const VALOR_DE_MENCION = new RegExp(`^(person|position|stakeholder):(${UUID_ESTRICTO})$`)
export function leerMencion(valor: string): { tipo: TipoDeMencion; id: string } | null {
  const m = VALOR_DE_MENCION.exec(valor)
  return m ? { tipo: m[1] as TipoDeMencion, id: m[2] } : null
}

export type Trozo = { tipo: 'texto'; texto: string } | { tipo: 'mencion'; clase: TipoDeMencion; id: string }

export function partirMenciones(texto: string): Trozo[] {
  const trozos: Trozo[] = []
  let desde = 0
  for (const m of texto.matchAll(TOKEN)) {
    const inicio = m.index ?? 0
    if (inicio > desde) trozos.push({ tipo: 'texto', texto: texto.slice(desde, inicio) })
    trozos.push({ tipo: 'mencion', clase: m[1] as TipoDeMencion, id: m[2] })
    desde = inicio + m[0].length
  }
  if (desde < texto.length) trozos.push({ tipo: 'texto', texto: texto.slice(desde) })
  return trozos
}

// el patrón de DeliverableSections.adopt: una persona identificada por la IA, también entre «», pasa a su mención; cualquier otro
// marcador queda y la sugerencia no se puede usar hasta que la persona lo reemplace (decisión 11 del plan)
const PERSONA_ESTABLE = new RegExp(`«\\[PERSONA:(${UUID})\\]»|\\[PERSONA:(${UUID})\\]`, 'g')
export const deSugerencia = (texto: string): string =>
  texto.replace(PERSONA_ESTABLE, (_m, entreComillas: string | undefined, sola: string | undefined) => mencion('person', entreComillas ?? sola ?? ''))

export const listaParaUsar = (texto: string): boolean => !quedanMarcadores(texto)

// la forma del Markdown que no cambia su sentido: los finales de línea, los espacios al final y las líneas en blanco de más
export const normalizarMarkdown = (texto: string): string =>
  texto
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((linea) => linea.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
