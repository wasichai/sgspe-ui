import { Node } from '@tiptap/core'
import { leerMencion, mencion, UUID_ESTRICTO, type TipoDeMencion } from './menciones'

// la mención como nodo atómico de tiptap (decisión 8 del plan): se lee del Markdown con su propio tokenizador (marked no conoce
// [[…]]) y se escribe de vuelta como el mismo token. al insertarla lleva su rótulo (el nombre que la cuenta lee, el cargo o el
// código GI-); leída del Markdown, dice su tipo y los ocho primeros caracteres del id (decisión 10). renderHTML devuelve una
// especificación de ProseMirror, nunca HTML en texto
export interface OpcionesDeMencion {
  rotulos: Record<TipoDeMencion, string>
}

const MENCION = new RegExp(`^\\[\\[(person|position|stakeholder):(${UUID_ESTRICTO})\\]\\]`)

export const NodoMencion = Node.create<OpcionesDeMencion>({
  name: 'mencion',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { rotulos: { person: 'persona', position: 'cargo', stakeholder: 'grupo de interés' } }
  },

  addAttributes() {
    return {
      tipo: { default: 'person' },
      id: { default: '' },
      etiqueta: { default: null, rendered: false }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mencion]',
        // un data-mencion pegado de otra página solo vale si es tipo:uuid (leerMencion); si no, no es mención
        getAttrs: (elemento) => leerMencion((elemento as HTMLElement).getAttribute('data-mencion') ?? '') ?? false
      }
    ]
  },

  renderHTML({ node }) {
    const tipo = node.attrs.tipo as TipoDeMencion
    const id = String(node.attrs.id)
    const etiqueta = (node.attrs.etiqueta as string | null) ?? `${this.options.rotulos[tipo]} ${id.slice(0, 8)}`
    return ['span', { 'data-mencion': `${tipo}:${id}`, class: 'rounded-sg-md bg-sg-primary-soft px-1 text-sg-primary-text' }, `@${etiqueta}`]
  },

  renderText({ node }) {
    return mencion(node.attrs.tipo as TipoDeMencion, String(node.attrs.id))
  },

  markdownTokenizer: {
    name: 'mencion',
    level: 'inline',
    start: (src: string) => src.indexOf('[['),
    tokenize: (src: string) => {
      const m = MENCION.exec(src)
      return m ? { type: 'mencion', raw: m[0], tipo: m[1], id: m[2] } : undefined
    }
  },

  parseMarkdown: (token, helpers) => helpers.createNode('mencion', { tipo: token.tipo, id: token.id }),

  // un nodo con atributos fuera de la forma no escribe nada: el Markdown solo lleva tokens válidos
  renderMarkdown: (node) => {
    const valida = leerMencion(`${String(node.attrs?.tipo)}:${String(node.attrs?.id)}`)
    return valida ? mencion(valida.tipo, valida.id) : ''
  }
})
