import type { ComponentType } from 'react'
import { FichaActorPage } from './grupos/FichaActorPage'
import { GruposRutas } from './grupos/GruposRutas'
import { ProyectosRutas } from './proyectos/ProyectosRutas'
import { RelacionamientoRutas } from './relacionamiento/RelacionamientoRutas'
import type { ClaveDeSeccion } from './shell/navTree'
import { TerritorioRutas } from './territorio/TerritorioRutas'

// la pantalla de cada sección, por su clave (como PANTALLAS de caja-ui@a45b224). una sección sin pantalla no se dibuja:
// una entrada de menú que no lleva a ninguna parte es un defecto. la pantalla se monta en `<ruta>/*` y declara sus rutas
// hijas. cada fase registra aquí las suyas; el Dashboard es la ruta índice y Administración es /admin
export const PANTALLAS: Partial<Record<ClaveDeSeccion, ComponentType>> = {
  projects: ProyectosRutas,
  territory: TerritorioRutas,
  stakeholders: GruposRutas,
  engagements: RelacionamientoRutas
}

// rutas del portal que no son una sección pero viven bajo los permisos de una (ux-architecture.md §6.2): la ficha de actor
// es de Grupos de interés y las visitas de campo globales, de Relacionamiento
export interface RutaAdicional {
  ruta: string
  seccion: ClaveDeSeccion
  Pantalla: ComponentType
}

export const RUTAS_ADICIONALES: RutaAdicional[] = [{ ruta: '/actors/:actorId', seccion: 'stakeholders', Pantalla: FichaActorPage }]
