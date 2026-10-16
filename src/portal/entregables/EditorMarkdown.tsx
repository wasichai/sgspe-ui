import { Editor } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Alert, Button } from '@wasichai/ui'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import { mencion, normalizarMarkdown, type TipoDeMencion } from './menciones'
import { NodoMencion } from './nodoMencion'
import { SelectorDeMenciones } from './SelectorDeMenciones'

// el editor de una sección (deliverables.md §7.4, decisión 8 del plan): tiptap con su extensión oficial de Markdown, los títulos
// 1 a 3, negrita, cursiva, listas y cita, y el nodo de mención; sin subrayado, enlaces, código ni tachado, que el Markdown de un
// entregable no usa. el valor es siempre Markdown. si el texto no sobrevive la ida y vuelta del editor (una tabla, HTML, otra
// numeración), se edita como Markdown en un área de texto, y lo mismo si la persona lo pide. injectCSS: false: la CSP de
// producción (style-src 'self') bloquearía el <style> de tiptap; su CSS va en src/index.css (decisión 9)
const ROTULOS_NEUTROS: Record<TipoDeMencion, string> = { person: 'persona', position: 'cargo', stakeholder: 'grupo de interés' }

export const extensionesDelEditor = (rotulos: Record<TipoDeMencion, string>) => [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, code: false, codeBlock: false, strike: false, underline: false, link: false, trailingNode: false }),
  Markdown,
  NodoMencion.configure({ rotulos })
]

// si el Markdown sale igual (salvo la forma, normalizarMarkdown) después de pasar por el editor
export function conservaElMarkdown(markdown: string): boolean {
  const editor = new Editor({ element: null, extensions: extensionesDelEditor(ROTULOS_NEUTROS), content: markdown, contentType: 'markdown', injectCSS: false })
  try {
    return normalizarMarkdown(editor.getMarkdown()) === normalizarMarkdown(markdown)
  } finally {
    editor.destroy()
  }
}

export function EditorMarkdown({
  etiqueta,
  valor,
  alCambiar,
  proyecto
}: {
  etiqueta: string
  valor: string
  alCambiar: (markdown: string) => void
  proyecto: string
}) {
  const { t } = useTranslation(NS)
  const [conservaAlAbrir] = useState(() => conservaElMarkdown(valor))
  const [modo, setModo] = useState<'formato' | 'markdown'>(conservaAlAbrir ? 'formato' : 'markdown')
  const [noVuelve, setNoVuelve] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const alCambiarActual = useRef(alCambiar)
  alCambiarActual.current = alCambiar
  const rotulos: Record<TipoDeMencion, string> = {
    person: t('entregables.menciones.tipos.person'),
    position: t('entregables.menciones.tipos.position'),
    stakeholder: t('entregables.menciones.tipos.stakeholder')
  }
  // en modo formato el editor toma solo el valor inicial: quien cambia el texto desde fuera lo remonta con otra key
  const editor = useEditor({
    extensions: extensionesDelEditor(rotulos),
    content: valor,
    contentType: 'markdown',
    injectCSS: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': etiqueta,
        'aria-multiline': 'true',
        class: 'ProseMirror min-h-40 rounded-sg-md border border-sg-border-strong bg-sg-surface p-3 text-sm'
      }
    },
    onUpdate: ({ editor: e }) => alCambiarActual.current(e.getMarkdown())
  })
  const aMarkdown = () => {
    setNoVuelve(false)
    setModo('markdown')
  }
  const aFormato = () => {
    if (!conservaElMarkdown(valor)) {
      setNoVuelve(true)
      return
    }
    editor?.commands.setContent(valor, { contentType: 'markdown', emitUpdate: false })
    setNoVuelve(false)
    setModo('formato')
  }
  const insertar = (tipo: TipoDeMencion, id: string, etiquetaDeMencion: string) => {
    if (modo === 'formato') {
      editor
        ?.chain()
        .insertContent({ type: 'mencion', attrs: { tipo, id, etiqueta: etiquetaDeMencion } })
        .run()
      return
    }
    const inicio = area.current?.selectionStart ?? valor.length
    const fin = area.current?.selectionEnd ?? inicio
    alCambiar(`${valor.slice(0, inicio)}${mencion(tipo, id)}${valor.slice(fin)}`)
  }
  return (
    <div className="space-y-2">
      <div role="toolbar" aria-label={t('entregables.editor.herramientas')} className="flex flex-wrap items-center gap-2">
        {modo === 'formato' ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => editor?.chain().toggleBold().run()}>
              {t('entregables.editor.negrita')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => editor?.chain().toggleItalic().run()}>
              {t('entregables.editor.cursiva')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => editor?.chain().toggleHeading({ level: 2 }).run()}>
              {t('entregables.editor.titulo')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => editor?.chain().toggleBulletList().run()}>
              {t('entregables.editor.lista')}
            </Button>
            <Button size="sm" variant="secondary" onClick={aMarkdown}>
              {t('entregables.editor.modoMarkdown')}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={aFormato}>
            {t('entregables.editor.modoFormato')}
          </Button>
        )}
      </div>
      {!conservaAlAbrir && modo === 'markdown' ? <Alert tone="notice">{t('entregables.editor.soloMarkdown')}</Alert> : null}
      {noVuelve ? <Alert tone="warning">{t('entregables.editor.noVuelve')}</Alert> : null}
      {modo === 'formato' ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          ref={area}
          aria-label={etiqueta}
          className="min-h-40 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface p-3 font-sg-mono text-sm"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
        />
      )}
      <SelectorDeMenciones proyecto={proyecto} alElegir={insertar} />
    </div>
  )
}
