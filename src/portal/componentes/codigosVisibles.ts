// lo que delata un código interno en un texto visible (textosSinCodigos.test.ts y humo F4, D3): ni un ID de requisito o de
// decisión del diseño, ni el código de una acción, de un error, de un estado HTTP, de una transición o de un campo de la API.
// lo usan la guarda de los textos del portal y los textos que llegan de afuera (el detail de un error, el mensaje de una
// regla de transition-checks, la descripción de un campo del modelo): uno que delata un código no se muestra tal cual
export const PATRONES: [string, RegExp][] = [
  // un ID de requirements-analysis.md: RF-…, RNF-PRIV-004, ASM-090, UPS-23, CON-006
  ['ID de requisito', /\b(?:RF|RNF|RN|RQ|ASM|UPS|GAP|CON)-[A-Z0-9-]+/g],
  // una decisión del plan o del diseño: (D11), D10, P54. una fase (F4) sí se dice: «llega en F7»
  ['ID de decisión', /\b[DP]\d+\b/g],
  // un código de acción, de error o de enum en UPPER_SNAKE: DOWNLOAD_RESTRICTED, APPROVE_OVER_CAP
  ['código UPPER_SNAKE', /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g],
  // una acción de permiso de wasichai en crudo: «la acción APPROVE», «el permiso EXPORT»
  ['acción de permiso', /\b(?:READ|CREATE|UPDATE|DELETE|EXPORT|IMPORT|APPROVE|DOWNLOAD)\b/g],
  // un estado HTTP de error: «(400 OUT_OF_RANGE)», «responde 403»
  ['estado HTTP', /\b[45]\d\d\b/g],
  // un nombre de la API en camelCase o snake_case: requiresReason, ignoredFilters, due_date, reject_acknowledged
  ['nombre de la API', /\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g],
  // una propiedad de configuración: sgspe.calendar.holidays
  ['propiedad de configuración', /\b[a-z]+(?:\.[a-z_]+){2,}\b/g],
  // la transición nombrada en crudo por una regla del servidor: «La transición decline exige response»
  ['transición en crudo', /\b[Tt]ransici[oó]n [a-z][a-z0-9_]* (?:exige|sale)\b/g]
]

// los códigos que aparecen en un texto; las interpolaciones {{n}} de i18next no son texto visible
export function codigosEn(texto: string): string[] {
  const visible = texto.replace(/\{\{[^}]*\}\}/g, '')
  return PATRONES.flatMap(([nombre, patron]) => [...visible.matchAll(patron)].map(([m]) => `${nombre}: ${m}`))
}

export const tieneCodigos = (texto: string): boolean => codigosEn(texto).length > 0
