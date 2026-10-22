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
import { ES_PAGINAS } from './paginas'
import { ES_MI_DIA } from './miDia'
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
import { ES_BUSQUEDA } from './busqueda'
import { ES_INVERSION } from './inversion'
import { ES_FICHA_PROGRAMA } from './fichaPrograma'
import { ES_FICHA_APORTE } from './fichaAporte'
import { ES_TABLERO_INVERSION } from './tableroInversion'
import { ES_SIG } from './sig'
import { ES_FICHA_TERRITORIAL } from './fichaTerritorial'
import { ES_TABLERO_TERRITORIAL } from './tableroTerritorial'
import { ES_ANALISIS_DEL_PROYECTO } from './analisisDelProyecto'
import { ES_SUGERENCIAS } from './sugerencias'
import { ES_EXPORTACION_GEOGRAFICA } from './exportacionGeografica'
import { ES_EDICION_DE_GEOMETRIA } from './edicionDeGeometria'
import { ES_UBICAR } from './ubicar'
import { ES_CALIDAD } from './calidad'
import { ES_IA } from './ia'
import { ES_ASISTENTE } from './asistente'
import { ES_BANDEJA_IA } from './bandejaIa'
import { ES_ACCIONES_IA } from './accionesIa'
import { ES_BORRADOR_DE_ACTA } from './borradorDeActa'
import { ES_TABLEROS_F8 } from './tablerosF8'
import { ES_ENTREGABLES } from './entregables'
import { ES_PLANTILLAS } from './plantillas'
import { ES_ADMINISTRACION } from './administracion'

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
  // revisión de UX: las piezas comunes de página y de ficha
  paginas: ES_PAGINAS,
  miDia: ES_MI_DIA,
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
  busqueda: ES_BUSQUEDA,
  // F5: programas e inversión social
  inversion: ES_INVERSION,
  fichaPrograma: ES_FICHA_PROGRAMA,
  fichaAporte: ES_FICHA_APORTE,
  tableroInversion: ES_TABLERO_INVERSION,
  // F6: SIG avanzado
  sig: ES_SIG,
  fichaTerritorial: ES_FICHA_TERRITORIAL,
  tableroTerritorial: ES_TABLERO_TERRITORIAL,
  analisisDelProyecto: ES_ANALISIS_DEL_PROYECTO,
  sugerencias: ES_SUGERENCIAS,
  exportacionGeografica: ES_EXPORTACION_GEOGRAFICA,
  edicionDeGeometria: ES_EDICION_DE_GEOMETRIA,
  ubicar: ES_UBICAR,
  calidad: ES_CALIDAD,
  // F7: IA
  ia: ES_IA,
  asistente: ES_ASISTENTE,
  bandejaIa: ES_BANDEJA_IA,
  accionesIa: ES_ACCIONES_IA,
  borradorDeActa: ES_BORRADOR_DE_ACTA,
  // F8: tableros consolidados y entregables
  tablerosF8: ES_TABLEROS_F8,
  entregables: ES_ENTREGABLES,
  plantillas: ES_PLANTILLAS,
  // el rediseño de UX: S53, la sección Administración
  administracion: ES_ADMINISTRACION,
  app: { lema: 'Gestión social de proyectos extractivos' },
  login: {
    correo: 'Correo',
    contrasena: 'Contraseña',
    ingresar: 'Ingresar',
    ingresando: 'Ingresando…',
    incorrectas: 'Correo o contraseña incorrectos',
    fallo: 'No se pudo iniciar sesión. Inténtelo de nuevo.'
  },
  sesionVencida: {
    titulo: 'Su sesión venció',
    texto: 'Lo que estaba haciendo sigue en la pantalla. Ingrese su contraseña para continuar y, si algo no se guardó, vuelva a guardarlo.',
    incorrecta: 'La contraseña no es correcta.'
  },
  shell: {
    insignias: {
      tareas_one: '{{count}} tarea suya vencida o por vencer',
      tareas_other: '{{count}} tareas suyas vencidas o por vencer',
      avisos_one: '{{count}} aviso sin leer que pide acción',
      avisos_other: '{{count}} avisos sin leer que piden acción'
    },
    salir: 'Cerrar sesión',
    menu: 'Menú',
    seccionesDelMenu: 'Secciones del menú',
    accesos: 'Accesos rápidos',
    mas: 'Más',
    secciones: 'Secciones',
    leyendoPermisos: 'Leyendo los permisos de su cuenta…',
    sinPermisos: 'No se pudieron leer sus permisos',
    preguntar: 'Preguntar',
    idioma: 'Idioma',
    idiomaNoGuardado: 'No se pudo guardar el idioma',
    tema: 'Tema',
    // los títulos de bloque de la navegación (navTree.ts, BLOQUES) y su «Contraer»
    bloques: {
      territorio: 'Proyectos y territorio',
      comunidades: 'Trabajo con las comunidades',
      riesgos: 'Riesgos e inversión social',
      seguimiento: 'Documentos y seguimiento'
    },
    contraer: 'Contraer',
    expandir: 'Expandir'
  },
  // las 13 secciones de docs/ux/ux-architecture.md §6.2, con la clave de NAV_TREE (Navigation.test.tsx las mantiene iguales)
  // el rótulo corto de una sección en la pestaña del proyecto (ProyectoLayout); el completo va en aria-label y title
  seccionesCortas: {
    attention: 'QCS'
  },
  // el nombre de una sección en la barra lateral, si no es el de secciones (DD-10): el completo va en title
  seccionesEnLaBarra: {
    attention: 'Quejas y solicitudes'
  },
  secciones: {
    dashboard: 'Inicio',
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
    titulo: 'Inicio',
    bienvenida: 'Le damos la bienvenida, {{nombre}}.',
    cuenta: 'Su cuenta',
    usuario: 'Usuario',
    organizacion: 'Organización',
    roles: 'Roles',
    cargando: 'Cargando…',
    sinOrganizacion: 'No se pudo leer la organización',
    sinCuenta: 'No se pudo leer la cuenta',
    sinRoles: 'Sin roles',
    sinPermisos: 'No se pudieron leer sus permisos',
    modulos: 'Sus secciones',
    rolesAsignados_one: '{{count}} rol asignado',
    rolesAsignados_other: '{{count}} roles asignados',
    resumen: '{{disponibles, number}} de {{total, number}} secciones disponibles para su cuenta'
  },
  seccionPorLlegar: 'Esta sección todavía no está disponible en su organización.',
  noEncontrada: 'Esta página no existe',
  irAlInicio: 'Ir al inicio'
}

export type Textos = typeof ES
