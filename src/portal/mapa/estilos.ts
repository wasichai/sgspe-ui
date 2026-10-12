// los colores de las capas que no salen por WMS (LYR-06, LYR-08 a LYR-15 y las de gestión, sin SLD en model/styles) y la
// rampa del mapa de calor: viven aquí y no en paleta.json, que es copia exacta de la paleta de sgspe. Mismos hex que los tokens
// --sg-data-*
export interface EstiloPropio {
  color: string
  fillOpacity: number
  dash?: number[]
}

export const ESTILOS_PROPIOS: Readonly<Record<string, EstiloPropio>> = {
  'LYR-06': { color: '#b59a62', fillOpacity: 0.15 },
  'LYR-08': { color: '#6b7f2a', fillOpacity: 0.15 },
  'LYR-09': { color: '#1d5c52', fillOpacity: 0.1, dash: [2, 2] },
  'LYR-10': { color: '#8e5a9e', fillOpacity: 0.15 },
  'LYR-11': { color: '#838b85', fillOpacity: 0.15 },
  'LYR-12': { color: '#1d5c52', fillOpacity: 0 },
  'LYR-13': { color: '#1d5c52', fillOpacity: 0.15 },
  'LYR-14': { color: '#c9772b', fillOpacity: 0.15 },
  'LYR-15': { color: '#838b85', fillOpacity: 0.15 },
  // las de gestión (LYR-17 a LYR-24): puntos, y las rutas de las visitas de LYR-18
  'LYR-17': { color: '#2b5f8f', fillOpacity: 0.15 },
  'LYR-18': { color: '#1d5c52', fillOpacity: 0.15 },
  'LYR-19': { color: '#6b7f2a', fillOpacity: 0.15 },
  'LYR-20': { color: '#a33a2a', fillOpacity: 0.15 },
  'LYR-21': { color: '#c9772b', fillOpacity: 0.15 },
  'LYR-22': { color: '#8e5a9e', fillOpacity: 0.15 },
  'LYR-23': { color: '#b59a62', fillOpacity: 0.15 },
  'LYR-24': { color: '#838b85', fillOpacity: 0.15 }
}

// la rampa del mapa de calor, de poco a mucho
export const RAMPA_DE_CALOR: readonly string[] = ['#f3eee2', '#e3b65a', '#c9772b', '#a33a2a']
