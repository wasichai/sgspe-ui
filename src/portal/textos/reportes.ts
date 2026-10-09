// S49 · reportes y exportaciones en F2 (screens.md, ux-architecture.md §9; api.md §4.13)
export const ES_REPORTES = {
  titulo: 'Reportes',
  registroDeGrupos: 'Registro de grupos de interés',
  registroAyuda:
    'XLSX con la evaluación vigente de cada grupo de interés, con el nivel de divulgación aplicado antes de escribir el archivo. Queda en el registro de exportaciones.',
  proyecto: 'Proyecto',
  todosMisProyectos: 'Todos mis proyectos',
  proyectosCargando: 'Leyendo los proyectos…',
  proyectoDeLaPagina: 'Proyecto de la página',
  nivel: 'Nivel de divulgación',
  niveles: {
    INTERNO: 'Uso interno: todos los campos que su cuenta lee',
    EXTERNO: 'Externo: personas por cargo o por código GI-, sin datos personales ni campos sensibles',
    PUBLICO: 'Público: solo conteos por grupo de influencia, postura y ámbito'
  },
  // deliverables.md §9.1: el código GI- es un seudónimo estable, no anonimato
  externoAyuda:
    'Cada persona se cita por su cargo o por un código GI- con 12 dígitos hexadecimales del grupo de interés. Es un seudónimo: es el mismo en todas las salidas, así que quien recibe varias puede enlazarlas.',
  // ASM-088: los conteos menores que 5 salen como «reservado»; dos salidas que difieren en pocas personas se restan
  publicoAyuda:
    'Todo conteo menor que 5, el cero incluido, sale como «reservado», y también la celda que permitiría despejarlo restando. La salida no lleva totales.',
  publicoAdvertencia:
    'No publique dos salidas PUBLICO que difieran en pocas personas (por ejemplo, el mismo filtro antes y después de registrar a alguien): restar una de otra revelaría las celdas reservadas (ASM-088).',
  // lo que la exportación dice distinto de un código (api.md §4.13)
  errores: {
    NOT_ASSIGNED: 'No tiene una asignación vigente a este proyecto: elija «Todos mis proyectos» o pida la asignación.',
    TOO_MANY_RECORDS: 'Hay demasiados grupos de interés para un solo archivo: elija un proyecto o acote los filtros.'
  },
  checklist: 'Revisé que el archivo puede salir con este nivel: sin datos personales, sin postura atribuida a personas y con las fotos con consentimiento',
  checklistFalta: 'Confirme la lista de verificación para una salida fuera de la organización',
  exportar: 'Exportar XLSX',
  exportando: 'Generando…',
  sinPermiso: 'Su cuenta no tiene la acción EXPORT sobre grupos de interés.',
  historial: 'Registro de exportaciones',
  historialAyuda: 'Las últimas exportaciones de la organización (o del proyecto elegido), con quién las hizo.',
  historialVacio: 'Todavía no hay exportaciones registradas.',
  columnas: { fecha: 'Fecha', quien: 'Exportó', objeto: 'Objeto', nivel: 'Nivel', filas: 'Filas' },
  otrasLlegan: 'El registro de QCS y de riesgos llega en F4 y los entregables en F8.',
  // F3: la matriz de compromisos (api.md §4.13, deliverables.md §10)
  matriz: {
    titulo: 'Matriz de compromisos',
    ayuda:
      'XLSX con la matriz de DOC-01: en INTERNO, las hojas «Matriz» y «Entregas»; en EXTERNO, sin responsable ni datos restringidos, con los solicitantes por código GI-; en PUBLICO, solo los conteos por estado y tema y por tipo de recurso. Nunca el documento de identidad de los solicitantes.',
    campana: 'Campaña de exploración',
    todas: 'Todas las campañas',
    estados: 'Estados',
    estadosAyuda: 'Sin ninguno marcado, todos los estados.',
    plazo: 'La situación de plazo (AL DIA, POR VENCER, VENCIDO) solo se imprime en los compromisos pendientes: aprobados, en ejecución o bloqueados.',
    exportar: 'Exportar la matriz',
    sinPermiso: 'Su cuenta no tiene la acción EXPORT sobre compromisos.',
    errores: {
      INVALID_FILTER: 'Uno de los estados elegidos no es de WF-D: recargue la página.',
      TOO_MANY_RECORDS: 'Hay demasiados compromisos para un solo archivo: elija un proyecto, una campaña o menos estados.'
    }
  }
}

