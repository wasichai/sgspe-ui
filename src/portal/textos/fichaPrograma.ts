// S43 · ficha de programa (screens.md §10, WF-G): encabezado, presupuesto por año y moneda y trazabilidad. la Tarea 8 suma los
// indicadores y sus mediciones, las iniciativas, los hitos y los beneficiarios
export const ES_FICHA_PROGRAMA = {
  volver: 'Volver a programas e inversión',
  editar: 'Editar',
  editarTitulo: 'Editar el programa',
  socio: 'Socio',
  sinSocio: 'Sin socio',
  convenio: 'Convenio de sinergia',
  sinConvenio: 'Sin convenio',
  sinergia: 'Con socio, aprobar o planificar el programa exige un acuerdo vigente (activo y no vencido) en el que el socio sea parte.',
  pestanas: {
    resumen: 'Resumen',
    presupuesto: 'Presupuesto',
    indicadores: 'Indicadores',
    iniciativas: 'Iniciativas e hitos',
    beneficiarios: 'Beneficiarios',
    evidencias: 'Evidencias',
    actividad: 'Actividad'
  },
  sinActividad: 'Sin actividad registrada',
  campos: { descripcion: 'Descripción', inicio: 'Inicio', fin: 'Fin', tema: 'Tema', moneda: 'Moneda del programa' },
  presupuesto: {
    titulo: 'Presupuesto por año',
    nuevo: 'Nuevo presupuesto',
    vacio: 'El programa no tiene presupuestos registrados',
    ayuda: 'El ejecutado de cada año se registra a mano: no se calcula de los aportes ni de los compromisos.',
    columnas: { anio: 'Año', moneda: 'Moneda', asignado: 'Asignado', ejecutado: 'Ejecutado registrado', avance: 'Avance' },
    sinRegistrar: 'Sin registrar',
    totales: 'Totales por moneda',
    delPrograma: '(moneda del programa)',
    totalDelPrograma: 'Total del programa: {{monto}}',
    sinMoneda: 'El programa no tiene moneda: su total no se calcula.',
    otrasMonedas: 'Los presupuestos en otra moneda no se suman al total del programa en {{moneda}}: se muestran aparte.',
    invalidos: 'Hay montos que no son válidos y no se suman: corríjalos.',
    totalesTruncados: 'La lista de presupuestos llegó al tope de lectura: los totales por moneda no se calculan porque podría faltar alguno.'
  },
  trazabilidad: { titulo: 'Trazabilidad', tareas: 'Tareas', sinTareas: 'Sin tareas del programa' },
  indicadores: {
    titulo: 'Indicadores',
    nuevo: 'Nuevo indicador',
    vacio: 'El programa no tiene indicadores',
    registrarMedicion: 'Registrar medición',
    indicador: 'Indicador',
    columnas: {
      nombre: 'Indicador',
      unidad: 'Unidad',
      base: 'Línea base',
      meta: 'Meta',
      ultima: 'Última medición',
      historial: 'Mediciones',
      periodo: 'Periodo',
      valor: 'Valor',
      notas: 'Notas'
    },
    ultima: '{{valor}} del {{desde}} al {{hasta}}',
    sinMediciones: 'Sin mediciones',
    verMediciones: 'Ver mediciones de {{nombre}}',
    historialTitulo: 'Mediciones de {{nombre}}',
    inmutables: 'Las mediciones no se corrigen ni se borran: un periodo nuevo es otra medición.',
    conMediciones: 'Un indicador con mediciones no se borra: sus mediciones son historia.'
  },
  iniciativas: {
    titulo: 'Iniciativas',
    nuevo: 'Nueva iniciativa',
    vacio: 'El programa no tiene iniciativas',
    columnas: { nombre: 'Iniciativa', localidad: 'Localidad', contraparte: 'Contraparte', inicio: 'Inicio', fin: 'Fin' }
  },
  hitos: {
    titulo: 'Hitos',
    nuevo: 'Nuevo hito',
    vacio: 'El programa no tiene hitos',
    columnas: { nombre: 'Hito', prevista: 'Fecha prevista', alcanzada: 'Fecha alcanzada', situacion: 'Situación' },
    situaciones: { alcanzado: 'Alcanzado', atrasado: 'Atrasado', previsto: 'Previsto', sinFecha: 'Sin fecha prevista' }
  },
  beneficiarios: {
    titulo: 'Grupos beneficiarios',
    nuevo: 'Nuevo grupo',
    vacio: 'El programa no tiene grupos beneficiarios',
    columnas: { nombre: 'Grupo', iniciativa: 'Iniciativa', localidad: 'Localidad', meta: 'Previstos', alcanzados: 'Alcanzados' },
    totales: 'Alcanzados: {{alcanzados}} de {{meta}} previstos.',
    totalesTruncados: 'La lista llegó al tope de lectura: el total de beneficiarios no se calcula porque podría faltar algún grupo.'
  }
}

