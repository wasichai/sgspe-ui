import type { ComponentType } from 'react'
import type { ClaveDeSeccion } from '../shell/navTree'
import { GruposPage } from '../grupos/GruposPage'
import { AreaDeInfluenciaPage } from './AreaDeInfluenciaPage'
import { EquipoYParametrosPage } from './EquipoYParametrosPage'
import { MapaDelProyectoPage } from './MapaDelProyectoPage'
import { ResumenPage } from './ResumenPage'

// las rutas bajo /projects/:projectId que aporta cada módulo de F2, relativas al proyecto (screens.md §3 a §6). las de
// otra sección (grupos de interés, relacionamiento, reportes) se guardan además con los permisos de esa sección
export interface RutaEnProyecto {
  ruta: string
  Pantalla: ComponentType
  seccion?: ClaveDeSeccion
}

export const RUTAS_EN_PROYECTO: RutaEnProyecto[] = [
  { ruta: 'overview', Pantalla: ResumenPage },
  { ruta: 'settings', Pantalla: EquipoYParametrosPage },
  { ruta: 'map', Pantalla: MapaDelProyectoPage },
  { ruta: 'areas/:areaId', Pantalla: AreaDeInfluenciaPage },
  { ruta: 'stakeholders', seccion: 'stakeholders', Pantalla: GruposPage }
]
