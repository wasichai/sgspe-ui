// los colores de las capas que no salen por WMS (LYR-06, LYR-08 a LYR-15 y las de gestión, sin SLD en model/styles) y la
// rampa del mapa de calor: viven aquí y no en paleta.json, que es copia exacta de la paleta de sgspe. Son tokens del tema
// (design-system.md §3.3, paleta cartográfica): --sg-lyr-* y --sg-map-* para el territorio y el proyecto, las escalas de datos
// para la gestión y --sg-heat-* para el calor, que colorDe (colores.ts) resuelve con el tema activo y MapaImpl repinta al
// cambiarlo. Nunca un tono semántico: un estado no se confunde con una capa
export interface EstiloPropio {
  color: string
  fillOpacity: number
  dash?: number[]
}

export const ESTILOS_PROPIOS: Readonly<Record<string, EstiloPropio>> = {
  // tenencia (oliva y siena): los sectores dentro del territorio comunal (LYR-05) y los predios
  'LYR-06': { color: '--sg-lyr-community-label', fillOpacity: 0.05, dash: [4, 2] },
  'LYR-14': { color: '--sg-lyr-concession', fillOpacity: 0.12 },
  'LYR-15': { color: '--sg-lyr-boundary', fillOpacity: 0.12 },
  // referencia: los elementos ambientales, en el azul del agua
  'LYR-08': { color: '--sg-lyr-water', fillOpacity: 0.15 },
  // proyecto (azul institucional): el área de interés punteada, las de influencia con su relleno; los componentes en marino
  'LYR-09': { color: '--sg-lyr-project', fillOpacity: 0, dash: [3, 3] },
  'LYR-13': { color: '--sg-lyr-project', fillOpacity: 0.12 },
  'LYR-10': { color: '--sg-lyr-access', fillOpacity: 0.15 },
  'LYR-11': { color: '--sg-lyr-access', fillOpacity: 0.25 },
  'LYR-12': { color: '--sg-lyr-access', fillOpacity: 0, dash: [5, 4] },
  // gestión (LYR-17 a LYR-24): puntos, y las rutas de las visitas de LYR-18, con las escalas de datos
  'LYR-17': { color: '--sg-stance-favor', fillOpacity: 0.15 },
  'LYR-18': { color: '--sg-data-6', fillOpacity: 0.15 },
  'LYR-19': { color: '--sg-data-3', fillOpacity: 0.15 },
  'LYR-20': { color: '--sg-heat-3', fillOpacity: 0.15 },
  'LYR-21': { color: '--sg-risk-high', fillOpacity: 0.15 },
  'LYR-22': { color: '--sg-data-2', fillOpacity: 0.15 },
  'LYR-23': { color: '--sg-data-4', fillOpacity: 0.15 },
  'LYR-24': { color: '--sg-data-5', fillOpacity: 0.15 }
}

// la rampa del mapa de calor, de poco a mucho (1–2, 3–5, 6–9 y 10 o más)
export const RAMPA_DE_CALOR: readonly string[] = ['--sg-heat-1', '--sg-heat-2', '--sg-heat-3', '--sg-heat-4']
