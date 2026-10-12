// las capas públicas por el proxy WMS de SGSPE (spec F6 §3.3, gis.md §6.2): GeoServer nunca recibe una petición del navegador
// sin pasar por /api/sgspe/territory/wms. el portal no conoce las tablas físicas: lee el GetCapabilities del proxy (WMS 1.3.0,
// armado con la lista blanca de la organización) y reconoce cada capa por su estilo sgspe-lyr-NN o sgspe-lyr-NN-<variante>
// (model/layers.json, plan 6.1)
export const CAPAS_WMS: readonly string[] = ['LYR-01', 'LYR-02', 'LYR-03', 'LYR-04', 'LYR-05', 'LYR-07', 'LYR-16']

export const RUTA_DEL_PROXY = '/api/sgspe/territory/wms'

// una capa de GeoServer con uno de sus estilos: una LYR-NN puede tener varias (LYR-02: ubicación y límite; LYR-16: escuelas
// y salud) y una capa física puede servir a varias LYR-NN (la ubicación de las localidades: LYR-02 y LYR-03)
export interface CapaPublicada {
  capa: string
  nombre: string
  estilo: string
}

const ESTILO = /^sgspe-lyr-(\d{2})(?:-[a-z]+)?$/i

// los hijos directos con ese nombre de etiqueta: el GetCapabilities del proxy usa el espacio de nombres WMS por defecto, sin
// prefijo, así que tagName es el nombre local
const hijos = (elemento: Element, etiqueta: string): Element[] => [...elemento.children].filter((h) => h.tagName === etiqueta)
const nombreDe = (elemento: Element): string => hijos(elemento, 'Name')[0]?.textContent?.trim() ?? ''

// una entrada por cada estilo reconocido de cada <Layer> con nombre (la raíz «SGSPE» no lo tiene); un XML ilegible o sin capas
// reconocidas es una lista vacía. la capa física se usa tal cual, sin interpretarla
export function leerCapacidades(xml: string): CapaPublicada[] {
  const documento = new DOMParser().parseFromString(xml, 'application/xml')
  if (documento.getElementsByTagName('parsererror').length > 0) return []
  return [...documento.getElementsByTagName('Layer')].flatMap((elemento) => {
    const nombre = nombreDe(elemento)
    if (!nombre) return []
    return hijos(elemento, 'Style').flatMap((s) => {
      const estilo = nombreDe(s)
      const numero = ESTILO.exec(estilo)?.[1]
      const capa = `LYR-${numero}`
      return numero && CAPAS_WMS.includes(capa) ? [{ capa, nombre, estilo }] : []
    })
  })
}

// la URL de GetMap del proxy para las capas publicadas de una LYR-NN, en el mismo origen: wmsTileUrl le suma bbox, tamaño, srs,
// formato y transparencia. varias capas (LYR-16: escuelas y salud) van en un solo GetMap, cada una con su estilo. el estilo va
// siempre explícito (vacío daría el primero de la capa: la ubicación de LYR-02 también para LYR-03) y la versión siempre 1.1.1,
// la que lleva srs (sin versión el proxy reenvía 1.3.0, que pide crs). ningún otro parámetro: el proxy rechaza lo demás
export const urlDeWms = (capas: readonly CapaPublicada[], origen: string = window.location.origin): string => {
  const lista = (valores: string[]) => valores.map(encodeURIComponent).join(',')
  return `${origen}${RUTA_DEL_PROXY}?service=WMS&version=1.1.1&request=GetMap&layers=${lista(capas.map((c) => c.nombre))}&styles=${lista(capas.map((c) => c.estilo))}`
}

// transformRequest de MapLibre: el token de wasichai va solo a las peticiones del proxy del mismo origen; el mapa base, sus
// glifos y sus sprites (otro host) nunca lo reciben
export function firmaDeWms(token: () => string | null, origen: string) {
  const proxy = `${origen}${RUTA_DEL_PROXY}`
  return (url: string): { url: string; headers?: Record<string, string> } => {
    const delProxy = url === proxy || url.startsWith(`${proxy}?`)
    const valor = delProxy ? token() : null
    return valor ? { url, headers: { Authorization: `Bearer ${valor}` } } : { url }
  }
}
