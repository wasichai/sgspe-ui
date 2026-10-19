// S40 · la ficha de riesgo (F4): su nivel, sus revisiones, medidas e impactos, y lo que lo alimenta
export const ES_FICHA_RIESGO = {
  volver: 'Volver a los riesgos',
  noExiste: 'Este riesgo no existe o no es de sus proyectos.',
  puntaje: '{{p}} × {{i}} = {{s}}',
  proxima: 'Próxima revisión: {{fecha}}',
  responsable: 'Responsable',
  sinResponsable: 'sin responsable',
  cadencia_one: 'se revisa cada día',
  cadencia_other: 'se revisa cada {{n}} días',
  cadenciaDelProyecto: 'se revisa con la cadencia del proyecto',
  cadenciaAyuda: 'Cada cuántos días se revisa: de 1 a 365. Vacío, vale la cadencia del proyecto.',
  sinResidual: 'Sin revisión residual',
  editar: 'Editar',
  motivoAyuda: 'Todo cambio de un riesgo queda con su motivo en la historia.',
  sinActividad: 'Sin actividad registrada.',
  pestanas: {
    resumen: 'Resumen',
    revisiones: 'Revisiones',
    medidas: 'Medidas',
    impactos: 'Impactos potenciales',
    evidencias: 'Evidencias',
    actividad: 'Actividad'
  },
  campos: {
    fuente: 'Fuente del riesgo',
    impacto: 'Tipo y naturaleza del impacto',
    tratamiento: 'Decisión de tratamiento',
    razon: 'Razón de la decisión',
    controles: 'Controles actuales',
    adecuados: 'Controles suficientes',
    monitoreo: 'Fuentes de monitoreo',
    residual: 'Valores residuales',
    cierre: 'Motivo de cierre'
  },
  revision: {
    nueva: 'Nueva revisión',
    descripcion: 'Una revisión no se edita ni se borra: si algo quedó mal, registre otra.',
    primera: 'Es la primera revisión: deja el riesgo evaluado. Una revisión no se edita ni se borra.',
    fecha: 'Fecha de la revisión',
    fechaFutura: 'Elija una fecha de hoy o anterior.',
    probabilidad: 'Probabilidad (1 a 5)',
    impacto: 'Impacto (1 a 5)',
    escala: 'Elija un valor de 1 a 5.',
    anticipo: 'Puntaje {{s}}: nivel {{nivel}} con los umbrales del proyecto. El servidor lo confirma al registrar.',
    residual: 'Es una revisión residual (después de las medidas)',
    residualAyuda: 'Mide el riesgo que queda con las medidas en marcha; no cambia los valores vigentes.',
    residualPrimera: 'La primera revisión no puede ser residual.',
    notas: 'Notas',
    registrar: 'Registrar revisión',
    registrando: 'Registrando…',
    sinResponsable: 'La primera revisión necesita un responsable del riesgo: asígnelo con «Editar» y vuelva a intentar.',
    hecha: 'Revisión registrada: el riesgo queda en nivel {{nivel}}.',
    hechaSinNivel: 'Revisión registrada.'
  },
  revisiones: {
    vacio: 'El riesgo todavía no tiene revisiones: registre la primera para que entre al mapa.',
    inmutables: 'Las revisiones no se editan: una se corrige con otra.',
    residual: 'Residual',
    vigente: 'Vigente',
    columnas: { fecha: 'Fecha', pi: 'P × I', nivel: 'Nivel', tendencia: 'Tendencia', tipo: 'Tipo', notas: 'Notas', quien: 'Revisó' }
  },
  medidas: {
    titulo: 'Medidas de mitigación',
    ayuda: 'Para decidir mitigar o volver a mitigar hace falta al menos una medida con responsable.',
    nueva: '+ Medida',
    vacio: 'Aún no hay medidas de mitigación.',
    completada: 'Completada',
    atrasada: 'Atrasada',
    pendiente: 'Pendiente',
    columnas: { medida: 'Medida', responsable: 'Responsable', prevista: 'Fecha prevista', avance: 'Avance' }
  },
  tipo: 'Riesgo',
  trazabilidad: {
    medidas_one: '{{count}} medida',
    medidas_other: '{{count}} medidas',
    atrasadas_one: '{{count}} atrasada',
    atrasadas_other: '{{count}} atrasadas',
    compromisos: 'Compromisos que lo atienden'
  },
  alimentan: {
    titulo: 'Lo alimentan',
    quejas: 'Quejas',
    alertas: 'Alertas',
    incidente: 'Incidente de origen',
    ninguno: 'Ninguno.'
  },
  contexto: {
    titulo: 'Contexto',
    locality: 'Localidad',
    community: 'Comunidad',
    local_conflict: 'Conflicto local',
    key_theme: 'Tema clave',
    grupos: 'Grupos de interés'
  }
}

