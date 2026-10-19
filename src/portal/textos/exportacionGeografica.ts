// el diálogo de exportación geográfica desde S12 y S09 (spec §3.5)
export const ES_EXPORTACION_GEOGRAFICA = {
  titulo: 'Exportar una capa',
  abrir: 'Exportar',
  ayuda: 'El archivo queda registrado en el historial de exportaciones con su nivel de divulgación.',
  capa: 'Capa',
  // la capa de localidades se exporta entera, con las ciudades
  localidadesYCiudades: 'Centros poblados, localidades y ciudades',
  localidadesEnteras: 'La exportación no separa las ciudades: salen todas las localidades, con las ciudades.',
  objeto: 'Objeto',
  objetos: { school: 'Instituciones educativas', health_facility: 'Establecimientos de salud' },
  geometria: 'Geometría',
  geometrias: {
    boundary: 'Límite',
    location: 'Ubicación',
    trace: 'Trazo',
    territory: 'Territorio',
    footprint: 'Huella',
    interest_area: 'Área de interés'
  },
  formato: 'Formato',
  formatos: { geojson: 'GeoJSON', kml: 'KML', gpkg: 'GeoPackage', shp: 'Shapefile (ZIP)', csv: 'CSV', xlsx: 'XLSX' },
  formatoNoDisponible: '{{formato}} (no disponible en el servidor)',
  formatoSinEscritor: 'El servidor no puede escribir ese formato todavía: elija GeoJSON, CSV o XLSX.',
  coordenadas: 'Coordenadas',
  utm: 'UTM del proyecto',
  latlon: 'Latitud y longitud (EPSG 4326)',
  utmSinProyecto: 'Las coordenadas UTM son las del CRS de trabajo de un proyecto: elija uno.',
  proyecto: 'Proyecto',
  ninguno: 'Ninguno',
  niveles: {
    INTERNO: 'todos los campos que su cuenta lee',
    EXTERNO: 'sin partidas registrales ni datos internos; pide la lista de verificación',
    PUBLICO: 'solo capas públicas'
  },
  filtroExterno: {
    project_component: 'En «Externo» solo salen los accesos del proyecto.',
    land_parcel: 'En «Externo» solo salen los predios de propiedad, posesión y comunales, sin su partida registral.'
  },
  checklist: 'Revisé que el archivo puede salir con este nivel: sin datos personales, sin componentes confidenciales y con su fuente citada',
  exportar: 'Exportar',
  reintentar: 'Reintentar',
  sinCapas: 'Su cuenta no puede exportar ninguna capa del mapa.'
}

export const EN_EXPORTACION_GEOGRAFICA: typeof ES_EXPORTACION_GEOGRAFICA = {
  titulo: 'Export a layer',
  abrir: 'Export',
  ayuda: 'The file is recorded in the export history with its disclosure level.',
  capa: 'Layer',
  localidadesYCiudades: 'Populated centres, localities and cities',
  localidadesEnteras: 'The export does not separate cities: every locality is exported, cities included.',
  objeto: 'Object',
  objetos: { school: 'Schools', health_facility: 'Health facilities' },
  geometria: 'Geometry',
  geometrias: {
    boundary: 'Boundary',
    location: 'Location',
    trace: 'Trace',
    territory: 'Territory',
    footprint: 'Footprint',
    interest_area: 'Area of interest'
  },
  formato: 'Format',
  formatos: { geojson: 'GeoJSON', kml: 'KML', gpkg: 'GeoPackage', shp: 'Shapefile (ZIP)', csv: 'CSV', xlsx: 'XLSX' },
  formatoNoDisponible: '{{formato}} (not available on the server)',
  formatoSinEscritor: 'The server cannot write that format yet: choose GeoJSON, CSV or XLSX.',
  coordenadas: 'Coordinates',
  utm: 'Project UTM',
  latlon: 'Latitude and longitude (EPSG 4326)',
  utmSinProyecto: 'UTM coordinates are those of a project working CRS: choose one.',
  proyecto: 'Project',
  ninguno: 'None',
  niveles: {
    INTERNO: 'every field your account reads',
    EXTERNO: 'without registry records or internal data; needs the checklist',
    PUBLICO: 'public layers only'
  },
  filtroExterno: {
    project_component: 'At «Externo» only the project access roads are exported.',
    land_parcel: 'At «Externo» only owned, possessed and communal parcels are exported, without their registry record.'
  },
  checklist: 'I checked the file can leave at this level: no personal data, no confidential components and its source cited',
  exportar: 'Export',
  reintentar: 'Retry',
  sinCapas: 'Your account cannot export any map layer.'
}
