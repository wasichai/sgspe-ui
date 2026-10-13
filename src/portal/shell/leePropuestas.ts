import type { Par } from './navTree'

// la bandeja de IA (S52) vive bajo Proyectos, pero se ofrece a quien lee las sugerencias de IA o los candidatos a compromiso. vive
// aparte de navTree.ts por lo mismo que leeAcuerdos.ts: las tablas de rutas lo usan al cargarse
export const LEE_PROPUESTAS: Par[][] = [[{ objeto: 'ai_suggestion', accion: 'READ' }], [{ objeto: 'commitment_candidate', accion: 'READ' }]]
