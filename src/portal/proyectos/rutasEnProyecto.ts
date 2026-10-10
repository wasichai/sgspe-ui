import type { ComponentType } from 'react'
import { AcuerdosPage } from '../acuerdos/AcuerdosPage'
import { AtencionPage } from '../atencion/AtencionPage'
import { FichaConsultaPage, FichaSolicitudPage } from '../atencion/FichaConsultaPage'
import { FichaQuejaPage } from '../atencion/FichaQuejaPage'
import { NuevaQcsPage } from '../atencion/NuevaQcsPage'
import { ReporteQcsPage } from '../atencion/ReporteQcsPage'
import { TableroAtencionPage } from '../atencion/TableroAtencionPage'
import { AlertasPage, FichaAlertaPage } from '../riesgos/AlertasPage'
import { FichaRiesgoPage } from '../riesgos/FichaRiesgoPage'
import { ImpactosPage } from '../riesgos/ImpactosPage'
import { FichaIncidentePage, IncidentesPage } from '../riesgos/IncidentesPage'
import { MencionesPage } from '../riesgos/MencionesPage'
import { ReglasPage } from '../riesgos/ReglasPage'
import { RiesgosPage } from '../riesgos/RiesgosPage'
import { SenalesPage } from '../riesgos/SenalesPage'
import { TableroRiesgosPage } from '../riesgos/TableroRiesgosPage'
import { FichaAcuerdoPage } from '../acuerdos/FichaAcuerdoPage'
import { CompromisosPage } from '../compromisos/CompromisosPage'
import { FichaCompromisoPage } from '../compromisos/FichaCompromisoPage'
import { NuevoCompromisoPage } from '../compromisos/NuevoCompromisoPage'
import { TableroCompromisosPage } from '../compromisos/TableroCompromisosPage'
import { BibliotecaPage } from '../documentos/BibliotecaPage'
import { FichaEvidenciaPage } from '../documentos/FichaEvidenciaPage'
import { MisTareasPage } from '../tareas/MisTareasPage'
import { LEE_ACUERDOS } from '../shell/leeAcuerdos'
import type { ClaveDeSeccion, Par } from '../shell/navTree'
import { FichaGrupoPage } from '../grupos/FichaGrupoPage'
import { GruposPage } from '../grupos/GruposPage'
import { MatrizPage } from '../grupos/MatrizPage'
import { TableroGruposPage } from '../grupos/TableroGruposPage'
import { DetalleDeIndicadorPage } from '../tableros/DetalleDeIndicadorPage'
import { InteraccionesCalendarioPage, InteraccionesListaPage } from '../relacionamiento/RelacionamientoRutas'
import { EditorDeActaPage } from '../relacionamiento/EditorDeActaPage'
import { FichaInteraccionPage } from '../relacionamiento/FichaInteraccionPage'
import { RegistrarInteraccionPage } from '../relacionamiento/RegistrarInteraccionPage'
import { TableroRelacionamientoPage } from '../relacionamiento/TableroRelacionamientoPage'
import { VisitaDeCampoPage, VisitasPage } from '../relacionamiento/VisitaDeCampoPage'
import { ReportesPage } from '../reportes/ReportesPage'
import { AreaDeInfluenciaPage } from './AreaDeInfluenciaPage'
import { EquipoYParametrosPage } from './EquipoYParametrosPage'
import { MapaDelProyectoPage } from './MapaDelProyectoPage'
import { ResumenPage } from './ResumenPage'

// las rutas bajo /projects/:projectId que aporta cada módulo de F2 a F4, relativas al proyecto (screens.md §3 a §7 y §11). las
// de otra sección (grupos de interés, relacionamiento, compromisos, documentos, tareas, reportes) se guardan además con los
// permisos de esa sección
export interface RutaEnProyecto {
  ruta: string
  Pantalla: ComponentType
  seccion?: ClaveDeSeccion
  // los permisos que la ofrecen, si no son los de su sección: los acuerdos piden READ sobre agreement
  seOfreceCon?: Par[][]
}

