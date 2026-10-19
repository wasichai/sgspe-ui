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
  tipos: {
    task: 'Task',
    commitment: 'Commitment',
    grievance: 'Grievance',
    inquiry: 'Inquiry',
    stakeholder_request: 'Request'
  }
}
