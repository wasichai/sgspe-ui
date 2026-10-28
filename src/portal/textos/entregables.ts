// F8 · los entregables (screens.md S49 y S50, deliverables.md §8 y §9): la lista y el alta, el entregable por secciones, el editor,
// las menciones, AI-04 de sección, el panel del borrador, la emisión y las versiones
export const ES_ENTREGABLES = {
  lista: {
    titulo: 'Entregables',
    ayuda: 'Los informes que se generan en DOCX y PDF, se revisan, se aprueban y se emiten. Cada uno lleva a su página.',
    nuevo: 'Nuevo entregable',
    plantillas: 'Plantillas',
    sinAsignacion: 'Para crear un entregable en este proyecto hace falta una asignación vigente a él.',
    vacio: 'Todavía no hay entregables.',
    comoEmpezar:
      '«Nuevo entregable» arma el borrador con las secciones de su tipo (un informe de campo, un diagnóstico social) a partir de los datos del proyecto.',
    columnas: {
      entregable: 'Entregable',
      tipo: 'Tipo',
      corte: 'Corte',
      estado: 'Estado',
      borrador: 'Borrador',
      revision: 'Revisión',
      niveles: 'Niveles'
    }
  },
  nuevo: {
    titulo: 'Nuevo entregable',
    ayuda: 'El tipo fija las secciones y los datos que pide el borrador. El tipo no cambia después.',
    tipo: 'Tipo de entregable',
    codigo: 'Código del documento',
    tituloDelDocumento: 'Título',
    desde: 'Inicio del periodo',
    hasta: 'Fin del periodo',
    corte: 'Fecha de corte',
    comunidad: 'Comunidad',
    buscarComunidad: 'Buscar la comunidad',
    estudio: 'Estudio',
    area: 'Área de influencia directa social aprobada',
    preparadoPara: 'Preparado para',
    suscritoPor: 'Suscrito por',
    plantilla: 'Plantilla',
    plantillaAyuda: 'La plantilla aporta el aspecto: portada, encabezado, pie y estilos.',
    plantillaBase: 'La plantilla base de SGSPE',
    ayudaT1: 'El diagnóstico necesita el área de influencia directa social aprobada del proyecto y su sistema de coordenadas de trabajo.',
    faltaTipo: 'Elija el tipo.',
    faltaCodigo: 'Escriba el código del documento.',
    faltaTitulo: 'Escriba el título.',
    faltaDesde: 'Elija el inicio del periodo.',
    faltaHasta: 'Elija el fin del periodo.',
    periodoAlReves: 'El fin del periodo no puede ser anterior a su inicio.',
    faltaCorte: 'Elija la fecha de corte.',
    faltaComunidad: 'Elija la comunidad del informe.',
    faltaEstudio: 'Elija el estudio.',
    faltaArea: 'Elija el área de influencia directa social aprobada.',
    crear: 'Crear entregable',
    creando: 'Creando…'
  },
  pagina: {
    volver: 'Volver a Reportes',
    camino: 'Camino del entregable',
    periodo: 'Periodo: {{desde}} a {{hasta}}',
    niveles: 'Niveles: {{niveles}}'
  },
  secciones: {
    titulo: 'Secciones',
    conIa: 'Con IA',
    cambiada: 'Cambió después del borrador',
    // cuántas lleva revisadas el entregable (tercera pasada de UX, 4.6)
    revisadas: 'Revisadas: {{n}} de {{m}}',
    revisada: 'Revisada'
  },
  seccion: {
    texto: 'Texto de la sección',
    revisada: 'Revisada',
    guardar: 'Guardar sección',
    calculada: 'Sección calculada: su contenido sale de los registros al generar el borrador.',
    soloEnBorrador: 'Las secciones se editan con el entregable en borrador u observado.',
    asistidaAyuda: 'Esta sección fue asistida por IA y lo seguirá diciendo en las versiones emitidas: todo cambio lleva motivo.',
    motivoDelServidor: 'Esta sección está asistida por IA: guardar un cambio exige un motivo.',
    vacia: 'La sección todavía no tiene texto.',
    guia: 'Guía de redacción',
    tiposConError: 'No se pudieron leer los tipos de entregable: la guía y las sugerencias de IA no se ofrecen por ahora.',
    cargandoEditor: 'Cargando el editor…',
    sinGuardar: {
      titulo: 'Hay cambios sin guardar',
      ayuda: 'Hay cambios sin guardar en esta sección. ¿Descartarlos y abrir la otra sección?',
      salir: 'Hay cambios sin guardar en esta sección. ¿Descartarlos y salir del entregable?',
      cancelar: 'Cancelar',
      descartar: 'Descartar'
    }
  },
  editor: {
    herramientas: 'Herramientas del editor',
    negrita: 'Negrita',
    cursiva: 'Cursiva',
    titulo: 'Título',
    lista: 'Lista',
    modoMarkdown: 'Editar como Markdown',
    modoFormato: 'Editar con formato',
    soloMarkdown: 'Este texto tiene partes que el editor con formato no conserva (una tabla, por ejemplo): se edita como Markdown.',
    noVuelve: 'Este texto no se puede editar con formato sin perder partes: siga en Markdown.'
  },
  menciones: {
    titulo: 'Mencionar',
    tipo: 'Mencionar a',
    tipos: { person: 'persona', position: 'cargo', stakeholder: 'grupo de interés' },
    buscar: { person: 'Buscar una persona', position: 'Buscar un cargo', stakeholder: 'Buscar un grupo de interés' }
  },
  ia: {
    titulo: 'Borrador de la IA',
    sugerir: 'Sugerir con IA',
    sugerirDeNuevo: 'Sugerir de nuevo',
    redactando: 'Redactando…',
    redactada: 'Redactada el {{fecha}}. Una persona decide si la usa.',
    sinSugerencia: 'Todavía no hay una sugerencia para esta sección.',
    usar: 'Usar…',
    usarResumen: 'Usar el resumen ejecutivo del proyecto…',
    guardeAntes: 'Guarde o descarte los cambios de la sección antes de usar una sugerencia.',
    usarTitulo: 'Usar la sugerencia en la sección',
    usarAyuda: 'Este será el texto de la sección. Corríjalo y escriba el motivo: la sección queda asistida por IA.',
    texto: 'Texto que irá a la sección',
    textoFalta: 'Escriba el texto de la sección.',
    quedanMarcadores: 'El texto todavía lleva datos reservados por la IA: reemplácelos por una mención o por un texto genérico.',
    confirmar: 'Usar en la sección',
    usando: 'Usando…'
  },
  borrador: {
    titulo: 'Borrador',
    estado: 'Estado del borrador: {{estado}}',
    letra: 'Revisión del borrador: {{letra}}',
    congelado: 'Datos congelados el {{fecha}}',
    // la espera dice cuánto lleva, sin el detalle técnico de la consulta, y al terminar se avisa (tercera pasada de UX, 4.6)
    consultandoRecien: 'Se prepara el borrador, recién pedido: suele tardar unos minutos. Puede seguir trabajando; aquí se avisa al terminar.',
    consultando: 'Se prepara el borrador, pedido hace {{n}} min: suele tardar unos minutos. Puede seguir trabajando; aquí se avisa al terminar.',
    consultandoDesde: 'Se prepara el borrador desde el {{fecha}}: tarda más de lo habitual. Puede seguir trabajando; aquí se avisa al terminar.',
    listo: 'El borrador ya está listo.',
    fallido: 'El borrador no se pudo preparar: vea los avisos.',
    irASeccion: 'Ir a la sección {{seccion}}',
    sinActualizar: 'No se pudo actualizar el estado del borrador.',
    avisosDelBorrador: 'Avisos del borrador',
    avisos: {
      MAP_FAILED: 'No se pudo dibujar un mapa de la sección {{seccion}}: la emisión queda bloqueada hasta un borrador nuevo.',
      POSSIBLE_PERSONAL_DATA: 'Posibles datos personales en la sección {{seccion}}: revíselos antes de emitir fuera de la organización.',
      PDF_CHECK_FAILED: 'El PDF del nivel {{seccion}} no pasó la verificación.',
      PDF_CONVERTER_UNAVAILABLE: 'El servicio que convierte a PDF no respondió: pida el borrador otra vez más tarde.',
      FILE_TOO_LARGE: 'Un archivo del borrador pasa del tamaño permitido.',
      TEMPLATE_UNAVAILABLE: 'La plantilla del entregable no está disponible.',
      TYPE_NOT_AVAILABLE: 'Esta versión no genera este tipo de entregable.',
      DELIVERABLE_PARAMETERS_MISSING: 'Faltan datos del entregable: {{seccion}}.',
      GENERATION_FAILED: 'El borrador no se pudo preparar. Pídalo otra vez; si se repite, avise a soporte.',
      otro: 'Aviso del borrador en {{seccion}}.'
    },
    huella: 'Huella de lo que se emitirá («{{nivel}}»)',
    verPdf: 'Ver el PDF «{{nivel}}»',
    descargarDocx: 'Descargar el DOCX «Interno»',
    vistaPrevia: 'Borrador «{{nivel}}» (con la marca BORRADOR)',
    sinDescarga: 'Su rol no descarga los borradores: los revisa quien puede leer todo su contenido.',
    pedir: 'Pedir borrador',
    otro: 'Generar otro borrador',
    pedirAyuda: 'El borrador se prepara en segundo plano con los datos de hoy: unos minutos. Mientras tanto se ve el último listo.',
    confirmar: 'Pedir',
    pidiendo: 'Pidiendo…',
    fueraDeEstado: 'Un borrador se pide con el entregable en borrador u observado.'
  },
  aprobar: {
    anexo: 'Modelo revisado SHA-256 {{sha}}'
  },
  emitir: {
    boton: 'Emitir…',
    mapaFallido: 'Un mapa del borrador falló: pida un borrador nuevo antes de emitir.',
    titulo: 'Emitir el entregable',
    ayuda: 'Se emite exactamente el borrador aprobado: sus versiones «Interno» y «Externo», sin la marca BORRADOR. No se deshace.',
    modelo: 'Huella del contenido revisado',
    candidatas: 'Huellas de las versiones que se emitirán',
    lista: {
      titulo: 'Lista de verificación para la versión «Externo»',
      narrativa: 'La narrativa y los textos de registro no tienen nombres tecleados ni datos de contacto.',
      fotos: 'Las fotos incluidas tienen consentimiento o no muestran personas identificables.',
      mapas: 'Los mapas no muestran titulares ni ubicaciones de viviendas.',
      anexos: 'Los anexos no traen datos personales.'
    },
    confirmar: 'Emitir',
    emitiendo: 'Emitiendo…',
    recargarBorrador: 'Recargar el borrador',
    cambio:
      'El borrador cambió mientras esta ventana estaba abierta: lo que revisó ya no es lo que hay. Cierre la ventana y vuelva a abrirla, o use el borrador actual para revisarlo y marcar la lista otra vez.',
    usarActual: 'Usar el borrador actual',
    hecho: 'Entregable emitido en su revisión {{revision}}.'
  },
  versiones: {
    titulo: 'Versiones emitidas',
    vacio: 'Todavía no hay versiones emitidas.',
    columnas: {
      numero: 'N.º',
      revision: 'Revisión',
      nivel: 'Nivel',
      emitida: 'Emitida el',
      quien: 'Emitió',
      huella: 'Huella del PDF',
      conIa: 'Secciones con IA',
      descargas: 'Descargas'
    },
    descargar: 'Descargar el {{formato}} de la versión {{numero}}'
  },
  resumen: {
    usarEnEntregable: 'Usar en un entregable…'
  }
}

