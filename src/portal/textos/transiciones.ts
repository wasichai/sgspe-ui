// el diálogo de transición de design-system.md §6.2
export const ES_TRANSICIONES = {
  acciones: 'Acciones del registro',
  deA: '{{de}} → {{a}}',
  reglas: 'Reglas',
  comprobando: 'Comprobando las reglas…',
  sinBloqueos: 'Se cumplen las reglas para este paso.',
  noPermitido: 'El servidor no permite este paso ahora. Recargue el registro e intente de nuevo.',
  bloqueo: 'No se puede todavía',
  advertencia: 'Advertencia: confirme con una justificación',
  campo: 'Campo: {{campo}}',
  faltaCampo: 'Para «{{accion}}» falta «{{campo}}»: complételo y vuelva a intentar.',
  faltaCampoSinAccion: 'Falta «{{campo}}» para este paso: complételo y vuelva a intentar.',
  reglaSinTexto: 'Una regla del sistema no permite este paso todavía.',
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
  anexo: 'Se agrega al motivo: {{anexo}}',
  hecho: 'Listo: el registro está en «{{a}}».'
}

export const EN_TRANSICIONES: typeof ES_TRANSICIONES = {
  acciones: 'Record actions',
  deA: '{{de}} → {{a}}',
  reglas: 'Rules',
  comprobando: 'Checking the rules…',
  sinBloqueos: 'The rules for this step are met.',
  noPermitido: 'The server does not allow this step now. Reload the record and try again.',
  bloqueo: 'Not possible yet',
  advertencia: 'Warning: confirm with a justification',
  campo: 'Field: {{campo}}',
  faltaCampo: 'To «{{accion}}», «{{campo}}» is missing: fill it in and try again.',
  faltaCampoSinAccion: '«{{campo}}» is missing for this step: fill it in and try again.',
  reglaSinTexto: 'A system rule does not allow this step yet.',
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
  anexo: 'Added to the reason: {{anexo}}',
  hecho: 'Done: the record is now “{{a}}”.'
}
