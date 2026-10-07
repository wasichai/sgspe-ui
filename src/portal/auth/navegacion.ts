// una navegación completa del navegador, para salir del router del portal hacia otra app del mismo bundle (/admin). aparte
// para que las pruebas la observen: jsdom no implementa window.location.assign
export const irA = (destino: string): void => window.location.assign(destino)
