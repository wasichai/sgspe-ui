// S30 · crear compromiso por pasos (screens.md §7, flujo 8)
export const ES_NUEVO_COMPROMISO = {
  titulo: 'Nuevo compromiso',
  ayuda: 'Nada se guarda hasta el último paso: el alta de un compromiso exige su monto y un motivo.',
  pasos: {
    que: 'Qué se compromete',
    origen: 'Origen',
    solicitantes: 'Solicitantes',
    beneficiarios: 'Beneficiarios',
    monto: 'Monto y campaña',
    plazo: 'Plazo y responsable',
    revision: 'Revisión y envío'
  },
  campos: {
    code: 'Código',
    title: 'Título',
    description: 'Descripción',
    objective: 'Objetivo',
    resource_type: 'Tipo de recurso',
    quantity: 'Cantidad',
    unit: 'Unidad',
    execution_time: 'Tiempo de ejecución (si hace falta)',
    commitment_theme: 'Tema',
    formality: 'Formalidad',
    origin_engagement: 'Interacción de origen',
    origin_justification: 'Justificación del origen',
    request_medium: 'Cómo se pidió',
    agreed_date: 'Fecha del acuerdo',
    beneficiaries_count: 'Beneficiarios en total',
    beneficiaries_female_count: 'Beneficiarias',
    beneficiaries_male_count: 'Beneficiarios varones',
    beneficiaries_detail: 'Detalle de beneficiarios (nombre, sexo y edad)',
    amount: 'Monto',
    currency: 'Moneda',
    exploration_campaign: 'Campaña de exploración',
    due_date: 'Fecha de vencimiento',
    owner: 'Responsable',
    verifier: 'Verificador',
    priority: 'Prioridad'
  },
  errores: {
    obligatorio: 'Este dato es obligatorio',
    numero: 'Escriba un número de hasta 15 dígitos enteros y 4 decimales',
    entero: 'Escriba un número entero',
    justificacion: 'Un compromiso que nace de un taller o de una reunión informativa exige la justificación de su origen',
    usuario: 'Escriba el correo y el identificador de la persona',
    mismaPersona: 'El verificador no puede ser el responsable'
  },
  buscarInteraccion: 'Buscar la interacción por título',
  naceDeLaQueja: 'Nace de la queja',
  sinSolicitantes: 'Todavía no hay solicitantes: el envío a aprobación pide al menos uno.',
  tope: {
    titulo: 'Tope de apoyo social de la campaña',
    sinTope: 'La campaña no tiene tope registrado.',
    aprobado: 'Aprobado en la campaña',
    este: 'Este compromiso',
    queda: 'Queda',
    supera:
      'Este compromiso supera el tope de la campaña. Si la política del proyecto bloquea lo que supera el tope, solo lo aprueba el nivel superior con permiso para superarlo.',
    otraMoneda: 'La campaña está en {{moneda}}: lo que está en otra moneda no se suma a su tope.',
    leyendo: 'Leyendo lo aprobado en la campaña…'
  },
  revision: {
    lista: 'Lo que pide el envío a aprobación',
    falta: 'Falta: {{campo}}',
    irAlPaso: 'Ir al paso',
    completo: 'Están los datos de la matriz y el responsable.',
    quePasara: 'Qué pasará',
    quePasaraTexto:
      'El compromiso queda Pendiente de aprobación y el aviso llega a quien aprueba. Desde la aprobación, su fecha de vencimiento solo cambia con una reprogramación.',
    solicitantes: 'Al menos un grupo de interés solicitante',
    guardar: 'Guardar borrador',
    enviar: 'Enviar a aprobación',
    guardando: 'Guardando…',
    parcial: 'El compromiso se creó en borrador pero no se terminó de registrar: complételo en su ficha.',
    abrirFicha: 'Abrir la ficha del compromiso',
    yaCreado: 'El borrador ya se creó: lo que cambie en estos pasos no se guarda. Complételo en su ficha.'
  }
}

export const EN_NUEVO_COMPROMISO: typeof ES_NUEVO_COMPROMISO = {
  titulo: 'New commitment',
  ayuda: 'Nothing is saved until the last step: creating a commitment needs its amount and a reason.',
  pasos: {
    que: 'What is committed',
    origen: 'Origin',
    solicitantes: 'Requesters',
    beneficiarios: 'Beneficiaries',
    monto: 'Amount and campaign',
    plazo: 'Due date and owner',
    revision: 'Review and submit'
  },
  campos: {
    code: 'Code',
    title: 'Title',
    description: 'Description',
    objective: 'Objective',
    resource_type: 'Resource type',
    quantity: 'Quantity',
    unit: 'Unit',
    execution_time: 'Execution time (if needed)',
    commitment_theme: 'Theme',
    formality: 'Formality',
    origin_engagement: 'Origin engagement',
    origin_justification: 'Origin justification',
    request_medium: 'How it was requested',
    agreed_date: 'Agreement date',
    beneficiaries_count: 'Total beneficiaries',
    beneficiaries_female_count: 'Female beneficiaries',
    beneficiaries_male_count: 'Male beneficiaries',
    beneficiaries_detail: 'Beneficiary detail (name, sex and age)',
    amount: 'Amount',
    currency: 'Currency',
    exploration_campaign: 'Exploration campaign',
    due_date: 'Due date',
    owner: 'Owner',
    verifier: 'Verifier',
    priority: 'Priority'
  },
  errores: {
    obligatorio: 'This value is required',
    numero: 'Type a number of up to 15 integer digits and 4 decimals',
    entero: 'Type a whole number',
    justificacion: 'A commitment born in a workshop or an information meeting needs the justification of its origin',
    usuario: 'Type the person’s email and identifier',
    mismaPersona: 'The verifier cannot be the owner'
  },
  buscarInteraccion: 'Search the engagement by title',
  naceDeLaQueja: 'Comes from the grievance',
  sinSolicitantes: 'There are no requesters yet: submitting for approval needs at least one.',
  tope: {
    titulo: 'Campaign social support cap',
    sinTope: 'The campaign has no cap recorded.',
    aprobado: 'Approved in the campaign',
    este: 'This commitment',
    queda: 'Left',
    supera:
      'This commitment exceeds the campaign cap. If the project policy blocks what exceeds the cap, only the senior level with permission to exceed it can approve it.',
    otraMoneda: 'The campaign is in {{moneda}}: amounts in another currency are not added to its cap.',
    leyendo: 'Reading what was approved in the campaign…'
  },
  revision: {
    lista: 'What submitting for approval needs',
    falta: 'Missing: {{campo}}',
    irAlPaso: 'Go to the step',
    completo: 'The matrix data and the owner are there.',
    quePasara: 'What will happen',
    quePasaraTexto:
      'The commitment becomes Pending approval and the notice reaches the approvers. Once approved, its due date only changes through a reschedule.',
    solicitantes: 'At least one requesting stakeholder',
    guardar: 'Save draft',
    enviar: 'Submit for approval',
    guardando: 'Saving…',
    parcial: 'The commitment was created as a draft but not fully recorded: complete it on its page.',
    abrirFicha: 'Open the commitment page',
    yaCreado: 'The draft was already created: changes in these steps are not saved. Complete it on its page.'
  }
}
