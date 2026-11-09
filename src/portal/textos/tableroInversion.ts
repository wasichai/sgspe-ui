// el tablero de inversión social (screens.md §12, dashboards.md §5.10, spec F5 §3.9)
export const ES_TABLERO_INVERSION = {
  titulo: 'Tablero de inversión social',
  filtros: 'Filtros de inversión',
  programa: 'Programa',
  anio: 'Año',
  todos: 'Todos',
  zonas: {
    campanas: 'Campañas frente a su tope',
    programas: 'Programas por año',
    consolidado: 'Inversión ejecutada',
    beneficiarios: 'Beneficiarios'
  },
  programas: {
    deMoneda: 'Programas en {{moneda}}',
    tablaDeMoneda: 'Presupuestos de programas en {{moneda}}',
    sinMoneda: 'Programas sin moneda',
    tablaSinMoneda: 'Presupuestos de programas sin moneda',
    programa: 'Programa',
    anio: 'Año',
    asignado: 'Asignado',
    ejecutado: 'Ejecutado registrado',
    avance: 'Avance',
    porAprobar: 'Por aprobar',
    sinFilas: 'No hay presupuestos de programas para estos filtros.',
    // la nota al pie de cada tabla de montos (design-system.md §5.3 «Tablas»)
    notaDeMoneda: 'Montos en {{moneda}}; — = sin monto.',
    notaSinMoneda: 'Montos sin moneda registrada; — = sin monto.'
  },
  consolidado: {
    tabla: 'Inversión ejecutada por proyecto y moneda',
    proyecto: 'Proyecto',
    moneda: 'Moneda',
    total: 'Ejecutado',
    compromisos: 'Compromisos',
    aportes: 'Aportes',
    programas: 'Programas',
    presupuesto: 'Presupuesto',
    tope: 'Tope de campaña',
    sinFilas: 'No hay inversión ejecutada para estos filtros.',
    nota: 'Montos en la moneda de cada fila; las monedas no se suman. — = sin monto.'
  },
  beneficiarios: {
    tabla: 'Beneficiarios por programa',
    programa: 'Programa',
    meta: 'Previstos',
    alcanzados: 'Alcanzados'
  }
}

export const EN_TABLERO_INVERSION: typeof ES_TABLERO_INVERSION = {
  titulo: 'Social investment dashboard',
  filtros: 'Investment filters',
  programa: 'Program',
  anio: 'Year',
  todos: 'All',
  zonas: {
    campanas: 'Campaigns against their cap',
    programas: 'Programs by year',
    consolidado: 'Executed investment',
    beneficiarios: 'Beneficiaries'
  },
  programas: {
    deMoneda: 'Programs in {{moneda}}',
    tablaDeMoneda: 'Program budgets in {{moneda}}',
    sinMoneda: 'Programs with no currency',
    tablaSinMoneda: 'Program budgets with no currency',
    programa: 'Program',
    anio: 'Year',
    asignado: 'Allocated',
    ejecutado: 'Recorded executed',
    avance: 'Progress',
    porAprobar: 'Pending approval',
    sinFilas: 'There are no program budgets for these filters.',
    notaDeMoneda: 'Amounts in {{moneda}}; — = no amount.',
    notaSinMoneda: 'Amounts with no recorded currency; — = no amount.'
  },
  consolidado: {
    tabla: 'Executed investment by project and currency',
    proyecto: 'Project',
    moneda: 'Currency',
    total: 'Executed',
    compromisos: 'Commitments',
    aportes: 'Contributions',
    programas: 'Programs',
    presupuesto: 'Budget',
    tope: 'Campaign cap',
    sinFilas: 'There is no executed investment for these filters.',
    nota: 'Amounts in the currency of each row; currencies are not added together. — = no amount.'
  },
  beneficiarios: {
    tabla: 'Beneficiaries by program',
    programa: 'Program',
    meta: 'Planned',
    alcanzados: 'Reached'
  }
}
