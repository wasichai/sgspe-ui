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
    absueltas: 'Absueltas en 90 días',
    abiertasDetalle: 'siguen en atención',
    vencidasDetalle: 'abiertas con el plazo vencido',
    porVencerDetalle: 'abiertas que vencen pronto',
    absueltasDetalle: '{{porcentaje}} % de las {{total}} recibidas en los últimos 90 días tienen respuesta',
    absueltasSinBase: 'recibidas en los últimos 90 días con respuesta'
  },
  grupos: {
    vencidas: 'Vencidas',
    porVencer: 'Por vencer',
    alDia: 'Al día o sin plazo'
  },
  tabla: 'Quejas, consultas y solicitudes',
  tablaDelGrupo: 'Quejas, consultas y solicitudes: {{grupo}}',
  // S11: la fila abierta con el ciclo de vida de la QCS
  fila: {
    columna: 'Ciclo de vida',
    abrir: 'Ver el ciclo de vida de {{codigo}}',
    cerrar: 'Ocultar el ciclo de vida de {{codigo}}',
    siguienteYResponsable: 'Siguiente acción · Responsable',
    sinSiguiente: 'Sin acción pendiente',
    abrirFicha: 'Abrir ficha'
  },
  notaDePlazos: 'El acuse de una queja se cuenta en días hábiles con el calendario de feriados de Perú; la respuesta y la resolución, en días calendario.',
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
    absueltas: 'Answered in 90 days',
    abiertasDetalle: 'still being handled',
    vencidasDetalle: 'open with the deadline past',
    porVencerDetalle: 'open and due soon',
    absueltasDetalle: '{{porcentaje}} % of the {{total}} received in the last 90 days have an answer',
    absueltasSinBase: 'received in the last 90 days with an answer'
  },
  grupos: {
    vencidas: 'Overdue',
    porVencer: 'Due soon',
    alDia: 'On time or without deadline'
  },
  tabla: 'Grievances, inquiries and requests',
  tablaDelGrupo: 'Grievances, inquiries and requests: {{grupo}}',
  fila: {
    columna: 'Life cycle',
    abrir: 'Show the life cycle of {{codigo}}',
    cerrar: 'Hide the life cycle of {{codigo}}',
    siguienteYResponsable: 'Next action · Owner',
    sinSiguiente: 'No pending action',
    abrirFicha: 'Open record'
  },
  notaDePlazos: 'A grievance acknowledgement counts business days with the Peruvian holiday calendar; answers and resolutions count calendar days.',
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
  sinPlazo: 'No deadline',
  plazoPorCalcular: 'Not computed yet',
  vacio: 'There are no grievances, inquiries or requests in this view.',
  sinLectura: 'Your account reads no type of grievance, inquiry or request.'
}
