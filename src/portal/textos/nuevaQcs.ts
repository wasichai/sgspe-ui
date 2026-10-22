// S37 · registrar una queja, una consulta o una solicitud (F4)
export const ES_NUEVA_QCS = {
  titulo: 'Registrar queja, consulta o solicitud',
  ayuda: 'Registre lo que se planteó, por el canal que llegó, sin decidir todavía su tratamiento.',
  tipo: 'Tipo',
  definiciones: {
    grievance: 'Una queja es un reclamo por un daño, una molestia o un incumplimiento atribuido al proyecto.',
    inquiry: 'Una consulta es un pedido de información sobre el proyecto o sus actividades.',
    stakeholder_request: 'Una solicitud es un pedido de apoyo o de recursos que puede volverse un compromiso.'
  },
  plazos: {
    grievance:
      'El acuse vence {{acuse}} días hábiles después de la recepción, sin contar fines de semana ni feriados; la resolución, {{resolucion}} días calendario después.',
    inquiry: 'La respuesta vence {{respuesta}} días calendario después de la recepción.',
    stakeholder_request: 'Las solicitudes no tienen plazo de respuesta.'
  },
  pasos: {
    que: 'Qué se plantea',
    como: 'Cómo llegó y quién',
    revision: 'Revisión'
  },
  secciones: {
    quePasara: 'Qué pasará al registrar'
  },
  revision: {
    resumen: 'Resumen',
    quien: 'Quién la plantea'
  },
  personaRestringida: 'Dato restringido: solo lo leen quienes atienden quejas, consultas y solicitudes.',
  campos: {
    code: 'Código',
    channel: 'Canal',
    received_at: 'Fecha y hora de recepción',
    category: 'Categoría',
    description: 'Descripción',
    priority: 'Prioridad',
    severity: 'Severidad',
    owner: 'Responsable',
    stakeholder: 'Grupo de interés',
    person: 'Persona que la plantea',
    request_medium: 'Medio de la solicitud',
    requested_resource: 'Recurso pedido',
    anonymous: 'Anónima',
    confidential: 'Confidencial'
  },
  anonimaAyuda: 'Una QCS anónima no lleva persona ni grupo de interés.',
  confidencialAyuda:
    'Solo la leerán la gestión de quejas, su responsable, usted, que la recibe, y, si es una queja grave, quien aprueba su resolución. El resto del equipo no la verá en listas, tableros ni reportes.',
  graveAyuda: 'Una queja «Alta» o «Crítica» la resuelve otra persona: quien aprueba.',
  ningunGrupo: 'Sin grupo de interés',
  buscarPersona: 'Buscar persona',
  quitar: 'Quitar',
  recibidaPor: 'La recibe: {{correo}}',
  origen: 'Nace de la interacción de origen indicada en el enlace.',
  quePasara: {
    codigo: 'Se registra con el código {{codigo}} en estado «Recibida».',
    sinCodigo: 'Se registra en estado «Recibida» con el código que escriba.',
    tarea: 'Se crea la tarea de acusar recibo.',
    tareaGenerica: 'Se crea una tarea genérica de acusar recibo, sin vínculo con la queja, para no revelarla.',
    plazoAlRegistrar: 'Los plazos los calcula el sistema al registrar y se ven en la ficha.'
  },
  obligatorio: 'Complete este dato.',
  fechaInvalida: 'Escriba una fecha y hora válidas.',
  registrar: {
    grievance: 'Registrar queja',
    inquiry: 'Registrar consulta',
    stakeholder_request: 'Registrar solicitud'
  },
  registrando: 'Registrando…',
  sinTipo: 'Su cuenta no puede registrar quejas, consultas ni solicitudes en este proyecto.'
}

export const EN_NUEVA_QCS: typeof ES_NUEVA_QCS = {
  titulo: 'Record a grievance, inquiry or request',
  ayuda: 'Record what was raised, through the channel it came, without deciding its handling yet.',
  tipo: 'Type',
  definiciones: {
    grievance: 'A grievance is a complaint about a harm, a nuisance or a breach attributed to the project.',
    inquiry: 'An inquiry is a request for information about the project or its activities.',
    stakeholder_request: 'A request asks for support or resources and may become a commitment.'
  },
  plazos: {
    grievance:
      'The acknowledgement is due {{acuse}} business days after reception, not counting weekends or holidays; the resolution, {{resolucion}} calendar days after.',
    inquiry: 'The answer is due {{respuesta}} calendar days after reception.',
    stakeholder_request: 'Requests have no answer deadline.'
  },
  pasos: {
    que: 'What is raised',
    como: 'How it came and who',
    revision: 'Review'
  },
  secciones: {
    quePasara: 'What happens on recording'
  },
  revision: {
    resumen: 'Summary',
    quien: 'Who raises it'
  },
  personaRestringida: 'Restricted data: only those who handle grievances, inquiries and requests read it.',
  campos: {
    code: 'Code',
    channel: 'Channel',
    received_at: 'Reception date and time',
    category: 'Category',
    description: 'Description',
    priority: 'Priority',
    severity: 'Severity',
    owner: 'Owner',
    stakeholder: 'Stakeholder',
    person: 'Person who raises it',
    request_medium: 'Request medium',
    requested_resource: 'Requested resource',
    anonymous: 'Anonymous',
    confidential: 'Confidential'
  },
  anonimaAyuda: 'An anonymous one carries no person or stakeholder.',
  confidencialAyuda:
    'Only grievance management, its owner, you, as receiver, and, for a serious grievance, the approver of its resolution will read it. The rest of the team will not see it in lists, dashboards or reports.',
  graveAyuda: 'An «Alta» or «Crítica» grievance is resolved by another person: the approver.',
  ningunGrupo: 'No stakeholder',
  buscarPersona: 'Search person',
  quitar: 'Remove',
  recibidaPor: 'Received by: {{correo}}',
  origen: 'It comes from the origin engagement given in the link.',
  quePasara: {
    codigo: 'It is recorded with code {{codigo}} in state «Received».',
    sinCodigo: 'It is recorded in state «Received» with the code you type.',
    tarea: 'The task to acknowledge receipt is created.',
    tareaGenerica: 'A generic task to acknowledge receipt is created, not linked to the grievance, so as not to reveal it.',
    plazoAlRegistrar: 'The system computes the deadlines on recording; the record shows them.'
  },
  obligatorio: 'Fill in this value.',
  fechaInvalida: 'Type a valid date and time.',
  registrar: {
    grievance: 'Record grievance',
    inquiry: 'Record inquiry',
    stakeholder_request: 'Record request'
  },
  registrando: 'Recording…',
  sinTipo: 'Your account cannot record grievances, inquiries or requests in this project.'
}
