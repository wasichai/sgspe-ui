// el diálogo de transición de design-system.md §6.2
export const ES_TRANSICIONES = {
  acciones: 'Acciones del registro',
  // el objeto que nombra una transición que anula, cancela, retira o resuelve («Anular el proyecto»)
  elObjeto: {
    project: 'el proyecto',
    stakeholder: 'el grupo de interés',
    engagement: 'la interacción',
    field_visit: 'la visita',
    commitment: 'el compromiso',
    agreement: 'el acuerdo',
    social_contribution: 'el aporte',
    social_program: 'el programa',
    deliverable: 'el entregable',
    task: 'la tarea'
  },
  deA: '{{de}} → {{a}}',
  reglas: 'Reglas',
  comprobando: 'Comprobando las reglas…',
  sinBloqueos: 'Se cumplen las reglas para este paso.',
  noPermitido: 'Este paso no se puede dar ahora. Recargue el registro e intente de nuevo.',
  bloqueo: 'No se puede todavía',
  advertencia: 'Advertencia: confirme con una justificación',
  campo: 'Campo: {{campo}}',
  faltaCampo: 'Para «{{accion}}» falta «{{campo}}»: complételo y vuelva a intentar.',
  faltaCampoSinAccion: 'Falta «{{campo}}» para este paso: complételo y vuelva a intentar.',
  reglaSinTexto: 'Una regla del sistema no permite este paso todavía.',
  // lo que falta se completa junto al bloqueo (tercera pasada de UX, 1.1)
  completar: 'Completar «{{campo}}»',
  completarAyuda: 'Al guardar se vuelven a comprobar las reglas de «{{accion}}».',
  // los datos que el paso exige, pedidos en el diálogo (tercera pasada de UX, 1.2)
  datosDelPaso: 'Datos que pide este paso',
  datoObligatorio: '{{campo}} (obligatorio)',
  datoFalta: 'Complete este dato para dar el paso.',
  soloFaltanDatos: 'Se cumplen las demás reglas para este paso. Solo faltan los datos de abajo.',
  seGuardan: 'Se guardan {{campos}} con el mismo motivo.',
  // la ayuda de un dato en un paso: ayudasDelPaso.<objeto>.<transición>.<campo>
  ayudasDelPaso: {
    inquiry: { refer: { response: 'Diga a qué entidad se derivó la consulta.' } }
  },
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
  // lo que el paso hace además del cambio de estado (las automatizaciones del modelo y las reglas que congelan datos):
  // efectos.<objeto>.<transición>; sin entrada, solo el texto general (tercera pasada de UX, 1.3)
  efectos: {
    commitment: {
      approve: 'Se crea la tarea de ejecutarlo, a cargo de su responsable y con su fecha límite.',
      approve_senior: 'Se crea la tarea de ejecutarlo, a cargo de su responsable y con su fecha límite.',
      approve_direct: 'Se crea la tarea de ejecutarlo, a cargo de su responsable y con su fecha límite.'
    },
    engagement: {
      approve_minutes: 'Se generan la minuta y la lista de asistentes del acta.',
      cancel_planned: 'Se crea una tarea para reprogramarla o reemplazarla.',
      cancel_scheduled: 'Se crea una tarea para reprogramarla o reemplazarla.',
      cancel_postponed: 'Se crea una tarea para reprogramarla o reemplazarla.'
    },
    social_contribution: {
      approve: 'Sus ítems quedan congelados: un cambio después es otro aporte.',
      approve_direct: 'Sus ítems quedan congelados: un cambio después es otro aporte.'
    }
  },
  confirmando: 'Aplicando…',
  // cerrar el diálogo cuando el paso mismo se llama «Cancelar»
  volver: 'Volver',
  anexo: 'Se agrega al motivo: {{anexo}}',
  hecho: 'Listo: el registro está en «{{a}}».',
  // lo que sigue tras el paso (la siguiente acción del camino)
  ahora: 'Ahora: «{{accion}}».'
}

export const EN_TRANSICIONES: typeof ES_TRANSICIONES = {
  acciones: 'Record actions',
  elObjeto: {
    project: '',
    stakeholder: '',
    engagement: '',
    field_visit: '',
    commitment: '',
    agreement: '',
    social_contribution: '',
    social_program: '',
    deliverable: '',
    task: ''
  },
  deA: '{{de}} → {{a}}',
  reglas: 'Rules',
  comprobando: 'Checking the rules…',
  sinBloqueos: 'The rules for this step are met.',
  noPermitido: 'This step cannot be taken now. Reload the record and try again.',
  bloqueo: 'Not possible yet',
  advertencia: 'Warning: confirm with a justification',
  campo: 'Field: {{campo}}',
  faltaCampo: 'To «{{accion}}», «{{campo}}» is missing: fill it in and try again.',
  faltaCampoSinAccion: '«{{campo}}» is missing for this step: fill it in and try again.',
  reglaSinTexto: 'A system rule does not allow this step yet.',
  completar: 'Fill in «{{campo}}»',
  completarAyuda: 'Saving checks the rules for «{{accion}}» again.',
  datosDelPaso: 'Data this step asks for',
  datoObligatorio: '{{campo}} (required)',
  datoFalta: 'Fill in this field to take the step.',
  soloFaltanDatos: 'The other rules for this step are met. Only the data below is missing.',
  seGuardan: '{{campos}} are saved with the same reason.',
  ayudasDelPaso: {
    inquiry: { refer: { response: 'Say which entity the inquiry was referred to.' } }
  },
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
  efectos: {
    commitment: {
      approve: 'A task to carry it out is created, assigned to its owner and with its due date.',
      approve_senior: 'A task to carry it out is created, assigned to its owner and with its due date.',
      approve_direct: 'A task to carry it out is created, assigned to its owner and with its due date.'
    },
    engagement: {
      approve_minutes: 'The minutes and the attendance list are generated.',
      cancel_planned: 'A task to reschedule or replace it is created.',
      cancel_scheduled: 'A task to reschedule or replace it is created.',
      cancel_postponed: 'A task to reschedule or replace it is created.'
    },
    social_contribution: {
      approve: 'Its items are frozen: a later change is another contribution.',
      approve_direct: 'Its items are frozen: a later change is another contribution.'
    }
  },
  confirmando: 'Applying…',
  volver: 'Back',
  anexo: 'Added to the reason: {{anexo}}',
  hecho: 'Done: the record is now “{{a}}”.',
  ahora: 'Next: “{{accion}}”.'
}
