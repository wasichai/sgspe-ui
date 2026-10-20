// los incidentes (F4): la lista del proyecto y la ficha de un incidente con su respuesta, lo que generó y sus evidencias
export const ES_INCIDENTES = {
  titulo: 'Incidentes',
  tabla: 'Incidentes del proyecto',
  vacio: 'No hay incidentes registrados',
  registrar: 'Registrar incidente',
  columnas: { codigo: 'Código', ocurrio: 'Ocurrió', tipo: 'Tipo', lugar: 'Lugar', estado: 'Estado' },
  ficha: {
    volver: 'Volver a los incidentes',
    noExiste: 'Este incidente no existe o no es de sus proyectos.',
    ocurrio: 'Ocurrió el {{fecha}}',
    editar: 'Editar',
    editarTitulo: 'Editar el incidente',
    cerrarExige: 'Para cerrar el incidente hacen falta la respuesta inmediata y las consecuencias.',
    identificarRiesgo: 'Identificar un riesgo desde este incidente',
    pestanas: { resumen: 'Resumen', evidencias: 'Evidencias', actividad: 'Actividad' },
    quePaso: 'Qué pasó',
    respuesta: 'Respuesta',
    respuestaInmediata: 'Respuesta inmediata',
    consecuencias: 'Consecuencias',
    queGenero: 'Qué generó',
    riesgos: 'Riesgos',
    quejas: 'Quejas',
    senales: 'Señales',
    nada: 'Nada todavía',
    evidenciasAyuda: 'Una foto con personas se sube como «Datos personales» o «Confidencial».',
    sinActividad: 'Sin actividad registrada'
  }
}

export const EN_INCIDENTES: typeof ES_INCIDENTES = {
  titulo: 'Incidents',
  tabla: 'Project incidents',
  vacio: 'There are no recorded incidents',
  registrar: 'Record incident',
  columnas: { codigo: 'Code', ocurrio: 'Occurred', tipo: 'Type', lugar: 'Place', estado: 'State' },
  ficha: {
    volver: 'Back to the incidents',
    noExiste: 'This incident does not exist or is not in your projects.',
    ocurrio: 'Occurred on {{fecha}}',
    editar: 'Edit',
    editarTitulo: 'Edit the incident',
    cerrarExige: 'Closing the incident needs the immediate response and the consequences.',
    identificarRiesgo: 'Identify a risk from this incident',
    pestanas: { resumen: 'Summary', evidencias: 'Evidence', actividad: 'Activity' },
    quePaso: 'What happened',
    respuesta: 'Response',
    respuestaInmediata: 'Immediate response',
    consecuencias: 'Consequences',
    queGenero: 'What it generated',
    riesgos: 'Risks',
    quejas: 'Grievances',
    senales: 'Signals',
    nada: 'Nothing yet',
    evidenciasAyuda: 'A photo with people is uploaded as «Datos personales» or «Confidencial».',
    sinActividad: 'No recorded activity'
  }
}
