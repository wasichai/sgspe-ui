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
    'No publique dos salidas PUBLICO que difieran en pocas personas (por ejemplo, el mismo filtro antes y después de registrar a alguien): restar una de otra revelaría las celdas reservadas.',
  // lo que la exportación dice distinto de un código (api.md §4.13)
  errores: {
    NOT_ASSIGNED: 'No tiene una asignación vigente a este proyecto: elija «Todos mis proyectos» o pida la asignación.',
    TOO_MANY_RECORDS: 'Hay demasiados grupos de interés para un solo archivo: elija un proyecto o acote los filtros.'
  },
  checklist: 'Revisé que el archivo puede salir con este nivel: sin datos personales, sin postura atribuida a personas y con las fotos con consentimiento',
  checklistFalta: 'Confirme la lista de verificación para una salida fuera de la organización',
  exportar: 'Exportar XLSX',
  exportando: 'Generando…',
  sinPermiso: 'Su cuenta no tiene permiso para exportar grupos de interés.',
  historial: 'Registro de exportaciones',
  historialAyuda: 'Las últimas exportaciones de la organización (o del proyecto elegido), con quién las hizo.',
  historialVacio: 'Todavía no hay exportaciones registradas.',
  columnas: { fecha: 'Fecha', quien: 'Exportó', objeto: 'Objeto', nivel: 'Nivel', filas: 'Filas' },
  otrasLlegan: 'El registro de QCS y de riesgos llega en F4 y los entregables en F8.',
  // F3: la matriz de compromisos (api.md §4.13, deliverables.md §10)
  matriz: {
    titulo: 'Matriz de compromisos',
    ayuda:
      'XLSX con la matriz de compromisos: en INTERNO, las hojas «Matriz» y «Entregas»; en EXTERNO, sin responsable ni datos restringidos, con los solicitantes por código GI-; en PUBLICO, solo los conteos por estado y tema y por tipo de recurso. Nunca el documento de identidad de los solicitantes.',
    // lo que la matriz lleva en cada nivel (api.md §4.13), no lo del registro de grupos de interés
    niveles: {
      INTERNO: 'Uso interno: las hojas «Matriz» y «Entregas» con todos los campos que su cuenta lee',
      EXTERNO: 'Externo: sin responsable ni datos restringidos, con los solicitantes por código GI-',
      PUBLICO: 'Público: solo conteos por estado y tema y por tipo de recurso'
    },
    externoAyuda:
      'Cada solicitante se cita por un código GI- con 12 dígitos hexadecimales del grupo de interés: un seudónimo que es el mismo en todas las salidas. No salen el responsable, el detalle de beneficiarios, quiénes dieron la conformidad ni los receptores, y el lugar de cada entrega se generaliza a la localidad del compromiso.',
    publicoAyuda:
      'Las hojas «Por estado y tema» y «Por tipo de recurso» traen todas las combinaciones. Todo conteo menor que 5, el cero incluido, sale como «reservado», y también la celda que permitiría despejarlo restando.',
    checklist:
      'Revisé que la matriz puede salir con este nivel: sin datos personales en los textos de los compromisos y las entregas, y sin compromisos que no deban divulgarse',
    campana: 'Campaña de exploración',
    todas: 'Todas las campañas',
    campanasCargando: 'Leyendo las campañas…',
    estados: 'Estados',
    estadosAyuda: 'Sin ninguno marcado, todos los estados.',
    estadosCargando: 'Leyendo los estados…',
    plazo: 'La situación de plazo (AL DIA, POR VENCER, VENCIDO) solo se imprime en los compromisos pendientes: aprobados, en ejecución o bloqueados.',
    exportar: 'Exportar la matriz',
    errores: {
      INVALID_FILTER: 'Uno de los estados elegidos ya no es un estado de compromiso: recargue la página.',
      TOO_MANY_RECORDS:
        'La matriz no cabe en un solo archivo: elija un proyecto, una campaña o menos estados. Si ya acotó los filtros, puede que un compromiso tenga más de 200 solicitantes o una entrega más de 200 evidencias, y eso no se resuelve filtrando: avise a la administración.'
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
    'Do not publish two PUBLICO outputs that differ by a few people (for instance, the same filter before and after someone is registered): subtracting one from the other would reveal the reserved cells.',
  errores: {
    NOT_ASSIGNED: 'You have no current assignment to this project: pick “All my projects” or ask for the assignment.',
    TOO_MANY_RECORDS: 'There are too many stakeholders for one file: pick a project or narrow the filters.'
  },
  checklist: 'I checked the file can leave with this level: no personal data, no stance attributed to people and photos with consent',
  checklistFalta: 'Confirm the checklist for an output leaving the organization',
  exportar: 'Export XLSX',
  exportando: 'Generating…',
  sinPermiso: 'Your account may not export stakeholders.',
  historial: 'Export log',
  historialAyuda: 'The latest exports of the organization (or of the chosen project), with who made them.',
  historialVacio: 'No exports have been recorded yet.',
  columnas: { fecha: 'Date', quien: 'Exported by', objeto: 'Object', nivel: 'Level', filas: 'Rows' },
  otrasLlegan: 'The grievance and risk registers arrive in F4 and the deliverables in F8.',
  matriz: {
    titulo: 'Commitment matrix',
    ayuda:
      'XLSX with the commitment matrix: in INTERNO, the «Matriz» and «Entregas» sheets; in EXTERNO, without owner or restricted data and with requesters by GI- code; in PUBLICO, only counts by status and theme and by resource type. Never the requesters’ identity document.',
    niveles: {
      INTERNO: 'Internal: the «Matriz» and «Entregas» sheets with every field your account reads',
      EXTERNO: 'External: without owner or restricted data, with requesters by GI- code',
      PUBLICO: 'Public: only counts by status and theme and by resource type'
    },
    externoAyuda:
      'Each requester is cited by a GI- code with 12 hexadecimal digits of the stakeholder: a pseudonym that is the same in every output. The owner, the beneficiaries detail, who gave conformity and the recipients are left out, and the place of each delivery is generalized to the commitment’s locality.',
    publicoAyuda:
      'The «Por estado y tema» and «Por tipo de recurso» sheets carry every combination. Every count under 5, zero included, shows as “reservado”, and so does the cell that would reveal it by subtraction.',
    checklist:
      'I checked the matrix can leave with this level: no personal data in the texts of commitments and deliveries, and no commitments that must not be disclosed',
    campana: 'Exploration campaign',
    todas: 'All campaigns',
    campanasCargando: 'Reading the campaigns…',
    estados: 'Statuses',
    estadosAyuda: 'With none checked, every status.',
    estadosCargando: 'Reading the statuses…',
    plazo: 'The deadline situation (AL DIA, POR VENCER, VENCIDO) is only printed for pending commitments: approved, in progress or blocked.',
    exportar: 'Export the matrix',
    errores: {
      INVALID_FILTER: 'One of the chosen statuses is no longer a commitment status: reload the page.',
      TOO_MANY_RECORDS:
        'The matrix does not fit in one file: pick a project, a campaign or fewer statuses. If the filters are already narrow, a commitment may have more than 200 requesters or a delivery more than 200 evidences, and filtering does not solve that: tell the administration.'
    }
  }
}
