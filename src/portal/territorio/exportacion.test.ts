import { describe, expect, it } from 'vitest'
import { capaExportable, capasExportables, CAPAS_EXPORTABLES, cuerpoDeExportacion, extensionDe, formatoDisponible, nombrePorDefecto } from './exportacion'

// spec F6 §3.5: solo LYR-01 a LYR-16, con la divulgación por objeto de ExportDisclosure (PUBLICO las públicas; EXTERNO suma las
// internas, los accesos y los predios sin partida; sondajes, plataformas, campamento y predios de la empresa solo en INTERNO)
describe('exportación geográfica', () => {
  const capaDe = (id: string) => CAPAS_EXPORTABLES.find((c) => c.capa === id)!
  const nivelesDe = (id: string) => capaDe(id).niveles

  it('los niveles salen de la tabla de divulgación por capa', () => {
    for (const publica of ['LYR-01', 'LYR-02', 'LYR-04', 'LYR-05', 'LYR-07', 'LYR-16']) expect(nivelesDe(publica)).toEqual(['INTERNO', 'EXTERNO', 'PUBLICO'])
    for (const interna of ['LYR-06', 'LYR-08', 'LYR-09', 'LYR-12', 'LYR-13', 'LYR-14']) expect(nivelesDe(interna)).toEqual(['INTERNO', 'EXTERNO'])
    for (const confidencial of ['LYR-10', 'LYR-11', 'LYR-15']) expect(nivelesDe(confidencial)).toEqual(['INTERNO'])
    // LYR-03 no se exporta sola (la exportación de locality no filtra el tipo: salen todas las localidades, hueco H4) y las capas
    // de gestión nunca (ASM-124)
    expect(CAPAS_EXPORTABLES.map((c) => c.capa)).toEqual([
      'LYR-01',
      'LYR-02',
      'LYR-04',
      'LYR-05',
      'LYR-06',
      'LYR-07',
      'LYR-08',
      'LYR-09',
      'LYR-10',
      'LYR-11',
      'LYR-12',
      'LYR-13',
      'LYR-14',
      'LYR-15',
      'LYR-16'
    ])
    expect(CAPAS_EXPORTABLES.filter((c) => c.objetos.some((o) => o.objeto === 'locality'))).toHaveLength(1)
  })

  it('pedir LYR-03 lleva a las localidades enteras; una capa de gestión no se ofrece', () => {
    const capas = CAPAS_EXPORTABLES.slice()
    expect(capaExportable(capas, 'LYR-03')?.capa).toBe('LYR-02')
    expect(capaExportable(capas, 'LYR-10')?.capa).toBe('LYR-10')
    expect(capaExportable(capas, 'LYR-20')).toBeUndefined()
  })

  it('solo se ofrecen las capas con algún objeto que la cuenta lee y exporta', () => {
    const can = (objeto: string, accion: string) => objeto === 'community' || (objeto === 'school' && accion === 'READ')
    expect(capasExportables(can).map((c) => c.capa)).toEqual(['LYR-05'])
    const soloSalud = (objeto: string) => objeto === 'health_facility'
    expect(capasExportables(soloSalud)).toEqual([{ ...capaDe('LYR-16'), objetos: [{ objeto: 'health_facility', geometrias: ['location'] }] }])
  })

  it('el cuerpo lleva el objeto, la geometría, el formato, las coordenadas y los filtros en camelCase', () => {
    expect(
      cuerpoDeExportacion({ capa: capaDe('LYR-14'), objeto: 'land_parcel', geometria: 'boundary', formato: 'gpkg', coordenadas: 'UTM', proyecto: 'p1' })
    ).toEqual({
      object: 'land_parcel',
      geometry: 'boundary',
      format: 'gpkg',
      coordinates: 'UTM',
      filters: { tenureType: ['PROPIEDAD', 'POSESION', 'COMUNAL'], project: ['p1'] }
    })
    expect(
      cuerpoDeExportacion({
        capa: capaDe('LYR-11'),
        objeto: 'project_component',
        geometria: 'footprint',
        formato: 'shp',
        coordenadas: 'LATLON',
        proyecto: 'p1'
      })
    ).toEqual({
      object: 'project_component',
      geometry: 'footprint',
      format: 'shp',
      coordinates: 'LATLON',
      filters: { componentType: ['PLATAFORMA', 'CAMPAMENTO', 'CAPTACION'], project: ['p1'] }
    })
    expect(extensionDe('shp')).toBe('zip')
    expect(extensionDe('gpkg')).toBe('gpkg')
  })

  it('GeoJSON y KML van en LATLON; el proyecto va solo en los objetos acotados por proyecto o con UTM', () => {
    // el servidor valida filters.project en todos los objetos (NOT_ASSIGNED): sin UTM, una capa sin proyecto no lo manda
    expect(
      cuerpoDeExportacion({ capa: capaDe('LYR-05'), objeto: 'community', geometria: 'territory', formato: 'kml', coordenadas: 'UTM', proyecto: 'p1' })
    ).toEqual({ object: 'community', geometry: 'territory', format: 'kml', coordinates: 'LATLON', filters: {} })
    expect(
      cuerpoDeExportacion({ capa: capaDe('LYR-05'), objeto: 'community', geometria: 'territory', formato: 'gpkg', coordenadas: 'UTM', proyecto: 'p1' }).filters
    ).toEqual({ project: ['p1'] })
    for (const [capa, objeto] of [
      ['LYR-07', 'mining_concession'],
      ['LYR-09', 'project'],
      ['LYR-13', 'area_of_influence']
    ]) {
      expect(cuerpoDeExportacion({ capa: capaDe(capa), objeto, geometria: 'boundary', formato: 'csv', coordenadas: 'LATLON', proyecto: 'p1' }).filters).toEqual(
        {
          project: ['p1']
        }
      )
    }
    expect(
      cuerpoDeExportacion({ capa: capaDe('LYR-13'), objeto: 'area_of_influence', geometria: 'boundary', formato: 'csv', coordenadas: 'LATLON' }).filters
    ).toEqual({})
  })

  it('en EXTERNO no manda el filtro fijo de la capa: el servidor aplica el suyo', () => {
    expect(
      cuerpoDeExportacion({
        capa: capaDe('LYR-14'),
        objeto: 'land_parcel',
        geometria: 'boundary',
        formato: 'gpkg',
        coordenadas: 'UTM',
        proyecto: 'p1',
        nivel: 'EXTERNO'
      }).filters
    ).toEqual({ project: ['p1'] })
    expect(
      cuerpoDeExportacion({ capa: capaDe('LYR-12'), objeto: 'project_component', geometria: 'trace', formato: 'csv', coordenadas: 'LATLON', nivel: 'EXTERNO' })
        .filters
    ).toEqual({})
  })

  it('el nombre por defecto sigue al del servidor y los formatos de GDAL siguen la pista de imports/formats', () => {
    expect(nombrePorDefecto('land_parcel', 'EXTERNO', 'shp')).toBe('land-parcel-externo.zip')
    const formatos = [
      { format: 'kml', available: false, multiLayer: true, crsFromFile: false },
      { format: 'gpkg', available: true, multiLayer: true, crsFromFile: true }
    ]
    expect(formatoDisponible('kml', formatos)).toBe(false)
    expect(formatoDisponible('gpkg', formatos)).toBe(true)
    // un formato que la lista no nombra, o sin la lista (un backend sin F6, una cuenta que no la lee): se ofrece
    expect(formatoDisponible('shp', formatos)).toBe(true)
    expect(formatoDisponible('kml', undefined)).toBe(true)
    // GeoJSON, CSV y XLSX no dependen de GDAL
    expect(formatoDisponible('geojson', [{ format: 'geojson', available: false, multiLayer: false, crsFromFile: false }])).toBe(true)
  })
})
