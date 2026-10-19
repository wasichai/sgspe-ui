import { RUTAS_ADICIONALES } from '../pantallas'
import { RUTAS_EN_PROYECTO } from '../proyectos/rutasEnProyecto'
import { NAV_TREE, type ClaveDeSeccion } from './navTree'

// la sección que la barra lateral marca para una ruta (revisión de UX, etapa 1): dentro de un proyecto, la del módulo abierto
// (/projects/:id/commitments/… es Compromisos, no Proyectos), con la sección que cada ruta declara en RUTAS_EN_PROYECTO; las
// de Project 360 que no son de un módulo (resumen, mapa, equipo) son Proyectos. las fichas de los maestros fuera de una
// sección (/actors, /field-visits, /agreements) marcan la suya (RUTAS_ADICIONALES). los avisos y /r/… no marcan ninguna
const primerSegmento = (ruta: string) => ruta.replace(/^\//, '').split('/')[0]

export function seccionDeRuta(pathname: string): ClaveDeSeccion | null {
  if (pathname === '/') return 'dashboard'
  const segmentos = pathname.split('/').filter(Boolean)
  if (segmentos[0] === 'projects') {
    if (segmentos.length < 3) return 'projects'
    return RUTAS_EN_PROYECTO.find((r) => primerSegmento(r.ruta) === segmentos[2])?.seccion ?? 'projects'
  }
  const seccion = NAV_TREE.find((s) => s.to !== '/' && !s.external && primerSegmento(s.to) === segmentos[0])
  if (seccion) return seccion.clave
  return RUTAS_ADICIONALES.find((r) => primerSegmento(r.ruta) === segmentos[0])?.seccion ?? null
}
