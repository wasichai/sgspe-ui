// la configuración del despliegue que el portal lee (vite.config.ts la toma de SGSPE_ROL_JEFATURA y SGSPE_MAPA_BASE)

// el rol de wasichai cuyas asignaciones activas son la jefatura del proyecto (ASM-080). es un dato del despliegue, no un
// literal del portal: así ningún fuente nombra un rol (RQ-SEC-005) y la jefatura no decide ningún permiso, solo se muestra
export const ROL_DE_JEFATURA: string = __SGSPE_ROL_JEFATURA__

// el estilo MapLibre del mapa base (gis.md §6.4, ASM-048): vacío es el fondo apagado de tokens.css, sin teselas externas.
// el despliegue le da el mismo valor que sgspe.map.base-style-url del backend: el mapa base no pasa por el backend en F2 y
// las dos piezas deben mostrar la misma cartografía (README, «Requisitos»)
export const ESTILO_DEL_MAPA_BASE: string = __SGSPE_MAPA_BASE__
