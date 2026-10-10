// el hilo de contexto de ux-architecture.md §7.1 y §8: selector de proyecto, barra de contexto, chip de territorio, rastro
// y sub-navegación de Project 360
export const ES_CONTEXTO = {
  proyecto: 'Proyecto',
  todos: 'Todos mis proyectos',
  // con la acción de leer todos los proyectos (o ADMIN), el alcance global no es «mis» proyectos (plan 4.4b)
  todosLosProyectos: 'Todos los proyectos',
  sinProyectos: 'No tiene proyectos asignados. Pida una asignación al administrador de proyectos.',
  contexto: 'Contexto',
  territorio: 'Territorio: {{nombre}}',
  quitarTerritorio: 'Quitar el filtro de territorio',
  rastro: 'Recorrido',
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
    documents: 'Documentos',
    tasks: 'Tareas',
    settings: 'Equipo y parámetros',
    reports: 'Reportes'
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
  todos: 'All my projects',
  todosLosProyectos: 'All projects',
  sinProyectos: 'You have no assigned projects. Ask the project administrator for an assignment.',
  contexto: 'Context',
  territorio: 'Territory: {{nombre}}',
  quitarTerritorio: 'Remove the territory filter',
  rastro: 'Trail',
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
    documents: 'Documents',
    tasks: 'Tasks',
    settings: 'Team and parameters',
    reports: 'Reports'
  },
  tipos: {
    community: 'Community',
    locality: 'Locality',
    'admin-unit': 'Administrative unit',
    area: 'Area of influence'
  },
  noAplica: 'The territory filter does not apply to this list.'
}
