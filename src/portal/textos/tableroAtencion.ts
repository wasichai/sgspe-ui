// S34 · el tablero de quejas, consultas y solicitudes (F4)
export const ES_TABLERO_ATENCION = {
  titulo: 'Tablero de quejas, consultas y solicitudes',
  zonas: {
    flujo: 'Flujo por tipo',
    absueltas: 'Absueltas',
    tiempos: 'Tiempo de atención',
    desgloses: 'Cómo se reparten',
    tendencia: 'Recibidas frente a cerradas por mes'
  },
  flujo: 'Flujo de quejas, consultas y solicitudes por tipo',
  indicador: 'Indicador',
  total: 'Total',
  tiempos: 'Tiempo de atención por tipo',
  columnasDeTiempos: {
    tipo: 'Tipo',
    mediana: 'Mediana de días',
    atendidas: 'Atendidas',
    aTiempo: 'Dentro de plazo'
  },
  sinPlazo: 'Sin plazo',
  dimensiones: {
    severity: 'Por severidad',
    category: 'Por categoría',
    territory: 'Por territorio',
    stakeholder: 'Por grupo de interés',
    channel: 'Por canal'
  },
  tendencia: {
    periodo: 'Mes',
    recibidas: 'Recibidas',
    cerradas: 'Cerradas'
  },
  unaVez: 'Cada planteamiento cuenta una vez, aunque se haya reclasificado.',
  sinPersona: 'La persona que plantea nunca aparece en el tablero.'
}

export const EN_TABLERO_ATENCION: typeof ES_TABLERO_ATENCION = {
  titulo: 'Grievances, inquiries and requests dashboard',
  zonas: {
    flujo: 'Flow by type',
    absueltas: 'Answered',
    tiempos: 'Attention time',
    desgloses: 'How they spread',
    tendencia: 'Received versus closed by month'
  },
  flujo: 'Flow of grievances, inquiries and requests by type',
  indicador: 'Indicator',
  total: 'Total',
  tiempos: 'Attention time by type',
  columnasDeTiempos: {
    tipo: 'Type',
    mediana: 'Median days',
    atendidas: 'Attended',
    aTiempo: 'Within deadline'
  },
  sinPlazo: 'No deadline',
  dimensiones: {
    severity: 'By severity',
    category: 'By category',
    territory: 'By territory',
    stakeholder: 'By stakeholder',
    channel: 'By channel'
  },
  tendencia: {
    periodo: 'Month',
    recibidas: 'Received',
    cerradas: 'Closed'
  },
  unaVez: 'Each case counts once, even when it was reclassified.',
  sinPersona: 'The person who raises it never appears on the dashboard.'
}
