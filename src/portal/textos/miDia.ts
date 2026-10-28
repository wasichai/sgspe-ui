// el inicio «Mi trabajo» (S02; P-01 y DD-01 del rediseño de UX): lo que le toca hoy, lo que espera su decisión, su agenda, los
// atajos de creación y los proyectos de la persona
export const ES_MI_DIA = {
  hoy: {
    titulo: 'Lo que me toca hoy',
    descripcion: 'Lo vencido primero, con su motivo y su fecha.',
    aCargo: 'A su cargo',
    nada: 'Nada pendiente a su cargo.',
    noSeLeyo: 'No se pudieron leer {{que}}: lo que está a su cargo puede estar incompleto.',
    verTareas: 'Ver mis tareas',
    actualizadoAhora: 'Actualizado hace un momento',
    actualizadoMinutos: 'Actualizado hace {{n}} min',
    actualizadoHoras_one: 'Actualizado hace {{count}} hora',
    actualizadoHoras_other: 'Actualizado hace {{count}} horas',
    actualizar: 'Actualizar',
    vencio: 'venció el {{fecha}}',
    vence: 'vence el {{fecha}}',
    paraTomar: 'Para tomar en {{proyecto}}',
    paraTomarSinNombre: 'Para tomar en uno de sus proyectos',
    paraTomarEnSusProyectos: 'Para tomar en sus proyectos',
    sinAsignar: 'Sin asignar',
    tomada: 'Tomó «{{titulo}}»: ahora está a su cargo.',
    otrosProyectos_one: 'Lo que puede tomar en su otro proyecto está en su lista de tareas',
    otrosProyectos_other: 'Lo que puede tomar en sus otros {{count}} proyectos está en la lista de tareas de cada uno'
  },
  decision: {
    titulo: 'Esperan su decisión',
    aprobaciones: 'Aprobaciones',
    alertas: 'Alertas por triar',
    avisos: 'Avisos que piden acción',
    aprobacionPendiente: 'Aprobación pendiente',
    pideAccion: 'Pide acción',
    desde: 'desde el {{fecha}}',
    severidad: 'Severidad: {{valor}}',
    sinSeveridad: 'Sin severidad',
    detectada: 'detectada el {{fecha}}'
  },
  agenda: {
    titulo: 'Agenda de la semana',
    descripcion: 'Sus visitas de campo y las interacciones programadas en sus proyectos, de hoy a siete días.',
    visita: 'Visita de campo',
    interaccion: 'Interacción'
  },
  vision: {
    titulo: 'Visión ejecutiva',
    ver: 'Ver la revisión ejecutiva'
  },
  atajos: {
    titulo: 'Registrar',
    interaccion: 'Registrar interacción',
    qcs: 'Registrar QCS',
    compromiso: 'Nuevo compromiso',
    proyecto: 'Nuevo proyecto'
  },
  consultas: { titulo: 'Consultar' },
  sinAsignacion: {
    titulo: 'Todavía no tiene un proyecto asignado',
    texto:
      'Para registrar en un proyecto necesita una asignación vigente: pídala a la administración del proyecto. Mientras tanto, puede leer lo que su rol permite.'
  },
  proyectos: {
    titulo: 'Mis proyectos',
    jefatura: 'Jefatura',
    sinJefatura: 'Sin jefatura asignada',
    compromisos_one: '{{count}} compromiso vencido',
    compromisos_other: '{{count}} compromisos vencidos',
    qcs_one: '{{count}} QCS vencida',
    qcs_other: '{{count}} QCS vencidas',
    riesgos_one: '{{count}} riesgo alto o crítico',
    riesgos_other: '{{count}} riesgos altos o críticos',
    nombres: { compromisos: 'Compromisos vencidos', qcs: 'QCS vencidas', riesgos: 'Riesgos altos o críticos' },
    sinDato: '{{cifra}}: —',
    nadaPideAccion: 'Nada pide acción',
    verTodos: 'Ver todos sus proyectos ({{count}})'
  },
  tipos: {
    task: 'Tarea',
    commitment: 'Compromiso',
    grievance: 'Queja',
    inquiry: 'Consulta',
    stakeholder_request: 'Solicitud'
  },
  // lo que no se pudo leer, en «No se pudieron leer {{que}}»
  fuentes: {
    task: 'sus tareas',
    commitment: 'sus compromisos',
    grievance: 'sus quejas',
    inquiry: 'sus consultas',
    stakeholder_request: 'sus solicitudes'
  }
}

