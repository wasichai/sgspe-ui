// el punto en polígono de los formularios con ubicación (spec §3.7, caso 16 de gis.md §5.3)
export const ES_UBICAR = {
  titulo: 'Lugares del punto',
  mapa: 'Marque el lugar en el mapa',
  ayuda: 'Un clic en el mapa marca el punto y propone sus lugares; nada se fija sin «Usar estos lugares».',
  punto: 'Punto: latitud {{lat}}, longitud {{lon}}',
  unidad: 'Unidad administrativa',
  localidad: 'Localidad (por su límite)',
  comunidad: 'Comunidad',
  ninguno: 'Ninguno',
  noDisponibleLugar: 'No disponible',
  sinLimite: 'Solo se propone una localidad que tenga límite registrado; si la suya solo tiene punto, elíjala en la lista.',
  usar: 'Usar estos lugares',
  sinLugares: 'El punto no cae en ningún lugar registrado que su cuenta lea.',
  noDisponible: 'No se pudo consultar los lugares del punto: elíjalos en la lista.'
}

export const EN_UBICAR: typeof ES_UBICAR = {
  titulo: 'Places at the point',
  mapa: 'Mark the place on the map',
  ayuda: 'A click on the map marks the point and proposes its places; nothing is set without «Use these places».',
  punto: 'Point: latitude {{lat}}, longitude {{lon}}',
  unidad: 'Administrative unit',
  localidad: 'Locality (by its boundary)',
  comunidad: 'Community',
  ninguno: 'None',
  noDisponibleLugar: 'Not available',
  sinLimite: 'Only a locality with a recorded boundary is proposed; if yours only has a point, choose it from the list.',
  usar: 'Use these places',
  sinLugares: 'The point does not fall in any recorded place your account can read.',
  noDisponible: 'The places at the point could not be queried: choose them from the list.'
}
