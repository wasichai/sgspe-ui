// ProseMirror pide medidas de la selección que jsdom no implementa (getClientRects, getBoundingClientRect y elementFromPoint):
// se devuelven vacías. la edición real se prueba en el navegador (e2e/f8.spec.ts)
export function prepararEditorEnJsdom(): void {
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  document.elementFromPoint = () => null
}
