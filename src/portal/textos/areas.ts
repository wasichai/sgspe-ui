// S10 · área de influencia (screens.md §3, WF-O)
export const ES_AREAS = {
  titulo: '{{tipo}} · versión {{version}}',
  versiones: 'Versiones',
  criterios: 'Criterios y origen',
  definida: 'Fecha de definición',
  areaCalculada: 'Área calculada',
  miembros: 'Miembros',
  columnas: {
    lugar: 'Lugar',
    tipo: 'Tipo',
    condicion: 'Condición',
    criterio: 'Criterio',
    justificacion: 'Justificación',
    estudiado: 'Estudiado',
    comparacion: 'Frente a la vigente'
  },
  comparacion: { igual: 'Igual', nuevo: 'Nuevo', sale: 'Sale', cargando: 'Comparando…', sinDato: '—' },
  tiposDeMiembro: { locality: 'Localidad', community: 'Comunidad', administrative_unit: 'Unidad administrativa' },
  agregarMiembro: 'Agregar miembro',
  tipoDeMiembro: 'Tipo de lugar',
  buscarLugar: 'Buscar el lugar',
  justificacion: 'Justificación',
  congelada: 'Esta versión está {{estado}}: sus miembros ya no cambian. Para cambiarlos, cree una versión nueva.',
  aprobar: 'Aprobar versión {{version}}',
  sinMiembros: 'Agregue al menos un miembro antes de aprobar',
  aprobarTitulo: 'Aprobar la versión {{version}}',
  reglas: 'Para aprobar: la versión está en borrador, tiene miembros y su cuenta tiene permiso para aprobar áreas de influencia.',
  quePasara:
    'La versión {{version}} pasa a Aprobada y la aprobada anterior de este tipo pasa a Reemplazada, en un solo paso. El filtro de territorio y los tableros usan la aprobada.',
  aprobando: 'Aprobando…',
  // lo que dice el diálogo de aprobación ante los códigos del comando (api.md §3.3), con la acción que ofrece
  errores: {
    MEMBERS_REQUIRED: 'El servidor no encuentra miembros en esta versión: agréguelos antes de aprobar.',
    STATE_MISMATCH: 'Esta versión ya no está en borrador: otra persona la aprobó o la reemplazó. Recargue para ver su estado.'
  },
  agregarMiembros: 'Agregar miembros',
  nuevaVersion: 'Nueva versión',
  creandoVersion: 'Creando la versión…',
  mapa: 'Las dos versiones en el mapa',
  miembrosNoCargaron: 'No se pudieron leer los miembros de esta versión: sin ellos no se puede aprobar.',
  sinPermisoParaMiembros: 'Su cuenta no puede agregar miembros: pida a quien administra el proyecto que los agregue.',
  versionCreada: 'La versión {{version}} ya se creó, pero la copia de sus miembros quedó incompleta.',
  continuarEnLaCreada: 'Continuar en la versión creada'
}

export const EN_AREAS: typeof ES_AREAS = {
  titulo: '{{tipo}} · version {{version}}',
  versiones: 'Versions',
  criterios: 'Criteria and source',
  definida: 'Definition date',
  areaCalculada: 'Calculated area',
  miembros: 'Members',
  columnas: {
    lugar: 'Place',
    tipo: 'Type',
    condicion: 'Condition',
    criterio: 'Criterion',
    justificacion: 'Rationale',
    estudiado: 'Studied',
    comparacion: 'Against the current one'
  },
  comparacion: { igual: 'Same', nuevo: 'New', sale: 'Leaves', cargando: 'Comparing…', sinDato: '—' },
  tiposDeMiembro: { locality: 'Locality', community: 'Community', administrative_unit: 'Administrative unit' },
  agregarMiembro: 'Add member',
  tipoDeMiembro: 'Place type',
  buscarLugar: 'Search the place',
  justificacion: 'Rationale',
  congelada: 'This version is {{estado}}: its members no longer change. Create a new version to change them.',
  aprobar: 'Approve version {{version}}',
  sinMiembros: 'Add at least one member before approving',
  aprobarTitulo: 'Approve version {{version}}',
  reglas: 'To approve: the version is a draft, has members and your account may approve areas of influence.',
  quePasara:
    'Version {{version}} becomes Approved and the previous approved one of this type becomes Superseded, in one step. The territory filter and the dashboards use the approved one.',
  aprobando: 'Approving…',
  errores: {
    MEMBERS_REQUIRED: 'The server finds no members in this version: add them before approving.',
    STATE_MISMATCH: 'This version is no longer a draft: someone else approved or superseded it. Reload to see its state.'
  },
  agregarMiembros: 'Add members',
  nuevaVersion: 'New version',
  creandoVersion: 'Creating the version…',
  mapa: 'Both versions on the map',
  miembrosNoCargaron: 'The members of this version could not be read: it cannot be approved without them.',
  sinPermisoParaMiembros: 'Your account cannot add members: ask whoever manages the project to add them.',
  versionCreada: 'Version {{version}} was created, but the copy of its members is incomplete.',
  continuarEnLaCreada: 'Continue in the created version'
}
