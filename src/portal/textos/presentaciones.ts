// las presentaciones de un entregable emitido (deliverables.md §16, ADR-0031): pedir por público y nivel, ver el estado, bajar el
// PDF de láminas y el MP4, presentar en el navegador y la lista de verificación de los niveles que salen de la organización
export const ES_PRESENTACIONES = {
  enlace: 'Presentaciones',
  pagina: {
    titulo: 'Presentaciones',
    volver: 'Volver al entregable',
    ayuda:
      'Las láminas de una versión emitida, contadas para un público y con un nivel de divulgación. No cambian los hechos del informe, no se aprueban y no son una emisión.',
    sinConexion:
      'Donde puede no haber internet, presente con el PDF: la presentación en el navegador necesita conexión para cargar. Baje el PDF antes de salir.',
    sinVersiones: 'Las presentaciones salen de una versión emitida, y este entregable todavía no tiene ninguna.'
  },
  pedir: {
    titulo: 'Pedir una presentación',
    ayuda: 'Se compone en segundo plano y aparece en la lista cuando está lista. Pedir la misma combinación otra vez devuelve la que ya existe.',
    version: 'Versión emitida',
    versionOpcion: 'Versión {{numero}} · revisión {{revision}} · {{nivel}}',
    publico: 'Público',
    nivel: 'Nivel de divulgación',
    sinNiveles: 'Este público no admite el nivel de esta versión, o no tiene permiso para bajar sus niveles.',
    boton: 'Pedir la presentación',
    pidiendo: 'Pidiendo…',
    hecho: 'Presentación pedida: se está componiendo.',
    sinPermiso: 'Pedir presentaciones de este entregable no está entre sus permisos.'
  },
  publicos: {
    DIRECCION: { nombre: 'Dirección', ayuda: 'Para decidir: una idea por lámina, cifras grandes, riesgos y próximos pasos.' },
    CAMPO: { nombre: 'Equipo de campo', ayuda: 'Para ver qué pasa en cada localidad: territorio, cronología, percepciones y pendientes.' },
    INVESTIGACION: { nombre: 'Investigación', ayuda: 'Para evaluar el rigor: método, indicadores con su número de casos, limitaciones y fuentes.' },
    INSTITUCIONES: { nombre: 'Instituciones', ayuda: 'Para coordinar: alcance, resultados, compromisos y asuntos que piden coordinación.' },
    COMUNIDAD: { nombre: 'Comunidad', ayuda: 'Para entender y preguntar: frases cortas, términos explicados y solo datos públicos.' }
  },
  lista: {
    titulo: 'Presentaciones pedidas',
    vacio: 'Todavía no se pidió ninguna presentación.',
    consultando: 'Hay presentaciones en preparación: la lista se actualiza sola.',
    sinActualizar: 'No se pudo actualizar la lista.',
    columnas: {
      version: 'Versión',
      publico: 'Público',
      nivel: 'Nivel',
      estado: 'Estado',
      laminas: 'Láminas',
      pedida: 'Pedida el',
      acciones: 'Acciones'
    }
  },
  acciones: {
    presentar: 'Presentar',
    bajarPdf: 'Bajar el PDF',
    pedirVideo: 'Pedir el MP4',
    bajarVideo: 'Bajar el MP4',
    otraVez: 'Pedir otra vez',
    sinDescarga: 'Sin permiso para bajarla'
  },
  video: {
    enCola: 'MP4 en cola',
    enProceso: 'Componiendo el MP4…',
    fallido: 'El MP4 no se pudo componer: {{motivo}}'
  },
  fallas: {
    SLIDES_UNAVAILABLE: 'el servicio de láminas no respondió; pídala otra vez más tarde.',
    SLIDE_OVERFLOW: 'un texto no cabe en su lámina.',
    SLIDE_OVERLAP: 'dos partes de una lámina se superponen.',
    TEXT_TOO_SMALL: 'un texto quedaría más chico que el mínimo legible.',
    SLIDE_EMPTY: 'una lámina quedaría vacía.',
    FONT_MISSING: 'faltó una tipografía al componer.',
    ASSET_INVALID: 'una imagen no se pudo usar.',
    DECK_CHECK_FAILED: 'el archivo no pasó la verificación final.',
    MODEL_MISMATCH: 'el informe guardado no coincide con su huella.',
    SPEC_MISMATCH: 'las láminas guardadas no coinciden con su huella.',
    FILE_TOO_LARGE: 'el archivo supera el tamaño permitido.',
    TIMEOUT: 'tardó más de lo permitido.',
    RENDER_FAILED: 'la composición se interrumpió.',
    GENERATION_FAILED: 'ocurrió un error inesperado.',
    otro: 'ocurrió un error inesperado.'
  },
  fallo: 'No se pudo componer: {{motivo}}',
  verificacion: {
    titulo: 'Lista de verificación para el nivel «{{nivel}}»',
    ayuda: 'Confirme cada punto antes de ver o bajar esta presentación. La confirmación queda en el registro de descargas.',
    laminas: 'Las láminas no tienen nombres tecleados ni datos de contacto.',
    fotos: 'Las fotos tienen consentimiento o no muestran personas identificables.',
    mapas: 'Los mapas no muestran titulares ni ubicaciones de viviendas.',
    confirmar: 'Confirmar y seguir'
  },
  presentador: {
    titulo: '{{codigo}} · {{publico}} · {{nivel}}',
    lamina: 'Lámina {{n}} de {{total}}',
    anterior: 'Lámina anterior',
    siguiente: 'Lámina siguiente',
    pantallaCompleta: 'Pantalla completa',
    cerrar: 'Cerrar la presentación',
    cargando: 'Cargando la presentación…',
    teclado: 'Flechas, espacio o Av Pág para avanzar; Esc para salir.',
    noAdmitida: 'Esta presentación no se puede mostrar en el navegador con esta versión del portal. Use el PDF, que es la referencia.',
    fallo: 'No se pudo cargar el reproductor. Use el PDF.'
  }
}

