// S53 · Administración: qué se administra en el portal, con motivo y reglas, y qué en la consola de la plataforma, con los
// cuidados de lo que no se cambia en la consola porque vive en el repositorio del producto
export const ES_ADMINISTRACION = {
  titulo: 'Administración',
  descripcion: 'Lo que se administra en el portal, con motivo y reglas, y lo que vive en la consola de la plataforma.',
  portal: {
    titulo: 'En el portal',
    descripcion: 'Aquí cada cambio sigue las reglas del producto, pide su motivo cuando corresponde y queda en el historial.',
    sinEnlaces: 'Su cuenta no abre por ahora ninguna de estas pantallas del portal.',
    proyectos: {
      enlace: 'Proyectos',
      ayuda: 'El equipo de cada proyecto y sus parámetros: abra el proyecto y su pestaña «Equipo y parámetros».'
    },
    reglas: {
      enlace: 'Reglas de alerta de la organización',
      ayuda: 'Qué dispara una alerta temprana en todos los proyectos; cada proyecto puede tener las suyas.'
    },
    plantillas: {
      enlace: 'Plantillas de entregables',
      ayuda: 'La plantilla Word de la organización para los informes que emite el portal.'
    }
  },
  consola: {
    titulo: 'En la consola de la plataforma',
    descripcion: 'La consola es otra aplicación, con la misma sesión. Allí se administra:',
    items: {
      usuarios: 'Usuarios: altas, bajas y los roles de cada cuenta',
      roles: 'Roles y permisos: qué puede hacer cada perfil',
      organizacion: 'La organización y sus datos',
      capas: 'Las capas y los servicios del mapa'
    },
    abrir: 'Abrir la consola',
    otraPestana: '(se abre en otra pestaña)'
  },
  cuidados: {
    titulo: 'Cuidados',
    aviso: 'La estructura de SGSPE no se cambia en la consola',
    texto:
      'Los tipos de datos, los flujos de aprobación, los roles y los tipos de documento de SGSPE los define el equipo del producto y se cargan al preparar o actualizar la organización. Un cambio que se haga sobre ellos en la consola se pierde en la próxima actualización.',
    motivo: 'La consola tampoco pide motivo: los cambios que lo necesitan se hacen en el portal.'
  }
}

export const EN_ADMINISTRACION: typeof ES_ADMINISTRACION = {
  titulo: 'Administration',
  descripcion: 'What is managed in the portal, with reasons and rules, and what lives in the platform console.',
  portal: {
    titulo: 'In the portal',
    descripcion: 'Here every change follows the product rules, asks for its reason when needed and stays in the history.',
    sinEnlaces: 'Your account cannot open any of these portal screens for now.',
    proyectos: {
      enlace: 'Projects',
      ayuda: 'The team of each project and its parameters: open the project and its “Team and parameters” tab.'
    },
    reglas: {
      enlace: 'Organization warning rules',
      ayuda: 'What triggers an early warning in every project; each project can have its own.'
    },
    plantillas: {
      enlace: 'Deliverable templates',
      ayuda: 'The organization Word template for the reports the portal issues.'
    }
  },
  consola: {
    titulo: 'In the platform console',
    descripcion: 'The console is another application, with the same session. There you manage:',
    items: {
      usuarios: 'Users: accounts and the roles of each one',
      roles: 'Roles and permissions: what each profile can do',
      organizacion: 'The organization and its details',
      capas: 'Map layers and services'
    },
    abrir: 'Open the console',
    otraPestana: '(opens in another tab)'
  },
  cuidados: {
    titulo: 'Take care',
    aviso: 'The SGSPE structure is not changed in the console',
    texto:
      'SGSPE’s data types, approval flows, roles and document types are defined by the product team and loaded when the organization is set up or updated. A change made to them in the console is lost at the next update.',
    motivo: 'The console does not ask for a reason either: changes that need one are made in the portal.'
  }
}
