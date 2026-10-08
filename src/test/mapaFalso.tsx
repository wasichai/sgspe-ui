import { destinoDe } from '../portal/mapa/api'
import type { MapaProps } from '../portal/mapa/Mapa'

// el Mapa del portal como una lista de botones, para probar las pantallas sin MapLibre: cada elemento dibujado es un
// botón que lo elige, como un clic en el mapa (un miembro de un área elige el lugar que dibuja, como MapaImpl). se instala
// con vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso'))
export function Mapa({ etiqueta, capas, seleccion, alSeleccionar }: MapaProps) {
  return (
    <ul aria-label={etiqueta} data-seleccion={seleccion ?? ''}>
      {capas.flatMap((capa) =>
        capa.datos.features.map((e) => (
          <li key={`${capa.id}-${String(e.properties.__id)}`}>
            <button
              type="button"
              data-capa={capa.id}
              onClick={() => {
                const destino = destinoDe(e.properties)
                if (destino) alSeleccionar?.(destino.id, capa.id, destino.objeto)
              }}
            >
              {String(e.properties.name ?? e.properties.code ?? e.properties.__id)}
            </button>
          </li>
        ))
      )}
    </ul>
  )
}