export const EN_FICHA_PROGRAMA: typeof ES_FICHA_PROGRAMA = {
  volver: 'Back to programs and investment',
  editar: 'Edit',
  editarTitulo: 'Edit the program',
  socio: 'Partner',
  sinSocio: 'No partner',
  convenio: 'Synergy agreement',
  sinConvenio: 'No agreement',
  sinergia: 'With a partner, approving or planning the program needs a current agreement (active and not expired) the partner is a party to.',
  pestanas: {
    resumen: 'Summary',
    presupuesto: 'Budget',
    indicadores: 'Indicators',
    iniciativas: 'Initiatives and milestones',
    beneficiarios: 'Beneficiaries',
    evidencias: 'Evidence',
    actividad: 'Activity'
  },
  sinActividad: 'No recorded activity',
  campos: { descripcion: 'Description', inicio: 'Start', fin: 'End', tema: 'Topic', moneda: 'Program currency' },
  presupuesto: {
    titulo: 'Budget by year',
    nuevo: 'New budget',
    vacio: 'The program has no recorded budgets',
    ayuda: 'Each year’s executed amount is recorded by hand: it is not calculated from contributions or commitments.',
    columnas: { anio: 'Year', moneda: 'Currency', asignado: 'Allocated', ejecutado: 'Recorded executed', avance: 'Progress' },
    sinRegistrar: 'Not recorded',
    totales: 'Totals by currency',
    delPrograma: '(program currency)',
    totalDelPrograma: 'Program total: {{monto}}',
    sinMoneda: 'The program has no currency: its total is not calculated.',
    otrasMonedas: 'Budgets in another currency are not added to the program total in {{moneda}}: they are shown apart.',
    invalidos: 'Some amounts are not valid and are not added: correct them.',
    totalesTruncados: 'The budget list reached the read limit: the totals by currency are not calculated because some may be missing.'
  },
  trazabilidad: { titulo: 'Traceability', tareas: 'Tasks', sinTareas: 'No program tasks' },
  indicadores: {
    titulo: 'Indicators',
    nuevo: 'New indicator',
    vacio: 'The program has no indicators',
    registrarMedicion: 'Record measurement',
    indicador: 'Indicator',
    columnas: {
      nombre: 'Indicator',
      unidad: 'Unit',
      base: 'Baseline',
      meta: 'Target',
      ultima: 'Latest measurement',
      historial: 'Measurements',
      periodo: 'Period',
      valor: 'Value',
      notas: 'Notes'
    },
    ultima: '{{valor}} from {{desde}} to {{hasta}}',
    sinMediciones: 'No measurements',
    verMediciones: 'See the measurements of {{nombre}}',
    historialTitulo: 'Measurements of {{nombre}}',
    inmutables: 'Measurements are not corrected or deleted: a new period is another measurement.',
    conMediciones: 'An indicator with measurements is not deleted: its measurements are history.'
  },
  iniciativas: {
    titulo: 'Initiatives',
    nuevo: 'New initiative',
    vacio: 'The program has no initiatives',
    columnas: { nombre: 'Initiative', localidad: 'Locality', contraparte: 'Counterpart', inicio: 'Start', fin: 'End' }
  },
  hitos: {
    titulo: 'Milestones',
    nuevo: 'New milestone',
    vacio: 'The program has no milestones',
    columnas: { nombre: 'Milestone', prevista: 'Planned date', alcanzada: 'Reached date', situacion: 'Status' },
    situaciones: { alcanzado: 'Reached', atrasado: 'Late', previsto: 'Planned', sinFecha: 'No planned date' }
  },
  beneficiarios: {
    titulo: 'Beneficiary groups',
    nuevo: 'New group',
    vacio: 'The program has no beneficiary groups',
    columnas: { nombre: 'Group', iniciativa: 'Initiative', localidad: 'Locality', meta: 'Planned', alcanzados: 'Reached' },
    totales: 'Reached: {{alcanzados}} of {{meta}} planned.',
    totalesTruncados: 'The list reached the read limit: the beneficiary total is not calculated because some group may be missing.'
  }
}
