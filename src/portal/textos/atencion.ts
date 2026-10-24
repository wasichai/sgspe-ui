// S35 · la lista unificada de quejas, consultas y solicitudes (F4)
export const ES_ATENCION = {
  titulo: 'Quejas, consultas y solicitudes',
  registrar: 'Registrar QCS',
  reporte: 'Reporte unificado',
  conteo_one: '{{count}} QCS',
  conteo_other: '{{count}} QCS',
  filtroBusqueda: 'Contiene «{{texto}}»',
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
    absueltas: 'Respondidas',
    abiertasDetalle: 'siguen en atención',
    vencidasDetalle: 'abiertas con el plazo vencido',
    porVencerDetalle: 'abiertas que vencen pronto',
    respondidasDetalle: '{{n}} de {{total}} recibidas en el periodo tienen respuesta',
    respondidasSinBase: 'de las recibidas en el periodo tienen respuesta'
  },
  grupos: {
    vencidas: 'Vencidas',
    porVencer: 'Por vencer',
    alDia: 'Al día o sin plazo'
  },
  tabla: 'Quejas, consultas y solicitudes: {{grupo}}',
  columnas: {
    tipo: 'Tipo',
    codigo: 'QCS',
    proyecto: 'Proyecto',
    canal: 'Canal',
    categoria: 'Categoría',
    severidad: 'Severidad',
    estado: 'Estado',
    plazo: 'Plazo que corre',
    responsable: 'Responsable',
    planteaQuien: 'Quien la plantea'
  },
  anonima: 'Anónima',
  identificada: 'Dio su nombre',
  sinPlazo: 'Sin plazo',
  plazoPorCalcular: 'Por calcular',
  vacio: 'No hay quejas, consultas ni solicitudes en esta vista.',
  sinLectura: 'Su cuenta no lee ningún tipo de queja, consulta o solicitud.'
}

export const EN_ATENCION: typeof ES_ATENCION = {
  titulo: 'Grievances, inquiries and requests',
  registrar: 'Record a grievance, inquiry or request',
  reporte: 'Unified report',
  conteo_one: '{{count}} grievance, inquiry or request',
  conteo_other: '{{count}} grievances, inquiries and requests',
  filtroBusqueda: 'Contains “{{texto}}”',
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
    absueltas: 'Answered',
    abiertasDetalle: 'still being handled',
    vencidasDetalle: 'open with the deadline past',
    porVencerDetalle: 'open and due soon',
    respondidasDetalle: '{{n}} of {{total}} received in the period have an answer',
    respondidasSinBase: 'of those received in the period have an answer'
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
  anonima: 'Anonymous',
  identificada: 'Gave their name',
  sinPlazo: 'No deadline',
  plazoPorCalcular: 'Not computed yet',
  vacio: 'There are no grievances, inquiries or requests in this view.',
  sinLectura: 'Your account reads no type of grievance, inquiry or request.'
}
