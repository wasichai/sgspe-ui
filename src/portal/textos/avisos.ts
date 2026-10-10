// S04 · avisos de wasichai-notifications: campana, bandeja y preferencias (ux-architecture.md §7.4)
export const ES_AVISOS = {
  titulo: 'Avisos',
  campana: 'Avisos, {{n}} sin leer',
  campanaSinNuevos: 'Avisos, ninguno sin leer',
  ultimos: 'Últimos avisos',
  verTodos: 'Ver todos los avisos',
  leerTodos: 'Marcar todos como leídos',
  vacio: 'No tiene avisos.',
  vacioFiltrado: 'No hay avisos con este filtro.',
  filtros: { todos: 'Activos', sinLeer: 'Solo sin leer', pospuestos: 'Pospuestos' },
  tipo: 'Tipo',
  tipos: { ACTION: 'Para hacer', WARNING: 'Advertencia', INFO: 'Información' },
  fuentes: {
    'sgspe.approvals': 'Aprobación pendiente',
    'sgspe.deadlines': 'Plazos',
    'sgspe.risks': 'Riesgos',
    'sgspe.warnings': 'Alerta temprana',
    otra: 'Otros avisos'
  },
  publicado: 'Publicado el {{fecha}}',
  vence: 'Vence el {{fecha}}',
  vencido: 'Vencido',
  sinLeer: 'Sin leer',
  abrir: 'Abrir',
  sinEnlace: 'Este aviso no lleva a un registro que su cuenta pueda abrir.',
  leer: 'Marcar como leído',
  posponer: 'Posponer hasta mañana',
  pospuesto: 'Pospuesto hasta el {{fecha}}',
  descartar: 'Descartar',
  noDescartable: 'Se va solo cuando el trabajo se hace',
  preferencias: {
    titulo: 'Avisos por correo',
    ayuda: 'La bandeja recibe todos los avisos; elija cuáles le llegan además por correo.',
    canal: { email: 'Correo' },
    guardar: 'Guardar preferencias',
    guardando: 'Guardando…',
    guardadas: 'Preferencias guardadas.',
    sinCanales: 'El correo de avisos no está configurado en esta instalación.'
  },
  abrirRegistro: {
    abriendo: 'Abriendo el registro…',
    sinFicha: 'Este registro no tiene una ficha en el portal todavía.',
    noExiste: 'Este registro ya no existe o no es de su organización.'
  }
}

export const EN_AVISOS: typeof ES_AVISOS = {
  titulo: 'Notices',
  campana: 'Notices, {{n}} unread',
  campanaSinNuevos: 'Notices, none unread',
  ultimos: 'Latest notices',
  verTodos: 'See all notices',
  leerTodos: 'Mark all as read',
  vacio: 'You have no notices.',
  vacioFiltrado: 'No notices match this filter.',
  filtros: { todos: 'Active', sinLeer: 'Unread only', pospuestos: 'Snoozed' },
  tipo: 'Kind',
  tipos: { ACTION: 'To do', WARNING: 'Warning', INFO: 'Information' },
  fuentes: {
    'sgspe.approvals': 'Pending approval',
    'sgspe.deadlines': 'Deadlines',
    'sgspe.risks': 'Risks',
    'sgspe.warnings': 'Early warning',
    otra: 'Other notices'
  },
  publicado: 'Published on {{fecha}}',
  vence: 'Due on {{fecha}}',
  vencido: 'Overdue',
  sinLeer: 'Unread',
  abrir: 'Open',
  sinEnlace: 'This notice does not lead to a record your account can open.',
  leer: 'Mark as read',
  posponer: 'Snooze until tomorrow',
  pospuesto: 'Snoozed until {{fecha}}',
  descartar: 'Dismiss',
  noDescartable: 'It leaves on its own when the work is done',
  preferencias: {
    titulo: 'Email notices',
    ayuda: 'The inbox gets every notice; pick which ones also reach you by email.',
    canal: { email: 'Email' },
    guardar: 'Save preferences',
    guardando: 'Saving…',
    guardadas: 'Preferences saved.',
    sinCanales: 'Notice email is not configured in this installation.'
  },
  abrirRegistro: {
    abriendo: 'Opening the record…',
    sinFicha: 'This record has no page in the portal yet.',
    noExiste: 'This record no longer exists or is not from your organization.'
  }
}
