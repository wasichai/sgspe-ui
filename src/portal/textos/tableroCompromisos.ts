// S27 · tablero de compromisos (dashboards.md §5.6, KPI-COM-01 a KPI-COM-11)
export const ES_TABLERO_COMPROMISOS = {
  titulo: 'Tablero de compromisos',
  verLista: 'Ver la lista de compromisos',
  zonas: {
    estado: 'Estado',
    desgloses: 'Dónde y en manos de quién',
    cumplimiento: 'Cumplimiento a tiempo',
    montos: 'Comprometido frente a ejecutado',
    formales: 'Compromisos formales por tema',
    historia: 'Vencidos al cierre de cada mes',
    pendientes: 'Pendientes: vencidos y por vencer'
  },
  diasDeAtraso: 'Días de atraso',
  porEstado: 'Por estado',
  dimensiones: { owner: 'Responsable', project: 'Proyecto', territory: 'Territorio', topic: 'Tema' },
  columnasDesglose: { nombre: 'Nombre', abiertos: 'Abiertos', vencidos: 'Vencidos' },
  tablaDesglose: '{{dimension}}: abiertos y vencidos',
  contraPlazo: { current: 'Frente al plazo vigente', original: 'Frente al plazo original' },
  nDeN: '{{n}} de {{total}}',
  moneda: 'Moneda',
  comprometido: 'Comprometido',
  ejecutado: 'Ejecutado',
  historiaAproximada: 'La historia anterior a la puesta en marcha es aproximada: el modelo no guarda la fecha de aprobación (dashboards.md §4.4).',
  sinPendientes: 'No hay compromisos vencidos ni por vencer.',
  truncadoPendientes: 'Se muestran los primeros {{n}}: abra la lista para ver todos.',
  columnasPendientes: { codigo: 'Código', titulo: 'Título', situacion: 'Plazo', vence: 'Vence', responsable: 'Responsable' }
}

export const EN_TABLERO_COMPROMISOS: typeof ES_TABLERO_COMPROMISOS = {
  titulo: 'Commitments dashboard',
  verLista: 'See the commitments list',
  zonas: {
    estado: 'Status',
    desgloses: 'Where and in whose hands',
    cumplimiento: 'On-time fulfillment',
    montos: 'Committed against executed',
    formales: 'Formal commitments by theme',
    historia: 'Overdue at each month end',
    pendientes: 'Pending: overdue and due soon'
  },
  diasDeAtraso: 'Days overdue',
  porEstado: 'By status',
  dimensiones: { owner: 'Owner', project: 'Project', territory: 'Territory', topic: 'Topic' },
  columnasDesglose: { nombre: 'Name', abiertos: 'Open', vencidos: 'Overdue' },
  tablaDesglose: '{{dimension}}: open and overdue',
  contraPlazo: { current: 'Against the current due date', original: 'Against the original due date' },
  nDeN: '{{n}} of {{total}}',
  moneda: 'Currency',
  comprometido: 'Committed',
  ejecutado: 'Executed',
  historiaAproximada: 'History before go-live is approximate: the model does not keep the approval date (dashboards.md §4.4).',
  sinPendientes: 'There are no overdue or due-soon commitments.',
  truncadoPendientes: 'The first {{n}} are shown: open the list to see them all.',
  columnasPendientes: { codigo: 'Code', titulo: 'Title', situacion: 'Deadline', vence: 'Due', responsable: 'Owner' }
}
