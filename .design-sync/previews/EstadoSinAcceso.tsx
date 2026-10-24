import { EstadoSinAcceso } from 'sgspe-kit'

export const FueraDeUnProyecto = () => (
  <div className="p-6">
    <EstadoSinAcceso que="Inversión social" aQuien={null} volver={{ etiqueta: 'Volver al inicio', a: '/' }} />
  </div>
)

export const EnUnProyecto = () => (
  <div className="p-6">
    <EstadoSinAcceso que="Riesgos" aQuien="Jefatura de relaciones comunitarias" volver={{ etiqueta: 'Volver al resumen del proyecto', a: '/projects/p1' }} />
  </div>
)
