import type { Textos } from './es'

// los mismos textos en inglés. Textos obliga a tener cada clave de es.ts (typecheck) y I18n.test.tsx lo comprueba al correr
export const EN: Textos = {
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
    sinAcceso: 'Your account cannot open “{{seccion}}”.',
    preguntar: 'Ask',
    asistentePorLlegar: 'The AI assistant arrives in a later phase',
    idioma: 'Language'
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
  inicio: { titulo: 'Dashboard' },
  noEncontrada: 'This page does not exist'
}
