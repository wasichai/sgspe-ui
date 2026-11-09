// S38 y S39 · el registro y la matriz de riesgos (F4), con el nivel de un riesgo que usan también la ficha y el tablero
export const ES_RIESGOS = {
  titulo: 'Riesgos',
  // S10: en un proyecto, el registro trae también su alerta temprana
  tituloConAlertas: 'Riesgos y alerta temprana',
  identificar: 'Identificar riesgo',
  conteo_one: '{{count}} riesgo',
  conteo_other: '{{count}} riesgos',
  criticos_one: '{{count}} crítico',
  criticos_other: '{{count}} críticos',
  alertasActivas_one: '{{count}} alerta activa',
  alertasActivas_other: '{{count}} alertas activas',
  verReglas: 'Ver reglas de alerta',
  // las pestañas de las páginas de Riesgos (PaginasDeRiesgos)
  paginas: {
    registro: 'Registro y matriz',
    warnings: 'Alerta temprana',
    incidents: 'Incidentes',
    signals: 'Señales de alerta',
    mentions: 'Menciones en medios',
    impacts: 'Impactos potenciales',
    tablero: 'Tablero'
  },
  // S10: la alerta por triar sobre la matriz y la alerta temprana a su lado
  porTriar: {
    titulo: 'Alerta por triar: «{{titulo}}»',
    otras_one: 'Hay {{count}} alerta más por triar.',
    otras_other: 'Hay {{count}} alertas más por triar.',
    severidad: 'Severidad {{severidad}}.',
    regla: 'Se activó por una regla de alerta.',
    aMano: 'Se registró a mano.',
    riesgo: 'Está relacionada con {{riesgo}}.',
    triar: 'Triar alerta'
  },
  alertas: {
    titulo: 'Alerta temprana',
    activas_one: '{{count}} activa',
    activas_other: '{{count}} activas',
    todas: 'Todas las alertas',
    vacio: 'No hay alertas activas en el proyecto.',
    origenRegla: 'Origen: regla de alerta',
    origenAMano: 'Origen: registrada a mano',
    triar: 'Triar',
    ver: 'Ver',
    triarAlerta: 'Triar la alerta {{titulo}}',
    verAlerta: 'Ver la alerta {{titulo}}',
    nota: 'Las alertas no cambian el nivel del riesgo por sí solas: una persona confirma o descarta en el triaje.'
  },
  filtroAltos: 'Nivel alto o crítico',
  buscar: 'Buscar por código o título',
  filtroCelda: 'Probabilidad {{p}} × impacto {{i}}',
  vacio: 'No hay riesgos en esta vista.',
  sinRiesgos: 'Aún no hay riesgos registrados.',
  sinRiesgosAyuda: 'Identifique el primero con «Identificar riesgo»: queda en el registro y en la matriz de calor.',
  tabla: 'Riesgos',
  nivel: 'Nivel de riesgo',
  nivelResidual: 'Nivel residual',
  sinEvaluar: 'Sin evaluar',
  vistas: { registro: 'Vigentes', revision: 'Revisión pendiente', mios: 'Mis riesgos', cerrados: 'Cerrados' },
  columnas: {
    riesgo: 'Riesgo · categoría',
    proyecto: 'Proyecto',
    categoria: 'Categoría',
    puntaje: 'P × I',
    nivel: 'Nivel y tendencia',
    estado: 'Estado',
    revision: 'Revisión',
    responsable: 'Responsable'
  },
  // la tendencia frente a la revisión anterior (trend), con su flecha
  tendencia: 'Tendencia',
  notaSinPuntaje: '«—» en P × I: el riesgo todavía no tiene una revisión con probabilidad e impacto.',
  mapa: {
    titulo: 'Matriz probabilidad × impacto',
    leyenda: 'Riesgos por probabilidad (filas) e impacto (columnas), con el nivel de cada celda',
    ejeProbabilidad: 'Probabilidad',
    ejeImpacto: 'Impacto',
    leyendaDeNiveles: 'Niveles por puntaje P × I',
    celda_one: 'Probabilidad {{p}}, impacto {{i}}: {{count}} riesgo, nivel {{nivel}}',
    celda_other: 'Probabilidad {{p}}, impacto {{i}}: {{count}} riesgos, nivel {{nivel}}',
    celdaSinNivel_one: 'Probabilidad {{p}}, impacto {{i}}: {{count}} riesgo',
    celdaSinNivel_other: 'Probabilidad {{p}}, impacto {{i}}: {{count}} riesgos',
    celdaSinCifra: 'Probabilidad {{p}}, impacto {{i}}: sin cifra',
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
  tituloConAlertas: 'Risks and early warning',
  identificar: 'Identify risk',
  conteo_one: '{{count}} risk',
  conteo_other: '{{count}} risks',
  criticos_one: '{{count}} critical',
  criticos_other: '{{count}} critical',
  alertasActivas_one: '{{count}} active warning',
  alertasActivas_other: '{{count}} active warnings',
  verReglas: 'View warning rules',
  paginas: {
    registro: 'Register and matrix',
    warnings: 'Early warning',
    incidents: 'Incidents',
    signals: 'Warning signals',
    mentions: 'Media mentions',
    impacts: 'Potential impacts',
    tablero: 'Dashboard'
  },
  porTriar: {
    titulo: 'Warning to triage: “{{titulo}}”',
    otras_one: 'There is {{count}} more warning to triage.',
    otras_other: 'There are {{count}} more warnings to triage.',
    severidad: 'Severity {{severidad}}.',
    regla: 'It was raised by a warning rule.',
    aMano: 'It was recorded by hand.',
    riesgo: 'It is linked to {{riesgo}}.',
    triar: 'Triage warning'
  },
  alertas: {
    titulo: 'Early warning',
    activas_one: '{{count}} active',
    activas_other: '{{count}} active',
    todas: 'All warnings',
    vacio: 'There are no active warnings in the project.',
    origenRegla: 'Source: warning rule',
    origenAMano: 'Source: recorded by hand',
    triar: 'Triage',
    ver: 'View',
    triarAlerta: 'Triage the warning {{titulo}}',
    verAlerta: 'View the warning {{titulo}}',
    nota: 'Warnings do not change the risk level on their own: a person confirms or dismisses them in triage.'
  },
  filtroAltos: 'High or critical level',
  buscar: 'Search by code or title',
  filtroCelda: 'Probability {{p}} × impact {{i}}',
  vacio: 'There are no risks in this view.',
  sinRiesgos: 'No risks recorded yet.',
  sinRiesgosAyuda: 'Identify the first one with “Identify risk”: it goes to the register and the heat map.',
  tabla: 'Risks',
  nivel: 'Risk level',
  nivelResidual: 'Residual level',
  sinEvaluar: 'Not assessed',
  vistas: { registro: 'Current', revision: 'Review due', mios: 'My risks', cerrados: 'Closed' },
  columnas: {
    riesgo: 'Risk · category',
    proyecto: 'Project',
    categoria: 'Category',
    puntaje: 'P × I',
    nivel: 'Level and trend',
    estado: 'State',
    revision: 'Review',
    responsable: 'Owner'
  },
  tendencia: 'Trend',
  notaSinPuntaje: '“—” in P × I: the risk has no review with probability and impact yet.',
  mapa: {
    titulo: 'Probability × impact matrix',
    leyenda: 'Risks by probability (rows) and impact (columns), with the level of each cell',
    ejeProbabilidad: 'Probability',
    ejeImpacto: 'Impact',
    leyendaDeNiveles: 'Levels by P × I score',
    celda_one: 'Probability {{p}}, impact {{i}}: {{count}} risk, level {{nivel}}',
    celda_other: 'Probability {{p}}, impact {{i}}: {{count}} risks, level {{nivel}}',
    celdaSinNivel_one: 'Probability {{p}}, impact {{i}}: {{count}} risk',
    celdaSinNivel_other: 'Probability {{p}}, impact {{i}}: {{count}} risks',
    celdaSinCifra: 'Probability {{p}}, impact {{i}}: no figure',
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
