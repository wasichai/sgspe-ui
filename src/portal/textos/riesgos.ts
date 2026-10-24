// S38 y S39 · el registro y la matriz de riesgos (F4), con el nivel de un riesgo que usan también la ficha y el tablero
export const ES_RIESGOS = {
  titulo: 'Riesgos',
  identificar: 'Identificar riesgo',
  conteo_one: '{{count}} riesgo',
  conteo_other: '{{count}} riesgos',
  mas: {
    warnings: 'Alerta temprana',
    incidents: 'Incidentes',
    mentions: 'Menciones en medios',
    signals: 'Señales de alerta',
    impacts: 'Impactos potenciales',
    rules: 'Reglas de alerta'
  },
  filtroAltos: 'Nivel alto o crítico',
  vacio: 'No hay riesgos en esta vista.',
  sinRiesgos: 'Aún no hay riesgos registrados.',
  sinRiesgosAyuda: 'Identifique el primero con «Identificar riesgo»: queda en el registro y en la matriz de calor.',
  tabla: 'Riesgos',
  nivel: 'Nivel de riesgo',
  nivelResidual: 'Nivel residual',
  sinEvaluar: 'Sin evaluar',
  vistas: { registro: 'Registro y matriz', revision: 'Revisión pendiente', mios: 'Mis riesgos', cerrados: 'Cerrados' },
  columnas: {
    riesgo: 'Riesgo',
    proyecto: 'Proyecto',
    categoria: 'Categoría',
    puntaje: 'P × I',
    nivel: 'Nivel',
    estado: 'Estado',
    revision: 'Revisión',
    responsable: 'Responsable'
  },
  mapa: {
    titulo: 'Mapa de calor',
    leyenda: 'Riesgos por probabilidad (filas) e impacto (columnas), con el nivel de cada celda',
    pi: 'P \\ I',
    probabilidad: 'P{{n}}',
    impacto: 'I{{n}}',
    celda_one: 'Probabilidad {{p}}, impacto {{i}}: {{count}} riesgo, nivel {{nivel}}',
    celda_other: 'Probabilidad {{p}}, impacto {{i}}: {{count}} riesgos, nivel {{nivel}}',
    sinEvaluar: 'Sin evaluar (fuera del mapa): {{n}}',
    quitar: 'Quitar filtro de celda'
  },
  alta: {
    descripcion: 'El riesgo nace identificado; su nivel sale de la primera revisión.',
    desdeIncidente: 'El riesgo se registra con el incidente de origen.',
    motivoAyuda: 'Todo cambio de un riesgo queda con su motivo en la historia.',
    cadencia: 'Cada cuántos días se revisa: de 1 a 365. Vacío, vale la cadencia del proyecto (7 días por defecto).'
  }
}

export const EN_RIESGOS: typeof ES_RIESGOS = {
  titulo: 'Risks',
  identificar: 'Identify risk',
  conteo_one: '{{count}} risk',
  conteo_other: '{{count}} risks',
  mas: {
    warnings: 'Early warning',
    incidents: 'Incidents',
    mentions: 'Media mentions',
    signals: 'Warning signals',
    impacts: 'Potential impacts',
    rules: 'Warning rules'
  },
  filtroAltos: 'High or critical level',
  vacio: 'There are no risks in this view.',
  sinRiesgos: 'No risks recorded yet.',
  sinRiesgosAyuda: 'Identify the first one with “Identify risk”: it goes to the register and the heat map.',
  tabla: 'Risks',
  nivel: 'Risk level',
  nivelResidual: 'Residual level',
  sinEvaluar: 'Not assessed',
  vistas: { registro: 'Register and matrix', revision: 'Review due', mios: 'My risks', cerrados: 'Closed' },
  columnas: {
    riesgo: 'Risk',
    proyecto: 'Project',
    categoria: 'Category',
    puntaje: 'P × I',
    nivel: 'Level',
    estado: 'State',
    revision: 'Review',
    responsable: 'Owner'
  },
  mapa: {
    titulo: 'Heat map',
    leyenda: 'Risks by probability (rows) and impact (columns), with the level of each cell',
    pi: 'P \\ I',
    probabilidad: 'P{{n}}',
    impacto: 'I{{n}}',
    celda_one: 'Probability {{p}}, impact {{i}}: {{count}} risk, level {{nivel}}',
    celda_other: 'Probability {{p}}, impact {{i}}: {{count}} risks, level {{nivel}}',
    sinEvaluar: 'Not assessed (outside the map): {{n}}',
    quitar: 'Clear cell filter'
  },
  alta: {
    descripcion: 'The risk starts as identified; its level comes from the first review.',
    desdeIncidente: 'The risk is recorded with its origin incident.',
    motivoAyuda: 'Every change to a risk keeps its reason in the history.',
    cadencia: 'How many days between reviews: 1 to 365. Empty, the project cadence applies (7 days by default).'
  }
}
