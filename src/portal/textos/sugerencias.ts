// S10: las sugerencias del cálculo espacial y el resumen del área (spec §3.7)
export const ES_SUGERENCIAS = {
  titulo: 'Sugerencias del cálculo',
  ayuda: 'Lugares que el cálculo espacial propone como miembros de esta versión. Nada se agrega sin «Aceptar».',
  buffer: 'Buffer (m), opcional',
  bufferFuera: 'Indique entre 1 y 20 000 metros, o déjelo vacío.',
  columnas: { lugar: 'Lugar', tipo: 'Tipo', relacion: 'Relación', accion: 'Acción' },
  tipos: { locality: 'Localidad', community: 'Comunidad', administrative_unit: 'Unidad administrativa' },
  relaciones: {
    INTERSECTS: 'Interseca el área',
    WITHIN_BUFFER: 'Está en el buffer',
    otra: 'Relación espacial'
  },
  yaEsMiembro: 'Ya es miembro',
  noSePuedeSaber: 'No se puede saber si ya es miembro',
  incompleto: 'El cálculo no pudo completarse con lo que su cuenta puede leer o con los datos del área; la lista puede estar incompleta.',
  aceptar: 'Aceptar {{nombre}}',
  aceptarCorto: 'Aceptar',
  agregarComo: 'Agregar {{nombre}} como miembro',
  condicion: 'Condición',
  justificacion: 'Justificación',
  justificacionPropuesta: 'Sugerido por el cálculo espacial: {{relacion}}.',
  agregar: 'Agregar como miembro',
  agregando: 'Agregando…',
  cancelar: 'Cancelar',
  agregado: 'Miembro agregado.',
  vacio: 'El cálculo no sugiere lugares para esta versión.',
  resumen: {
    titulo: 'Resumen del área',
    superficie: 'Superficie plana',
    localidades: 'Localidades por tipo',
    comunal: 'Componentes en tierras comunales',
    privada: 'Componentes en tierras privadas',
    incompleto: 'Algunas cifras no se pudieron calcular con lo que su cuenta puede leer o con los datos del área.',
    sinResumen: 'El resumen del área no está disponible.'
  }
}

export const EN_SUGERENCIAS: typeof ES_SUGERENCIAS = {
  titulo: 'Spatial suggestions',
  ayuda: 'Places the spatial calculation proposes as members of this version. Nothing is added without «Accept».',
  buffer: 'Buffer (m), optional',
  bufferFuera: 'Give between 1 and 20,000 meters, or leave it empty.',
  columnas: { lugar: 'Place', tipo: 'Type', relacion: 'Relation', accion: 'Action' },
  tipos: { locality: 'Locality', community: 'Community', administrative_unit: 'Administrative unit' },
  relaciones: {
    INTERSECTS: 'Intersects the area',
    WITHIN_BUFFER: 'Lies within the buffer',
    otra: 'Spatial relation'
  },
  yaEsMiembro: 'Already a member',
  noSePuedeSaber: 'Cannot tell whether it is already a member',
  incompleto: 'The calculation could not be completed with what your account can read or with the area data; the list may be incomplete.',
  aceptar: 'Accept {{nombre}}',
  aceptarCorto: 'Accept',
  agregarComo: 'Add {{nombre}} as a member',
  condicion: 'Condition',
  justificacion: 'Rationale',
  justificacionPropuesta: 'Suggested by the spatial calculation: {{relacion}}.',
  agregar: 'Add as a member',
  agregando: 'Adding…',
  cancelar: 'Cancel',
  agregado: 'Member added.',
  vacio: 'The calculation suggests no places for this version.',
  resumen: {
    titulo: 'Area summary',
    superficie: 'Planar area',
    localidades: 'Localities by type',
    comunal: 'Components on communal land',
    privada: 'Components on private land',
    incompleto: 'Some figures could not be computed with what your account can read or with the area data.',
    sinResumen: 'The area summary is not available.'
  }
}
