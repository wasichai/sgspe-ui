import { ES_ACUERDOS } from './acuerdos'
import { ES_APROBACIONES } from './aprobaciones'
import { ES_AREAS } from './areas'
import { ES_AVISOS } from './avisos'
import { ES_COMPROMISOS } from './compromisos'
import { ES_COMUN } from './comun'
import { ES_CONTEXTO } from './contexto'
import { ES_DOCUMENTOS } from './documentos'
import { ES_ENTREGAS } from './entregas'
import { ES_EVIDENCIAS } from './evidencias'
import { ES_FICHA_COMPROMISO } from './fichaCompromiso'
import { ES_GRUPOS } from './grupos'
import { ES_IMPORTACION } from './importacion'
import { ES_MAPA } from './mapa'
import { ES_NUEVO_COMPROMISO } from './nuevoCompromiso'
import { ES_P360 } from './p360'
import { ES_PROYECTOS } from './proyectos'
import { ES_RELACIONAMIENTO } from './relacionamiento'
import { ES_REPORTES } from './reportes'
import { ES_REPROGRAMACIONES } from './reprogramaciones'
import { ES_SEGUIMIENTO } from './seguimiento'
import { ES_TABLERO_COMPROMISOS } from './tableroCompromisos'
import { ES_TABLEROS } from './tableros'
import { ES_TAREAS } from './tareas'
import { ES_TERRITORIO } from './territorio'
import { ES_TRANSICIONES } from './transiciones'
import { ES_PIEZAS } from './piezas'
import { ES_ATENCION } from './atencion'
import { ES_NUEVA_QCS } from './nuevaQcs'
import { ES_FICHA_QUEJA } from './fichaQueja'
import { ES_FICHA_CONSULTA } from './fichaConsulta'
import { ES_TABLERO_ATENCION } from './tableroAtencion'
import { ES_REPORTE_QCS } from './reporteQcs'
import { ES_RIESGOS } from './riesgos'
import { ES_FICHA_RIESGO } from './fichaRiesgo'
import { ES_ALERTAS } from './alertas'
import { ES_INCIDENTES } from './incidentes'
import { ES_REGISTROS_DE_ALERTA } from './registrosDeAlerta'
import { ES_REGLAS_DE_ALERTA } from './reglasDeAlerta'
import { ES_TABLERO_RIESGOS } from './tableroRiesgos'
import { ES_INVERSION } from './inversion'
import { ES_FICHA_PROGRAMA } from './fichaPrograma'
import { ES_FICHA_APORTE } from './fichaAporte'
import { ES_TABLERO_INVERSION } from './tableroInversion'

// los textos del portal en español, el idioma por defecto (RNF-I18N-001). en.ts tiene las mismas claves. cada módulo de
// F2 trae los suyos en su archivo (comun.ts, proyectos.ts…) con su par en inglés
export const ES = {
  areas: ES_AREAS,
  comun: ES_COMUN,
  contexto: ES_CONTEXTO,
  grupos: ES_GRUPOS,
  importacion: ES_IMPORTACION,
  mapa: ES_MAPA,
  p360: ES_P360,
  proyectos: ES_PROYECTOS,
  relacionamiento: ES_RELACIONAMIENTO,
  reportes: ES_REPORTES,
  tableros: ES_TABLEROS,
  territorio: ES_TERRITORIO,
  transiciones: ES_TRANSICIONES,
  // F3: compromisos, acuerdos, evidencias, tareas y avisos
  evidencias: ES_EVIDENCIAS,
  documentos: ES_DOCUMENTOS,
  compromisos: ES_COMPROMISOS,
  nuevoCompromiso: ES_NUEVO_COMPROMISO,
  fichaCompromiso: ES_FICHA_COMPROMISO,
  seguimiento: ES_SEGUIMIENTO,
  reprogramaciones: ES_REPROGRAMACIONES,
  entregas: ES_ENTREGAS,
  avisos: ES_AVISOS,
  tareas: ES_TAREAS,
  aprobaciones: ES_APROBACIONES,
  acuerdos: ES_ACUERDOS,
  tableroCompromisos: ES_TABLERO_COMPROMISOS,
  // F4: quejas, consultas y solicitudes, riesgos y alerta temprana
  piezas: ES_PIEZAS,
  atencion: ES_ATENCION,
  nuevaQcs: ES_NUEVA_QCS,
  fichaQueja: ES_FICHA_QUEJA,
  fichaConsulta: ES_FICHA_CONSULTA,
  tableroAtencion: ES_TABLERO_ATENCION,
  reporteQcs: ES_REPORTE_QCS,
  riesgos: ES_RIESGOS,
  fichaRiesgo: ES_FICHA_RIESGO,
  alertas: ES_ALERTAS,
  incidentes: ES_INCIDENTES,
  registrosDeAlerta: ES_REGISTROS_DE_ALERTA,
  reglasDeAlerta: ES_REGLAS_DE_ALERTA,
  tableroRiesgos: ES_TABLERO_RIESGOS,
  // F5: programas e inversión social
  inversion: ES_INVERSION,
  fichaPrograma: ES_FICHA_PROGRAMA,
  fichaAporte: ES_FICHA_APORTE,
  tableroInversion: ES_TABLERO_INVERSION,
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
