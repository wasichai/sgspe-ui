import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@wasichai/core'
import { useState } from 'react'
import { usePedir } from '../datos/http'
import type { CapaWms } from './Mapa'

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

const CAPACIDADES = '/sgspe/territory/wms?service=WMS&version=1.1.1&request=GetCapabilities'

// GeoServer caído o vencido (spec elección 10): 503 GEOSERVER_UNAVAILABLE del proxy, un 502 o 504 de un intermediario o una
// tesela sin estado (un corte)
const CAIDO = new Set([0, 502, 503, 504])

// las capas de la lista blanca del proxy, de su GetCapabilities (spec §3.3). el proxy lo arma con las capas que GeoServer
// publica: si no responde, 503 (WmsProxy.kt), y entonces el WMS está caído desde el inicio (enmienda 5.1 del plan 6.3). un 404
// (backend sin F6), un 403, un corte o una lista vacía dejan todo por GeoJSON, sin aviso
export function useCapasPublicadas() {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['wms-capabilities'],
    queryFn: async () => {
      const { blob } = await pedir.archivo(CAPACIDADES)
      return leerCapacidades(await blob.text())
    },
    staleTime: 5 * 60_000,
    retry: false
  })
}

const caidoAlPedir = (error: unknown): boolean => error instanceof ApiError && CAIDO.has(error.status)

// las capas encendidas que se dibujan por WMS: las publicadas, mientras GeoServer responda y el proxy no rechace la capa. una
// tesela con 503 (o sin estado) apaga todas (decisión 9 del plan 6.3); un 403 o un 422 saca solo esa. un 503 del GetCapabilities
// es caído desde el inicio. reintentar vuelve a probar el WMS y, si el que falló fue el GetCapabilities, lo vuelve a pedir
export function useWms(encendidas: readonly string[]): {
  wms: CapaWms[]
  porWms: ReadonlySet<string>
  caido: boolean
  alFallar: (id: string, estado: number | null) => void
  reintentar: () => void
} {
  const publicadas = useCapasPublicadas()
  const [teselasCaidas, setTeselasCaidas] = useState(false)
  const [excluidas, setExcluidas] = useState<ReadonlySet<string>>(() => new Set())
  const caido = teselasCaidas || caidoAlPedir(publicadas.error)
  const porCapa = new Map<string, CapaPublicada[]>()
  for (const c of publicadas.data ?? []) porCapa.set(c.capa, [...(porCapa.get(c.capa) ?? []), c])
  const servidas = caido ? [] : encendidas.filter((id) => porCapa.has(id) && !excluidas.has(id))
  return {
    wms: servidas.map((id) => ({ id, url: urlDeWms(porCapa.get(id)!) })),
    porWms: new Set(servidas),
    caido,
    alFallar: (id, estado) => {
      if (estado === null || CAIDO.has(estado)) setTeselasCaidas(true)
      else setExcluidas((x) => (x.has(id) ? x : new Set([...x, id])))
    },
    reintentar: () => {
      setTeselasCaidas(false)
      if (publicadas.isError) void publicadas.refetch()
    }
  }
}
