// S57 · la ficha de consulta y la de solicitud (F4): responder o derivar una consulta; evaluar, aceptar creando el compromiso o
// declinar una solicitud; la carta firmada
export const ES_FICHA_CONSULTA = {
  consulta: {
    titulo: 'Consulta {{codigo}}',
    noExiste: 'Esta consulta no existe o es confidencial y su cuenta no la lee.',
    responder: 'Escribir la respuesta',
    responderTitulo: 'Responder la consulta',
    responderAyuda:
      'Responder pide la respuesta y cuándo se comunicó: guárdelas aquí y después aplique «Responder». Derivar pide lo mismo, con la entidad a la que se derivó en la respuesta.'
  },
  solicitud: {
    titulo: 'Solicitud {{codigo}}',
    noExiste: 'Esta solicitud no existe o es confidencial y su cuenta no la lee.',
    sinPlazo: 'Las solicitudes no tienen plazo de respuesta.',
    campos: {
      request_medium: 'Cómo se pidió',
      requested_resource: 'Qué se pide',
      created_commitment: 'Compromiso creado'
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
      confirmar: 'Aceptar y crear',
      confirmando: 'Aceptando…'
    }
  },
  subirCarta: 'Subir carta firmada',
  cartaAyuda: 'La carta de respuesta no se emite en el sistema: imprímala, entréguela en papel y suba aquí la copia firmada. Se propone como datos personales.'
}

export const EN_FICHA_CONSULTA: typeof ES_FICHA_CONSULTA = {
  consulta: {
    titulo: 'Inquiry {{codigo}}',
    noExiste: 'This inquiry does not exist, or it is confidential and your account cannot read it.',
    responder: 'Write the answer',
    responderTitulo: 'Answer the inquiry',
    responderAyuda:
      'Answering needs the response and when it was communicated: save them here and then apply «Answer». Referring needs the same, with the entity it was referred to in the response.'
  },
  solicitud: {
    titulo: 'Request {{codigo}}',
    noExiste: 'This request does not exist, or it is confidential and your account cannot read it.',
    sinPlazo: 'Requests have no response deadline.',
    campos: {
      request_medium: 'How it was requested',
      requested_resource: 'What is requested',
      created_commitment: 'Created commitment'
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
      confirmar: 'Accept and create',
      confirmando: 'Accepting…'
    }
  },
  subirCarta: 'Upload the signed letter',
  cartaAyuda: 'The response letter is not issued in the system: print it, deliver it on paper and upload the signed copy here. It is proposed as personal data.'
}
