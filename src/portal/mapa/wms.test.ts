import { wmsTileUrl, WMS_TILE_SIZE } from '@wasichai/gis'
import { describe, expect, it } from 'vitest'
import { CAPACIDADES_WMS } from '../../test/sig'
import { CAPAS_WMS, firmaDeWms, leerCapacidades, urlDeWms } from './wms'

// spec F6 §3.3 y gis.md §6.2: las capas públicas por el proxy; el portal no conoce tablas físicas: lee el GetCapabilities del
// proxy (WMS 1.3.0 con espacio de nombres por defecto, WmsCapabilities) y reconoce cada capa por su estilo sgspe-lyr-NN o
// sgspe-lyr-NN-<variante> (model/layers.json). una capa física puede llevar varios estilos (LYR-02 ubicación y LYR-03 comparten
// la de las localidades): una entrada por estilo reconocido. el token va solo a las teselas del proxy, nunca a otro host
describe('WMS por el proxy', () => {
  it('las capas públicas son LYR-01 a 05, 07 y 16', () => {
    expect(CAPAS_WMS).toEqual(['LYR-01', 'LYR-02', 'LYR-03', 'LYR-04', 'LYR-05', 'LYR-07', 'LYR-16'])
  })

  it('lee una entrada por cada estilo reconocido del GetCapabilities del proxy, con su espacio de nombres 1.3.0', () => {
    expect(leerCapacidades(CAPACIDADES_WMS)).toEqual([
      { capa: 'LYR-01', nombre: 't_admin__boundary', estilo: 'sgspe-lyr-01' },
      { capa: 'LYR-02', nombre: 't_locality__location', estilo: 'sgspe-lyr-02-location' },
      { capa: 'LYR-03', nombre: 't_locality__location', estilo: 'sgspe-lyr-03' },
      { capa: 'LYR-05', nombre: 't_community__territory', estilo: 'sgspe-lyr-05' }
    ])
  })

  it('reconoce los estilos con variante (límite de localidad, escuelas y salud) y descarta lo que no es de la lista blanca', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms"><Capability><Layer><Title>SGSPE</Title>
<Layer queryable="0"><Name>t_locality__boundary</Name><Title>LYR-02 · Localidad</Title><Style><Name>sgspe-lyr-02-boundary</Name><Title>sgspe-lyr-02-boundary</Title></Style></Layer>
<Layer queryable="0"><Name>t_school__location</Name><Title>LYR-16 · Escuela</Title><Style><Name>sgspe-lyr-16-school</Name><Title>sgspe-lyr-16-school</Title></Style></Layer>
<Layer queryable="0"><Name>t_health_facility__location</Name><Title>LYR-16 · Salud</Title><Style><Name>sgspe-lyr-16-health</Name><Title>sgspe-lyr-16-health</Title></Style></Layer>
<Layer queryable="0"><Name>t_otra__location</Name><Title>Otra</Title><Style><Name>sgspe-lyr-13</Name></Style><Style><Name>otro</Name></Style><Style><Name>sgspe-lyr-05-x-y</Name></Style></Layer>
<Layer queryable="0"><Title>Sin nombre</Title><Style><Name>sgspe-lyr-01</Name></Style></Layer>
</Layer></Capability></WMS_Capabilities>`
    expect(leerCapacidades(xml)).toEqual([
      { capa: 'LYR-02', nombre: 't_locality__boundary', estilo: 'sgspe-lyr-02-boundary' },
      { capa: 'LYR-16', nombre: 't_school__location', estilo: 'sgspe-lyr-16-school' },
      { capa: 'LYR-16', nombre: 't_health_facility__location', estilo: 'sgspe-lyr-16-health' }
    ])
    expect(
      leerCapacidades('<WMT_MS_Capabilities><Capability><Layer><Name>x</Name><Style><Name>otro</Name></Style></Layer></Capability></WMT_MS_Capabilities>')
    ).toEqual([])
    expect(leerCapacidades('no es xml')).toEqual([])
    expect(leerCapacidades('')).toEqual([])
  })

  it('arma la URL de GetMap del proxy con las capas de una LYR y sus estilos siempre explícitos, en 1.1.1 y en el mismo origen', () => {
    expect(urlDeWms([{ capa: 'LYR-03', nombre: 't_locality__location', estilo: 'sgspe-lyr-03' }], 'https://sgspe.example')).toBe(
      'https://sgspe.example/api/sgspe/territory/wms?service=WMS&version=1.1.1&request=GetMap&layers=t_locality__location&styles=sgspe-lyr-03'
    )
    expect(
      urlDeWms(
        [
          { capa: 'LYR-16', nombre: 't_school__location', estilo: 'sgspe-lyr-16-school' },
          { capa: 'LYR-16', nombre: 't_health_facility__location', estilo: 'sgspe-lyr-16-health' }
        ],
        'https://sgspe.example'
      )
    ).toBe(
      'https://sgspe.example/api/sgspe/territory/wms?service=WMS&version=1.1.1&request=GetMap&layers=t_school__location,t_health_facility__location&styles=sgspe-lyr-16-school,sgspe-lyr-16-health'
    )
  })

  it('la tesela de wmsTileUrl solo lleva parámetros de la lista blanca del proxy, cada uno una vez', () => {
    const permitidos = ['SERVICE', 'VERSION', 'REQUEST', 'LAYERS', 'STYLES', 'BBOX', 'SRS', 'WIDTH', 'HEIGHT', 'FORMAT', 'TRANSPARENT']
    const tesela = wmsTileUrl(urlDeWms([{ capa: 'LYR-05', nombre: 't_community__territory', estilo: 'sgspe-lyr-05' }], 'https://sgspe.example'), WMS_TILE_SIZE)
    const claves = [...new URL(tesela).searchParams.keys()].map((k) => k.toUpperCase())
    expect(new Set(claves).size).toBe(claves.length)
    expect([...claves].sort()).toEqual([...permitidos].sort())
    expect(new URL(tesela).searchParams.get('version')).toBe('1.1.1')
    expect(new URL(tesela).searchParams.get('srs')).toBe('EPSG:3857')
    expect(new URL(tesela).searchParams.get('styles')).toBe('sgspe-lyr-05')
  })

  it('firma con el token solo las teselas del proxy del mismo origen', () => {
    const firmar = firmaDeWms(() => 't-1', 'https://sgspe.example')
    expect(firmar('https://sgspe.example/api/sgspe/territory/wms?request=GetMap')).toEqual({
      url: 'https://sgspe.example/api/sgspe/territory/wms?request=GetMap',
      headers: { Authorization: 'Bearer t-1' }
    })
    expect(firmar('https://mapas.example/estilo.json')).toEqual({ url: 'https://mapas.example/estilo.json' })
    expect(firmar('https://otro.example/api/sgspe/territory/wms?x')).toEqual({ url: 'https://otro.example/api/sgspe/territory/wms?x' })
    expect(firmar('https://sgspe.example/api/sgspe/territory/wmsx?x')).toEqual({ url: 'https://sgspe.example/api/sgspe/territory/wmsx?x' })
    expect(firmar('https://sgspe.example.otro.example/api/sgspe/territory/wms?x')).toEqual({
      url: 'https://sgspe.example.otro.example/api/sgspe/territory/wms?x'
    })
    expect(firmaDeWms(() => null, 'https://sgspe.example')('https://sgspe.example/api/sgspe/territory/wms')).toEqual({
      url: 'https://sgspe.example/api/sgspe/territory/wms'
    })
  })
})
