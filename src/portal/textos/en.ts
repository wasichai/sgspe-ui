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
import { EN_PIEZAS } from './piezas'
import { EN_ATENCION } from './atencion'
import { EN_NUEVA_QCS } from './nuevaQcs'
import { EN_FICHA_QUEJA } from './fichaQueja'
import { EN_FICHA_CONSULTA } from './fichaConsulta'
import { EN_TABLERO_ATENCION } from './tableroAtencion'
import { EN_REPORTE_QCS } from './reporteQcs'
import { EN_RIESGOS } from './riesgos'
import { EN_FICHA_RIESGO } from './fichaRiesgo'
import { EN_ALERTAS } from './alertas'
import { EN_INCIDENTES } from './incidentes'
import { EN_REGISTROS_DE_ALERTA } from './registrosDeAlerta'
import { EN_REGLAS_DE_ALERTA } from './reglasDeAlerta'
import { EN_TABLERO_RIESGOS } from './tableroRiesgos'
import { EN_INVERSION } from './inversion'
import { EN_FICHA_PROGRAMA } from './fichaPrograma'
import { EN_FICHA_APORTE } from './fichaAporte'
import { EN_TABLERO_INVERSION } from './tableroInversion'
import { EN_SIG } from './sig'
import { EN_FICHA_TERRITORIAL } from './fichaTerritorial'
import { EN_TABLERO_TERRITORIAL } from './tableroTerritorial'
import { EN_ANALISIS_DEL_PROYECTO } from './analisisDelProyecto'
import { EN_SUGERENCIAS } from './sugerencias'
import { EN_EXPORTACION_GEOGRAFICA } from './exportacionGeografica'
import { EN_EDICION_DE_GEOMETRIA } from './edicionDeGeometria'
import { EN_UBICAR } from './ubicar'
import { EN_CALIDAD } from './calidad'
import { EN_IA } from './ia'
import { EN_ASISTENTE } from './asistente'
import { EN_BANDEJA_IA } from './bandejaIa'
import { EN_ACCIONES_IA } from './accionesIa'
import { EN_BORRADOR_DE_ACTA } from './borradorDeActa'
import { EN_TABLEROS_F8 } from './tablerosF8'
import { EN_ENTREGABLES } from './entregables'
import { EN_PLANTILLAS } from './plantillas'
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
  // F4: quejas, consultas y solicitudes, riesgos y alerta temprana
  piezas: EN_PIEZAS,
  atencion: EN_ATENCION,
  nuevaQcs: EN_NUEVA_QCS,
  fichaQueja: EN_FICHA_QUEJA,
  fichaConsulta: EN_FICHA_CONSULTA,
  tableroAtencion: EN_TABLERO_ATENCION,
  reporteQcs: EN_REPORTE_QCS,
  riesgos: EN_RIESGOS,
  fichaRiesgo: EN_FICHA_RIESGO,
  alertas: EN_ALERTAS,
  incidentes: EN_INCIDENTES,
  registrosDeAlerta: EN_REGISTROS_DE_ALERTA,
  reglasDeAlerta: EN_REGLAS_DE_ALERTA,
  tableroRiesgos: EN_TABLERO_RIESGOS,
  // F5: programas e inversión social
  inversion: EN_INVERSION,
  fichaPrograma: EN_FICHA_PROGRAMA,
  fichaAporte: EN_FICHA_APORTE,
  tableroInversion: EN_TABLERO_INVERSION,
  // F6: SIG avanzado
  sig: EN_SIG,
  fichaTerritorial: EN_FICHA_TERRITORIAL,
  tableroTerritorial: EN_TABLERO_TERRITORIAL,
  analisisDelProyecto: EN_ANALISIS_DEL_PROYECTO,
  sugerencias: EN_SUGERENCIAS,
  exportacionGeografica: EN_EXPORTACION_GEOGRAFICA,
  edicionDeGeometria: EN_EDICION_DE_GEOMETRIA,
  ubicar: EN_UBICAR,
  calidad: EN_CALIDAD,
  // F7: IA
  ia: EN_IA,
  asistente: EN_ASISTENTE,
  bandejaIa: EN_BANDEJA_IA,
  accionesIa: EN_ACCIONES_IA,
  borradorDeActa: EN_BORRADOR_DE_ACTA,
  // F8: tableros consolidados y entregables
  tablerosF8: EN_TABLEROS_F8,
  entregables: EN_ENTREGABLES,
  plantillas: EN_PLANTILLAS,
  app: { lema: 'Social management for extractive projects' },
  login: {
    correo: 'Email',
    contrasena: 'Password',
    ingresar: 'Sign in',
    ingresando: 'Signing in…',
    incorrectas: 'Wrong email or password',
    fallo: 'Could not sign in. Please try again.'
  },
  sesionVencida: {
    titulo: 'Your session expired',
    texto: 'What you were doing is still on screen. Enter your password to continue and, if something was not saved, save it again.',
    incorrecta: 'The password is not correct.'
  },
  shell: {
    salir: 'Sign out',
    menu: 'Menu',
    seccionesDelMenu: 'Menu sections',
    accesos: 'Quick access',
    mas: 'More',
    secciones: 'Sections',
    leyendoPermisos: 'Reading your account permissions…',
    sinPermisos: 'Your permissions could not be read',
    sinAcceso: 'Your account cannot open “{{seccion}}”.',
    preguntar: 'Ask',
    idioma: 'Language',
    idiomaNoGuardado: 'Could not save the language'
  },
  secciones: {
    dashboard: 'Home',
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
    titulo: 'Home',
    bienvenida: 'Welcome, {{nombre}}.',
    cuenta: 'Your account',
    usuario: 'User',
    organizacion: 'Organization',
    roles: 'Roles',
    cargando: 'Loading…',
    sinOrganizacion: 'Could not read the organization',
    sinCuenta: 'Could not read the account',
    sinRoles: 'No roles',
    sinPermisos: 'Your permissions could not be read',
    modulos: 'Your sections',
    rolesAsignados_one: '{{count}} role assigned',
    rolesAsignados_other: '{{count}} roles assigned',
    resumen: '{{disponibles, number}} of {{total, number}} sections available to your account'
  },
  seccionPorLlegar: 'This section is not available in your organization yet.',
  noEncontrada: 'This page does not exist',
  irAlInicio: 'Go to the home page'
}
