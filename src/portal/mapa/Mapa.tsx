import { useApiClient, useAuth } from '@wasichai/core'
import type { BasemapSpec } from '@wasichai/gis'
import { Info } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LimiteDeError } from '../componentes/LimiteDeError'
import { NS } from '../i18n'
import { PERU, type Coleccion, type Encuadre } from './api'
import { SIN_MAPA_BASE, useAtribucionDelMapa, useMapaBase } from './mapaBase'
import { firmaDeWms } from './wms'

// el mapa del portal (gis.md §6.5): MapLibre 6.16.0, la versión que fija @wasichai/gis, usado directamente y cargado bajo
// demanda, como el mapa de srtm. el fondo es el mapa base de la organización (/map/settings, mapaBase.tsx) o el que la pantalla
// pase por la prop basemap; «Sin fondo» siempre está disponible y «Sin mapa base» se dice cuando no hay fondo (gis.md §6.4).
// siempre va acompañado de una lista o tabla sincronizada, su alternativa accesible
export interface CapaDibujada {
  id: string
  datos: Coleccion
  color: string
  // la opacidad del relleno, su color si no es el de la línea y el trazo discontinuo de la paleta; sin ellos, 0.15 y línea continua
  relleno?: number
  colorDeRelleno?: string
  trazo?: number[]
  seleccionable: boolean
  // la capa trae miembros de áreas de influencia (LYR-13): se dibujan aparte, con trazo discontinuo
  miembros?: boolean
  // el color del punto según un atributo del elemento (el nivel de un riesgo en LYR-21, la postura que más pesa en LYR-17), con el
  // color de la capa para un valor sin color; con anillo, el color va en el borde de un punto hueco (design-system.md §3.3)
  colorPor?: ColorPorAtributo
  // los puntos son huecos: relleno surface con el color en un borde de 2 px (LYR-02, design-system.md §3.3)
  hueco?: boolean
  // se elige pero no se ve (solo el borde de lo elegido): una capa pública servida por WMS cuyos lugares tienen ficha
  // (decisión 7 del plan 6.3)
  invisible?: boolean
}

export interface ColorPorAtributo {
  campo: string
  // el valor del atributo y su token (o hex de la paleta)
  colores: Readonly<Record<string, string>>
  anillo?: boolean
}

// una capa ráster del proxy WMS: la URL de GetMap de urlDeWms (wms.ts)
export interface CapaWms {
  id: string
  url: string
  opacidad?: number
}

// el mapa de calor: un punto por localidad con su conteo (count), el máximo de la escala y la rampa de la paleta
export interface CapaDeCalor {
  datos: Coleccion
  maximo: number
  colores: readonly string[]
}

export interface MapaProps {
  etiqueta: string
  capas: CapaDibujada[]
  seleccion?: string | null
  // el id del registro elegido, la capa y su objeto (__object, o el __target de un miembro de un área)
  alSeleccionar?: (id: string, capa: string, objeto: string | null) => void
  alMoverVista?: (encuadre: Encuadre) => void
  alMoverCursor?: (punto: [number, number] | null) => void
  // la página recibe la función que devuelve el mapa como PNG (Capturar PNG)
  alCapturar?: (capturar: () => string | null) => void
  // el fondo; sin la prop, el de la organización
  basemap?: BasemapSpec
  // las capas públicas por WMS y el aviso de una tesela que falla, con su estado HTTP (503: GeoServer no responde; null: sin
  // estado, un corte de red)
  wms?: CapaWms[]
  alFallarWms?: (id: string, estado: number | null) => void
  calor?: CapaDeCalor | null
  // el acercamiento máximo al encuadrar lo elegido (16 por omisión, el de una ficha); una lista junto al mapa lo deja más lejos,
  // para que lo elegido se vea entre los demás
  zoomAlElegir?: number
  // un clic en cualquier punto del mapa: [longitud, latitud] (locate)
  alPulsar?: (punto: [number, number]) => void
  // la firma de las peticiones de MapLibre (transformRequest); la pone Mapa con el token de la sesión
  firmar?: (url: string) => { url: string; headers?: Record<string, string> }
  // la vista con la que abre un mapa que acota sus capas por la vista (alMoverVista): un encuadre que la pantalla ya conoce (la
  // ubicación y el área de interés del proyecto), null o ausente para el Perú entero, o 'esperar' mientras la pantalla aún no lo
  // sabe. ese mapa no se encuadra a sus datos, que dependen de la vista, e informa la vista solo una vez fijada
  vistaInicial?: Encuadre | null | 'esperar'
  className?: string
}

// el centro y el zoom del mapa: el que se vuelve a crear con otro fondo nace en la misma cámara
export interface Camara {
  centro: [number, number]
  zoom: number
}

