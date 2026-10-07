// los textos del portal en español, el idioma por defecto (RNF-I18N-001). en.ts tendrá las mismas claves (Tarea 17)
export const ES = {
  app: { lema: 'Gestión social de proyectos extractivos' },
  login: {
    correo: 'Correo',
    contrasena: 'Contraseña',
    ingresar: 'Ingresar',
    ingresando: 'Ingresando…',
    incorrectas: 'Correo o contraseña incorrectos',
    fallo: 'No se pudo iniciar sesión. Inténtalo de nuevo.'
  },
  shell: {
    salir: 'Cerrar sesión',
    secciones: 'Secciones',
    leyendoPermisos: 'Leyendo los permisos de su cuenta…',
    sinAcceso: 'Su cuenta no puede abrir «{{seccion}}».',
    preguntar: 'Preguntar',
    asistentePorLlegar: 'El asistente de IA llega en una próxima fase'
  },
  // las 13 secciones de docs/ux/ux-architecture.md §6.2, con la clave de NAV_TREE (Navigation.test.tsx las mantiene iguales)
  secciones: {
    dashboard: 'Dashboard',
    projects: 'Proyectos',
    territory: 'Territorio',
    stakeholders: 'Grupos de interés',
    engagements: 'Relacionamiento',
    commitments: 'Compromisos',
    attention: 'Quejas, consultas y solicitudes',
    risks: 'Riesgos',
    programs: 'Programas sociales',
    documents: 'Documentos',
    tasks: 'Tareas',
    reports: 'Reportes',
    admin: 'Administración'
  },
  inicio: { titulo: 'Dashboard' },
  noEncontrada: 'Esta página no existe'
}

export type Textos = typeof ES
