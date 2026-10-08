import { Component, lazy, Suspense, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import type { Coleccion, Encuadre } from './api'

// el mapa del portal (gis.md §6.5): MapLibre 6.10.0, la versión que fija @wasichai/gis, usado directamente y cargado bajo
// demanda, como el mapa de srtm. el fondo es el estilo configurable del despliegue (ESTILO_DEL_MAPA_BASE) o el fondo
// apagado de tokens.css. siempre va acompañado de una lista o tabla sincronizada, su alternativa accesible
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
  className?: string
}

const MapaImpl = lazy(() => import('./MapaImpl'))

// si el chunk de MapLibre no baja o el navegador no tiene WebGL, el mapa dice por qué no está en lugar de tirar la pantalla:
// la lista o tabla que lo acompaña sigue funcionando
class LimiteDeError extends Component<{ mensaje: string; children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() {
    return { fallo: true }
  }
  render() {
    return this.state.fallo ? (
      <p role="alert" className="p-4 text-sm text-sg-text-muted">
        {this.props.mensaje}
      </p>
    ) : (
      this.props.children
    )
  }
}

export function Mapa({ className, ...props }: MapaProps) {
  const { t } = useTranslation(NS)
  return (
    <div className={className ?? 'relative h-[480px] w-full overflow-hidden rounded-sg-lg border border-sg-border bg-sg-surface-sunken'}>
      <LimiteDeError mensaje={t('mapa.fallo')}>
        <Suspense fallback={<p className="p-4 text-sm text-sg-text-muted">{t('mapa.cargando')}</p>}>
          <MapaImpl {...props} />
        </Suspense>
      </LimiteDeError>
    </div>
  )
}
