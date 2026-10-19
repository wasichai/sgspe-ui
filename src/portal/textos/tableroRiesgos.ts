// S62 · el tablero de riesgos (dashboards.md §5.8, KPI-RSK-01 a KPI-RSK-05)
export const ES_TABLERO_RIESGOS = {
  titulo: 'Tablero de riesgos',
  // el nombre de cada zona si el servidor no devolvió su indicador (nunca su código)
  zonas: {
    matriz: 'Mapa de calor de riesgos',
    activos: 'Riesgos activos',
    territorio: 'Riesgos por territorio',
    semanas: 'Niveles de riesgo semana a semana',
    atrasadas: 'Medidas de mitigación atrasadas'
  },
  vigente: 'Vigente',
  residual: 'Residual',
  valoracion: 'Valoración',
  tablaMatriz: 'Riesgos por probabilidad e impacto ({{valoracion}})',
  probabilidad: 'Probabilidad',
  impacto: 'Impacto',
  sinEvaluar: 'Sin evaluar: {{n}} riesgos todavía no tienen revisión y no entran al mapa.',
  dimension: 'Ver por',
  dimensiones: { locality: 'Localidad', community: 'Comunidad', areaOfInfluence: 'Área de influencia', project: 'Proyecto' },
  tablaTerritorio: 'Riesgos por {{dimension}} y nivel',
  nombre: 'Nombre',
  total: 'Total',
  sinNivel: 'Sin nivel',
  niveles: { BAJO: 'Bajo', MEDIO: 'Medio', ALTO: 'Alto', CRITICO: 'Crítico' },
  tendencias: { AUMENTA: 'Aumenta', 'SE MANTIENE': 'Se mantiene', DISMINUYE: 'Disminuye' },
  semana: 'Semana del',
  sinFilas: 'No hay riesgos activos para estos filtros.',
  // el vacío de un desglose cuando otro sí tiene filas: los riesgos activos no tienen esa dimensión registrada
  sinDimension: {
    locality: 'Ningún riesgo activo de estos filtros tiene localidad registrada.',
    community: 'Ningún riesgo activo de estos filtros tiene comunidad registrada.',
    areaOfInfluence: 'Ningún riesgo activo de estos filtros está en un área de influencia registrada.',
    project: 'Ningún riesgo activo de estos filtros tiene proyecto.'
  },
  sinDesglose: 'El desglose por territorio no está disponible.',
  atrasadasPor: 'Medidas atrasadas por',
  atrasadasDimensiones: { overdue: 'Medida', risk: 'Riesgo', owner: 'Responsable' },
  tablaAtrasadas: 'Medidas atrasadas por {{dimension}}',
  cantidad: 'Cantidad'
}

export const EN_TABLERO_RIESGOS: typeof ES_TABLERO_RIESGOS = {
  titulo: 'Risks dashboard',
  zonas: {
    matriz: 'Risk heat map',
    activos: 'Active risks',
    territorio: 'Risks by territory',
    semanas: 'Risk levels week by week',
    atrasadas: 'Overdue mitigation measures'
  },
  vigente: 'Current',
  residual: 'Residual',
  valoracion: 'Rating',
  tablaMatriz: 'Risks by probability and impact ({{valoracion}})',
  probabilidad: 'Probability',
  impacto: 'Impact',
  sinEvaluar: 'Not assessed: {{n}} risks have no review yet and are not on the map.',
  dimension: 'View by',
  dimensiones: { locality: 'Locality', community: 'Community', areaOfInfluence: 'Area of influence', project: 'Project' },
  tablaTerritorio: 'Risks by {{dimension}} and level',
  nombre: 'Name',
  total: 'Total',
  sinNivel: 'No level',
  niveles: { BAJO: 'Low', MEDIO: 'Medium', ALTO: 'High', CRITICO: 'Critical' },
  tendencias: { AUMENTA: 'Rising', 'SE MANTIENE': 'Stable', DISMINUYE: 'Falling' },
  semana: 'Week of',
  sinFilas: 'There are no active risks for these filters.',
  sinDimension: {
    locality: 'No active risk for these filters has a recorded locality.',
    community: 'No active risk for these filters has a recorded community.',
    areaOfInfluence: 'No active risk for these filters is in a recorded area of influence.',
    project: 'No active risk for these filters has a project.'
  },
  sinDesglose: 'The breakdown by territory is not available.',
  atrasadasPor: 'Overdue measures by',
  atrasadasDimensiones: { overdue: 'Measure', risk: 'Risk', owner: 'Owner' },
  tablaAtrasadas: 'Overdue measures by {{dimension}}',
  cantidad: 'Count'
}
