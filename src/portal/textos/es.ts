import { ES_AREAS } from './areas'
import { ES_COMUN } from './comun'
import { ES_CONTEXTO } from './contexto'
import { ES_MAPA } from './mapa'
import { ES_P360 } from './p360'
import { ES_PROYECTOS } from './proyectos'
import { ES_TERRITORIO } from './territorio'
import { ES_TRANSICIONES } from './transiciones'

// los textos del portal en español, el idioma por defecto (RNF-I18N-001). en.ts tiene las mismas claves. cada módulo de
// F2 trae los suyos en su archivo (comun.ts, proyectos.ts…) con su par en inglés
export const ES = {
  areas: ES_AREAS,
  comun: ES_COMUN,
  contexto: ES_CONTEXTO,
  mapa: ES_MAPA,
  p360: ES_P360,
  proyectos: ES_PROYECTOS,
  territorio: ES_TERRITORIO,
  transiciones: ES_TRANSICIONES,
  app: { lema: 'Gestión social de proyectos extractivos' },
  login: {
    correo: 'Correo',
    contrasena: 'Contraseña',
    ingresar: 'Ingresar',
    ingresando: 'Ingresando…',
    incorrectas: 'Correo o contraseña incorrectos',
    fallo: 'No se pudo iniciar sesión. Inténtelo de nuevo.'
  },
  shell: {
    salir: 'Cerrar sesión',
    secciones: 'Secciones',
    leyendoPermisos: 'Leyendo los permisos de su cuenta…',
    sinPermisos: 'No se pudieron leer sus permisos',
    sinAcceso: 'Su cuenta no puede abrir «{{seccion}}».',
    preguntar: 'Preguntar',
    asistentePorLlegar: 'El asistente de IA llega en una próxima fase',
    idioma: 'Idioma',
    idiomaNoGuardado: 'No se pudo guardar el idioma'
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
  inicio: {
    titulo: 'Dashboard',
    bienvenida: 'Le damos la bienvenida, {{nombre}}.',
    porRol: 'Cada rol tendrá su propio inicio cuando llegue su módulo; mientras tanto, todas las cuentas empiezan aquí.',
    cuenta: 'Su cuenta',
    usuario: 'Usuario',
    organizacion: 'Organización',
    roles: 'Roles',
    cargando: 'Cargando…',
    sinOrganizacion: 'No se pudo leer la organización',
    sinCuenta: 'No se pudo leer la cuenta',
    sinRoles: 'Sin roles',
    sinPermisos: 'No se pudieron leer sus permisos',
    modulos: 'Módulos por fase',
    resumen: '{{disponibles, number}} de {{total, number}} secciones disponibles para su cuenta',
    seccion: 'Sección',
    fases: 'Fases',
    estado: 'Estado',
    llegaEn: 'Llega en {{fase}}',
    notasDeFases: { reports: 'F2–F4 exportaciones; F8 entregables' },
    estados: { disponible: 'Disponible', 'sin-acceso': 'Sin acceso con sus permisos', 'solo-admin': 'Solo para administración' }
  },
  seccionPorLlegar: 'Esta sección llega en {{fase}}',
  noEncontrada: 'Esta página no existe'
}

export type Textos = typeof ES