export const EN_ENTREGABLES: typeof ES_ENTREGABLES = {
  lista: {
    titulo: 'Deliverables',
    ayuda: 'The reports that are generated in DOCX and PDF, reviewed, approved and issued. Each one opens its page.',
    nuevo: 'New deliverable',
    plantillas: 'Templates',
    sinAsignacion: 'Creating a deliverable in this project needs a current assignment to it.',
    vacio: 'There are no deliverables yet.',
    comoEmpezar: '“New deliverable” builds the draft with the sections of its type (a field report, a social diagnosis) from the project data.',
    columnas: { entregable: 'Deliverable', tipo: 'Type', corte: 'Cutoff', estado: 'State', borrador: 'Draft', revision: 'Revision', niveles: 'Levels' }
  },
  nuevo: {
    titulo: 'New deliverable',
    ayuda: 'The type sets the sections and the data the draft asks for. The type does not change later.',
    tipo: 'Deliverable type',
    codigo: 'Document code',
    tituloDelDocumento: 'Title',
    desde: 'Period start',
    hasta: 'Period end',
    corte: 'Cutoff date',
    comunidad: 'Community',
    buscarComunidad: 'Search the community',
    estudio: 'Study',
    area: 'Approved direct social area of influence',
    preparadoPara: 'Prepared for',
    suscritoPor: 'Signed by',
    plantilla: 'Template',
    plantillaAyuda: 'The template provides the look: cover, header, footer and styles.',
    plantillaBase: 'The SGSPE base template',
    ayudaT1: 'The diagnosis needs the approved direct social area of influence of the project and its working coordinate system.',
    faltaTipo: 'Choose the type.',
    faltaCodigo: 'Write the document code.',
    faltaTitulo: 'Write the title.',
    faltaDesde: 'Choose the period start.',
    faltaHasta: 'Choose the period end.',
    periodoAlReves: 'The period end cannot be before its start.',
    faltaCorte: 'Choose the cutoff date.',
    faltaComunidad: 'Choose the report community.',
    faltaEstudio: 'Choose the study.',
    faltaArea: 'Choose the approved direct social area of influence.',
    crear: 'Create deliverable',
    creando: 'Creating…'
  },
  pagina: {
    volver: 'Back to Reports',
    camino: 'Deliverable path',
    periodo: 'Period: {{desde}} to {{hasta}}',
    niveles: 'Levels: {{niveles}}'
  },
  secciones: {
    titulo: 'Sections',
    conIa: 'With AI',
    cambiada: 'Changed after the draft',
    revisadas: 'Reviewed: {{n}} of {{m}}',
    revisada: 'Reviewed'
  },
  seccion: {
    texto: 'Section text',
    revisada: 'Reviewed',
    guardar: 'Save section',
    calculada: 'Computed section: its content comes from the records when the draft is generated.',
    soloEnBorrador: 'Sections are edited with the deliverable in draft or observed.',
    asistidaAyuda: 'This section was AI-assisted and the issued versions will keep saying so: every change takes a reason.',
    motivoDelServidor: 'This section is AI-assisted: saving a change needs a reason.',
    vacia: 'The section has no text yet.',
    guia: 'Writing guide',
    tiposConError: 'The deliverable types could not be read: the guide and the AI suggestions are not offered for now.',
    cargandoEditor: 'Loading the editor…',
    sinGuardar: {
      titulo: 'There are unsaved changes',
      ayuda: 'This section has unsaved changes. Discard them and open the other section?',
      salir: 'This section has unsaved changes. Discard them and leave the deliverable?',
      cancelar: 'Cancel',
      descartar: 'Discard'
    }
  },
  editor: {
    herramientas: 'Editor tools',
    negrita: 'Bold',
    cursiva: 'Italic',
    titulo: 'Heading',
    lista: 'List',
    modoMarkdown: 'Edit as Markdown',
    modoFormato: 'Edit with formatting',
    soloMarkdown: 'This text has parts the formatting editor does not keep (a table, for example): it is edited as Markdown.',
    noVuelve: 'This text cannot be edited with formatting without losing parts: keep using Markdown.'
  },
  menciones: {
    titulo: 'Mention',
    tipo: 'Mention a',
    tipos: { person: 'person', position: 'position', stakeholder: 'stakeholder' },
    buscar: { person: 'Search a person', position: 'Search a position', stakeholder: 'Search a stakeholder' }
  },
  ia: {
    titulo: 'AI draft',
    sugerir: 'Suggest with AI',
    sugerirDeNuevo: 'Suggest again',
    redactando: 'Writing…',
    redactada: 'Written on {{fecha}}. A person decides whether to use it.',
    sinSugerencia: 'There is no suggestion for this section yet.',
    usar: 'Use…',
    usarResumen: 'Use the project executive summary…',
    guardeAntes: 'Save or discard the section changes before using a suggestion.',
    usarTitulo: 'Use the suggestion in the section',
    usarAyuda: 'This will be the section text. Correct it and write the reason: the section becomes AI-assisted.',
    texto: 'Text that will go to the section',
    textoFalta: 'Write the section text.',
    quedanMarcadores: 'The text still has data reserved by the AI: replace it with a mention or a generic text.',
    confirmar: 'Use in the section',
    usando: 'Using…'
  },
  borrador: {
    titulo: 'Draft',
    estado: 'Draft status: {{estado}}',
    letra: 'Draft revision: {{letra}}',
    congelado: 'Data frozen on {{fecha}}',
    consultandoRecien:
      'The draft is being prepared, just requested: it usually takes a few minutes. You can keep working; you will be told here when it is done.',
    consultando:
      'The draft is being prepared, requested {{n}} min ago: it usually takes a few minutes. You can keep working; you will be told here when it is done.',
    consultandoDesde:
      'The draft has been in preparation since {{fecha}}: it is taking longer than usual. You can keep working; you will be told here when it is done.',
    listo: 'The draft is ready.',
    fallido: 'The draft could not be prepared: see the warnings.',
    irASeccion: 'Go to the section {{seccion}}',
    sinActualizar: 'The draft status could not be updated.',
    avisosDelBorrador: 'Draft warnings',
    avisos: {
      MAP_FAILED: 'A map of the section {{seccion}} could not be drawn: issuing is blocked until a new draft.',
      POSSIBLE_PERSONAL_DATA: 'Possible personal data in the section {{seccion}}: review it before issuing outside the organization.',
      PDF_CHECK_FAILED: 'The PDF of the level {{seccion}} did not pass the check.',
      PDF_CONVERTER_UNAVAILABLE: 'The PDF conversion service did not answer: request the draft again later.',
      FILE_TOO_LARGE: 'A draft file exceeds the allowed size.',
      TEMPLATE_UNAVAILABLE: 'The deliverable template is not available.',
      TYPE_NOT_AVAILABLE: 'This version does not generate this deliverable type.',
      DELIVERABLE_PARAMETERS_MISSING: 'The deliverable lacks data: {{seccion}}.',
      GENERATION_FAILED: 'The draft could not be prepared. Request it again; if it repeats, tell support.',
      otro: 'Draft warning in {{seccion}}.'
    },
    huella: 'Fingerprint of what will be issued («{{nivel}}»)',
    verPdf: 'See the «{{nivel}}» PDF',
    descargarDocx: 'Download the «Interno» DOCX',
    vistaPrevia: 'Draft «{{nivel}}» (with the BORRADOR mark)',
    sinDescarga: 'Your role does not download drafts: they are reviewed by whoever can read all their content.',
    pedir: 'Request draft',
    otro: 'Generate another draft',
    pedirAyuda: 'The draft is prepared in the background with today data: a few minutes. Meanwhile the last ready one is shown.',
    confirmar: 'Request',
    pidiendo: 'Requesting…',
    fueraDeEstado: 'A draft is requested with the deliverable in draft or observed.'
  },
  aprobar: {
    anexo: 'Reviewed model SHA-256 {{sha}}'
  },
  emitir: {
    boton: 'Issue…',
    mapaFallido: 'A draft map failed: request a new draft before issuing.',
    titulo: 'Issue the deliverable',
    ayuda: 'Exactly the approved draft is issued: its «Interno» and «Externo» versions, without the BORRADOR mark. It cannot be undone.',
    modelo: 'Fingerprint of the reviewed content',
    candidatas: 'Fingerprints of the versions to be issued',
    lista: {
      titulo: 'Checklist for the «Externo» version',
      narrativa: 'The narrative and the record texts have no typed names nor contact data.',
      fotos: 'The included photos have consent or do not show identifiable people.',
      mapas: 'The maps do not show holders nor dwelling locations.',
      anexos: 'The annexes carry no personal data.'
    },
    confirmar: 'Issue',
    emitiendo: 'Issuing…',
    recargarBorrador: 'Reload the draft',
    cambio:
      'The draft changed while this window was open: what you reviewed is no longer what is there. Close the window and open it again, or use the current draft to review it and tick the checklist again.',
    usarActual: 'Use the current draft',
    hecho: 'Deliverable issued in its revision {{revision}}.'
  },
  versiones: {
    titulo: 'Issued versions',
    vacio: 'There are no issued versions yet.',
    columnas: {
      numero: 'No.',
      revision: 'Revision',
      nivel: 'Level',
      emitida: 'Issued on',
      quien: 'Issued by',
      huella: 'PDF fingerprint',
      conIa: 'Sections with AI',
      descargas: 'Downloads'
    },
    descargar: 'Download the {{formato}} of version {{numero}}'
  },
  resumen: {
    usarEnEntregable: 'Use in a deliverable…'
  }
}
