// la configuración del despliegue que el portal lee (vite.config.ts la toma de SGSPE_ROL_JEFATURA)

// el rol de wasichai cuyas asignaciones activas son la jefatura del proyecto (ASM-080). es un dato del despliegue, no un
// literal del portal: así ningún fuente nombra un rol (RQ-SEC-005) y la jefatura no decide ningún permiso, solo se muestra
export const ROL_DE_JEFATURA: string = __SGSPE_ROL_JEFATURA__
