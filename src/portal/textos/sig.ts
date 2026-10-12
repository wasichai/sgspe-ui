// las piezas del mapa de F6 (spec §3.3 y §3.7): el mapa base, la paleta y la leyenda, el WMS por el proxy, el calor y la captura
export const ES_SIG = {
  titulo: 'Mapa',
  sinMapaBase: 'Sin mapa base',
  sinFondo: 'Sin fondo',
  leyenda: 'Leyenda',
  filtros: 'Filtros del mapa',
  proyecto: 'Proyecto del mapa',
  todosLosLugares: 'Todo el territorio',
  desde: 'Desde',
  hasta: 'Hasta',
  // el periodo no filtra las capas de F2 (Layers.kt; enmienda 5.2 y H5 del plan 6.3)
  ayudaDelPeriodo: 'El periodo filtra las capas de gestión, el calor, la ficha de un lugar y sus registros; las capas de referencia no tienen fecha.',
  periodoAlReves: 'La fecha de inicio no puede ser posterior a la de fin.',
  periodoLargo: 'El periodo no puede pasar de 5 años.',
  wmsCaido: 'El servicio de mapas de referencia no responde: las capas públicas se muestran por la API, que puede tardar más.',
  reintentar: 'Reintentar',
  // los agregados por localidad de las capas de gestión: un lugar con sus conteos, nunca una persona
  gruposDeInteres_one: '{{count, number}} grupo de interés',
  gruposDeInteres_other: '{{count, number}} grupos de interés',
  sinDato: 'Sin dato',
  posturaNoDisponible: 'Postura: No disponible',
  totalNoDisponible: 'Grupos de interés: No disponible',
  aportes_one: '{{monto}} ({{count, number}} aporte)',
  aportes_other: '{{monto}} ({{count, number}} aportes)'
}

export const EN_SIG: typeof ES_SIG = {
  titulo: 'Map',
  sinMapaBase: 'No base map',
  sinFondo: 'No background',
  leyenda: 'Legend',
  filtros: 'Map filters',
  proyecto: 'Map project',
  todosLosLugares: 'The whole territory',
  desde: 'From',
  hasta: 'To',
  ayudaDelPeriodo: 'The period filters the management layers, the heat map, the card of a place and its records; the reference layers have no date.',
  periodoAlReves: 'The start date cannot be later than the end date.',
  periodoLargo: 'The period cannot exceed 5 years.',
  wmsCaido: 'The reference map service is not responding: the public layers are shown through the API, which may be slower.',
  reintentar: 'Retry',
  gruposDeInteres_one: '{{count, number}} stakeholder',
  gruposDeInteres_other: '{{count, number}} stakeholders',
  sinDato: 'No data',
  posturaNoDisponible: 'Stance: Not available',
  totalNoDisponible: 'Stakeholders: Not available',
  aportes_one: '{{monto}} ({{count, number}} contribution)',
  aportes_other: '{{monto}} ({{count, number}} contributions)'
}