export const EN_MI_DIA: typeof ES_MI_DIA = {
  hoy: {
    titulo: 'My work today',
    descripcion: 'Overdue first, with its reason and date.',
    aCargo: 'In your charge',
    nada: 'Nothing pending in your charge.',
    noSeLeyo: 'Your {{que}} could not be read: what is in your charge may be incomplete.',
    verTareas: 'See my tasks',
    actualizadoAhora: 'Updated a moment ago',
    actualizadoMinutos: 'Updated {{n}} min ago',
    actualizadoHoras_one: 'Updated {{count}} hour ago',
    actualizadoHoras_other: 'Updated {{count}} hours ago',
    actualizar: 'Refresh',
    vencio: 'was due {{fecha}}',
    vence: 'due {{fecha}}',
    paraTomar: 'Up for grabs in {{proyecto}}',
    paraTomarSinNombre: 'Up for grabs in one of your projects',
    paraTomarEnSusProyectos: 'Up for grabs in your projects',
    sinAsignar: 'Unassigned',
    tomada: 'You took “{{titulo}}”: it is now yours.',
    otrosProyectos_one: 'What you can take in your other project is in its task list',
    otrosProyectos_other: 'What you can take in your other {{count}} projects is in the task list of each one'
  },
  decision: {
    titulo: 'Awaiting your decision',
    aprobaciones: 'Approvals',
    alertas: 'Alerts to triage',
    avisos: 'Notifications that need action',
    aprobacionPendiente: 'Approval pending',
    pideAccion: 'Needs action',
    desde: 'since {{fecha}}',
    severidad: 'Severity: {{valor}}',
    sinSeveridad: 'No severity',
    detectada: 'detected {{fecha}}'
  },
  agenda: {
    titulo: 'This week',
    descripcion: 'Your field visits and the engagements scheduled in your projects, from today to seven days ahead.',
    visita: 'Field visit',
    interaccion: 'Engagement'
  },
  vision: {
    titulo: 'Executive overview',
    ver: 'See the executive review'
  },
  atajos: {
    titulo: 'Record',
    interaccion: 'Record engagement',
    qcs: 'Record grievance, inquiry or request',
    compromiso: 'New commitment',
    proyecto: 'New project'
  },
  consultas: { titulo: 'Look up' },
  sinAsignacion: {
    titulo: 'You have no project assigned yet',
    texto: 'To record in a project you need a current assignment: ask the project administration for it. Meanwhile, you can read what your role allows.'
  },
  proyectos: {
    titulo: 'My projects',
    jefatura: 'Project lead',
    sinJefatura: 'No project lead assigned',
    compromisos_one: '{{count}} overdue commitment',
    compromisos_other: '{{count}} overdue commitments',
    qcs_one: '{{count}} overdue grievance, inquiry or request',
    qcs_other: '{{count}} overdue grievances, inquiries or requests',
    riesgos_one: '{{count}} high or critical risk',
    riesgos_other: '{{count}} high or critical risks',
    nombres: { compromisos: 'Overdue commitments', qcs: 'Overdue grievances, inquiries or requests', riesgos: 'High or critical risks' },
    sinDato: '{{cifra}}: —',
    nadaPideAccion: 'Nothing needs action',
    verTodos: 'See all your projects ({{count}})'
  },
  tipos: {
    task: 'Task',
    commitment: 'Commitment',
    grievance: 'Grievance',
    inquiry: 'Inquiry',
    stakeholder_request: 'Request'
  },
  fuentes: {
    task: 'tasks',
    commitment: 'commitments',
    grievance: 'grievances',
    inquiry: 'inquiries',
    stakeholder_request: 'requests'
  }
}
