// lo común de los tableros de módulo de F2 (dashboards.md §3.1, §5 y §9)
export const ES_TABLEROS = {
  filtros: 'Filtros del tablero',
  desde: 'Desde',
  hasta: 'Hasta',
  ambito: 'Ámbito',
  actualizar: 'Actualizar',
  calculado: 'Calculado el {{fecha}}',
  otros: 'Otros',
  meta: 'Meta',
  valor: 'Valor',
  categoria: 'Categoría',
  periodo: 'Mes',
  noDisponible: '{{indicador}}: no disponible para su cuenta',
  unSoloProyecto: 'La matriz interés × poder usa los umbrales de un proyecto: elija uno en el selector.',
  verMatriz: 'Ver la matriz del proyecto',
  masIndicadores: 'Más indicadores',
  masIndicadoresAyuda: 'No tienen zona en este tablero: cada uno se consulta en su detalle.',
  volverAlTablero: 'Volver al tablero',
  serie: 'Evolución mensual',
  indicador: 'Indicador',
  sinDatos: 'Sin datos para estos filtros.',
  desgloses: {
    sex: 'Por sexo',
    scope: 'Por ámbito',
    institution: 'Por institución',
    influence_group: 'Por grupo de influencia',
    stakeholder_type: 'Por tipo de actor',
    stance: 'Por postura',
    direction: 'Por dirección del cambio',
    engagement_type: 'Por tipo de interacción',
    topic: 'Por tema',
    engagement: 'Por interacción'
  },
  direcciones: { MORE_FAVORABLE: 'Más favorable', LESS_FAVORABLE: 'Menos favorable' },
  fallo: 'No se pudo dibujar el gráfico. Los datos están en «Ver datos».',
  // ignoredFilters de un indicador (api.md §4.11, ruling P27): el filtro se pidió y esta cifra no lo aplica
  ignorados: 'Esta cifra no aplica el filtro de {{filtros}}',
  nombresDeFiltro: {
    project: 'proyecto',
    periodStart: 'inicio del periodo',
    periodEnd: 'fin del periodo',
    administrativeUnit: 'unidad administrativa',
    locality: 'localidad',
    community: 'comunidad',
    areaOfInfluence: 'área de influencia',
    explorationCampaign: 'campaña de exploración',
    scope: 'ámbito'
  },
  // 400 TOO_MANY_RECORDS: la lectura acotada no recorta la cifra, pide acotar (dashboards.md §6.2)
  acotar: {
    titulo: 'Acote los filtros',
    texto: 'Hay demasiados registros para calcular estas cifras sin recortarlas: elija un proyecto, un periodo más corto o un territorio.'
  }
}

export const EN_TABLEROS: typeof ES_TABLEROS = {
  filtros: 'Dashboard filters',
  desde: 'From',
  hasta: 'To',
  ambito: 'Scope',
  actualizar: 'Refresh',
  calculado: 'Calculated on {{fecha}}',
  otros: 'Others',
  meta: 'Target',
  valor: 'Value',
  categoria: 'Category',
  periodo: 'Month',
  noDisponible: '{{indicador}}: not available for your account',
  unSoloProyecto: 'The interest × power matrix uses the thresholds of one project: pick one in the selector.',
  verMatriz: 'Open the project matrix',
  masIndicadores: 'More indicators',
  masIndicadoresAyuda: 'They have no zone on this dashboard: each one is read in its detail.',
  volverAlTablero: 'Back to the dashboard',
  serie: 'Monthly trend',
  indicador: 'Indicator',
  sinDatos: 'No data for these filters.',
  desgloses: {
    sex: 'By sex',
    scope: 'By scope',
    institution: 'By institution',
    influence_group: 'By influence group',
    stakeholder_type: 'By actor type',
    stance: 'By stance',
    direction: 'By direction of change',
    engagement_type: 'By engagement type',
    topic: 'By topic',
    engagement: 'By engagement'
  },
  direcciones: { MORE_FAVORABLE: 'More favorable', LESS_FAVORABLE: 'Less favorable' },
  fallo: 'The chart could not be drawn. The data is under “View data”.',
  ignorados: 'This figure does not apply the {{filtros}} filter',
  nombresDeFiltro: {
    project: 'project',
    periodStart: 'period start',
    periodEnd: 'period end',
    administrativeUnit: 'administrative unit',
    locality: 'locality',
    community: 'community',
    areaOfInfluence: 'area of influence',
    explorationCampaign: 'exploration campaign',
    scope: 'scope'
  },
  acotar: {
    titulo: 'Narrow the filters',
    texto: 'There are too many records to calculate these figures without cutting them: pick a project, a shorter period or a territory.'
  }
}
