import { useEffect, useRef } from 'react'
import { destinoDe, type Encuadre } from '../portal/mapa/api'
import type { MapaProps } from '../portal/mapa/Mapa'

// la vista que informa el doble cuando la pantalla no da un encuadre: abarca el Perú entero, como el mapa real sobre PERU
export const VISTA_DEL_PERU: Encuadre = [-82, -19, -68, 1]

// el Mapa del portal como listas de botones, para probar las pantallas sin MapLibre: cada elemento dibujado es un botón que lo
// elige, como un clic en el mapa (un miembro de un área elige el lugar que dibuja, como MapaImpl). las capas WMS se listan aparte
// con un botón que simula una tesela que falla con 503; el calor dice cuántas celdas dibuja; «Pulsar en el mapa» entrega un punto.
// se instala con vi.mock('../mapa/Mapa', () => import('../../test/mapaFalso')). como el mapa real, informa la vista una vez fijada:
// la que da la pantalla (vistaInicial) o el Perú entero, nunca mientras la pantalla espera
export function Mapa({ etiqueta, capas, seleccion, alSeleccionar, wms, alFallarWms, calor, alPulsar, alMoverVista, vistaInicial }: MapaProps) {
  const esperando = vistaInicial === 'esperar'
  const clave = JSON.stringify(vistaInicial ?? null)
  const fijada = useRef(false)
  useEffect(() => {
    if (fijada.current || esperando || !alMoverVista) return
    fijada.current = true
    alMoverVista(JSON.parse(clave) ?? VISTA_DEL_PERU)
  }, [esperando, clave, alMoverVista])
  return (
    <div>
      <ul aria-label={etiqueta} data-seleccion={seleccion ?? ''}>
        {capas.flatMap((capa) =>
          capa.datos.features.map((e) => (
            <li key={`${capa.id}-${String(e.properties.__id)}`}>
              <button
                type="button"
                data-capa={capa.id}
                data-invisible={capa.invisible ? 'si' : 'no'}
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
      {wms && wms.length > 0 ? (
        <ul aria-label={`${etiqueta} · WMS`}>
          {wms.map((w) => (
            <li key={w.id} data-url={w.url}>
              {w.id}
              <button type="button" onClick={() => alFallarWms?.(w.id, 503)}>
                Tesela que falla {w.id}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {calor ? (
        <p data-testid="calor" data-maximo={calor.maximo}>
          {calor.datos.features.length}
        </p>
      ) : null}
      {alPulsar ? (
        <button type="button" onClick={() => alPulsar([-78.5, -7.9])}>
          Pulsar en el mapa
        </button>
      ) : null}
    </div>
  )
}
