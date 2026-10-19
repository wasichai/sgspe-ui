// las piezas comunes de página y de ficha de la revisión de UX (etapa 0): el fallo de una pantalla, el título del documento,
// las migas, el botón de crear, el panel de decisión, el camino del flujo y el panel de trazabilidad
export const ES_PAGINAS = {
  fallo: {
    titulo: 'Esta pantalla no se pudo mostrar',
    texto: 'Lo demás del portal sigue funcionando. Vuelva al inicio o recargue la página; si se repite, avise a soporte.',
    volver: 'Volver al inicio',
    recargar: 'Recargar la página'
  },
  migas: 'Ubicación',
  mas: 'Más acciones',
  crear: {
    titulo: '¿En qué proyecto?',
    texto: 'Elija el proyecto donde se registrará.',
    proyecto: 'Proyecto',
    elegir: 'Elija un proyecto',
    continuar: 'Continuar',
    cancelar: 'Cancelar',
    sinProyectos: 'Su cuenta no tiene un proyecto vigente donde registrar.'
  },
  decision: {
    titulo: 'Situación',
    estado: 'Estado actual',
    desde: 'Desde',
    por: 'Por',
    siguiente: 'Siguiente acción',
    sinSiguiente: 'Nada pendiente',
    responsable: 'Responsable',
    sinResponsable: 'Sin responsable',
    vencimiento: 'Vencimiento',
    sinVencimiento: 'Sin fecha límite'
  },
  flujo: {
    titulo: 'Camino del flujo',
    actual: 'Estado actual',
    hecho: 'Paso cumplido',
    pendiente: 'Paso pendiente',
    terminales: 'Otros cierres'
  },
  crearRelacionado: 'Crear relacionado',
  vistasDelModulo: { titulo: 'Vistas del módulo', lista: 'Lista', tablero: 'Tablero' },
  filtroDeGrupo: 'Grupo de interés: {{nombre}}',
  vistaPrevia: { titulo: 'Vista previa', abrirFicha: 'Abrir ficha', abrir: 'Vista previa de {{nombre}}' },
  relacionados: { compromiso: 'Registrar compromiso', qcs: 'Registrar queja, consulta o solicitud' },
  formulario: {
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    cancelar: 'Cancelar',
    guardarYSalir: 'Guardar y salir',
    salirTitulo: '¿Salir sin terminar?',
    salirTexto: 'Lo que escribió en este formulario se perderá si sale ahora.',
    salir: 'Salir',
    quedarse: 'Seguir aquí'
  },
  trazabilidad: {
    titulo: 'Trazabilidad',
    deDondeViene: 'De dónde viene',
    queGenero: 'Qué generó',
    loSustenta: 'Lo sustenta',
    nada: 'Sin registros'
  }
}

export const EN_PAGINAS: typeof ES_PAGINAS = {
  fallo: {
    titulo: 'This screen could not be shown',
    texto: 'The rest of the portal still works. Go back home or reload the page; if it happens again, contact support.',
    volver: 'Back to home',
    recargar: 'Reload the page'
  },
  migas: 'Location',
  mas: 'More actions',
  crear: {
    titulo: 'In which project?',
    texto: 'Choose the project where it will be recorded.',
    proyecto: 'Project',
    elegir: 'Choose a project',
    continuar: 'Continue',
    cancelar: 'Cancel',
    sinProyectos: 'Your account has no current project to record in.'
  },
  decision: {
    titulo: 'Status',
    estado: 'Current status',
    desde: 'Since',
    por: 'By',
    siguiente: 'Next action',
    sinSiguiente: 'Nothing pending',
    responsable: 'Owner',
    sinResponsable: 'No owner',
    vencimiento: 'Due date',
    sinVencimiento: 'No due date'
  },
  flujo: {
    titulo: 'Workflow path',
    actual: 'Current status',
    hecho: 'Step done',
    pendiente: 'Pending step',
    terminales: 'Other endings'
  },
  crearRelacionado: 'Create related',
  vistasDelModulo: { titulo: 'Module views', lista: 'List', tablero: 'Dashboard' },
  filtroDeGrupo: 'Stakeholder: {{nombre}}',
  vistaPrevia: { titulo: 'Preview', abrirFicha: 'Open record', abrir: 'Preview of {{nombre}}' },
  relacionados: { compromiso: 'Record a commitment', qcs: 'Record a grievance, inquiry or request' },
  formulario: {
    anterior: 'Previous',
    siguiente: 'Next',
    cancelar: 'Cancel',
    guardarYSalir: 'Save and exit',
    salirTitulo: 'Leave without finishing?',
    salirTexto: 'What you wrote in this form will be lost if you leave now.',
    salir: 'Leave',
    quedarse: 'Stay here'
  },
  trazabilidad: {
    titulo: 'Traceability',
    deDondeViene: 'Where it comes from',
    queGenero: 'What it produced',
    loSustenta: 'What supports it',
    nada: 'No records'
  }
}
