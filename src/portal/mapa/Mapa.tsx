import type { BasemapSpec } from '@wasichai/gis'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LimiteDeError } from '../componentes/LimiteDeError'
import { NS } from '../i18n'
import type { Coleccion, Encuadre } from './api'
import { SIN_MAPA_BASE, useAtribucionDelMapa, useMapaBase } from './mapaBase'

// el mapa del portal (gis.md §6.5): MapLibre 6.10.0, la versión que fija @wasichai/gis, usado directamente y cargado bajo
// demanda, como el mapa de srtm. el fondo es el mapa base de la organización (/map/settings, mapaBase.tsx) o el que la pantalla
// pase por la prop basemap; «Sin fondo» siempre está disponible y «Sin mapa base» se dice cuando no hay fondo (gis.md §6.4).
// siempre va acompañado de una lista o tabla sincronizada, su alternativa accesible
export interface CapaDibujada {
  id: string
  datos: Coleccion
  color: string
  seleccionable: boolean
  // la capa trae miembros de áreas de influencia (LYR-13): se dibujan aparte, con trazo discontinuo
  miembros?: boolean
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
  className?: string
}

const MapaImpl = lazy(() => import('./MapaImpl'))

export function Mapa({ className, basemap, ...props }: MapaProps) {
  const { t } = useTranslation(NS)
  const deLaSesion = useMapaBase()
  const atribucion = useAtribucionDelMapa()
  const [sinFondo, setSinFondo] = useState(false)
  const configurado = basemap ?? deLaSesion
  const fondo = sinFondo ? SIN_MAPA_BASE : configurado
  return (
    <div className={className ?? 'relative h-[480px] w-full overflow-hidden rounded-sg-lg border border-sg-border bg-sg-surface-sunken'}>
      <LimiteDeError mensaje={t('mapa.fallo')}>
        <Suspense fallback={<p className="p-4 text-sm text-sg-text-muted">{t('mapa.cargando')}</p>}>
          {/* otro fondo vuelve a crear el mapa: llega una vez por sesión o al elegir «Sin fondo» */}
          <MapaImpl key={JSON.stringify(fondo)} {...props} basemap={fondo} />
        </Suspense>
      </LimiteDeError>
      <div className="absolute left-2 top-2 flex items-center gap-2">
        {fondo.type === 'none' ? (
          <p className="rounded-sg-sm bg-sg-surface px-2 py-0.5 text-sg-caption text-sg-text-muted shadow-sg-sm">{t('sig.sinMapaBase')}</p>
        ) : null}
        {configurado.type !== 'none' ? (
          <button
            type="button"
            aria-pressed={sinFondo}
            onClick={() => setSinFondo(!sinFondo)}
            className="rounded-sg-sm border border-sg-border bg-sg-surface px-2 py-0.5 text-sg-caption text-sg-text shadow-sg-sm"
          >
            {t('sig.sinFondo')}
          </button>
        ) : null}
      </div>
      {/* la atribución del proveedor siempre a la vista (gis.md §6.4, MapAttribution) */}
      {fondo.type !== 'none' && atribucion ? (
        <p className="absolute bottom-1 right-2 rounded-sg-sm bg-sg-surface px-1.5 text-sg-caption text-sg-text-muted">{atribucion}</p>
      ) : null}
    </div>
  )
}
