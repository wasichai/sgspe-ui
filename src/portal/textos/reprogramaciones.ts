// S29 · reprogramaciones de un compromiso (RF-COM-003, api.md §4.5)
export const ES_REPROGRAMACIONES = {
  titulo: 'Reprogramaciones',
  ayuda: 'Desde la aprobación, la fecha de vencimiento solo cambia aquí; cada reprogramación conserva la fecha anterior y no se borra.',
  vacia: 'Este compromiso no se ha reprogramado.',
  columnas: { cuando: 'Registrada', anterior: 'Fecha anterior', nueva: 'Fecha nueva', motivo: 'Motivo', acordada: 'Acordada con el grupo de interés' },
  reprogramar: 'Reprogramar',
  dialogo: 'Reprogramar el compromiso',
  anterior: 'Fecha de vencimiento vigente: {{fecha}}',
  nueva: 'Fecha nueva',
  motivo: 'Motivo de la reprogramación',
  acordada: 'Se acordó con el grupo de interés',
  guardar: 'Reprogramar',
  guardando: 'Reprogramando…',
  hecha: 'El compromiso vence ahora el {{fecha}}.',
  errores: {
    fecha: 'Elija la fecha nueva',
    misma: 'La fecha nueva es la misma que la vigente',
    motivo: 'Escriba el motivo de la reprogramación',
    estado: 'Solo se reprograma un compromiso aprobado, en ejecución o bloqueado: recargue para ver su estado.'
  }
}

export const EN_REPROGRAMACIONES: typeof ES_REPROGRAMACIONES = {
  titulo: 'Reschedules',
  ayuda: 'Once approved, the due date only changes here; each reschedule keeps the previous date and is never deleted.',
  vacia: 'This commitment has not been rescheduled.',
  columnas: { cuando: 'Recorded', anterior: 'Previous date', nueva: 'New date', motivo: 'Reason', acordada: 'Agreed with the stakeholder' },
  reprogramar: 'Reschedule',
  dialogo: 'Reschedule the commitment',
  anterior: 'Current due date: {{fecha}}',
  nueva: 'New date',
  motivo: 'Reason for the reschedule',
  acordada: 'It was agreed with the stakeholder',
  guardar: 'Reschedule',
  guardando: 'Rescheduling…',
  hecha: 'The commitment is now due on {{fecha}}.',
  errores: {
    fecha: 'Pick the new date',
    misma: 'The new date is the current one',
    motivo: 'Write the reason for the reschedule',
    estado: 'Only an approved, in-progress or blocked commitment is rescheduled: reload to see its state.'
  }
}
