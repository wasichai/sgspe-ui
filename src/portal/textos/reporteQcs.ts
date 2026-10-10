// el reporte unificado de quejas, consultas y solicitudes (F4)
export const ES_REPORTE_QCS = {
  titulo: 'Reporte unificado de quejas, consultas y solicitudes',
  ayuda: 'Los conteos cuentan cada planteamiento una vez, como el último registro de su cadena de reclasificaciones.',
  verLista: 'Ir a la lista',
  filtros: {
    desde: 'Recibidas desde',
    hasta: 'Recibidas hasta',
    tipo: 'Tipo',
    todos: 'Todos',
    canal: 'Canal',
    categoria: 'Categoría'
  },
  totales: 'Totales',
  porTipo: 'Por tipo',
  conteos: {
    received: 'Recibidas',
    open: 'Abiertas',
    closed: 'Cerradas',
    rejected: 'Rechazadas',
    withdrawn: 'Desistidas',
    absolved: 'Absueltas',
    overdue: 'Vencidas'
  },
  tipo: 'Tipo',
  desgloses: {
    byState: 'Por estado',
    byChannel: 'Por canal',
    byCategory: 'Por categoría'
  },
  desgloseDe: '{{tipo}}: {{desglose}}',
  clave: 'Valor',
  cantidad: 'Cantidad',
  lista: 'Quejas, consultas y solicitudes del reporte',
  columnas: {
    tipo: 'Tipo',
    codigo: 'Código',
    estado: 'Estado',
    canal: 'Canal',
    categoria: 'Categoría',
    severidad: 'Severidad',
    recibida: 'Recibida',
    situacion: 'Situación de plazo',
    plazo: 'Plazo que corre',
    responsable: 'Responsable',
    respondida: 'Respondida',
    anonima: 'Anónima'
  },
  vacio: 'No hay quejas, consultas ni solicitudes con estos filtros.',
  acotar: 'Hay demasiados registros para este reporte: acote el periodo, el tipo o el proyecto.',
  filtroInvalido: 'Uno de los filtros no es válido: revíselos.'
}

export const EN_REPORTE_QCS: typeof ES_REPORTE_QCS = {
  titulo: 'Unified report of grievances, inquiries and requests',
  ayuda: 'Counts count each case once, as the last record of its reclassification chain.',
  verLista: 'Go to the list',
  filtros: {
    desde: 'Received from',
    hasta: 'Received until',
    tipo: 'Type',
    todos: 'All',
    canal: 'Channel',
    categoria: 'Category'
  },
  totales: 'Totals',
  porTipo: 'By type',
  conteos: {
    received: 'Received',
    open: 'Open',
    closed: 'Closed',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
    absolved: 'Answered',
    overdue: 'Overdue'
  },
  tipo: 'Type',
  desgloses: {
    byState: 'By state',
    byChannel: 'By channel',
    byCategory: 'By category'
  },
  desgloseDe: '{{tipo}}: {{desglose}}',
  clave: 'Value',
  cantidad: 'Count',
  lista: 'Grievances, inquiries and requests in the report',
  columnas: {
    tipo: 'Type',
    codigo: 'Code',
    estado: 'State',
    canal: 'Channel',
    categoria: 'Category',
    severidad: 'Severity',
    recibida: 'Received',
    situacion: 'Deadline situation',
    plazo: 'Running deadline',
    responsable: 'Owner',
    respondida: 'Answered',
    anonima: 'Anonymous'
  },
  vacio: 'There are no grievances, inquiries or requests with these filters.',
  acotar: 'There are too many records for this report: narrow the period, the type or the project.',
  filtroInvalido: 'One of the filters is not valid: check them.'
}
