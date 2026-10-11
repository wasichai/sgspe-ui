// el tablero de inversión social (screens.md §12, dashboards.md §5.10, spec F5 §3.9)
export const ES_TABLERO_INVERSION = {
  titulo: 'Tablero de inversión social',
  irAProgramas: 'Ir a programas y aportes',
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
    sinFilas: 'No hay presupuestos de programas para estos filtros.'
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
    sinFilas: 'No hay inversión ejecutada para estos filtros.'
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
  irAProgramas: 'Go to programs and contributions',
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
    sinFilas: 'There are no program budgets for these filters.'
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
    sinFilas: 'There is no executed investment for these filters.'
  },
  beneficiarios: {
    tabla: 'Beneficiaries by program',
    programa: 'Program',
    meta: 'Planned',
    alcanzados: 'Reached'
  }
}
