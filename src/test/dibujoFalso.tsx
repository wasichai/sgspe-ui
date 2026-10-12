import type { DibujoProps } from '../portal/mapa/Dibujo'
import { CUADRADO, LAZO, PUNTO } from './sig'

// el dibujo de @wasichai/gis (GeometryField sobre MapLibre y terra-draw) como botones que dibujan geometrías sintéticas, para
// probar las pantallas sin WebGL. se instala con vi.mock('../mapa/Dibujo', () => import('../../test/dibujoFalso'))
export function Dibujo({ etiqueta, tipo, valor, alCambiar }: DibujoProps) {
  return (
    <div role="group" aria-label={etiqueta} data-tipo={tipo} data-valor={valor ? JSON.stringify(valor) : ''}>
      <button type="button" onClick={() => alCambiar(CUADRADO)}>
        Dibujar un cuadrado de prueba
      </button>
      <button type="button" onClick={() => alCambiar(LAZO)}>
        Dibujar un lazo de prueba
      </button>
      <button type="button" onClick={() => alCambiar(PUNTO)}>
        Dibujar un punto de prueba
      </button>
      <button type="button" onClick={() => alCambiar(null)}>
        Borrar el dibujo de prueba
      </button>
    </div>
  )
}
