// la edición de geometrías en S13 y S14 con la validación previa (spec §3.6, gis.md §6.6). el motivo de invalidez llega armado
// en español desde el servidor y se muestra tal cual también en inglés (enmienda 13.2 del plan 6.3)
export const ES_EDICION_DE_GEOMETRIA = {
  titulo: 'Editar la geometría',
  abrir: 'Editar la geometría',
  cual: 'Qué geometría',
  campos: { territory: 'Territorio', location: 'Ubicación', boundary: 'Límite' },
  ayuda: 'Dibuje o corrija la geometría y revísela antes de guardarla: nada se guarda sin su confirmación.',
  revisar: 'Revisar',
  revisando: 'Revisando…',
  valida: 'La geometría es válida.',
  invalida: 'La geometría no es válida.',
  motivo: 'Motivo: {{motivo}}',
  reparacion: 'La reparación propuesta cambia el área de {{antes}} ha a {{despues}} ha.',
  sinReparacion: 'No hay una reparación automática: corrija el dibujo.',
  reparacionDeOtroTipo: 'La reparación automática cambia el tipo de la geometría y no se puede guardar: corrija el dibujo.',
  tipo: 'La geometría dibujada no es del tipo que pide este dato: dibuje {{tipo}}.',
  tipos: {
    POINT: 'un punto',
    LINESTRING: 'una línea',
    POLYGON: 'un polígono',
    MULTIPOINT: 'un punto',
    MULTILINESTRING: 'una línea',
    MULTIPOLYGON: 'un polígono'
  },
  otroTipo: 'otra forma',
  fueraDeZona: 'La geometría cae fuera de la zona UTM esperada.',
  fueraDeRegion: 'La geometría cae fuera del Perú.',
  confirmarUbicacion: 'Confirmo que la ubicación es correcta',
  guardar: 'Guardar',
  guardarReparacion: 'Guardar la reparación',
  guardando: 'Guardando…',
  cancelar: 'Cancelar',
  sinDibujo: 'Dibuje una geometría para revisarla.'
}

export const EN_EDICION_DE_GEOMETRIA: typeof ES_EDICION_DE_GEOMETRIA = {
  titulo: 'Edit the geometry',
  abrir: 'Edit the geometry',
  cual: 'Which geometry',
  campos: { territory: 'Territory', location: 'Location', boundary: 'Boundary' },
  ayuda: 'Draw or fix the geometry and check it before saving: nothing is saved without your confirmation.',
  revisar: 'Check',
  revisando: 'Checking…',
  valida: 'The geometry is valid.',
  invalida: 'The geometry is not valid.',
  motivo: 'Reason: {{motivo}}',
  reparacion: 'The proposed repair changes the area from {{antes}} ha to {{despues}} ha.',
  sinReparacion: 'There is no automatic repair: fix the drawing.',
  reparacionDeOtroTipo: 'The automatic repair changes the kind of geometry and cannot be saved: fix the drawing.',
  tipo: 'The drawn geometry is not the kind this field needs: draw {{tipo}}.',
  tipos: {
    POINT: 'a point',
    LINESTRING: 'a line',
    POLYGON: 'a polygon',
    MULTIPOINT: 'a point',
    MULTILINESTRING: 'a line',
    MULTIPOLYGON: 'a polygon'
  },
  otroTipo: 'another shape',
  fueraDeZona: 'The geometry falls outside the expected UTM zone.',
  fueraDeRegion: 'The geometry falls outside Peru.',
  confirmarUbicacion: 'I confirm the location is right',
  guardar: 'Save',
  guardarReparacion: 'Save the repair',
  guardando: 'Saving…',
  cancelar: 'Cancel',
  sinDibujo: 'Draw a geometry to check it.'
}
