// el inicio «Mi día» de la revisión de UX (etapa 2, S02): lo que pide atención, los atajos de creación y los proyectos de la persona
export const ES_MI_DIA = {
  atencion: {
    titulo: 'Atención requerida',
    nada: 'Nada vencido ni por vencer a su cargo, y nada espera su decisión.',
    vencidos_one: '{{count}} vencido a su cargo',
    vencidos_other: '{{count}} vencidos a su cargo',
    porVencer_one: '{{count}} por vencer a su cargo',
    porVencer_other: '{{count}} por vencer a su cargo',
    decisiones_one: '{{count}} espera su decisión',
    decisiones_other: '{{count}} esperan su decisión',
    avisos_one: '{{count}} aviso que pide acción',
    avisos_other: '{{count}} avisos que piden acción'
  },
  atajos: {
    titulo: 'Registrar',
    interaccion: 'Registrar interacción',
    qcs: 'Registrar QCS',
    compromiso: 'Nuevo compromiso',
    proyecto: 'Nuevo proyecto'
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
    verTodos: 'Ver todos sus proyectos ({{count}})'
  },
  tipos: {
    task: 'Tarea',
    commitment: 'Compromiso',
    grievance: 'Queja',
    inquiry: 'Consulta',
    stakeholder_request: 'Solicitud'
  }
}

export const EN_MI_DIA: typeof ES_MI_DIA = {
  atencion: {
    titulo: 'Needs attention',
    nada: 'Nothing overdue or due soon in your charge, and nothing awaits your decision.',
    vencidos_one: '{{count}} overdue in your charge',
    vencidos_other: '{{count}} overdue in your charge',
    porVencer_one: '{{count}} due soon in your charge',
    porVencer_other: '{{count}} due soon in your charge',
    decisiones_one: '{{count}} awaits your decision',
    decisiones_other: '{{count}} await your decision',
    avisos_one: '{{count}} notification needs action',
    avisos_other: '{{count}} notifications need action'
  },
  atajos: {
    titulo: 'Record',
    interaccion: 'Record engagement',
    qcs: 'Record grievance, inquiry or request',
    compromiso: 'New commitment',
    proyecto: 'New project'
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
    verTodos: 'See all your projects ({{count}})'
  },
  tipos: {
    task: 'Task',
    commitment: 'Commitment',
    grievance: 'Grievance',
    inquiry: 'Inquiry',
    stakeholder_request: 'Request'
  }
}
