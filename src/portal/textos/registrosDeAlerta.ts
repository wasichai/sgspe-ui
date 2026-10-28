// S58, S59 y S61 · las menciones en medios, las señales de alerta y los impactos potenciales (F4)
export const ES_REGISTROS_DE_ALERTA = {
  menciones: {
    titulo: 'Menciones en medios',
    ayuda: 'Lo que dicen los medios del proyecto, con su tono: alimenta los indicadores de medios y las reglas de alerta.',
    lista: 'Menciones',
    nueva: 'Registrar mención',
    vacio: 'Aún no hay menciones registradas.',
    buscar: 'Buscar por titular o medio',
    tono: 'Tono',
    otraPestana: '(se abre en otra pestaña)',
    enlaceAyuda: 'El enlace se guarda como texto y se abre en otra pestaña: el sistema nunca lo descarga.',
    columnas: { titular: 'Titular', fecha: 'Publicada', medio: 'Medio', tono: 'Tono', enlace: 'Enlace' }
  },
  senales: {
    titulo: 'Señales de alerta',
    ayuda: 'Lo que puede anticipar un conflicto, con su fuente: quien hace el triaje la lleva a una alerta, y las reglas las cuentan.',
    lista: 'Señales',
    nueva: 'Registrar señal',
    vacio: 'Aún no hay señales registradas.',
    buscar: 'Buscar en la señal',
    sinAlerta: 'Sin alerta',
    sinNombres: 'Describa lo que pasó sin nombres de personas.',
    columnas: { descripcion: 'Señal', recibida: 'Recibida', fuente: 'Fuente', alerta: 'Alerta' }
  },
  impactos: {
    titulo: 'Impactos potenciales',
    ayuda: 'Qué actividad puede causar qué impacto, de qué tipo, naturaleza y signo, y a qué riesgo alimenta.',
    lista: 'Impactos',
    nuevo: '+ Impacto potencial',
    vacio: 'Aún no hay impactos potenciales.',
    buscar: 'Buscar por impacto o actividad',
    sinRiesgo: 'Sin riesgo vinculado',
    columnas: { descripcion: 'Impacto', actividad: 'Actividad', tipo: 'Tipo', naturaleza: 'Naturaleza', signo: 'Signo', riesgo: 'Riesgo' }
  }
}

export const EN_REGISTROS_DE_ALERTA: typeof ES_REGISTROS_DE_ALERTA = {
  menciones: {
    titulo: 'Media mentions',
    ayuda: 'What the media say about the project, with their tone: they feed the media indicators and the alert rules.',
    lista: 'Mentions',
    nueva: 'Record mention',
    vacio: 'No mentions recorded yet.',
    buscar: 'Search by headline or outlet',
    tono: 'Tone',
    otraPestana: '(opens in another tab)',
    enlaceAyuda: 'The link is stored as text and opened in another tab: the system never downloads it.',
    columnas: { titular: 'Headline', fecha: 'Published', medio: 'Outlet', tono: 'Tone', enlace: 'Link' }
  },
  senales: {
    titulo: 'Warning signals',
    ayuda: 'What may anticipate a conflict, with its source: whoever triages takes it to an alert, and the rules count them.',
    lista: 'Signals',
    nueva: 'Record signal',
    vacio: 'No signals recorded yet.',
    buscar: 'Search in the signal',
    sinAlerta: 'No alert',
    sinNombres: 'Describe what happened without names of people.',
    columnas: { descripcion: 'Signal', recibida: 'Received', fuente: 'Source', alerta: 'Alert' }
  },
  impactos: {
    titulo: 'Potential impacts',
    ayuda: 'Which activity may cause which impact, of which type, nature and sign, and which risk it feeds.',
    lista: 'Impacts',
    nuevo: '+ Potential impact',
    vacio: 'No potential impacts yet.',
    buscar: 'Search by impact or activity',
    sinRiesgo: 'No linked risk',
    columnas: { descripcion: 'Impact', actividad: 'Activity', tipo: 'Type', naturaleza: 'Nature', signo: 'Sign', riesgo: 'Risk' }
  }
}
