// S57 · la ficha de consulta y la de solicitud (F4): responder o derivar una consulta; evaluar, aceptar creando el compromiso o
// el aporte (F5) o declinar una solicitud; la carta firmada
export const ES_FICHA_CONSULTA = {
  consulta: {
    titulo: 'Consulta {{codigo}}',
    noExiste: 'Esta consulta no existe, no es de sus proyectos o es confidencial y su cuenta no la lee.',
    responder: 'Escribir la respuesta',
    responderTitulo: 'Responder la consulta',
    responderAyuda:
      'Responder pide la respuesta y cuándo se comunicó: guárdelas aquí y después aplique «Responder». Derivar pide lo mismo, con la entidad a la que se derivó en la respuesta.'
  },
  solicitud: {
    titulo: 'Solicitud {{codigo}}',
    noExiste: 'Esta solicitud no existe, no es de sus proyectos o es confidencial y su cuenta no la lee.',
    sinPlazo: 'Las solicitudes no tienen plazo de respuesta.',
    campos: {
      request_medium: 'Cómo se pidió',
      requested_resource: 'Qué se pide',
      created_commitment: 'Compromiso creado',
      created_contribution: 'Aporte creado'
    },
    declinarAyuda: 'Declinar pide la respuesta y cuándo se comunicó: guárdelas con «Editar» antes de aplicar «Declinar».',
    aceptar: {
      boton: 'Aceptar y crear el compromiso',
      titulo: 'Aceptar la solicitud',
      descripcion:
        'Aceptar es responderla: se guarda la respuesta, nace el compromiso en borrador con su aprobación de siempre y la solicitud se cierra sola cuando el compromiso se cierre.',
      respuesta: 'Respuesta a la solicitud',
      respondida: 'Respuesta comunicada (hora de Lima)',
      compromiso: 'El compromiso que nace',
      codigo: 'Código del compromiso',
      tituloDelCompromiso: 'Título del compromiso',
      monto: 'Monto',
      moneda: 'Moneda',
      falta: 'Este dato es obligatorio',
      montoInvalido: 'Escriba un número de hasta 15 dígitos enteros y 4 decimales',
      respondidaInvalida: 'La fecha y hora de la respuesta no es válida: corríjala.',
      confirmar: 'Aceptar y crear',
      confirmando: 'Aceptando…',
      botonAporte: 'Aceptar y crear el aporte',
      botonElegir: 'Aceptar…',
      queSeCrea: '¿Qué se crea?',
      unCompromiso: 'Un compromiso',
      unAporte: 'Un aporte social',
      descripcionAporte:
        'Aceptar es responderla: se guarda la respuesta, nace el aporte en «Solicitado» (sus ítems se cargan en su ficha antes de aprobarlo) y la solicitud se cierra sola cuando el aporte se cierre.',
      aporte: 'El aporte que nace',
      codigoDelAporte: 'Código del aporte',
      proposito: 'Propósito declarado',
      condiciones: 'Condiciones',
      pagador: 'Quién paga',
      cambiarPagador: 'Cambiar',
      tipo: 'Tipo de aporte (opcional)',
      aporteSinDefinicion: 'No se pudo saber si su cuenta puede crear el aporte: por ahora solo se ofrece el compromiso.'
    }
  },
  subirCarta: 'Subir carta firmada',
  cartaAyuda: 'La carta de respuesta no se emite en el sistema: imprímala, entréguela en papel y suba aquí la copia firmada. Se propone como datos personales.'
}

export const EN_FICHA_CONSULTA: typeof ES_FICHA_CONSULTA = {
  consulta: {
    titulo: 'Inquiry {{codigo}}',
    noExiste: 'This inquiry does not exist, is not in your projects, or is confidential and your account cannot read it.',
    responder: 'Write the answer',
    responderTitulo: 'Answer the inquiry',
    responderAyuda:
      'Answering needs the response and when it was communicated: save them here and then apply «Answer». Referring needs the same, with the entity it was referred to in the response.'
  },
  solicitud: {
    titulo: 'Request {{codigo}}',
    noExiste: 'This request does not exist, is not in your projects, or is confidential and your account cannot read it.',
    sinPlazo: 'Requests have no response deadline.',
    campos: {
      request_medium: 'How it was requested',
      requested_resource: 'What is requested',
      created_commitment: 'Created commitment',
      created_contribution: 'Created contribution'
    },
    declinarAyuda: 'Declining needs the response and when it was communicated: save them with «Edit» before applying «Decline».',
    aceptar: {
      boton: 'Accept and create the commitment',
      titulo: 'Accept the request',
      descripcion:
        'Accepting is answering it: the response is saved, the commitment is born as a draft with its usual approval and the request closes by itself when the commitment closes.',
      respuesta: 'Response to the request',
      respondida: 'Response communicated (Lima time)',
      compromiso: 'The commitment that is born',
      codigo: 'Commitment code',
      tituloDelCompromiso: 'Commitment title',
      monto: 'Amount',
      moneda: 'Currency',
      falta: 'This value is required',
      montoInvalido: 'Type a number with up to 15 integer digits and 4 decimals',
      respondidaInvalida: 'The date and time of the answer is not valid: correct it.',
      confirmar: 'Accept and create',
      confirmando: 'Accepting…',
      botonAporte: 'Accept and create the contribution',
      botonElegir: 'Accept…',
      queSeCrea: 'What is created?',
      unCompromiso: 'A commitment',
      unAporte: 'A social contribution',
      descripcionAporte:
        'Accepting is answering it: the response is saved, the contribution is born «Requested» (its items are added in its record before approval) and the request closes by itself when the contribution closes.',
      aporte: 'The contribution that is born',
      codigoDelAporte: 'Contribution code',
      proposito: 'Declared purpose',
      condiciones: 'Conditions',
      pagador: 'Payer',
      cambiarPagador: 'Change',
      tipo: 'Contribution type (optional)',
      aporteSinDefinicion: 'It could not be determined whether your account can create the contribution: for now only the commitment is offered.'
    }
  },
  subirCarta: 'Upload the signed letter',
  cartaAyuda: 'The response letter is not issued in the system: print it, deliver it on paper and upload the signed copy here. It is proposed as personal data.'
}