export interface MapaImplProps extends MapaProps {
  camaraPrevia?: () => Camara | null
  alMoverCamara?: (camara: Camara) => void
}

const MapaImpl = lazy(() => import('./MapaImpl'))

export function Mapa({ className, basemap, ...props }: MapaProps) {
  const { t } = useTranslation(NS)
  const { isAdmin } = useAuth()
  const deLaSesion = useMapaBase()
  const atribucion = useAtribucionDelMapa()
  const [sinFondo, setSinFondo] = useState(false)
  const configurado = basemap ?? deLaSesion
  const fondo = sinFondo ? SIN_MAPA_BASE : configurado
  const cliente = useApiClient()
  // el token de la sesión solo para las teselas del proxy (firmaDeWms); se lee en cada petición, así sigue al token vigente
  const firmar = useMemo(() => firmaDeWms(() => cliente.getToken(), window.location.origin), [cliente])
  const camara = useRef<Camara | null>(null)
  const camaraPrevia = useCallback(() => camara.current, [])
  const alMoverCamara = useCallback((c: Camara) => {
    camara.current = c
  }, [])
  // sin mapa (sin WebGL, o el trozo de MapLibre no bajó) nadie informa la vista: se informa la inicial, para que las capas se
  // pidan igual y la lista o la tabla que acompaña al mapa, su alternativa accesible, tenga qué mostrar
  const [fallo, setFallo] = useState(false)
  const respaldo = useRef(false)
  const { alMoverVista, vistaInicial } = props
  useEffect(() => {
    if (!fallo || respaldo.current || !alMoverVista || vistaInicial === 'esperar') return
    respaldo.current = true
    alMoverVista(vistaInicial ?? PERU)
  }, [fallo, alMoverVista, vistaInicial])
  return (
    <div className={className ?? 'relative h-[480px] w-full overflow-hidden rounded-sg-lg border border-sg-border bg-sg-surface-sunken'}>
      <LimiteDeError mensaje={t('mapa.fallo')} alFallar={() => setFallo(true)}>
        <Suspense fallback={<p className="p-4 text-sm text-sg-text-muted">{t('mapa.cargando')}</p>}>
          {/* otro fondo vuelve a crear el mapa (llega una vez por sesión o al elegir «Sin fondo»), en la misma cámara */}
          <MapaImpl key={JSON.stringify(fondo)} {...props} basemap={fondo} firmar={firmar} camaraPrevia={camaraPrevia} alMoverCamara={alMoverCamara} />
        </Suspense>
      </LimiteDeError>
      {/* «Sin mapa base» (§3.3, ASM-085): un aviso info arriba, entre el panel de capas y los controles que una pantalla superpone
          (--sg-mapa-izquierda y --sg-mapa-derecha); no tapa el lienzo ni se confunde con un estado */}
      {fondo.type === 'none' ? (
        <div className="pointer-events-none absolute top-3 right-14 left-3 flex justify-center md:right-[calc(var(--sg-mapa-derecha,0px)+3.5rem)] md:left-[calc(var(--sg-mapa-izquierda,0px)+0.75rem)]">
          <p className="pointer-events-auto flex max-w-md items-start gap-2 rounded-sg-md border-2 border-sg-info bg-sg-surface px-3 py-1.5 text-sg-caption text-sg-text shadow-sg-md">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-sg-info" />
            <span>
              <strong className="font-bold">{t('sig.sinMapaBase')}</strong>
              <span className="block">{t('sig.sinMapaBaseDetalle')}</span>
              {/* U-32: sin mapa base configurado, quien administra lee dónde se configura; con «Sin fondo» elegido, el mapa base
                  existe y no hace falta. quien no administra solo lee que no lo hay */}
              {configurado.type === 'none' && isAdmin ? <span className="block text-sg-text-secondary">{t('sig.dondeSeConfigura')}</span> : null}
            </span>
          </p>
        </div>
      ) : null}
      {/* «Sin fondo», abajo a la izquierda, sobre la escala */}
      {configurado.type !== 'none' ? (
        <button
          type="button"
          aria-pressed={sinFondo}
          onClick={() => setSinFondo(!sinFondo)}
          className="absolute bottom-9 left-2 rounded-sg-sm border border-sg-border-strong bg-sg-surface px-2 py-0.5 text-sg-caption text-sg-text shadow-sg-sm"
        >
          {t('sig.sinFondo')}
        </button>
      ) : null}
      {/* la atribución del proveedor siempre a la vista (gis.md §6.4, MapAttribution) */}
      {fondo.type !== 'none' && atribucion ? (
        <p className="absolute bottom-1 right-2 rounded-sg-sm bg-sg-surface px-1.5 text-sg-caption text-sg-text-muted">{atribucion}</p>
      ) : null}
    </div>
  )
}