export const RUTAS_EN_PROYECTO: RutaEnProyecto[] = [
  { ruta: 'overview', Pantalla: ResumenPage },
  { ruta: 'settings', Pantalla: EquipoYParametrosPage },
  { ruta: 'map', Pantalla: MapaDelProyectoPage },
  { ruta: 'areas/:areaId', Pantalla: AreaDeInfluenciaPage },
  { ruta: 'stakeholders', seccion: 'stakeholders', Pantalla: GruposPage },
  { ruta: 'stakeholders/matrix', seccion: 'stakeholders', Pantalla: MatrizPage },
  { ruta: 'stakeholders/dashboard', seccion: 'stakeholders', Pantalla: TableroGruposPage },
  { ruta: 'stakeholders/indicators/:code', seccion: 'stakeholders', Pantalla: DetalleDeIndicadorPage },
  { ruta: 'stakeholders/:stakeholderId', seccion: 'stakeholders', Pantalla: FichaGrupoPage },
  { ruta: 'engagements', seccion: 'engagements', Pantalla: InteraccionesListaPage },
  { ruta: 'engagements/calendar', seccion: 'engagements', Pantalla: InteraccionesCalendarioPage },
  { ruta: 'engagements/dashboard', seccion: 'engagements', Pantalla: TableroRelacionamientoPage },
  { ruta: 'engagements/new', seccion: 'engagements', Pantalla: RegistrarInteraccionPage },
  { ruta: 'engagements/:engagementId', seccion: 'engagements', Pantalla: FichaInteraccionPage },
  { ruta: 'engagements/:engagementId/minutes', seccion: 'engagements', Pantalla: EditorDeActaPage },
  { ruta: 'field-visits', seccion: 'engagements', Pantalla: VisitasPage },
  { ruta: 'field-visits/:visitId', seccion: 'engagements', Pantalla: VisitaDeCampoPage },
  { ruta: 'commitments', seccion: 'commitments', Pantalla: CompromisosPage },
  { ruta: 'commitments/dashboard', seccion: 'commitments', Pantalla: TableroCompromisosPage },
  { ruta: 'commitments/new', seccion: 'commitments', Pantalla: NuevoCompromisoPage },
  { ruta: 'commitments/:commitmentId', seccion: 'commitments', Pantalla: FichaCompromisoPage },
  { ruta: 'agreements', seccion: 'commitments', seOfreceCon: LEE_ACUERDOS, Pantalla: AcuerdosPage },
  { ruta: 'agreements/:agreementId', seccion: 'commitments', seOfreceCon: LEE_ACUERDOS, Pantalla: FichaAcuerdoPage },
  { ruta: 'documents', seccion: 'documents', Pantalla: BibliotecaPage },
  { ruta: 'documents/:documentId', seccion: 'documents', Pantalla: FichaEvidenciaPage },
  { ruta: 'tasks', seccion: 'tasks', Pantalla: MisTareasPage },
  { ruta: 'reports', seccion: 'reports', Pantalla: ReportesPage },
  // F4: quejas, consultas y solicitudes (S35, S37, S36, S57, S34 y el reporte unificado)
  { ruta: 'attention', seccion: 'attention', Pantalla: AtencionPage },
  { ruta: 'attention/new', seccion: 'attention', Pantalla: NuevaQcsPage },
  { ruta: 'attention/dashboard', seccion: 'attention', Pantalla: TableroAtencionPage },
  { ruta: 'attention/report', seccion: 'attention', Pantalla: ReporteQcsPage },
  { ruta: 'grievances/:grievanceId', seccion: 'attention', Pantalla: FichaQuejaPage },
  { ruta: 'inquiries/:inquiryId', seccion: 'attention', Pantalla: FichaConsultaPage },
  { ruta: 'requests/:requestId', seccion: 'attention', Pantalla: FichaSolicitudPage },
  // F4: riesgos y alerta temprana (S38 y S39, S40, S41, S58 a S62 y los incidentes). las rutas fijas ganan a risks/:riskId
  { ruta: 'risks', seccion: 'risks', Pantalla: RiesgosPage },
  { ruta: 'risks/register', seccion: 'risks', Pantalla: RiesgosPage },
  { ruta: 'risks/dashboard', seccion: 'risks', Pantalla: TableroRiesgosPage },
  { ruta: 'risks/warnings', seccion: 'risks', Pantalla: AlertasPage },
  { ruta: 'risks/warnings/:warningId', seccion: 'risks', Pantalla: FichaAlertaPage },
  { ruta: 'risks/mentions', seccion: 'risks', Pantalla: MencionesPage },
  { ruta: 'risks/mentions/:mentionId', seccion: 'risks', Pantalla: MencionesPage },
  { ruta: 'risks/signals', seccion: 'risks', Pantalla: SenalesPage },
  { ruta: 'risks/signals/:signalId', seccion: 'risks', Pantalla: SenalesPage },
  { ruta: 'risks/impacts', seccion: 'risks', Pantalla: ImpactosPage },
  { ruta: 'risks/rules', seccion: 'risks', Pantalla: ReglasPage },
  { ruta: 'risks/:riskId', seccion: 'risks', Pantalla: FichaRiesgoPage },
  { ruta: 'incidents', seccion: 'risks', Pantalla: IncidentesPage },
  { ruta: 'incidents/:incidentId', seccion: 'risks', Pantalla: FichaIncidentePage }
]
