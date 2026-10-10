// S60 · las reglas de alerta (F4): qué dispara una alerta, con el tipo de regla, su umbral y su ventana
export const ES_REGLAS_DE_ALERTA = {
  titulo: 'Reglas de alerta',
  tituloDeLaOrganizacion: 'Reglas de alerta de la organización',
  ayuda: 'Cada hora se revisan las reglas activas. Una regla del proyecto reemplaza, para ese proyecto, a la regla de la organización del mismo tipo.',
  tabla: 'Reglas de alerta',
  vacio: 'No hay reglas de alerta',
  truncado: 'Se muestran las primeras {{n}} reglas: hay más.',
  nueva: 'Nueva regla',
  editar: 'Editar',
  editarTitulo: 'Editar la regla',
  activar: 'Activar',
  desactivar: 'Desactivar',
  borrar: 'Borrar',
  borrando: 'Borrando…',
  borrarConfirmar: '¿Borrar la regla «{{nombre}}»? No se puede deshacer.',
  tieneAlertas: 'Esta regla ya creó alertas: desactívela en lugar de borrarla, para no perder el origen de sus alertas.',
  columnas: {
    nombre: 'Nombre',
    tipo: 'Tipo',
    umbral: 'Umbral',
    ventana: 'Días',
    severidad: 'Severidad',
    alcance: 'Alcance',
    estado: 'Estado',
    acciones: 'Acciones'
  },
  alcances: { proyecto: 'Proyecto', organizacion: 'Organización' },
  estados: { activa: 'Activa', desactivada: 'Desactivada' },
  campos: {
    nombre: 'Nombre',
    tipo: 'Tipo de regla',
    umbral: 'Umbral',
    umbralPuntaje: 'Puntaje mínimo (probabilidad por impacto)',
    ventana: 'Ventana y silencio (días)',
    silencio: 'Silencio tras una alerta (días)',
    ventanaAyuda: 'Vacío vale 7 días. Tras una alerta de esta regla, no se crea otra durante esos días.',
    severidad: 'Severidad de la alerta',
    activa: 'Regla activa',
    descripcion: 'Descripción'
  },
  errores: {
    nombre: 'Escriba el nombre de la regla.',
    tipo: 'Elija el tipo de regla.',
    umbral: 'Escriba un número entero desde 1.',
    umbralPuntaje: 'Escriba un número entero de 1 a 25.',
    ventana: 'Escriba un número entero de 1 a 365, o déjelo vacío.'
  },
  guardar: 'Guardar',
  guardando: 'Guardando…',
  // qué cuenta cada tipo de regla, qué es su umbral y qué ventana usa (workflows.md, «Tipos de regla de JOB-04»)
  tipos: {
    'CONTEO DE SEÑALES':
      'Cuenta las señales de alerta del proyecto recibidas en los últimos días de la ventana, de cualquier fuente. Dispara cuando son tantas como el umbral o más.',
    'CONTEO DE QCS':
      'Cuenta las quejas, consultas y solicitudes del proyecto recibidas en la ventana, cada planteamiento una vez y también las confidenciales; la alerta dice solo el número. Dispara cuando son tantas como el umbral o más.',
    'COMPROMISOS VENCIDOS':
      'Cuenta los compromisos del proyecto vencidos en el momento de la revisión (aprobados, en ejecución o bloqueados). No usa ventana: los días son solo el silencio tras una alerta.',
    'MENCIONES NEGATIVAS':
      'Cuenta las menciones en medios del proyecto con tono negativo publicadas en la ventana. Dispara cuando son tantas como el umbral o más.',
    INCIDENTES: 'Cuenta los incidentes del proyecto ocurridos en la ventana, de cualquier tipo y estado. Dispara cuando son tantos como el umbral o más.',
    'NIVEL DE RIESGO':
      'Revisa cada riesgo evaluado y abierto del proyecto: crea una alerta por riesgo cuyo puntaje vigente (probabilidad por impacto) llega al umbral, de 1 a 25. No usa ventana: los días son solo el silencio tras una alerta de ese riesgo.'
  }
}

export const EN_REGLAS_DE_ALERTA: typeof ES_REGLAS_DE_ALERTA = {
  titulo: 'Alert rules',
  tituloDeLaOrganizacion: 'Organization alert rules',
  ayuda: 'Active rules are reviewed every hour. A project rule replaces, for that project, the organization rule of the same kind.',
  tabla: 'Alert rules',
  vacio: 'There are no alert rules',
  truncado: 'The first {{n}} rules are shown: there are more.',
  nueva: 'New rule',
  editar: 'Edit',
  editarTitulo: 'Edit the rule',
  activar: 'Enable',
  desactivar: 'Disable',
  borrar: 'Delete',
  borrando: 'Deleting…',
  borrarConfirmar: 'Delete the rule «{{nombre}}»? It cannot be undone.',
  tieneAlertas: 'This rule already created alerts: disable it instead of deleting it, so its alerts keep their origin.',
  columnas: {
    nombre: 'Name',
    tipo: 'Kind',
    umbral: 'Threshold',
    ventana: 'Days',
    severidad: 'Severity',
    alcance: 'Scope',
    estado: 'State',
    acciones: 'Actions'
  },
  alcances: { proyecto: 'Project', organizacion: 'Organization' },
  estados: { activa: 'Enabled', desactivada: 'Disabled' },
  campos: {
    nombre: 'Name',
    tipo: 'Rule kind',
    umbral: 'Threshold',
    umbralPuntaje: 'Minimum score (probability times impact)',
    ventana: 'Window and silence (days)',
    silencio: 'Silence after an alert (days)',
    ventanaAyuda: 'Empty means 7 days. After an alert of this rule, no other one is created during those days.',
    severidad: 'Alert severity',
    activa: 'Rule enabled',
    descripcion: 'Description'
  },
  errores: {
    nombre: 'Type the rule name.',
    tipo: 'Pick the rule kind.',
    umbral: 'Type a whole number from 1.',
    umbralPuntaje: 'Type a whole number from 1 to 25.',
    ventana: 'Type a whole number from 1 to 365, or leave it empty.'
  },
  guardar: 'Save',
  guardando: 'Saving…',
  tipos: {
    'CONTEO DE SEÑALES':
      'Counts the project’s warning signals received in the last days of the window, from any source. It fires when they reach the threshold.',
    'CONTEO DE QCS':
      'Counts the project’s grievances, inquiries and requests received in the window, each case once and confidential ones too; the alert only says the number. It fires when they reach the threshold.',
    'COMPROMISOS VENCIDOS':
      'Counts the project’s overdue commitments at review time (approved, in progress or blocked). It uses no window: the days are only the silence after an alert.',
    'MENCIONES NEGATIVAS': 'Counts the project’s negative media mentions published in the window. It fires when they reach the threshold.',
    INCIDENTES: 'Counts the project’s incidents that happened in the window, of any type and state. It fires when they reach the threshold.',
    'NIVEL DE RIESGO':
      'Reviews each assessed open risk of the project: it creates one alert per risk whose current score (probability times impact) reaches the threshold, from 1 to 25. It uses no window: the days are only the silence after an alert of that risk.'
  }
}
