// S25 · el borrador del acta que redactó la IA (AI-02): insertar y editar, o descartar con motivo
export const ES_BORRADOR_DE_ACTA = {
  titulo: 'Borrador de la IA',
  ayuda: 'La IA redactó este borrador con los datos de la interacción. Nunca escribe el acta sola.',
  insertar: 'Insertar y editar…',
  dialogo: 'Insertar el borrador en el acta',
  dialogoAyuda: 'Este será el texto del acta: el actual más el borrador. Corríjalo y escriba el motivo.',
  texto: 'Texto del acta',
  esperaGuardado: 'Espere a que el acta se guarde para insertar el borrador.',
  insertando: 'Insertando…',
  confirmar: 'Insertar en el acta',
  insertado: 'El borrador quedó en el acta.',
  errores: { STATE_MISMATCH: 'Otra persona ya decidió este borrador.' }
}

export const EN_BORRADOR_DE_ACTA: typeof ES_BORRADOR_DE_ACTA = {
  titulo: 'AI draft',
  ayuda: 'The AI wrote this draft with the engagement data. It never writes the minutes on its own.',
  insertar: 'Insert and edit…',
  dialogo: 'Insert the draft into the minutes',
  dialogoAyuda: 'This will be the text of the minutes: the current one plus the draft. Correct it and write the reason.',
  texto: 'Minutes text',
  esperaGuardado: 'Wait until the minutes are saved to insert the draft.',
  insertando: 'Inserting…',
  confirmar: 'Insert into the minutes',
  insertado: 'The draft is now in the minutes.',
  errores: { STATE_MISMATCH: 'Someone else already decided on this draft.' }
}
