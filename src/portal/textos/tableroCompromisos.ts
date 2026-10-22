// S27 · tablero de compromisos (dashboards.md §5.6, KPI-COM-01 a KPI-COM-11)
export const ES_TABLERO_COMPROMISOS = {
  titulo: 'Tablero de compromisos',
  zonas: {
    estado: 'Estado',
    desgloses: 'Dónde y en manos de quién',
    cumplimiento: 'Cumplimiento a tiempo',
    montos: 'Comprometido frente a ejecutado',
    formales: 'Compromisos formales por tema',
    historia: 'Vencidos al cierre de cada mes',
    pendientes: 'Pendientes: vencidos y por vencer'
  },
  // el nombre de cada tarjeta de estado si el servidor no la devolvió (nunca su código)
  tarjetas: {
    registrados: 'Compromisos registrados',
    abiertos: 'Compromisos abiertos',
    vencidos: 'Compromisos vencidos',
    porVencer: 'Compromisos por vencer',
    cumplidos: 'Cumplidos en el periodo',
    bloqueados: 'Compromisos bloqueados'
  },
  diasDeAtraso: 'Días de atraso',
  // los tramos de KPI-COM-03 si una fila llega sin su etiqueta (los umbrales son los del proyecto)
  tramos: {
    OVERDUE_FIRST: 'Hasta el primer umbral',
    OVERDUE_SECOND: 'Entre el primer y el segundo umbral',
    OVERDUE_OVER: 'Más allá del segundo umbral',
    otro: 'Otro tramo'
  },
  porEstado: 'Por estado',
  dimensiones: { owner: 'Responsable', project: 'Proyecto', territory: 'Territorio', topic: 'Tema' },
  columnasDesglose: { nombre: 'Nombre', abiertos: 'Abiertos', vencidos: 'Vencidos' },
  tablaDesglose: '{{dimension}}: abiertos y vencidos',
  contraPlazo: { current: 'Frente al plazo vigente', original: 'Frente al plazo original' },
  nDeN: '{{n}} de {{total}}',
  moneda: 'Moneda',
  comprometido: 'Comprometido',
  ejecutado: 'Ejecutado',
  sinMontos: 'No hay compromisos con monto para estos filtros.',
  sinBase: 'Sin base de comparación: ningún compromiso tiene monto en la moneda principal.',
  historiaAproximada: 'La historia anterior a la puesta en marcha es aproximada: el sistema no guarda la fecha de aprobación.',
  sinPendientes: 'No hay compromisos vencidos ni por vencer.',
  // la tabla aplica el proyecto, la campaña y el responsable; el periodo, el territorio y el ámbito no
  pendientesNoAplica: 'Esta tabla no aplica el filtro de {{filtros}}',
  truncadoPendientes: 'Se muestran los primeros {{n}}: abra la lista para ver todos.',
  columnasPendientes: { codigo: 'Código', titulo: 'Título', situacion: 'Plazo', vence: 'Vence', responsable: 'Responsable' }
}

export const EN_TABLERO_COMPROMISOS: typeof ES_TABLERO_COMPROMISOS = {
  titulo: 'Commitments dashboard',
  zonas: {
    estado: 'Status',
    desgloses: 'Where and in whose hands',
    cumplimiento: 'On-time fulfillment',
    montos: 'Committed against executed',
    formales: 'Formal commitments by theme',
    historia: 'Overdue at each month end',
    pendientes: 'Pending: overdue and due soon'
  },
  tarjetas: {
    registrados: 'Registered commitments',
    abiertos: 'Open commitments',
    vencidos: 'Overdue commitments',
    porVencer: 'Commitments due soon',
    cumplidos: 'Fulfilled in the period',
    bloqueados: 'Blocked commitments'
  },
  diasDeAtraso: 'Days overdue',
  tramos: {
    OVERDUE_FIRST: 'Up to the first threshold',
    OVERDUE_SECOND: 'Between the first and second thresholds',
    OVERDUE_OVER: 'Beyond the second threshold',
    otro: 'Other range'
  },
  porEstado: 'By status',
  dimensiones: { owner: 'Owner', project: 'Project', territory: 'Territory', topic: 'Topic' },
  columnasDesglose: { nombre: 'Name', abiertos: 'Open', vencidos: 'Overdue' },
  tablaDesglose: '{{dimension}}: open and overdue',
  contraPlazo: { current: 'Against the current due date', original: 'Against the original due date' },
  nDeN: '{{n}} of {{total}}',
  moneda: 'Currency',
  comprometido: 'Committed',
  ejecutado: 'Executed',
  sinMontos: 'There are no commitments with an amount for these filters.',
  sinBase: 'No basis for comparison: no commitment has an amount in the main currency.',
  historiaAproximada: 'History before go-live is approximate: the system does not keep the approval date.',
  sinPendientes: 'There are no overdue or due-soon commitments.',
  pendientesNoAplica: 'This table does not apply the {{filtros}} filter',
  truncadoPendientes: 'The first {{n}} are shown: open the list to see them all.',
  columnasPendientes: { codigo: 'Code', titulo: 'Title', situacion: 'Deadline', vence: 'Due', responsable: 'Owner' }
}
