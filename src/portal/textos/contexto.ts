// el hilo de contexto de ux-architecture.md §7.1 y §8: selector de proyecto, barra de contexto, chip de territorio, rastro
// y sub-navegación de Project 360
export const ES_CONTEXTO = {
  proyecto: 'Proyecto',
  conteos: {
    total_one: '{{count}} en total',
    total_other: '{{count}} en total',
    vencidos_one: '{{count}} vencido',
    vencidos_other: '{{count}} vencidos'
  },
  masPestanas: 'Más secciones del proyecto',
  cambiarProyecto: 'Proyecto: {{proyecto}}. Cambiar de proyecto',
  todos: 'Todos mis proyectos',
  // con la acción de leer todos los proyectos (o ADMIN), el alcance global no es «mis» proyectos (plan 4.4b)
  todosLosProyectos: 'Todos los proyectos',
  buscarProyecto: 'Buscar un proyecto…',
  sinCoincidencias: 'Ningún proyecto coincide con la búsqueda.',
  sinProyectos: 'No tiene proyectos asignados. Pida una asignación al administrador de proyectos.',
  contexto: 'Contexto',
  estadoDelProyecto: 'Estado del proyecto:',
  territorio: 'Territorio: {{nombre}}',
  quitarTerritorio: 'Quitar el filtro de territorio',
  rastro: 'Recorrido',
  // el origen de una ficha abierta desde una lista (flujo F-C): volver a ella y pasar a la anterior o la siguiente
  origen: {
    volver: 'Volver a {{lista}}',
    volverConConteo: 'Volver a {{lista}} ({{n}})',
    enLaLista: 'Registros de {{lista}}',
    anterior: 'Anterior',
    siguiente: 'Siguiente'
  },
  soloLectura: 'No está asignado a este proyecto: puede leerlo, pero no cambiarlo.',
  irAProyectos: 'Ir a todos los proyectos',
  subnav: 'Secciones del proyecto',
  pestanas: {
    overview: 'Resumen',
    map: 'Mapa',
    stakeholders: 'Grupos de interés',
    engagements: 'Relacionamiento',
    commitments: 'Compromisos',
    agreements: 'Acuerdos',
    attention: 'Quejas, consultas y solicitudes',
    risks: 'Riesgos',
    programs: 'Programas sociales',
    documents: 'Documentos',
    tasks: 'Tareas',
    settings: 'Equipo y parámetros',
    reports: 'Reportes',
    'ai-review': 'Bandeja de IA'
  },
  tipos: {
    community: 'Comunidad',
    locality: 'Localidad',
    'admin-unit': 'Unidad administrativa',
    area: 'Área de influencia'
  },
  noAplica: 'El filtro de territorio no se aplica a esta lista.'
}

export const EN_CONTEXTO: typeof ES_CONTEXTO = {
  proyecto: 'Project',
  conteos: {
    total_one: '{{count}} in total',
    total_other: '{{count}} in total',
    vencidos_one: '{{count}} overdue',
    vencidos_other: '{{count}} overdue'
  },
  masPestanas: 'More project sections',
  cambiarProyecto: 'Project: {{proyecto}}. Change project',
  todos: 'All my projects',
  todosLosProyectos: 'All projects',
  buscarProyecto: 'Search for a project…',
  sinCoincidencias: 'No project matches the search.',
  sinProyectos: 'You have no assigned projects. Ask the project administrator for an assignment.',
  contexto: 'Context',
  estadoDelProyecto: 'Project status:',
  territorio: 'Territory: {{nombre}}',
  quitarTerritorio: 'Remove the territory filter',
  rastro: 'Trail',
  origen: {
    volver: 'Back to {{lista}}',
    volverConConteo: 'Back to {{lista}} ({{n}})',
    enLaLista: 'Records in {{lista}}',
    anterior: 'Previous',
    siguiente: 'Next'
  },
  soloLectura: 'You are not assigned to this project: you can read it, but not change it.',
  irAProyectos: 'Go to all projects',
  subnav: 'Project sections',
  pestanas: {
    overview: 'Overview',
    map: 'Map',
    stakeholders: 'Stakeholders',
    engagements: 'Engagement',
    commitments: 'Commitments',
    agreements: 'Agreements',
    attention: 'Grievances, inquiries and requests',
    risks: 'Risks',
    programs: 'Social programs',
    documents: 'Documents',
    tasks: 'Tasks',
    settings: 'Team and parameters',
    reports: 'Reports',
    'ai-review': 'AI tray'
  },
  tipos: {
    community: 'Community',
    locality: 'Locality',
    'admin-unit': 'Administrative unit',
    area: 'Area of influence'
  },
  noAplica: 'The territory filter does not apply to this list.'
}
