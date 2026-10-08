// de WGS 84 (EPSG:4326) a UTM WGS 84 del hemisferio sur, para la barra de coordenadas en el CRS de trabajo del proyecto
// (screens.md S09, gis.md §3.2). serie de Krüger de orden 4: error submilimétrico dentro de la zona. solo muestra: las
// áreas y distancias oficiales las calcula PostGIS en el servidor
const A = 6378137
const F = 1 / 298.257223563
const K0 = 0.9996
const N = F / (2 - F)
const A_RECT = (A / (1 + N)) * (1 + (N * N) / 4 + N ** 4 / 64)
const ALFA = [
  N / 2 - (2 * N * N) / 3 + (5 * N ** 3) / 16 + (41 * N ** 4) / 180,
  (13 * N * N) / 48 - (3 * N ** 3) / 5 + (557 * N ** 4) / 1440,
  (61 * N ** 3) / 240 - (103 * N ** 4) / 140,
  (49561 * N ** 4) / 161280
]

export interface Utm {
  este: number
  norte: number
}

// la zona UTM de un CRS de trabajo del catálogo ('EPSG 32717' → 17), o null si no es UTM sur WGS 84
export function zonaDe(crs: string | null | undefined): number | null {
  const m = /^EPSG 327(\d\d)$/.exec(crs ?? '')
  return m ? Number(m[1]) : null
}

export function aUtm(lon: number, lat: number, zona: number): Utm {
  const rad = Math.PI / 180
  const phi = lat * rad
  const lambda = (lon - (zona * 6 - 183)) * rad
  const e = Math.sqrt(F * (2 - F))
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)))
  const xi0 = Math.atan2(t, Math.cos(lambda))
  const eta0 = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t))
  let xi = xi0
  let eta = eta0
  ALFA.forEach((alfa, i) => {
    const j = 2 * (i + 1)
    xi += alfa * Math.sin(j * xi0) * Math.cosh(j * eta0)
    eta += alfa * Math.cos(j * xi0) * Math.sinh(j * eta0)
  })
  return { este: 500000 + K0 * A_RECT * eta, norte: 10000000 + K0 * A_RECT * xi }
}
