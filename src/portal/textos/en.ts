import { EN_COMUN } from './comun'
import { EN_TRANSICIONES } from './transiciones'
import type { Textos } from './es'

// los mismos textos en inglés. Textos obliga a tener cada clave de es.ts (typecheck) y I18n.test.tsx lo comprueba al correr
export const EN: Textos = {
  comun: EN_COMUN,
  transiciones: EN_TRANSICIONES,
  app: { lema: 'Social management for extractive projects' },
  login: {
    correo: 'Email',
    contrasena: 'Password',
    ingresar: 'Sign in',
    ingresando: 'Signing in…',
    incorrectas: 'Wrong email or password',
    fallo: 'Could not sign in. Please try again.'
  },
  shell: {
    salir: 'Sign out',
    secciones: 'Sections',
    leyendoPermisos: 'Reading your account permissions…',
    sinPermisos: 'Your permissions could not be read',
    sinAcceso: 'Your account cannot open “{{seccion}}”.',
    preguntar: 'Ask',
    asistentePorLlegar: 'The AI assistant arrives in a later phase',
    idioma: 'Language',
    idiomaNoGuardado: 'Could not save the language'
  },
  secciones: {
    dashboard: 'Dashboard',
    projects: 'Projects',
    territory: 'Territory',
    stakeholders: 'Stakeholders',
    engagements: 'Engagement',
    commitments: 'Commitments',
    attention: 'Grievances, inquiries and requests',
    risks: 'Risks',
    programs: 'Social programs',
    documents: 'Documents',
    tasks: 'Tasks',
    reports: 'Reports',
    admin: 'Administration'
  },
  inicio: {
    titulo: 'Dashboard',
    bienvenida: 'Welcome, {{nombre}}.',
    porRol: 'Each role gets its own home when its module arrives; until then, every account starts here.',
    cuenta: 'Your account',
    usuario: 'User',
    organizacion: 'Organization',
    roles: 'Roles',
    cargando: 'Loading…',
    sinOrganizacion: 'Could not read the organization',
    sinCuenta: 'Could not read the account',
    sinRoles: 'No roles',
    sinPermisos: 'Your permissions could not be read',
    modulos: 'Modules by phase',
    resumen: '{{disponibles, number}} of {{total, number}} sections available to your account',
    seccion: 'Section',
    fases: 'Phases',
    estado: 'Status',
    llegaEn: 'Arrives in {{fase}}',
    notasDeFases: { reports: 'F2–F4 exports; F8 deliverables' },
    estados: { disponible: 'Available', 'sin-acceso': 'No access with your permissions', 'solo-admin': 'Administrators only' }
  },
  seccionPorLlegar: 'This section arrives in {{fase}}',
  noEncontrada: 'This page does not exist'
}
