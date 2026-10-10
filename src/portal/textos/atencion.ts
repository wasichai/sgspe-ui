// S35 · la lista unificada de quejas, consultas y solicitudes (F4)
export const ES_ATENCION = {
  titulo: 'Quejas, consultas y solicitudes',
  registrar: 'Registrar QCS',
  tablero: 'Tablero',
  reporte: 'Reporte unificado',
  eligeProyecto: 'Para registrar una QCS, elija primero un proyecto.',
  vistas: {
    atencion: 'Atención',
    quejas: 'Quejas',
    consultas: 'Consultas',
    solicitudes: 'Solicitudes',
    mias: 'Mis QCS',
    todas: 'Todas'
  },
  buscar: 'Buscar por código o descripción',
  canal: 'Canal',
  categoria: 'Categoría',
  severidad: 'Severidad',
  indicadores: 'Indicadores',
  tarjetas: {
    abiertas: 'Abiertas',
    vencidas: 'Vencidas',
    porVencer: 'Por vencer',
    absueltas: 'Absueltas'
  },
  grupos: {
    vencidas: 'Vencidas',
    porVencer: 'Por vencer',
    alDia: 'Al día o sin plazo'
  },
  tabla: 'Quejas, consultas y solicitudes: {{grupo}}',
  columnas: {
    tipo: 'Tipo',
    codigo: 'Código',
    proyecto: 'Proyecto',
    canal: 'Canal',
    categoria: 'Categoría',
    severidad: 'Severidad',
    estado: 'Estado',
    plazo: 'Plazo que corre',
    responsable: 'Responsable',
    planteaQuien: 'Quién la plantea'
  },
  anonima: 'anónima',
  identificada: 'identificada',
  sinPlazo: 'Sin plazo',
  plazoPorCalcular: 'Por calcular',
  vacio: 'No hay quejas, consultas ni solicitudes en esta vista.',
  truncado: 'Se muestran las primeras {{n}} de cada tipo: acote con el proyecto o los filtros.',
  sinLectura: 'Su cuenta no lee ningún tipo de queja, consulta o solicitud.'
}

export const EN_ATENCION: typeof ES_ATENCION = {
  titulo: 'Grievances, inquiries and requests',
  registrar: 'Record a grievance, inquiry or request',
  tablero: 'Dashboard',
  reporte: 'Unified report',
  eligeProyecto: 'To record one, pick a project first.',
  vistas: {
    atencion: 'Attention',
    quejas: 'Grievances',
    consultas: 'Inquiries',
    solicitudes: 'Requests',
    mias: 'Mine',
    todas: 'All'
  },
  buscar: 'Search by code or description',
  canal: 'Channel',
  categoria: 'Category',
  severidad: 'Severity',
  indicadores: 'Indicators',
  tarjetas: {
    abiertas: 'Open',
    vencidas: 'Overdue',
    porVencer: 'Due soon',
    absueltas: 'Answered'
  },
  grupos: {
    vencidas: 'Overdue',
    porVencer: 'Due soon',
    alDia: 'On time or without deadline'
  },
  tabla: 'Grievances, inquiries and requests: {{grupo}}',
  columnas: {
    tipo: 'Type',
    codigo: 'Code',
    proyecto: 'Project',
    canal: 'Channel',
    categoria: 'Category',
    severidad: 'Severity',
    estado: 'State',
    plazo: 'Running deadline',
    responsable: 'Owner',
    planteaQuien: 'Raised by'
  },
  anonima: 'anonymous',
  identificada: 'identified',
  sinPlazo: 'No deadline',
  plazoPorCalcular: 'Not computed yet',
  vacio: 'There are no grievances, inquiries or requests in this view.',
  truncado: 'The first {{n}} of each type are shown: narrow with the project or the filters.',
  sinLectura: 'Your account reads no type of grievance, inquiry or request.'
}
