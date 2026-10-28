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
    leToca: 'Le toca a usted.',
    noAsignado: 'Usted no está asignado a este proyecto: la da quien lo esté.',
    deOtraPersona: 'El siguiente paso lo da otra persona.',
    pide_one: 'Al darla se le pedirá {{campos}}.',
    pide_other: 'Al darla se le pedirán {{campos}}.',
    responsable: 'Responsable',
    sinResponsable: 'Sin responsable',
    vencimiento: 'Vencimiento',
    sinVencimiento: 'Sin fecha límite',
    verCamino: 'Ver el camino'
  },
  // cerrar un cajón con algo escrito (Drawer, tercera pasada de UX)
  cajon: {
    descartarTitulo: '¿Descartar lo escrito?',
    descartarTexto: 'Lo que escribió en este panel todavía no se guardó y se perderá si lo cierra.',
    descartar: 'Descartar',
    seguir: 'Seguir editando'
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
    salirTextoConBorrador: 'Lo que escribió queda como borrador en este navegador: lo recupera al volver a esta alta.',
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
    leToca: 'It is your turn.',
    noAsignado: 'You are not assigned to this project: someone who is takes it.',
    deOtraPersona: 'Someone else takes the next step.',
    pide_one: 'It will ask you for {{campos}}.',
    pide_other: 'It will ask you for {{campos}}.',
    responsable: 'Owner',
    sinResponsable: 'No owner',
    vencimiento: 'Due date',
    sinVencimiento: 'No due date',
    verCamino: 'Show the path'
  },
  cajon: {
    descartarTitulo: 'Discard what you wrote?',
    descartarTexto: 'What you wrote in this panel has not been saved yet and will be lost if you close it.',
    descartar: 'Discard',
    seguir: 'Keep editing'
  },
  flujo: {
    titulo: 'Path of steps',
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
    salirTextoConBorrador: 'What you wrote stays as a draft in this browser: you get it back when you return to this form.',
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
