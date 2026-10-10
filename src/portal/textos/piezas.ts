// las piezas comunes de F4: el vínculo a otro registro, reclasificar una QCS y los registros simples de riesgos y alertas
export const ES_PIEZAS = {
  vinculado: {
    sinNombre: 'Registro sin nombre'
  },
  reclasificar: {
    boton: 'Reclasificar…',
    titulo: 'Reclasificar',
    descripcion: 'La {{tipo}} {{codigo}} se cierra y el planteamiento sigue como el tipo que elija, con la misma fecha de recepción y sus datos comunes.',
    destino: 'Reclasificar como',
    codigo: 'Código del registro nuevo',
    codigoAyuda: 'Cada tipo numera sus registros: escriba el código que tendrá.',
    codigoFalta: 'Escriba el código del registro nuevo.',
    sinDestino: 'Su cuenta no puede registrar otro tipo de queja, consulta o solicitud.',
    confirmar: 'Reclasificar',
    confirmando: 'Reclasificando…'
  },
  registros: {
    truncado: 'Se muestran los primeros {{n}} registros: hay más.',
    borrar: 'Borrar',
    borrando: 'Borrando…',
    borrarConfirmar: '¿Borrar este registro? No se puede deshacer.'
  }
}

export const EN_PIEZAS: typeof ES_PIEZAS = {
  vinculado: {
    sinNombre: 'Unnamed record'
  },
  reclasificar: {
    boton: 'Reclassify…',
    titulo: 'Reclassify',
    descripcion: 'The {{tipo}} {{codigo}} is closed and the case continues as the type you choose, with the same reception date and its common data.',
    destino: 'Reclassify as',
    codigo: 'Code of the new record',
    codigoAyuda: 'Each type numbers its records: type the code it will have.',
    codigoFalta: 'Type the code of the new record.',
    sinDestino: 'Your account cannot record another type of grievance, inquiry or request.',
    confirmar: 'Reclassify',
    confirmando: 'Reclassifying…'
  },
  registros: {
    truncado: 'The first {{n}} records are shown: there are more.',
    borrar: 'Delete',
    borrando: 'Deleting…',
    borrarConfirmar: 'Delete this record? It cannot be undone.'
  }
}
