// S29 · pestañas de acciones, hitos y dependencias (RF-COM-004, RF-COM-006)
export const ES_SEGUIMIENTO = {
  titulo: 'Acciones e hitos',
  dependencias: 'Dependencias',
  acciones: {
    titulo: 'Acciones',
    nueva: '+ Acción',
    nuevaTitulo: 'Nueva acción',
    vacia: 'Todavía no hay acciones registradas.',
    columnas: { descripcion: 'Acción', fecha: 'Fecha', responsable: 'Responsable', hecha: 'Completada' },
    marcar: 'Marcar «{{accion}}» como completada',
    desmarcar: 'Marcar «{{accion}}» como pendiente'
  },
  hitos: {
    titulo: 'Hitos',
    nuevo: '+ Hito',
    nuevoTitulo: 'Nuevo hito',
    vacio: 'Todavía no hay hitos.',
    columnas: { descripcion: 'Hito', vence: 'Fecha prevista', alcanzado: 'Alcanzado' },
    alcanzar: 'Alcanzado hoy',
    alcanzarDe: 'Marcar «{{hito}}» como alcanzado hoy',
    pendiente: 'Pendiente'
  },
  deps: {
    vacia: 'Este compromiso no depende de otros.',
    columnas: { compromiso: 'Depende de', estado: 'Estado', bloquea: 'Bloquea', notas: 'Notas' },
    bloquea: 'Bloquea el cumplimiento',
    noBloquea: 'No bloquea',
    abierta: 'Una dependencia bloqueante sigue abierta: el cumplimiento no se registra hasta que se cierre (D10).',
    nueva: '+ Dependencia',
    buscar: 'Buscar el compromiso del que depende',
    bloqueante: 'Bloquea el cumplimiento de este compromiso',
    notas: 'Notas',
    agregar: 'Agregar la dependencia',
    agregada: 'Dependencia agregada.',
    elegir: 'Elija el compromiso del que depende'
  }
}

export const EN_SEGUIMIENTO: typeof ES_SEGUIMIENTO = {
  titulo: 'Actions and milestones',
  dependencias: 'Dependencies',
  acciones: {
    titulo: 'Actions',
    nueva: '+ Action',
    nuevaTitulo: 'New action',
    vacia: 'No actions recorded yet.',
    columnas: { descripcion: 'Action', fecha: 'Date', responsable: 'Owner', hecha: 'Completed' },
    marcar: 'Mark “{{accion}}” as completed',
    desmarcar: 'Mark “{{accion}}” as pending'
  },
  hitos: {
    titulo: 'Milestones',
    nuevo: '+ Milestone',
    nuevoTitulo: 'New milestone',
    vacio: 'No milestones yet.',
    columnas: { descripcion: 'Milestone', vence: 'Planned date', alcanzado: 'Reached' },
    alcanzar: 'Reached today',
    alcanzarDe: 'Mark “{{hito}}” as reached today',
    pendiente: 'Pending'
  },
  deps: {
    vacia: 'This commitment does not depend on others.',
    columnas: { compromiso: 'Depends on', estado: 'Status', bloquea: 'Blocks', notas: 'Notes' },
    bloquea: 'Blocks fulfillment',
    noBloquea: 'Does not block',
    abierta: 'A blocking dependency is still open: fulfillment is not recorded until it closes (D10).',
    nueva: '+ Dependency',
    buscar: 'Search the commitment it depends on',
    bloqueante: 'Blocks this commitment’s fulfillment',
    notas: 'Notes',
    agregar: 'Add the dependency',
    agregada: 'Dependency added.',
    elegir: 'Pick the commitment it depends on'
  }
}
