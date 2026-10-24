import type { ComponentType } from 'react'
import { CatalogoDeIndicadoresPage } from './tableros/CatalogoDeIndicadoresPage'
import { DetalleDeIndicadorPage } from './tableros/DetalleDeIndicadorPage'
import { MonitoreoPage } from './tableros/MonitoreoPage'
import { RevisionEjecutivaPage } from './tableros/RevisionEjecutivaPage'
import { AcuerdosPage } from './acuerdos/AcuerdosPage'
import { AdministracionPage } from './administracion/AdministracionPage'
import { AtencionRutas } from './atencion/AtencionRutas'
import { CompromisosRutas } from './compromisos/CompromisosRutas'
import { DocumentosRutas } from './documentos/DocumentosRutas'
import { FichaActorPage } from './grupos/FichaActorPage'
import { GruposRutas } from './grupos/GruposRutas'
import { ProgramasRutas } from './inversion/ProgramasRutas'
import { ProyectosRutas } from './proyectos/ProyectosRutas'
import { RelacionamientoRutas } from './relacionamiento/RelacionamientoRutas'
import { ReportesRutas } from './reportes/ReportesRutas'
import { RiesgosRutas } from './riesgos/RiesgosRutas'
import { TareasRutas } from './tareas/TareasRutas'
import { VisitasPage } from './relacionamiento/VisitaDeCampoPage'
import { LEE_ACUERDOS } from './shell/leeAcuerdos'
import type { ClaveDeSeccion, Par } from './shell/navTree'
import { TerritorioRutas } from './territorio/TerritorioRutas'

// la pantalla de cada sección, por su clave (como PANTALLAS de caja-ui@a45b224). una sección sin pantalla no se dibuja:
// una entrada de menú que no lleva a ninguna parte es un defecto. la pantalla se monta en `<ruta>/*` y declara sus rutas
// hijas. cada fase registra aquí las suyas; el Dashboard es la ruta índice. Administración es S53, que enlaza la consola (/admin)
export const PANTALLAS: Partial<Record<ClaveDeSeccion, ComponentType>> = {
  projects: ProyectosRutas,
  territory: TerritorioRutas,
  stakeholders: GruposRutas,
  engagements: RelacionamientoRutas,
  commitments: CompromisosRutas,
  attention: AtencionRutas,
  risks: RiesgosRutas,
  programs: ProgramasRutas,
  documents: DocumentosRutas,
  tasks: TareasRutas,
  reports: ReportesRutas,
  admin: AdministracionPage
}

// rutas del portal que no son una sección pero viven bajo los permisos de una (ux-architecture.md §6.2): la ficha de actor
// es de Grupos de interés, las visitas de campo globales de Relacionamiento y los acuerdos de todos los proyectos de Compromisos
export interface RutaAdicional {
  ruta: string
  seccion: ClaveDeSeccion
  // los permisos que la ofrecen, si no son los de su sección: los acuerdos piden READ sobre agreement
  seOfreceCon?: Par[][]
  Pantalla: ComponentType
}

export const RUTAS_ADICIONALES: RutaAdicional[] = [
  { ruta: '/actors/:actorId', seccion: 'stakeholders', Pantalla: FichaActorPage },
  { ruta: '/field-visits', seccion: 'engagements', Pantalla: VisitasPage },
  { ruta: '/agreements', seccion: 'commitments', seOfreceCon: LEE_ACUERDOS, Pantalla: AcuerdosPage },
  // F8 (decisión 2 del plan 8.3): el monitoreo de la Tabla 9.5 y el detalle de un indicador viven bajo Dashboard
  // el rediseño de UX (DD-01): la revisión ejecutiva S51 deja de ser el inicio y tiene su ruta
  { ruta: '/dashboards/executive', seccion: 'dashboard', Pantalla: RevisionEjecutivaPage },
  { ruta: '/dashboards/monitoring', seccion: 'dashboard', Pantalla: MonitoreoPage },
  { ruta: '/dashboards/indicators', seccion: 'dashboard', Pantalla: CatalogoDeIndicadoresPage },
  { ruta: '/dashboards/indicators/:code', seccion: 'dashboard', Pantalla: DetalleDeIndicadorPage }
]
