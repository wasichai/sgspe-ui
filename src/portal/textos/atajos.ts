// la hoja de atajos de teclado (tercera pasada de UX, 4.7): se abre con «?» o desde el menú de la cuenta
export const ES_ATAJOS = {
  titulo: 'Atajos de teclado',
  descripcion: 'Funcionan en cualquier pantalla, salvo mientras se escribe en un campo.',
  abrir: 'Atajos de teclado',
  tabla: 'Atajos',
  columnas: { tecla: 'Tecla', hace: 'Qué hace' },
  // la tecla de la búsqueda depende del teclado: ⌘ en Mac, Ctrl en los demás
  buscarMac: '⌘ K',
  buscarOtros: 'Ctrl K',
  teclas: {
    buscar: 'Buscar en el portal',
    hoja: 'Abrir esta hoja',
    saltar: 'Al entrar a una página, el primer Tab ofrece «Saltar al contenido»',
    abrirFila: 'En una fila de una lista, abrir su ficha',
    previa: 'En una fila de una lista, ver su vista previa',
    siguiente: 'En una ficha abierta desde una lista, ir a la siguiente',
    anterior: 'En una ficha abierta desde una lista, ir a la anterior',
    cerrar: 'Cerrar un cajón, un diálogo o un menú'
  },
  nombresDeTecla: { hoja: '?', saltar: 'Tab', abrirFila: 'Enter', previa: 'Espacio', siguiente: 'J', anterior: 'K', cerrar: 'Esc' },
  listo: 'Listo'
}

export const EN_ATAJOS: typeof ES_ATAJOS = {
  titulo: 'Keyboard shortcuts',
  descripcion: 'They work on any screen, except while typing in a field.',
  abrir: 'Keyboard shortcuts',
  tabla: 'Shortcuts',
  columnas: { tecla: 'Key', hace: 'What it does' },
  buscarMac: '⌘ K',
  buscarOtros: 'Ctrl K',
  teclas: {
    buscar: 'Search the portal',
    hoja: 'Open this sheet',
    saltar: 'On entering a page, the first Tab offers “Skip to content”',
    abrirFila: 'On a list row, open its record',
    previa: 'On a list row, see its preview',
    siguiente: 'On a record opened from a list, go to the next one',
    anterior: 'On a record opened from a list, go to the previous one',
    cerrar: 'Close a drawer, a dialog or a menu'
  },
  nombresDeTecla: { hoja: '?', saltar: 'Tab', abrirFila: 'Enter', previa: 'Space', siguiente: 'J', anterior: 'K', cerrar: 'Esc' },
  listo: 'Done'
}
