import { EN_ACUERDOS } from './acuerdos'
import { EN_APROBACIONES } from './aprobaciones'
import { EN_AREAS } from './areas'
import { EN_AVISOS } from './avisos'
import { EN_COMPROMISOS } from './compromisos'
import { EN_COMUN } from './comun'
import { EN_CONTEXTO } from './contexto'
import { EN_DOCUMENTOS } from './documentos'
import { EN_ENTREGAS } from './entregas'
import { EN_EVIDENCIAS } from './evidencias'
import { EN_FICHA_COMPROMISO } from './fichaCompromiso'
import { EN_GRUPOS } from './grupos'
import { EN_IMPORTACION } from './importacion'
import { EN_MAPA } from './mapa'
import { EN_NUEVO_COMPROMISO } from './nuevoCompromiso'
import { EN_P360 } from './p360'
import { EN_PROYECTOS } from './proyectos'
import { EN_RELACIONAMIENTO } from './relacionamiento'
import { EN_REPORTES } from './reportes'
import { EN_REPROGRAMACIONES } from './reprogramaciones'
import { EN_SEGUIMIENTO } from './seguimiento'
import { EN_TABLERO_COMPROMISOS } from './tableroCompromisos'
import { EN_TABLEROS } from './tableros'
import { EN_TAREAS } from './tareas'
import { EN_TERRITORIO } from './territorio'
import { EN_TRANSICIONES } from './transiciones'
import type { Textos } from './es'

// los mismos textos en inglés. Textos obliga a tener cada clave de es.ts (typecheck) y I18n.test.tsx lo comprueba al correr
export const EN: Textos = {
  areas: EN_AREAS,
  comun: EN_COMUN,
  contexto: EN_CONTEXTO,
  grupos: EN_GRUPOS,
  importacion: EN_IMPORTACION,
  mapa: EN_MAPA,
  p360: EN_P360,
  proyectos: EN_PROYECTOS,
  relacionamiento: EN_RELACIONAMIENTO,
  reportes: EN_REPORTES,
  tableros: EN_TABLEROS,
  territorio: EN_TERRITORIO,
  transiciones: EN_TRANSICIONES,
  // F3: compromisos, acuerdos, evidencias, tareas y avisos
  evidencias: EN_EVIDENCIAS,
  documentos: EN_DOCUMENTOS,
  compromisos: EN_COMPROMISOS,
  nuevoCompromiso: EN_NUEVO_COMPROMISO,
  fichaCompromiso: EN_FICHA_COMPROMISO,
  seguimiento: EN_SEGUIMIENTO,
  reprogramaciones: EN_REPROGRAMACIONES,
  entregas: EN_ENTREGAS,
  avisos: EN_AVISOS,
  tareas: EN_TAREAS,
  aprobaciones: EN_APROBACIONES,
  acuerdos: EN_ACUERDOS,
  tableroCompromisos: EN_TABLERO_COMPROMISOS,
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
