import { Node } from '@tiptap/core'
import { mencion, type TipoDeMencion } from './menciones'

// la mención como nodo atómico de tiptap (decisión 8 del plan): se lee del Markdown con su propio tokenizador (marked no conoce
// [[…]]) y se escribe de vuelta como el mismo token. al insertarla lleva su rótulo (el nombre que la cuenta lee, el cargo o el
// código GI-); leída del Markdown, dice su tipo y los ocho primeros caracteres del id (decisión 10). renderHTML devuelve una
// especificación de ProseMirror, nunca HTML en texto
export interface OpcionesDeMencion {
  rotulos: Record<TipoDeMencion, string>
}

const MENCION = /^\[\[(person|position|stakeholder):([0-9a-fA-F-]{36})\]\]/

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
        getAttrs: (elemento) => {
          const [tipo, id] = (elemento as HTMLElement).getAttribute('data-mencion')?.split(':') ?? []
          return tipo && id ? { tipo, id } : false
        }
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

  renderMarkdown: (node) => mencion(node.attrs?.tipo as TipoDeMencion, String(node.attrs?.id ?? ''))
})
