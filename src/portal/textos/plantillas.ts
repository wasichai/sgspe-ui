// F8 · S64, las plantillas de entregables (screens.md, api.md §4.12, ASM-135): la lista, la subida y lo que la validación rechaza
export const ES_PLANTILLAS = {
  titulo: 'Plantillas de entregables',
  volver: 'Volver a Reportes',
  ayuda:
    'La plantilla Word de la organización aporta el aspecto de los entregables. Una plantilla nueva con la misma clave reemplaza a la anterior para los borradores siguientes; ninguna se edita ni se borra.',
  soloAdministracion: 'Las plantillas de entregables las administra la administración de la organización.',
  subir: 'Subir plantilla',
  vacio: 'Todavía no hay plantillas propias: rige la plantilla base de SGSPE.',
  columnas: { clave: 'Clave', nombre: 'Nombre', huella: 'Huella SHA-256', fecha: 'Subida el', avisos: 'Avisos', acciones: 'Acciones' },
  descargar: 'Descargar {{clave}}',
  descargarCorto: 'Descargar',
  reglas: {
    titulo: 'Qué admite una plantilla',
    ayuda:
      'Sin macros, objetos incrustados, controles ni vínculos externos; con los estilos requeridos; solo con los marcadores fijos y las fuentes permitidas.',
    marcadores: 'Marcadores de la portada, el encabezado y el pie',
    estilos: 'Estilos requeridos',
    fuentes: 'Fuentes permitidas',
    prohibido: 'Un marcador desconocido o una fuente fuera de la lista rechazan la plantilla; una fuente que solo figura en la tabla de fuentes es un aviso.'
  },
  subida: {
    titulo: 'Subir una plantilla',
    ayuda: 'La plantilla se valida antes de guardarse. Si no pasa, se dice cada problema.',
    archivo: 'Archivo (.dotx o .docx, hasta 20 MB)',
    faltaArchivo: 'Elija el archivo de la plantilla.',
    muyGrande: 'El archivo pesa {{tamano}}: pasa de 20 MB.',
    clave: 'Clave',
    claveAyuda: 'La clave que eligen los entregables, por ejemplo informe-base.',
    claveInvalida: 'De 1 a 64 letras minúsculas, dígitos o guiones; empieza por una letra o un dígito.',
    nombre: 'Nombre',
    confirmar: 'Subir',
    subiendo: 'Subiendo…',
    aceptada: 'Plantilla aceptada. Rige para los borradores siguientes de esa clave.',
    avisos: 'Avisos de la plantilla',
    rechazada: 'La plantilla no pasó la validación',
    problemas: 'Problemas de la plantilla',
    listo: 'Listo'
  },
  codigos: {
    MACROS: 'Trae macros',
    OLE_OBJECT: 'Trae objetos incrustados',
    ACTIVEX: 'Trae controles ActiveX',
    CONTENT_CONTROL: 'Trae controles de contenido',
    EXTERNAL_RELATIONSHIP: 'Cita archivos o direcciones externas',
    EXTERNAL_CONTENT: 'Importa contenido de otro documento',
    FIELD_NOT_ALLOWED: 'Trae un campo que no se admite',
    UNKNOWN_PLACEHOLDER: 'Un marcador que no se admite',
    MISSING_STYLE: 'Falta un estilo requerido',
    FONT_NOT_ALLOWED: 'Usa una fuente que no está permitida',
    NOT_WORD: 'No es un documento Word válido',
    TOO_LARGE: 'Es demasiado grande',
    FONT_IN_TABLE: 'Fuente que solo figura en la tabla de fuentes',
    otro: 'Problema de la plantilla'
  }
}

export const EN_PLANTILLAS: typeof ES_PLANTILLAS = {
  titulo: 'Deliverable templates',
  volver: 'Back to Reports',
  ayuda:
    'The organization Word template provides the look of the deliverables. A new template with the same key replaces the previous one for the next drafts; none is edited nor deleted.',
  soloAdministracion: 'Deliverable templates are managed by the organization administration.',
  subir: 'Upload template',
  vacio: 'There are no own templates yet: the SGSPE base template applies.',
  columnas: { clave: 'Key', nombre: 'Name', huella: 'SHA-256 fingerprint', fecha: 'Uploaded on', avisos: 'Warnings', acciones: 'Actions' },
  descargar: 'Download {{clave}}',
  descargarCorto: 'Download',
  reglas: {
    titulo: 'What a template admits',
    ayuda: 'No macros, embedded objects, controls nor external links; with the required styles; only the fixed placeholders and the allowed fonts.',
    marcadores: 'Placeholders of the cover, header and footer',
    estilos: 'Required styles',
    fuentes: 'Allowed fonts',
    prohibido: 'An unknown placeholder or a font outside the list rejects the template; a font that only appears in the font table is a warning.'
  },
  subida: {
    titulo: 'Upload a template',
    ayuda: 'The template is validated before it is saved. If it does not pass, each problem is listed.',
    archivo: 'File (.dotx or .docx, up to 20 MB)',
    faltaArchivo: 'Choose the template file.',
    muyGrande: 'The file weighs {{tamano}}: it exceeds 20 MB.',
    clave: 'Key',
    claveAyuda: 'The key the deliverables choose, for example informe-base.',
    claveInvalida: 'From 1 to 64 lowercase letters, digits or hyphens; it starts with a letter or a digit.',
    nombre: 'Name',
    confirmar: 'Upload',
    subiendo: 'Uploading…',
    aceptada: 'Template accepted. It applies to the next drafts of that key.',
    avisos: 'Template warnings',
    rechazada: 'The template did not pass validation',
    problemas: 'Template problems',
    listo: 'Done'
  },
  codigos: {
    MACROS: 'It has macros',
    OLE_OBJECT: 'It has embedded objects',
    ACTIVEX: 'It has ActiveX controls',
    CONTENT_CONTROL: 'It has content controls',
    EXTERNAL_RELATIONSHIP: 'It cites external files or addresses',
    EXTERNAL_CONTENT: 'It imports content from another document',
    FIELD_NOT_ALLOWED: 'It has a field that is not admitted',
    UNKNOWN_PLACEHOLDER: 'A placeholder that is not admitted',
    MISSING_STYLE: 'A required style is missing',
    FONT_NOT_ALLOWED: 'It uses a font that is not allowed',
    NOT_WORD: 'It is not a valid Word document',
    TOO_LARGE: 'It is too large',
    FONT_IN_TABLE: 'A font that only appears in the font table',
    otro: 'Template problem'
  }
}
