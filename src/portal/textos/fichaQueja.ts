// S36 · la ficha de queja (F4) y lo que comparte con las fichas de consulta y de solicitud (S57): los datos del caso, de dónde viene,
// la confidencialidad, la edición con motivo y el cargo o la carta firmados
export const ES_FICHA_QUEJA = {
  titulo: 'Queja {{codigo}}',
  volver: 'Volver a quejas, consultas y solicitudes',
  noExiste: 'Esta queja no existe o es confidencial y su cuenta no la lee.',
  severidad: 'Severidad {{valor}}',
  grave: 'Es una queja {{severidad}}: la resuelve quien aprueba («Resolver con aprobación») y le llega en Aprobaciones.',
  crearCompromiso: 'Crear compromiso desde esta queja',
  subirCargo: 'Subir cargo firmado',
  cargoAyuda: 'El cargo de queja no se emite en el sistema: imprímalo, entréguelo en papel y suba aquí la copia firmada. Se propone como datos personales.',
  plazos: {
    ack_due_date: 'Acuse hasta el {{fecha}}',
    resolution_due_date: 'Resolución hasta el {{fecha}}',
    response_due_date: 'Respuesta hasta el {{fecha}}',
    sinFecha: 'El plazo se está calculando'
  },
  pestanas: { resumen: 'Resumen', evidencias: 'Evidencias', actividad: 'Actividad' },
  sinActividad: 'Sin actividad registrada.',
  campos: {
    description: 'Qué plantea',
    category: 'Categoría',
    severity: 'Severidad',
    priority: 'Prioridad',
    channel: 'Canal',
    received_at: 'Recibida',
    received_by: 'Recibida por',
    owner: 'Responsable',
    person: 'Persona que la plantea',
    stakeholder: 'Grupo de interés',
    response: 'Respuesta',
    responded_at: 'Respuesta comunicada',
    resolution: 'Resolución',
    resolved_date: 'Resuelta',
    complainant_conformity_given: 'Conformidad del reclamante',
    closed_date: 'Cerrada'
  },
  comun: {
    anonima: 'Anónima',
    confidencial: 'Confidencial',
    confidencialAyuda:
      'Solo la leen la gestión de quejas, su responsable, quien la recibió y, si es una queja ALTA o CRITICA, quien aprueba. Las evidencias que se le vinculen deben ser confidenciales o de datos personales.',
    editar: 'Editar',
    editarTitulo: 'Editar el caso',
    motivo: 'Motivo del cambio (obligatorio)',
    motivoAyuda: 'Queda en la actividad del registro.',
    deDondeViene: 'De dónde viene',
    queGenero: 'Qué alimenta y qué generó',
    interaccion: 'Interacción de origen',
    pregunta: 'Pregunta de la reunión',
    reclasificadaDe: 'Reclasificada de',
    riesgo: 'Riesgo vinculado',
    incidente: 'Incidente',
    duplicadaDe: 'Duplicada de',
    compromisos: 'Compromisos que nacen de ella',
    compromisoCreado: 'Compromiso creado',
    sinOrigen: 'Se registró directamente, sin interacción ni pregunta de origen.',
    sinNada: 'Todavía no alimenta ni generó otros registros.',
    // marcar confidencial una QCS ya registrada (D-3 del 2026-10-10): su receptor, su responsable o la gestión de quejas
    marcar: {
      boton: 'Marcar como confidencial…',
      ayuda: 'Puede marcarla porque la recibió, es su responsable o gestiona las quejas.',
      titulo: '¿Marcar la {{tipo}} como confidencial?',
      texto:
        'Sus colegas sin acceso dejarán de verla en listas, tableros y reportes: solo la leerán la gestión de quejas, su responsable, quien la recibió y, si es una queja grave, quien aprueba su resolución. Quitar la marca después lo decide solo la gestión de quejas.',
      confirmar: 'Marcar como confidencial',
      marcando: 'Marcando…'
    }
  }
}

export const EN_FICHA_QUEJA: typeof ES_FICHA_QUEJA = {
  titulo: 'Grievance {{codigo}}',
  volver: 'Back to grievances, inquiries and requests',
  noExiste: 'This grievance does not exist, or it is confidential and your account cannot read it.',
  severidad: 'Severity {{valor}}',
  grave: 'It is a {{severidad}} grievance: the approver resolves it («Resolve with approval») and receives it in Approvals.',
  crearCompromiso: 'Create a commitment from this grievance',
  subirCargo: 'Upload the signed receipt',
  cargoAyuda:
    'The grievance receipt is not issued in the system: print it, deliver it on paper and upload the signed copy here. It is proposed as personal data.',
  plazos: {
    ack_due_date: 'Acknowledge by {{fecha}}',
    resolution_due_date: 'Resolve by {{fecha}}',
    response_due_date: 'Answer by {{fecha}}',
    sinFecha: 'The deadline is being computed'
  },
  pestanas: { resumen: 'Summary', evidencias: 'Evidence', actividad: 'Activity' },
  sinActividad: 'No recorded activity.',
  campos: {
    description: 'What it raises',
    category: 'Category',
    severity: 'Severity',
    priority: 'Priority',
    channel: 'Channel',
    received_at: 'Received',
    received_by: 'Received by',
    owner: 'Owner',
    person: 'Person who raises it',
    stakeholder: 'Stakeholder',
    response: 'Response',
    responded_at: 'Response communicated',
    resolution: 'Resolution',
    resolved_date: 'Resolved',
    complainant_conformity_given: 'Complainant conformity',
    closed_date: 'Closed'
  },
  comun: {
    anonima: 'Anonymous',
    confidencial: 'Confidential',
    confidencialAyuda:
      'Only grievance management, its owner, whoever received it and, for an ALTA or CRITICA grievance, the approver read it. Evidence linked to it must be confidential or personal data.',
    editar: 'Edit',
    editarTitulo: 'Edit the case',
    motivo: 'Reason for the change (required)',
    motivoAyuda: 'It stays in the record activity.',
    deDondeViene: 'Where it comes from',
    queGenero: 'What it feeds and what it produced',
    interaccion: 'Origin engagement',
    pregunta: 'Meeting question',
    reclasificadaDe: 'Reclassified from',
    riesgo: 'Linked risk',
    incidente: 'Incident',
    duplicadaDe: 'Duplicate of',
    compromisos: 'Commitments born from it',
    compromisoCreado: 'Created commitment',
    sinOrigen: 'It was recorded directly, without an origin engagement or question.',
    sinNada: 'It does not feed or produce other records yet.',
    marcar: {
      boton: 'Mark as confidential…',
      ayuda: 'You can mark it because you received it, own it or manage grievances.',
      titulo: 'Mark the {{tipo}} as confidential?',
      texto:
        'Colleagues without access will stop seeing it in lists, dashboards and reports: only grievance management, its owner, whoever received it and, for a serious grievance, the approver of its resolution will read it. Only grievance management can remove the mark later.',
      confirmar: 'Mark as confidential',
      marcando: 'Marking…'
    }
  }
}
