// las acciones de IA en las fichas y el resumen ejecutivo del proyecto (screens.md §13, S08, S23, S36, S46, S57 y S58)
export const ES_ACCIONES_IA = {
  titulo: 'Con IA',
  ayuda: 'La IA lee como usted y propone; nada cambia hasta que una persona decide en la bandeja.',
  casos: {
    extraer: 'Extraer datos del documento',
    compromisosDelDocumento: 'Detectar posibles compromisos',
    borrador: 'Redactar el borrador del acta',
    compromisosDelActa: 'Detectar posibles compromisos en el acta',
    clasificarQcs: 'Sugerir categoría, prioridad y tema',
    temaDePregunta: 'Sugerir el tema',
    tonoDeMencion: 'Sugerir el tono y el tema',
    duplicados: 'Buscar posibles duplicados'
  },
  preguntarSobre: 'Preguntar sobre este registro',
  analizando: 'Analizando…',
  resultado: 'Sugerencias por revisar: {{sugerencias}}. Candidatos por revisar: {{candidatos}}.',
  sinResultado: 'La IA no encontró nada que proponer.',
  irALaBandeja: 'Revisar en la bandeja',
  borradorListo: 'El borrador quedó listo en el editor del acta.',
  abrirEditor: 'Abrir el editor del acta',
  pendientes: 'Propuestas pendientes sobre este registro: {{n}}',
  proveedorCaido: 'El servicio de IA no responde: las acciones vuelven cuando responda.',
  reintentar: 'Reintentar',
  resumen: {
    titulo: 'Resumen ejecutivo',
    ayuda: 'Un borrador redactado con las cifras que su cuenta puede leer. No es un dato: cópielo y edítelo donde lo use.',
    redactado: 'Redactado el {{fecha}}',
    generar: 'Generar resumen',
    generarDeNuevo: 'Generar de nuevo',
    generando: 'Generando…',
    copiar: 'Copiar',
    copiado: 'Copiado.',
    noCopiado: 'No se pudo copiar: seleccione el texto y cópielo a mano.',
    vacio: 'Aún no hay un resumen de este proyecto.',
    documentos: 'Preguntar a los documentos'
  }
}

export const EN_ACCIONES_IA: typeof ES_ACCIONES_IA = {
  titulo: 'With AI',
  ayuda: 'The AI reads as you do and proposes; nothing changes until a person decides in the tray.',
  casos: {
    extraer: 'Extract data from the document',
    compromisosDelDocumento: 'Detect possible commitments',
    borrador: 'Draft the minutes',
    compromisosDelActa: 'Detect possible commitments in the minutes',
    clasificarQcs: 'Suggest category, priority and topic',
    temaDePregunta: 'Suggest the topic',
    tonoDeMencion: 'Suggest the tone and the topic',
    duplicados: 'Look for possible duplicates'
  },
  preguntarSobre: 'Ask about this record',
  analizando: 'Analyzing…',
  resultado: 'Suggestions to review: {{sugerencias}}. Candidates to review: {{candidatos}}.',
  sinResultado: 'The AI found nothing to propose.',
  irALaBandeja: 'Review in the tray',
  borradorListo: 'The draft is ready in the minutes editor.',
  abrirEditor: 'Open the minutes editor',
  pendientes: 'Pending proposals about this record: {{n}}',
  proveedorCaido: 'The AI service is not responding: the actions come back when it does.',
  reintentar: 'Retry',
  resumen: {
    titulo: 'Executive summary',
    ayuda: 'A draft written with the figures your account can read. It is not data: copy it and edit it where you use it.',
    redactado: 'Written on {{fecha}}',
    generar: 'Generate summary',
    generarDeNuevo: 'Generate again',
    generando: 'Generating…',
    copiar: 'Copy',
    copiado: 'Copied.',
    noCopiado: 'Could not copy: select the text and copy it by hand.',
    vacio: 'There is no summary of this project yet.',
    documentos: 'Ask the documents'
  }
}