export const EN_REPORTES: typeof ES_REPORTES = {
  titulo: 'Reports',
  registroDeGrupos: 'Stakeholder register',
  registroAyuda:
    'XLSX with the current assessment of each stakeholder, with the disclosure level applied before the file is written. It is recorded in the export log.',
  proyecto: 'Project',
  todosMisProyectos: 'All my projects',
  proyectosCargando: 'Reading the projects…',
  proyectoDeLaPagina: 'Project of this page',
  nivel: 'Disclosure level',
  niveles: {
    INTERNO: 'Internal: every field your account reads',
    EXTERNO: 'External: people by position or GI- code, no personal data or sensitive fields',
    PUBLICO: 'Public: only counts by influence group, stance and scope'
  },
  externoAyuda:
    'Each person is cited by position or by a GI- code with 12 hexadecimal digits of the stakeholder. It is a pseudonym: it is the same in every output, so whoever receives several can link them.',
  publicoAyuda:
    'Every count under 5, zero included, shows as “reservado”, and so does the cell that would reveal it by subtraction. The output carries no totals.',
  publicoAdvertencia:
    'Do not publish two PUBLICO outputs that differ by a few people (for instance, the same filter before and after someone is registered): subtracting one from the other would reveal the reserved cells (ASM-088).',
  errores: {
    NOT_ASSIGNED: 'You have no current assignment to this project: pick “All my projects” or ask for the assignment.',
    TOO_MANY_RECORDS: 'There are too many stakeholders for one file: pick a project or narrow the filters.'
  },
  checklist: 'I checked the file can leave with this level: no personal data, no stance attributed to people and photos with consent',
  checklistFalta: 'Confirm the checklist for an output leaving the organization',
  exportar: 'Export XLSX',
  exportando: 'Generating…',
  sinPermiso: 'Your account does not hold the EXPORT action on stakeholders.',
  historial: 'Export log',
  historialAyuda: 'The latest exports of the organization (or of the chosen project), with who made them.',
  historialVacio: 'No exports have been recorded yet.',
  columnas: { fecha: 'Date', quien: 'Exported by', objeto: 'Object', nivel: 'Level', filas: 'Rows' },
  otrasLlegan: 'The grievance and risk registers arrive in F4 and the deliverables in F8.',
  matriz: {
    titulo: 'Commitment matrix',
    ayuda:
      'XLSX with the DOC-01 matrix: in INTERNO, the «Matriz» and «Entregas» sheets; in EXTERNO, without owner or restricted data and with requesters by GI- code; in PUBLICO, only counts by status and theme and by resource type. Never the requesters’ identity document.',
    campana: 'Exploration campaign',
    todas: 'All campaigns',
    estados: 'Statuses',
    estadosAyuda: 'With none checked, every status.',
    plazo: 'The deadline situation (AL DIA, POR VENCER, VENCIDO) is only printed for pending commitments: approved, in progress or blocked.',
    exportar: 'Export the matrix',
    sinPermiso: 'Your account does not hold the EXPORT action on commitments.',
    errores: {
      INVALID_FILTER: 'One of the chosen statuses is not a WF-D status: reload the page.',
      TOO_MANY_RECORDS: 'There are too many commitments for one file: pick a project, a campaign or fewer statuses.'
    }
  }
}
