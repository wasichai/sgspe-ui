import { screen, waitFor } from '@testing-library/react'
import { Editor as EditorDeTiptap, type JSONContent } from '@tiptap/core'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { useState } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararEditorEnJsdom } from '../../test/editor'
import { PERSONA, PERSONA_ID } from '../../test/f8'
import { montar, pagina } from '../../test/montar'
import { conservaElMarkdown, EditorMarkdown, extensionesDelEditor } from './EditorMarkdown'

// el editor de sección (deliverables.md §7.4): tiptap con Markdown y menciones; lo que no sobrevive la ida y vuelta se edita
// como Markdown (decisión 8 del plan) y el editor nunca inyecta estilos (CSP style-src 'self', decisión 9)
let fetch: FetchMock | null = null
beforeAll(prepararEditorEnJsdom)
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const TABLA = '| Comunidad | Familias |\n| --- | --- |\n| Comunidad Ejemplo | 40 |'

function Editor({ inicial, alCambiar }: { inicial: string; alCambiar: (md: string) => void }) {
  const [valor, setValor] = useState(inicial)
  return (
    <EditorMarkdown
      etiqueta="Texto de la sección"
      valor={valor}
      proyecto="p1"
      alCambiar={(md) => {
        setValor(md)
        alCambiar(md)
      }}
    />
  )
}

describe('editor de Markdown', () => {
  it('un Markdown que el editor conserva se abre con formato, con la mención como ficha', async () => {
    const md = `## Antecedentes\n\nTexto con **negrita** y [[person:${PERSONA_ID}]].\n\n- uno\n- dos`
    expect(conservaElMarkdown(md)).toBe(true)
    fetch = mockFetch([])
    montar(<Editor inicial={md} alCambiar={vi.fn()} />)
    const caja = await screen.findByRole('textbox', { name: 'Texto de la sección' })
    expect(caja).toHaveAttribute('contenteditable', 'true')
    expect(caja).toHaveTextContent('@persona 9b8a7c6d')
    expect(screen.getByRole('button', { name: 'Editar como Markdown' })).toBeInTheDocument()
  })

  it('una tabla abre el modo Markdown y se guarda tal cual', async () => {
    expect(conservaElMarkdown(TABLA)).toBe(false)
    const alCambiar = vi.fn()
    fetch = mockFetch([])
    montar(<Editor inicial={TABLA} alCambiar={alCambiar} />)
    expect(
      await screen.findByText('Este texto tiene partes que el editor con formato no conserva (una tabla, por ejemplo): se edita como Markdown.')
    ).toBeInTheDocument()
    const area = screen.getByRole('textbox', { name: 'Texto de la sección' })
    expect(area).toHaveValue(TABLA)
    await userEvent.type(area, '\n\nFuente: censo.')
    expect(alCambiar).toHaveBeenLastCalledWith(`${TABLA}\n\nFuente: censo.`)
    await userEvent.click(screen.getByRole('button', { name: 'Editar con formato' }))
    expect(screen.getByText('Este texto no se puede editar con formato sin perder partes: siga en Markdown.')).toBeInTheDocument()
  })

  it('el selector inserta la mención como token en el Markdown', async () => {
    const alCambiar = vi.fn()
    fetch = mockFetch([{ path: '/objects/person/records', body: pagina([PERSONA]) }])
    montar(<Editor inicial="" alCambiar={alCambiar} />)
    await screen.findByRole('textbox', { name: 'Texto de la sección' })
    await userEvent.type(screen.getByLabelText('Buscar una persona'), 'Pers')
    await userEvent.click(await screen.findByRole('button', { name: 'Persona Ejemplo 1' }))
    await waitFor(() => expect(String(alCambiar.mock.lastCall?.[0])).toContain(`[[person:${PERSONA_ID}]]`))
    expect(screen.getByRole('textbox', { name: 'Texto de la sección' })).toHaveTextContent('@Persona Ejemplo 1')
  })

  it('no inyecta estilos en la página', async () => {
    fetch = mockFetch([])
    montar(<Editor inicial="Texto." alCambiar={vi.fn()} />)
    await screen.findByRole('textbox', { name: 'Texto de la sección' })
    expect(document.querySelector('style[data-tiptap-style]')).toBeNull()
  })
})

// lo pegado no puede fabricar una mención: el nodo solo nace de [[person|position|stakeholder:<uuid>]] validado, y el texto con
// forma de token queda como texto (escapado al guardar)
describe('menciones pegadas', () => {
  const ROTULOS = { person: 'persona', position: 'cargo', stakeholder: 'grupo de interés' }
  const abrir = (md: string) =>
    new EditorDeTiptap({
      element: document.createElement('div'),
      extensions: extensionesDelEditor(ROTULOS),
      content: md,
      contentType: 'markdown',
      injectCSS: false
    })
  const tipos = (nodo: JSONContent): string[] => [nodo.type ?? '', ...(nodo.content ?? []).flatMap(tipos)]
  const alFinal = (editor: EditorDeTiptap) => editor.commands.setTextSelection(editor.state.doc.content.size - 1)
  // jsdom no tiene ClipboardEvent: ProseMirror solo necesita un evento de pegado
  const pegado = () => new Event('paste') as ClipboardEvent

  it('un data-mencion que no es tipo:uuid no crea una mención', () => {
    for (const malo of ['otro:no-uuid', `person:${PERSONA_ID}]] **y**`, 'person:no-uuid', `cargo:${PERSONA_ID}`, `person:${PERSONA_ID}:x`]) {
      const editor = abrir('Hola')
      alFinal(editor)
      editor.view.pasteHTML(`<p>a <span data-mencion="${malo}">@x</span> b</p>`, pegado())
      expect(tipos(editor.getJSON())).not.toContain('mencion')
      expect(editor.getMarkdown()).not.toContain('[[')
      editor.destroy()
    }
  })

  it('un data-mencion válido pegado sí es una mención', () => {
    const editor = abrir('Hola')
    alFinal(editor)
    editor.view.pasteHTML(`<p>a <span data-mencion="person:${PERSONA_ID}">@x</span> b</p>`, pegado())
    expect(tipos(editor.getJSON())).toContain('mencion')
    expect(editor.getMarkdown()).toContain(`[[person:${PERSONA_ID}]]`)
    editor.destroy()
  })

  it('un texto pegado con forma de token queda como texto escapado', () => {
    const editor = abrir('Hola')
    alFinal(editor)
    editor.view.pasteText(` [[person:${PERSONA_ID}]]`, pegado())
    expect(tipos(editor.getJSON())).not.toContain('mencion')
    expect(editor.getMarkdown()).toContain(`\\[\\[person:${PERSONA_ID}\\]\\]`)
    editor.destroy()
  })

  it('el Markdown con un id que no es UUID no crea una mención', () => {
    const editor = abrir('[[person:9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6-]] y [[person:------------------------------------]]')
    expect(tipos(editor.getJSON())).not.toContain('mencion')
    editor.destroy()
  })
})