export const EN_FICHA_RIESGO: typeof ES_FICHA_RIESGO = {
  volver: 'Back to risks',
  noExiste: 'This risk does not exist or is not in your projects.',
  puntaje: '{{p}} × {{i}} = {{s}}',
  proxima: 'Next review: {{fecha}}',
  responsable: 'Owner',
  sinResponsable: 'no owner',
  cadencia_one: 'reviewed every day',
  cadencia_other: 'reviewed every {{n}} days',
  cadenciaDelProyecto: 'reviewed with the project cadence',
  cadenciaAyuda: 'How many days between reviews: 1 to 365. Empty, the project cadence applies.',
  sinResidual: 'No residual review',
  editar: 'Edit',
  motivoAyuda: 'Every change to a risk keeps its reason in the history.',
  sinActividad: 'No recorded activity.',
  pestanas: {
    resumen: 'Summary',
    revisiones: 'Reviews',
    medidas: 'Measures',
    impactos: 'Potential impacts',
    evidencias: 'Evidence',
    actividad: 'Activity'
  },
  campos: {
    fuente: 'Risk source',
    impacto: 'Impact type and nature',
    tratamiento: 'Treatment decision',
    razon: 'Reason for the decision',
    controles: 'Current controls',
    adecuados: 'Controls adequate',
    monitoreo: 'Monitoring sources',
    residual: 'Residual values',
    cierre: 'Closing reason'
  },
  revision: {
    nueva: 'New review',
    descripcion: 'A review is not edited or deleted: if something went wrong, record another.',
    primera: 'This is the first review: it leaves the risk assessed. A review is not edited or deleted.',
    fecha: 'Review date',
    fechaFutura: 'Pick today or an earlier date.',
    probabilidad: 'Probability (1 to 5)',
    impacto: 'Impact (1 to 5)',
    escala: 'Pick a value from 1 to 5.',
    anticipo: 'Score {{s}}: level {{nivel}} with the project thresholds. The server confirms it when recording.',
    residual: 'It is a residual review (after the measures)',
    residualAyuda: 'It measures the risk left with the measures in place; it does not change the current values.',
    residualPrimera: 'The first review cannot be residual.',
    notas: 'Notes',
    registrar: 'Record review',
    registrando: 'Recording…',
    sinResponsable: 'The first review needs a risk owner: assign one with «Edit» and try again.',
    hecha: 'Review recorded: the risk is now at level {{nivel}}.',
    hechaSinNivel: 'Review recorded.'
  },
  revisiones: {
    vacio: 'The risk has no reviews yet: record the first one so it enters the map.',
    inmutables: 'Reviews are not edited: one is corrected with another.',
    residual: 'Residual',
    vigente: 'Current',
    columnas: { fecha: 'Date', pi: 'P × I', nivel: 'Level', tendencia: 'Trend', tipo: 'Kind', notas: 'Notes', quien: 'Reviewed by' }
  },
  medidas: {
    titulo: 'Mitigation measures',
    ayuda: 'Deciding to mitigate or to resume mitigation needs at least one measure with an owner.',
    nueva: '+ Measure',
    vacio: 'No mitigation measures yet.',
    completada: 'Completed',
    atrasada: 'Overdue',
    pendiente: 'Pending',
    columnas: { medida: 'Measure', responsable: 'Owner', prevista: 'Planned date', avance: 'Progress' }
  },
  tipo: 'Risk',
  trazabilidad: {
    medidas_one: '{{count}} measure',
    medidas_other: '{{count}} measures',
    atrasadas_one: '{{count}} overdue',
    atrasadas_other: '{{count}} overdue',
    compromisos: 'Commitments that address it'
  },
  alimentan: {
    titulo: 'Fed by',
    quejas: 'Grievances',
    alertas: 'Alerts',
    incidente: 'Origin incident',
    ninguno: 'None.'
  },
  contexto: {
    titulo: 'Context',
    locality: 'Locality',
    community: 'Community',
    local_conflict: 'Local conflict',
    key_theme: 'Key theme',
    grupos: 'Stakeholders'
  }
}
