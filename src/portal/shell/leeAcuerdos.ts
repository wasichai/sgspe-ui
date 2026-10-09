import type { Par } from './navTree'

// los acuerdos viven bajo Compromisos, pero se leen con su propio permiso: la pestaña Acuerdos, /projects/:projectId/agreements
// y /agreements se ofrecen con READ sobre agreement, no sobre commitment. vive aparte de navTree.ts porque las tablas de rutas
// (pantallas.ts, rutasEnProyecto.ts) lo usan al cargarse y navTree.ts importa pantallas.ts: así no hay un ciclo de valores
export const LEE_ACUERDOS: Par[][] = [[{ objeto: 'agreement', accion: 'READ' }]]
