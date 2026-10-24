// el tablero territorial: S12 en modo tablero (screens.md §12, dashboards.md §5.9)
export const ES_TABLERO_TERRITORIAL = {
  titulo: 'Tablero territorial',
  estadisticas: 'Estadísticas territoriales',
  eligeProyecto: 'Elija un proyecto en los filtros del mapa para ver sus cifras territoriales.',
  zonas: {
    'KPI-TER-02': 'Superficie del área de influencia',
    'KPI-TER-03': 'Miembros por tipo de área',
    'KPI-TER-04': 'Componentes sobre tierras comunales o privadas'
  },
  categoria: 'Categoría',
  valor: 'Valor',
  // los desgloses (breakdowns[].by) de KPI-TER-02 a 04
  desgloses: {
    area: 'Por área de influencia',
    areaType: 'Por tipo de área',
    memberType: 'Por tipo de miembro',
    memberCondition: 'Por condición del miembro',
    tenureType: 'Por tenencia',
    componentType: 'Por tipo de componente'
  },
  // un desglose que el portal no conoce todavía
  desgloseGenerico: 'Desglose',
  // memberType viaja como clave del objeto; los demás, como el valor guardado (ASM-025), salvo los marcadores del servidor
  tiposDeMiembro: { locality: 'Localidades', community: 'Comunidades', administrative_unit: 'Unidades administrativas' },
  sinTenencia: 'Sin tenencia',
  sinDato: 'Sin dato',
  sinDatos: 'No hay cifras para este desglose.',
  sinCifra: '—',
  periodo: 'Periodo pedido: {{rango}}',
  rangoCompleto: '{{desde}} a {{hasta}}',
  periodoDesde: 'desde {{desde}}',
  periodoHasta: 'hasta {{hasta}}',
  calculado: 'Calculado el {{fecha}}'
}

export const EN_TABLERO_TERRITORIAL: typeof ES_TABLERO_TERRITORIAL = {
  titulo: 'Territorial dashboard',
  estadisticas: 'Territorial statistics',
  eligeProyecto: 'Choose a project in the map filters to see its territorial figures.',
  zonas: {
    'KPI-TER-02': 'Area of influence size',
    'KPI-TER-03': 'Members by area type',
    'KPI-TER-04': 'Components on communal or private land'
  },
  categoria: 'Category',
  valor: 'Value',
  desgloses: {
    area: 'By area of influence',
    areaType: 'By area type',
    memberType: 'By member type',
    memberCondition: 'By member condition',
    tenureType: 'By tenure',
    componentType: 'By component type'
  },
  desgloseGenerico: 'Breakdown',
  tiposDeMiembro: { locality: 'Localities', community: 'Communities', administrative_unit: 'Administrative units' },
  sinTenencia: 'No tenure',
  sinDato: 'No data',
  sinDatos: 'There are no figures for this breakdown.',
  sinCifra: '—',
  periodo: 'Period requested: {{rango}}',
  rangoCompleto: '{{desde}} to {{hasta}}',
  periodoDesde: 'from {{desde}}',
  periodoHasta: 'to {{hasta}}',
  calculado: 'Calculated on {{fecha}}'
}
