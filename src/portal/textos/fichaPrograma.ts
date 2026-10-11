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
  pestanas: { resumen: 'Resumen', presupuesto: 'Presupuesto', evidencias: 'Evidencias', actividad: 'Actividad' },
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
    invalidos: 'Hay montos que no son válidos y no se suman: corríjalos.'
  },
  trazabilidad: { titulo: 'Trazabilidad', tareas: 'Tareas', sinTareas: 'Sin tareas del programa' }
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
  pestanas: { resumen: 'Summary', presupuesto: 'Budget', evidencias: 'Evidence', actividad: 'Activity' },
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
    invalidos: 'Some amounts are not valid and are not added: correct them.'
  },
  trazabilidad: { titulo: 'Traceability', tareas: 'Tasks', sinTareas: 'No program tasks' }
}
