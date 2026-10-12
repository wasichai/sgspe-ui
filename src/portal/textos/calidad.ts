// S63 · calidad de datos geográficos (spec §3.6, gis.md §8)
export const ES_CALIDAD = {
  titulo: 'Calidad de datos',
  ayuda: 'Lo que entra por la administración o la API genérica no pasa por la validación del portal: este listado lo muestra para corregirlo.',
  revisiones: {
    INVALID: 'Geometrías inválidas',
    OUT_OF_ZONE: 'Fuera de zona o región',
    STALE_AREA: 'Áreas desactualizadas',
    NO_TERRITORY: 'Sin relación territorial',
    NO_GEOMETRY: 'Lugares sin geometría'
  },
  explicaciones: {
    INVALID: 'La geometría no es válida: corrija el dibujo o vuelva a importarla.',
    OUT_OF_ZONE: 'El centroide cae fuera de la zona UTM de trabajo o fuera del Perú.',
    STALE_AREA: 'El área calculada falta o no coincide con su recálculo.',
    NO_TERRITORY: 'QCS, compromisos, riesgos o incidentes sin localidad, comunidad ni ubicación: no cuentan en el mapa de calor.',
    NO_GEOMETRY: 'Localidades y comunidades sin geometría: no se dibujan ni ubican por relación los registros que dependen de ellas.'
  },
  objeto: 'Objeto',
  proyecto: 'Proyecto',
  todos: 'Todos',
  columnas: { objeto: 'Objeto', registro: 'Registro', campo: 'Campo', detalle: 'Detalle' },
  campos: {
    community: { territory: 'Territorio' },
    locality: { location: 'Ubicación', boundary: 'Límite' },
    land_parcel: { boundary: 'Límite' },
    area_of_influence: { boundary: 'Límite' },
    mining_concession: { boundary: 'Límite' }
  },
  notaTenant: 'Los objetos de la organización no se filtran por proyecto: con un proyecto elegido solo se ofrecen los que tienen proyecto.',
  objetos: {
    administrative_unit: 'Unidad administrativa',
    locality: 'Localidad',
    community: 'Comunidad',
    community_sector: 'Sector comunal',
    road_access: 'Vía de acceso',
    mining_concession: 'Concesión minera',
    environmental_feature: 'Elemento ambiental',
    project: 'Proyecto',
    project_component: 'Componente',
    area_of_influence: 'Área de influencia',
    land_parcel: 'Predio',
    school: 'Institución educativa',
    health_facility: 'Establecimiento de salud',
    grievance: 'Queja',
    inquiry: 'Consulta',
    stakeholder_request: 'Solicitud',
    commitment: 'Compromiso',
    social_risk: 'Riesgo',
    incident: 'Incidente'
  },
  // sin un objeto elegido, el servidor omite los objetos que la cuenta no lee enteros: la lista es de los que puede ver
  vacio: 'No hay registros con este problema entre los que su cuenta puede ver.',
  actualizando: 'Actualizando…',
  sinNombre: 'Registro sin nombre',
  anterior: 'Anterior',
  siguiente: 'Siguiente',
  pagina: 'Página {{n}}'
}

export const EN_CALIDAD: typeof ES_CALIDAD = {
  titulo: 'Data quality',
  ayuda: 'What comes in through administration or the generic API skips the portal validation: this list shows it so it can be fixed.',
  revisiones: {
    INVALID: 'Invalid geometries',
    OUT_OF_ZONE: 'Out of zone or region',
    STALE_AREA: 'Stale areas',
    NO_TERRITORY: 'Without a territorial relation',
    NO_GEOMETRY: 'Places without geometry'
  },
  explicaciones: {
    INVALID: 'The geometry is not valid: fix the drawing or import it again.',
    OUT_OF_ZONE: 'The centroid falls outside the working UTM zone or outside Peru.',
    STALE_AREA: 'The calculated area is missing or does not match its recalculation.',
    NO_TERRITORY: 'Grievances, commitments, risks or incidents without a locality, community or location: they do not count in the heat map.',
    NO_GEOMETRY: 'Localities and communities without geometry: the records that depend on them cannot be drawn or placed by relation.'
  },
  objeto: 'Object',
  proyecto: 'Project',
  todos: 'All',
  columnas: { objeto: 'Object', registro: 'Record', campo: 'Field', detalle: 'Detail' },
  campos: {
    community: { territory: 'Territory' },
    locality: { location: 'Location', boundary: 'Boundary' },
    land_parcel: { boundary: 'Boundary' },
    area_of_influence: { boundary: 'Boundary' },
    mining_concession: { boundary: 'Boundary' }
  },
  notaTenant: 'Organization-wide objects are not filtered by project: with a project chosen only objects that have a project are offered.',
  objetos: {
    administrative_unit: 'Administrative unit',
    locality: 'Locality',
    community: 'Community',
    community_sector: 'Community sector',
    road_access: 'Access road',
    mining_concession: 'Mining concession',
    environmental_feature: 'Environmental feature',
    project: 'Project',
    project_component: 'Component',
    area_of_influence: 'Area of influence',
    land_parcel: 'Land parcel',
    school: 'School',
    health_facility: 'Health facility',
    grievance: 'Grievance',
    inquiry: 'Inquiry',
    stakeholder_request: 'Request',
    commitment: 'Commitment',
    social_risk: 'Risk',
    incident: 'Incident'
  },
  vacio: 'There are no records with this problem among those your account can see.',
  actualizando: 'Updating…',
  sinNombre: 'Unnamed record',
  anterior: 'Previous',
  siguiente: 'Next',
  pagina: 'Page {{n}}'
}
