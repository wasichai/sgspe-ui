// S44 · aporte social (screens.md §10, WF-P): encabezado, para qué y para quién, ítems con el total y la trazabilidad. las Tareas 5
// y 6 suman «Antes de aprobar» (antes) y la entrega (entrega)
export const ES_FICHA_APORTE = {
  titulo: 'Aporte {{codigo}}',
  volver: 'Volver a programas e inversión',
  total: 'Total: {{monto}}',
  campana: 'Campaña',
  editar: 'Editar',
  editarTitulo: 'Editar el aporte',
  motivo: 'Motivo (obligatorio)',
  motivoAyuda: 'El aporte guarda el motivo de cada cambio.',
  terminosCongelados:
    'Desde la aprobación no cambian la moneda, el tipo, el tema, la campaña, la sinergia, el acuerdo ni la justificación: un cambio es otro aporte.',
  pestanas: { resumen: 'Resumen', evidencias: 'Evidencias', actividad: 'Actividad' },
  sinActividad: 'Sin actividad registrada',
  paraQue: {
    titulo: 'Para qué y para quién',
    proposito: 'Propósito declarado',
    ocasion: 'Ocasión',
    festividad: 'Festividad',
    recibe: 'Organización que recibe',
    grupo: 'Grupo de interés',
    localidad: 'Localidad',
    condiciones: 'Condiciones',
    beneficiarios: 'Beneficiarios',
    pagador: 'Quién paga',
    tema: 'Tema',
    sinergia: 'Sinergia institucional',
    acuerdo: 'Acuerdo de sinergia',
    compromiso: 'Compromiso que atiende',
    justificacion: 'Justificación de la desviación'
  },
  items: {
    titulo: 'Ítems',
    nuevo: 'Nuevo ítem',
    vacio: 'El aporte no tiene ítems: cárguelos antes de enviarlo a aprobar.',
    columnas: { descripcion: 'Bien o servicio', tipo: 'Tipo', cantidad: 'Cantidad', costo: 'Costo unitario', monto: 'Monto' },
    seAprobara: 'Total que se aprobará: {{monto}}',
    aprobado: 'Total aprobado: {{monto}}',
    actualizando: 'El total guardado del aporte se está poniendo al día con sus ítems.',
    invalidos: 'Hay montos de ítems que no son válidos y no se suman: corríjalos.',
    congelados: 'El aporte ya salió de «Solicitado»: sus ítems no cambian. Un cambio es otro aporte.',
    congeladosAlBorrar: 'Otra persona aprobó el aporte mientras tanto: sus ítems ya no cambian.'
  },
  trazabilidad: {
    titulo: 'Trazabilidad',
    solicitud: 'Solicitud de origen',
    sinSolicitud: 'No nace de una solicitud que su cuenta lea.'
  }
}

export const EN_FICHA_APORTE: typeof ES_FICHA_APORTE = {
  titulo: 'Contribution {{codigo}}',
  volver: 'Back to programs and investment',
  total: 'Total: {{monto}}',
  campana: 'Campaign',
  editar: 'Edit',
  editarTitulo: 'Edit the contribution',
  motivo: 'Reason (required)',
  motivoAyuda: 'The contribution keeps the reason for each change.',
  terminosCongelados:
    'After approval the currency, type, topic, campaign, synergy, agreement and justification do not change: a change is another contribution.',
  pestanas: { resumen: 'Summary', evidencias: 'Evidence', actividad: 'Activity' },
  sinActividad: 'No recorded activity',
  paraQue: {
    titulo: 'What for and for whom',
    proposito: 'Declared purpose',
    ocasion: 'Occasion',
    festividad: 'Festivity',
    recibe: 'Recipient organisation',
    grupo: 'Stakeholder',
    localidad: 'Locality',
    condiciones: 'Conditions',
    beneficiarios: 'Beneficiaries',
    pagador: 'Payer',
    tema: 'Topic',
    sinergia: 'Institutional synergy',
    acuerdo: 'Synergy agreement',
    compromiso: 'Commitment it serves',
    justificacion: 'Deviation justification'
  },
  items: {
    titulo: 'Items',
    nuevo: 'New item',
    vacio: 'The contribution has no items: add them before submitting it for approval.',
    columnas: { descripcion: 'Good or service', tipo: 'Type', cantidad: 'Quantity', costo: 'Unit cost', monto: 'Amount' },
    seAprobara: 'Total to be approved: {{monto}}',
    aprobado: 'Approved total: {{monto}}',
    actualizando: 'The stored total of the contribution is catching up with its items.',
    invalidos: 'Some item amounts are not valid and are not added: correct them.',
    congelados: 'The contribution is no longer «Requested»: its items do not change. A change is another contribution.',
    congeladosAlBorrar: 'Someone else approved the contribution meanwhile: its items no longer change.'
  },
  trazabilidad: {
    titulo: 'Traceability',
    solicitud: 'Originating request',
    sinSolicitud: 'It does not come from a request your account reads.'
  }
}
