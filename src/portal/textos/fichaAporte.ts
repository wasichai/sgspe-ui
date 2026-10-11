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
  pestanas: { resumen: 'Resumen', entrega: 'Entrega', evidencias: 'Evidencias', actividad: 'Actividad' },
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
  },
  antes: {
    titulo: 'Antes de aprobar',
    ayuda: 'Las reglas de «{{accion}}» corren aquí sin escribir nada: lo que bloquea, lo que advierte y lo que cumple, antes de decidir.',
    aprobar: 'Aprobar',
    comprobando: 'Comprobando las reglas de la aprobación…',
    filas: {
      items: 'Ítems y tipo de aporte',
      tope: 'Tope de la campaña',
      manoDeObra: 'Sin mano de obra',
      donaciones: 'Donación no monetaria',
      prioridad: 'Tema priorizado del proyecto',
      sinergia: 'Acuerdo de sinergia vigente',
      quienAprueba: 'Quién aprueba'
    },
    situaciones: { cumple: 'Cumple', bloquea: 'Bloquea', advierte: 'Advierte', noAplica: 'No se evalúa' },
    otras: 'Otras reglas',
    sinergiaNoSeJustifica: 'La sinergia sin un acuerdo vigente no se cubre con la justificación: vincule un acuerdo activo y no vencido.',
    justificacion: {
      titulo: 'Justificación de la desviación',
      sin: 'Sin justificación.',
      pide: 'El aporte se aparta de los lineamientos del proyecto: escriba una justificación para poder aprobarlo. Una sola justificación cubre todos los lineamientos incumplidos.',
      escribir: 'Escribir la justificación',
      cambiar: 'Cambiar la justificación',
      ayuda: 'Diga por qué el aporte se aparta de los lineamientos. Desde la aprobación ya no cambia.'
    }
  },
  entrega: {
    titulo: 'Entrega',
    registrar: 'Registrar entrega',
    registrarTitulo: 'Registrar la entrega del aporte',
    corregir: 'Corregir',
    corregirTitulo: 'Corregir la entrega del aporte',
    ayuda: 'Guardar la entrega no cambia el estado del aporte: después viene «Registrar entrega» con sus requisitos.',
    unaVez: 'Un aporte se entrega una sola vez: lo que se entrega en partes son aportes distintos.',
    actaFuera: 'El acta de recepción se imprime fuera del sistema, se firma en la entrega y se sube como evidencia ACTA DE RECEPCION.',
    sinEntrega: 'El aporte todavía no tiene su entrega.',
    antesDeAdquirir: 'La entrega se registra cuando el aporte está adquirido.',
    congelada: 'El aporte ya se entregó o se anuló: su entrega y sus evidencias no cambian.',
    guardada: 'Entrega guardada.',
    yaExiste: 'La entrega ya existe: no se guarda otra. Cierre este panel para verla; las evidencias que subió se vinculan desde su tarjeta.',
    subirActa: 'Subir acta de recepción firmada',
    evidencias: 'Evidencias de la entrega',
    evidenciasAyuda: 'Suba el acta de recepción, la foto y el comprobante: se vinculan a la entrega al guardarla.',
    faltan: 'Faltan: {{tipos}}',
    completas: 'Están las tres evidencias que pide la entrega.',
    errores: { estado: 'El aporte ya no está adquirido: recargue para ver su estado.' },
    requisitos: {
      titulo: 'Lo que pide «Registrar entrega»',
      conformidad: 'Conformidad dada',
      quienes: 'Quiénes dieron la conformidad',
      lista: 'Lista',
      falta: 'Falta',
      noLee: 'Su cuenta no lo lee'
    },
    comprobantes: {
      titulo: 'Comprobantes',
      nuevo: 'Nuevo comprobante',
      vacio: 'Sin comprobantes estructurados',
      ayuda: 'Los datos del comprobante son opcionales; el escaneo se sube como evidencia COMPROBANTE.',
      tipo: 'Tipo',
      sinTipo: 'Sin tipo',
      emisor: 'Emisor',
      fecha: 'Fecha',
      monto: 'Monto'
    }
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
  pestanas: { resumen: 'Summary', entrega: 'Delivery', evidencias: 'Evidence', actividad: 'Activity' },
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
  },
  antes: {
    titulo: 'Before approving',
    ayuda: 'The rules of «{{accion}}» run here without writing anything: what blocks, what warns and what complies, before deciding.',
    aprobar: 'Approve',
    comprobando: 'Checking the approval rules…',
    filas: {
      items: 'Items and contribution type',
      tope: 'Campaign cap',
      manoDeObra: 'No labour',
      donaciones: 'Non-monetary donation',
      prioridad: 'Prioritised project topic',
      sinergia: 'Current synergy agreement',
      quienAprueba: 'Who approves'
    },
    situaciones: { cumple: 'Complies', bloquea: 'Blocks', advierte: 'Warns', noAplica: 'Not assessed' },
    otras: 'Other rules',
    sinergiaNoSeJustifica: 'A synergy without a current agreement is not covered by the justification: link an active, unexpired agreement.',
    justificacion: {
      titulo: 'Deviation justification',
      sin: 'No justification.',
      pide: 'The contribution departs from the project guidelines: write a justification to approve it. One justification covers all unmet guidelines.',
      escribir: 'Write the justification',
      cambiar: 'Change the justification',
      ayuda: 'Say why the contribution departs from the guidelines. After approval it no longer changes.'
    }
  },
  entrega: {
    titulo: 'Delivery',
    registrar: 'Record delivery',
    registrarTitulo: 'Record the contribution delivery',
    corregir: 'Correct',
    corregirTitulo: 'Correct the contribution delivery',
    ayuda: 'Saving the delivery does not change the contribution state: «Record delivery» with its requirements comes next.',
    unaVez: 'A contribution is delivered once: what is delivered in parts are separate contributions.',
    actaFuera: 'The receipt certificate is printed outside the system, signed at the delivery and uploaded as ACTA DE RECEPCION evidence.',
    sinEntrega: 'The contribution has no delivery yet.',
    antesDeAdquirir: 'The delivery is recorded once the contribution is procured.',
    congelada: 'The contribution was already delivered or voided: its delivery and evidence do not change.',
    guardada: 'Delivery saved.',
    yaExiste: 'The delivery already exists: another is not saved. Close this panel to see it; the evidence you uploaded is linked from its card.',
    subirActa: 'Upload the signed receipt certificate',
    evidencias: 'Delivery evidence',
    evidenciasAyuda: 'Upload the receipt certificate, the photo and the voucher: they are linked to the delivery when it is saved.',
    faltan: 'Missing: {{tipos}}',
    completas: 'The three pieces of evidence the delivery asks for are here.',
    errores: { estado: 'The contribution is no longer procured: reload to see its state.' },
    requisitos: {
      titulo: 'What «Record delivery» asks for',
      conformidad: 'Conformity given',
      quienes: 'Who gave conformity',
      lista: 'Ready',
      falta: 'Missing',
      noLee: 'Your account does not read it'
    },
    comprobantes: {
      titulo: 'Vouchers',
      nuevo: 'New voucher',
      vacio: 'No structured vouchers',
      ayuda: 'The voucher data is optional; the scan is uploaded as COMPROBANTE evidence.',
      tipo: 'Type',
      sinTipo: 'No type',
      emisor: 'Issuer',
      fecha: 'Date',
      monto: 'Amount'
    }
  }
}
