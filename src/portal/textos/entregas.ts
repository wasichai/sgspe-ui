// S32 · entrega, cumplimiento y verificación (screens.md §7, flujos 10 y 11)
export const ES_ENTREGAS = {
  titulo: 'Entregas',
  ejecutado: 'Ejecutado: {{ejecutado}} de {{monto}}',
  sinEjecucion: 'Sin ejecución registrada · comprometido: {{monto}}',
  vacia: 'Todavía no hay entregas registradas.',
  registrar: 'Registrar entrega',
  registrarTitulo: 'Registrar una entrega',
  corregir: 'Corregir',
  corregirTitulo: 'Corregir la entrega',
  congelada: 'El compromiso está cumplido: sus entregas no cambian. Para corregir una, devuélvalo a ejecución.',
  congeladaCancelado: 'El compromiso está cancelado: sus entregas ya no cambian.',
  sinActa: 'El «Acta de entrega» todavía no se emite desde el sistema: por ahora, súbala como evidencia.',
  ayuda: 'Guardar la entrega no cambia el estado: después se registra el cumplimiento.',
  minima: {
    MATERIAL: 'Para registrar el cumplimiento, la entrega con conformidad necesita al menos un «Acta de entrega» y una «Foto».',
    'NO MATERIAL': 'Para registrar el cumplimiento, la entrega con conformidad necesita al menos un «Acta», una «Carta» u «Otro».'
  },
  campos: {
    delivery_date: 'Fecha de la entrega',
    place: 'Lugar',
    delivered_items: 'Qué se entregó',
    delivered_amount: 'Monto entregado',
    recipients: 'Receptores',
    conformity_given: 'El grupo de interés dio conformidad',
    conformity_by: 'Quiénes dieron la conformidad'
  },
  tarjeta: {
    titulo: 'Entrega del {{fecha}}',
    conformidad: 'Conformidad',
    conformidadPor: 'Dieron conformidad',
    receptores: 'Receptores',
    monto: 'Monto entregado'
  },
  evidencias: 'Acta y fotos de esta entrega',
  evidenciasAyuda: 'Suba cada archivo antes de guardar la entrega: quedan vinculados al guardarla.',
  subidas: 'Evidencias listas para vincular',
  sinSubidas: 'Todavía no subió evidencias para esta entrega.',
  quitarSubida: 'No vincular {{nombre}}',
  guardar: 'Guardar entrega',
  guardando: 'Guardando…',
  guardada: 'Entrega guardada.',
  errores: {
    fecha: 'Elija la fecha de la entrega',
    monto: 'Escriba un monto de hasta 15 dígitos enteros y 4 decimales',
    estado: 'El compromiso ya no está en ejecución: recargue para ver su estado.'
  },
  verificacion: {
    titulo: 'Verificación',
    ayuda: 'Revise el acta, las fotos y lo entregado frente a lo comprometido antes de verificar.',
    ejecutado: 'Entregado frente a comprometido',
    conConformidad: 'Entregas con conformidad: {{n}} de {{total}}',
    revisar: 'El acta y las fotos están en cada entrega; las restringidas solo las descarga quien tiene permiso para descargar lo restringido.',
    segregacion: 'Usted es responsable de este compromiso: otra persona lo verifica.'
  }
}

export const EN_ENTREGAS: typeof ES_ENTREGAS = {
  titulo: 'Deliveries',
  ejecutado: 'Executed: {{ejecutado}} of {{monto}}',
  sinEjecucion: 'No execution recorded · committed: {{monto}}',
  vacia: 'No deliveries recorded yet.',
  registrar: 'Record delivery',
  registrarTitulo: 'Record a delivery',
  corregir: 'Correct',
  corregirTitulo: 'Correct the delivery',
  congelada: 'The commitment is fulfilled: its deliveries do not change. To correct one, return it to execution.',
  congeladaCancelado: 'The commitment is cancelled: its deliveries no longer change.',
  sinActa: 'The system does not issue the “Acta de entrega” yet: for now, upload it as evidence.',
  ayuda: 'Saving the delivery does not change the status: fulfillment is recorded afterwards.',
  minima: {
    MATERIAL: 'To record fulfillment, the delivery with conformity needs at least one «Acta de entrega» and one «Foto».',
    'NO MATERIAL': 'To record fulfillment, the delivery with conformity needs at least one «Acta», «Carta» or «Otro».'
  },
  campos: {
    delivery_date: 'Delivery date',
    place: 'Place',
    delivered_items: 'What was delivered',
    delivered_amount: 'Delivered amount',
    recipients: 'Recipients',
    conformity_given: 'The stakeholder gave conformity',
    conformity_by: 'Who gave conformity'
  },
  tarjeta: {
    titulo: 'Delivery of {{fecha}}',
    conformidad: 'Conformity',
    conformidadPor: 'Gave conformity',
    receptores: 'Recipients',
    monto: 'Delivered amount'
  },
  evidencias: 'Minutes and photos of this delivery',
  evidenciasAyuda: 'Upload each file before saving the delivery: they are linked when it is saved.',
  subidas: 'Evidence ready to link',
  sinSubidas: 'No evidence uploaded for this delivery yet.',
  quitarSubida: 'Do not link {{nombre}}',
  guardar: 'Save delivery',
  guardando: 'Saving…',
  guardada: 'Delivery saved.',
  errores: {
    fecha: 'Pick the delivery date',
    monto: 'Type an amount of up to 15 integer digits and 4 decimals',
    estado: 'The commitment is no longer in execution: reload to see its state.'
  },
  verificacion: {
    titulo: 'Verification',
    ayuda: 'Check the minutes, the photos and what was delivered against what was committed before verifying.',
    ejecutado: 'Delivered against committed',
    conConformidad: 'Deliveries with conformity: {{n}} of {{total}}',
    revisar: 'The minutes and photos are in each delivery; restricted ones are downloaded only by whoever may download restricted files.',
    segregacion: 'You own this commitment: someone else verifies it.'
  }
}
