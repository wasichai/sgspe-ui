// el diálogo de transición de design-system.md §6.2
export const ES_TRANSICIONES = {
  acciones: 'Acciones del registro',
  deA: '{{de}} → {{a}}',
  reglas: 'Reglas',
  comprobando: 'Comprobando las reglas…',
  sinBloqueos: 'Se cumplen las reglas para este paso.',
  bloqueo: 'No se puede todavía',
  advertencia: 'Advertencia: confirme con una justificación',
  campo: 'Campo: {{campo}}',
  // field de un aviso que no es un campo del registro (api.md §4.1): un objeto que la regla revisa, el motivo o el estado
  campos: {
    reason: 'Motivo',
    state: 'Estado',
    attended: 'Asistencia de los participantes',
    project: 'Proyecto',
    project_party: 'Partes del proyecto (cliente u operador)',
    engagement_participant: 'Participantes',
    engagement_question: 'Preguntas de la interacción',
    area_of_influence: 'Área de influencia',
    area_of_influence_member: 'Miembros del área de influencia'
  },
  quePasara: 'Qué pasará',
  quePasaraTexto: 'El registro pasa a «{{a}}». El cambio y su motivo quedan en el historial.',
  confirmar: 'Confirmar',
  confirmando: 'Aplicando…',
  hecho: 'Listo: el registro está en «{{a}}».'
}

export const EN_TRANSICIONES: typeof ES_TRANSICIONES = {
  acciones: 'Record actions',
  deA: '{{de}} → {{a}}',
  reglas: 'Rules',
  comprobando: 'Checking the rules…',
  sinBloqueos: 'The rules for this step are met.',
  bloqueo: 'Not possible yet',
  advertencia: 'Warning: confirm with a justification',
  campo: 'Field: {{campo}}',
  campos: {
    reason: 'Reason',
    state: 'State',
    attended: 'Participant attendance',
    project: 'Project',
    project_party: 'Project parties (client or operator)',
    engagement_participant: 'Participants',
    engagement_question: 'Engagement questions',
    area_of_influence: 'Area of influence',
    area_of_influence_member: 'Area of influence members'
  },
  quePasara: 'What will happen',
  quePasaraTexto: 'The record moves to “{{a}}”. The change and its reason are kept in the history.',
  confirmar: 'Confirm',
  confirmando: 'Applying…',
  hecho: 'Done: the record is now “{{a}}”.'
}