export const EN_PRESENTACIONES: typeof ES_PRESENTACIONES = {
  enlace: 'Presentations',
  pagina: {
    titulo: 'Presentations',
    volver: 'Back to the deliverable',
    ayuda:
      'The slides of an issued version, told for an audience and at a disclosure level. They do not change the facts of the report, are not approved and are not an issue.',
    sinConexion:
      'Where there may be no internet, present with the PDF: the presentation in the browser needs a connection to load. Download the PDF before leaving.',
    sinVersiones: 'Presentations come from an issued version, and this deliverable has none yet.'
  },
  pedir: {
    titulo: 'Request a presentation',
    ayuda: 'It is composed in the background and shows up in the list when ready. Requesting the same combination again returns the existing one.',
    version: 'Issued version',
    versionOpcion: 'Version {{numero}} · revision {{revision}} · {{nivel}}',
    publico: 'Audience',
    nivel: 'Disclosure level',
    sinNiveles: 'This audience does not accept the level of this version, or you are not allowed to download its levels.',
    boton: 'Request the presentation',
    pidiendo: 'Requesting…',
    hecho: 'Presentation requested: it is being composed.',
    sinPermiso: 'Requesting presentations of this deliverable is not among your permissions.'
  },
  publicos: {
    DIRECCION: { nombre: 'Management', ayuda: 'To decide: one idea per slide, large figures, risks and next steps.' },
    CAMPO: { nombre: 'Field team', ayuda: 'To see what happens in each locality: territory, timeline, perceptions and pending items.' },
    INVESTIGACION: { nombre: 'Research', ayuda: 'To assess rigor: method, indicators with their number of cases, limitations and sources.' },
    INSTITUCIONES: { nombre: 'Institutions', ayuda: 'To coordinate: scope, results, commitments and matters that need coordination.' },
    COMUNIDAD: { nombre: 'Community', ayuda: 'To understand and ask: short sentences, explained terms and public data only.' }
  },
  lista: {
    titulo: 'Requested presentations',
    vacio: 'No presentation has been requested yet.',
    consultando: 'Some presentations are being prepared: the list updates by itself.',
    sinActualizar: 'The list could not be updated.',
    columnas: {
      version: 'Version',
      publico: 'Audience',
      nivel: 'Level',
      estado: 'Status',
      laminas: 'Slides',
      pedida: 'Requested on',
      acciones: 'Actions'
    }
  },
  acciones: {
    presentar: 'Present',
    bajarPdf: 'Download the PDF',
    pedirVideo: 'Request the MP4',
    bajarVideo: 'Download the MP4',
    otraVez: 'Request again',
    sinDescarga: 'Not allowed to download it'
  },
  video: {
    enCola: 'MP4 queued',
    enProceso: 'Composing the MP4…',
    fallido: 'The MP4 could not be composed: {{motivo}}'
  },
  fallas: {
    SLIDES_UNAVAILABLE: 'the slide service did not answer; request it again later.',
    SLIDE_OVERFLOW: 'a text does not fit in its slide.',
    SLIDE_OVERLAP: 'two parts of a slide overlap.',
    TEXT_TOO_SMALL: 'a text would be smaller than the legible minimum.',
    SLIDE_EMPTY: 'a slide would be empty.',
    FONT_MISSING: 'a typeface was missing while composing.',
    ASSET_INVALID: 'an image could not be used.',
    DECK_CHECK_FAILED: 'the file did not pass the final check.',
    MODEL_MISMATCH: 'the stored report does not match its fingerprint.',
    SPEC_MISMATCH: 'the stored slides do not match their fingerprint.',
    FILE_TOO_LARGE: 'the file is larger than allowed.',
    TIMEOUT: 'it took longer than allowed.',
    RENDER_FAILED: 'the composition was interrupted.',
    GENERATION_FAILED: 'an unexpected error happened.',
    otro: 'an unexpected error happened.'
  },
  fallo: 'It could not be composed: {{motivo}}',
  verificacion: {
    titulo: 'Checklist for the «{{nivel}}» level',
    ayuda: 'Confirm each item before viewing or downloading this presentation. The confirmation is kept in the download log.',
    laminas: 'The slides have no typed names or contact details.',
    fotos: 'The photos have consent or show no identifiable people.',
    mapas: 'The maps show no holders or home locations.',
    confirmar: 'Confirm and continue'
  },
  presentador: {
    titulo: '{{codigo}} · {{publico}} · {{nivel}}',
    lamina: 'Slide {{n}} of {{total}}',
    anterior: 'Previous slide',
    siguiente: 'Next slide',
    pantallaCompleta: 'Full screen',
    cerrar: 'Close the presentation',
    cargando: 'Loading the presentation…',
    teclado: 'Arrows, space or Page Down to advance; Esc to leave.',
    noAdmitida: 'This presentation cannot be shown in the browser with this version of the portal. Use the PDF, which is the reference.',
    fallo: 'The player could not be loaded. Use the PDF.'
  }
}
